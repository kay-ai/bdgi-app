import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, humanCode, lookupHash } from "@/lib/crypto";
import { receiptAmount } from "@/server/receipts/pdf";
import {
  consoleSimulatesFailure,
  paymentsProvider,
  paystackAdapter,
  PaymentsError,
  type Currency,
} from "@/server/providers/payments";
import type { DonationInput } from "@/server/validation/donation";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { hit } from "./rate-limit";
import { receiptMessage } from "./receipts";

export { donationInput } from "@/server/validation/donation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = Tx | typeof db;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const newReference = () => `BGDI-${humanCode(10)}`;

/** Log lines carry the reference and event only, never names, emails or amounts tied to a person. */
const log = (msg: string, extra?: Record<string, string | number | boolean | null>) =>
  console.info(`[donations] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);

/** Revalidate pages that show money raised. Outside a Next request (tests, scripts) this is a no-op. */
async function revalidateProgress() {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/[locale]/(site)/programmes/[slug]", "page");
  } catch {
    /* not in a request */
  }
}

async function upsertSupporter(
  tx: Exec,
  input: { name: string; email: string; phone?: string; wantsUpdates?: boolean },
): Promise<{ id: string; isNew: boolean }> {
  const hash = lookupHash(input.email);
  const [existing] = await tx.select().from(s.supporter).where(eq(s.supporter.emailHash, hash));
  if (existing) {
    await tx
      .update(s.supporter)
      .set({
        name: input.name,
        ...(input.phone ? { phone: encrypt(input.phone) } : {}),
        // Ticking the box opts in; leaving it unticked on a later gift never silently opts out.
        ...(input.wantsUpdates ? { wantsUpdates: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(s.supporter.id, existing.id));
    return { id: existing.id, isNew: false };
  }
  const [row] = await tx
    .insert(s.supporter)
    .values({
      name: input.name,
      email: encrypt(input.email),
      emailHash: hash,
      phone: encrypt(input.phone ?? null),
      wantsUpdates: !!input.wantsUpdates,
    })
    .returning({ id: s.supporter.id });
  return { id: row!.id, isNew: true };
}

/** Monthly gifts use a Paystack plan per amount and currency, created on first use and cached in `setting`. */
async function planFor(amountMinor: number, currency: Currency): Promise<string> {
  const key = `${currency}:${amountMinor}`;
  const [row] = await db.select().from(s.setting).where(eq(s.setting.key, "paystack_plans"));
  const plans = (row?.value ?? {}) as Record<string, string>;
  if (plans[key]) return plans[key];
  const code = await paymentsProvider().createPlan({
    name: `BGDI monthly ${receiptAmount(amountMinor, currency)}`,
    amountMinor,
    currency,
  });
  const next = { ...plans, [key]: code };
  await db
    .insert(s.setting)
    .values({ key: "paystack_plans", value: next })
    .onConflictDoUpdate({ target: s.setting.key, set: { value: next, updatedAt: new Date() } });
  return code;
}

async function campaignId(code: string | null | undefined) {
  if (!code || !/^[0-9A-Z]{8}$/.test(code)) return null;
  const [c] = await db.select({ id: s.campaign.id }).from(s.campaign).where(eq(s.campaign.code, code));
  return c?.id ?? null;
}

export type InitiateResult =
  | { ok: true; reference: string; redirectUrl: string | null }
  | { ok: false; code: "rate_limited" | "designation" | "currency" | "provider" };

/**
 * `donations.initiate` (spec/11 §2.1). Creates the supporter and an `initiated` donation, then asks
 * the provider for a checkout. Paystack returns its hosted page; the console provider settles the
 * gift at once (paid, or failed for amounts ending in 13) and the donor goes to the thank-you page.
 */
export async function initiateDonation(
  ctx: Ctx,
  input: DonationInput,
  opts: { campaignCode?: string | null } = {},
): Promise<InitiateResult> {
  if (ctx.ip && !(await hit(`donate:${ctx.ip}`, 10, 3600))) return { ok: false, code: "rate_limited" };

  if (input.currency === "USD") {
    const [usd] = await db.select().from(s.setting).where(eq(s.setting.key, "donations_usd_enabled"));
    if (usd?.value !== true) return { ok: false, code: "currency" };
  }
  if (input.designation) {
    const [p] = await db
      .select({ ok: s.programme.acceptsDesignatedGifts })
      .from(s.programme)
      .where(eq(s.programme.id, input.designation));
    if (!p?.ok) return { ok: false, code: "designation" };
  }

  const provider = paymentsProvider();
  const reference = newReference();
  const amountMinor = input.amount * 100;
  const sourceCampaignId = await campaignId(opts.campaignCode);

  const donationId = await db.transaction(async (tx) => {
    const sup = await upsertSupporter(tx, input);
    const [d] = await tx
      .insert(s.donation)
      .values({
        supporterId: sup.id,
        reference,
        amountMinor,
        currency: input.currency,
        frequency: input.frequency,
        designationProgrammeId: input.designation || null,
        status: "initiated",
        provider: provider.name,
        isAnonymous: input.isAnonymous,
        message: encrypt(input.message ?? null),
        sourceCampaignId,
      })
      .returning({ id: s.donation.id });
    await audit(tx, ctx, { action: "donation.initiate", entityType: "donation", entityId: d!.id, meta: { provider: provider.name } });
    return d!.id;
  });

  if (provider.name === "console") {
    if (consoleSimulatesFailure(amountMinor)) {
      await markDonationFailed(ctx, reference);
    } else {
      await markDonationPaid(ctx, reference, {
        amountMinor,
        currency: input.currency,
        feeMinor: 0,
        paidAt: new Date(),
        providerReference: `console-${reference}`,
      });
    }
    return { ok: true, reference, redirectUrl: null };
  }

  try {
    const plan = input.frequency === "monthly" ? await planFor(amountMinor, input.currency) : undefined;
    const { authorizationUrl } = await provider.initialize({
      reference,
      amountMinor,
      currency: input.currency,
      email: input.email,
      callbackUrl: `${appUrl()}/donate/thank-you?ref=${encodeURIComponent(reference)}`,
      metadata: { donation_id: donationId, designation: input.designation || "general", frequency: input.frequency },
      plan,
    });
    log("initiated", { reference, provider: provider.name });
    return { ok: true, reference, redirectUrl: authorizationUrl };
  } catch (e) {
    log("initialize failed", { reference, error: e instanceof PaymentsError ? e.message : "unexpected" });
    await db.update(s.donation).set({ status: "failed", updatedAt: new Date() }).where(eq(s.donation.reference, reference));
    return { ok: false, code: "provider" };
  }
}

type Settlement = {
  amountMinor: number;
  currency: string;
  feeMinor: number | null;
  paidAt: Date | null;
  providerReference: string | null;
};

/** Queue the receipt email for a paid donation, inside the caller's transaction. */
async function queueReceipt(tx: Exec, donationId: string, eventKey: string) {
  const r = await receiptMessage(tx, donationId);
  if (!r) return null;
  return queueTemplate({ templateKey: "donation.receipt", to: r.to, channel: "email", vars: r.vars, eventKey }, tx);
}

/**
 * Mark an `initiated` donation paid. Idempotent: the update only matches while the row is still
 * `initiated`, so a replayed webhook or a second thank-you visit changes nothing and sends nothing.
 * Returns true when this call made the change.
 */
export async function markDonationPaid(ctx: Ctx, reference: string, st: Settlement): Promise<boolean> {
  const ids: string[] = [];
  const changed = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(s.donation).where(eq(s.donation.reference, reference));
    if (!current || current.status !== "initiated") return false;
    if (current.amountMinor !== st.amountMinor || current.currency !== st.currency) {
      await audit(tx, ctx, {
        action: "donation.amount_mismatch",
        entityType: "donation",
        entityId: current.id,
        meta: { expected: current.amountMinor, got: st.amountMinor, currency: st.currency },
      });
      log("amount mismatch; not marked paid", { reference });
      return false;
    }
    const [d] = await tx
      .update(s.donation)
      .set({
        status: "paid",
        paidAt: st.paidAt ?? new Date(),
        providerFeeMinor: st.feeMinor,
        providerReference: st.providerReference,
        receiptCode: humanCode(),
        updatedAt: new Date(),
      })
      .where(and(eq(s.donation.reference, reference), eq(s.donation.status, "initiated")))
      .returning({ id: s.donation.id });
    if (!d) return false;
    const id = await queueReceipt(tx, d.id, `donation.receipt:${d.id}`);
    if (id) ids.push(id);
    await audit(tx, ctx, { action: "donation.paid", entityType: "donation", entityId: d.id, meta: { provider: current.provider } });
    return true;
  });
  if (changed) {
    log("paid", { reference });
    await dispatch(ids).catch(() => log("receipt dispatch failed", { reference }));
    await revalidateProgress();
  }
  return changed;
}

export async function markDonationFailed(ctx: Ctx, reference: string): Promise<boolean> {
  const [d] = await db
    .update(s.donation)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(s.donation.reference, reference), eq(s.donation.status, "initiated")))
    .returning({ id: s.donation.id });
  if (!d) return false;
  await audit(db, ctx, { action: "donation.failed", entityType: "donation", entityId: d.id });
  log("failed", { reference });
  return true;
}

/**
 * The thank-you page (spec/11 §2.2) asks Paystack for the result rather than trusting the query
 * string, and settles the donation if the webhook has not arrived yet.
 */
export async function confirmDonation(reference: string) {
  if (!/^BGDI-[0-9A-Z]{8,12}$/.test(reference)) return null;
  let d = await getDonationByReference(reference);
  if (!d) return null;
  if (d.status === "initiated" && d.provider === "paystack") {
    try {
      const v = await paystackAdapter.verify(reference);
      const ctx: Ctx = { actor: null, locale: "en", ip: null };
      if (v.status === "success") await markDonationPaid(ctx, reference, v);
      else if (v.status === "failed") await markDonationFailed(ctx, reference);
      d = await getDonationByReference(reference);
    } catch (e) {
      log("verify failed", { reference, error: e instanceof PaymentsError ? e.message : "unexpected" });
    }
  }
  if (!d) return null;
  return { reference: d.reference, status: d.status, amountMinor: d.amountMinor, currency: d.currency, frequency: d.frequency };
}

export async function getDonationByReference(reference: string) {
  const [d] = await db.select().from(s.donation).where(eq(s.donation.reference, reference));
  return d ?? null;
}

/* ---------- Paystack webhook (spec/11 §2.3) ---------- */

type PaystackCustomer = { email?: string; first_name?: string | null; last_name?: string | null };
type PaystackEvent = {
  event: string;
  data: {
    reference?: string;
    amount?: number;
    currency?: string;
    fees?: number | null;
    paid_at?: string | null;
    id?: number;
    status?: string;
    plan?: { plan_code?: string } | string | null;
    customer?: PaystackCustomer;
    subscription_code?: string;
    invoice_code?: string;
    subscription?: { subscription_code?: string };
  };
};

const webhookCtx: Ctx = { actor: null, locale: "en", ip: null };

export type WebhookResult = { status: 200 | 400 | 401; body: string };

/** Verify, then handle. Always answers 200 to a genuine event (Paystack retries anything else). */
export async function handlePaystackWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  let valid = false;
  try {
    valid = paystackAdapter.verifyWebhook(rawBody, signature);
  } catch (e) {
    log("webhook secret unavailable", { error: e instanceof Error ? e.message : "unexpected" });
  }
  if (!valid) {
    log("webhook rejected: bad signature");
    return { status: 401, body: "invalid signature" };
  }

  let evt: PaystackEvent;
  try {
    evt = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return { status: 400, body: "invalid json" };
  }
  if (!evt?.event || !evt.data) return { status: 400, body: "invalid event" };

  switch (evt.event) {
    case "charge.success":
      await onChargeSuccess(evt.data);
      break;
    case "subscription.create":
      await onSubscriptionCreate(evt.data);
      break;
    case "invoice.payment_failed":
      await onInvoiceFailed(evt.data);
      break;
    case "subscription.disable":
    case "subscription.not_renew":
      await onSubscriptionDisable(evt.data);
      break;
    default:
      log("webhook ignored", { event: evt.event });
  }
  return { status: 200, body: "ok" };
}

const planCode = (plan: PaystackEvent["data"]["plan"]) =>
  typeof plan === "string" ? plan || null : plan?.plan_code ?? null;

async function onChargeSuccess(data: PaystackEvent["data"]) {
  const reference = data.reference;
  if (!reference || typeof data.amount !== "number" || !data.currency) return;
  const settlement: Settlement = {
    amountMinor: data.amount,
    currency: data.currency,
    feeMinor: data.fees ?? null,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    providerReference: data.id ? String(data.id) : null,
  };

  const existing = await getDonationByReference(reference);
  if (existing) {
    await markDonationPaid(webhookCtx, reference, settlement);
    return;
  }
  // A reference we did not create: a renewal of a monthly gift (Paystack makes the reference).
  if (planCode(data.plan) && data.customer?.email && (data.currency === "NGN" || data.currency === "USD")) {
    await recordRenewal(reference, data.customer, settlement);
    return;
  }
  log("charge.success for unknown reference ignored", { reference });
}

/** The latest monthly Paystack gift from this supporter at this amount: the subscription a renewal belongs to. */
async function parentGift(exec: Exec, supporterId: string, amountMinor: number, currency: string) {
  const [p] = await exec
    .select()
    .from(s.donation)
    .where(
      and(
        eq(s.donation.supporterId, supporterId),
        eq(s.donation.frequency, "monthly"),
        eq(s.donation.provider, "paystack"),
        eq(s.donation.amountMinor, amountMinor),
        eq(s.donation.currency, currency as Currency),
      ),
    )
    .orderBy(desc(s.donation.createdAt))
    .limit(1);
  return p ?? null;
}

async function recordRenewal(reference: string, customer: PaystackCustomer, st: Settlement) {
  const ids: string[] = [];
  const created = await db.transaction(async (tx) => {
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Supporter";
    const sup = await upsertSupporter(tx, { name, email: customer.email! });
    const parent = await parentGift(tx, sup.id, st.amountMinor, st.currency);
    const [d] = await tx
      .insert(s.donation)
      .values({
        supporterId: sup.id,
        reference,
        amountMinor: st.amountMinor,
        currency: st.currency as Currency,
        frequency: "monthly",
        designationProgrammeId: parent?.designationProgrammeId ?? null,
        status: "paid",
        provider: "paystack",
        providerReference: st.providerReference,
        providerFeeMinor: st.feeMinor,
        paidAt: st.paidAt ?? new Date(),
        receiptCode: humanCode(),
        isAnonymous: parent?.isAnonymous ?? false,
        subscriptionCode: parent?.subscriptionCode ?? null,
        sourceCampaignId: parent?.sourceCampaignId ?? null,
      })
      .onConflictDoNothing({ target: s.donation.reference })
      .returning({ id: s.donation.id });
    if (!d) return false;
    const id = await queueReceipt(tx, d.id, `donation.receipt:${d.id}`);
    if (id) ids.push(id);
    await audit(tx, webhookCtx, { action: "donation.paid", entityType: "donation", entityId: d.id, meta: { provider: "paystack", renewal: true } });
    return true;
  });
  if (created) {
    log("renewal paid", { reference });
    await dispatch(ids).catch(() => log("receipt dispatch failed", { reference }));
    await revalidateProgress();
  }
}

/** Link the subscription code to the first monthly gift that started it. */
async function onSubscriptionCreate(data: PaystackEvent["data"]) {
  const code = data.subscription_code;
  const email = data.customer?.email;
  if (!code || !email) return;
  const [sup] = await db.select({ id: s.supporter.id }).from(s.supporter).where(eq(s.supporter.emailHash, lookupHash(email)));
  if (!sup) return;
  const [d] = await db
    .select({ id: s.donation.id })
    .from(s.donation)
    .where(
      and(
        eq(s.donation.supporterId, sup.id),
        eq(s.donation.frequency, "monthly"),
        eq(s.donation.provider, "paystack"),
        isNull(s.donation.subscriptionCode),
        ...(typeof data.amount === "number" ? [eq(s.donation.amountMinor, data.amount)] : []),
      ),
    )
    .orderBy(desc(s.donation.createdAt))
    .limit(1);
  if (!d) return;
  await db.update(s.donation).set({ subscriptionCode: code, updatedAt: new Date() }).where(eq(s.donation.id, d.id));
  await audit(db, webhookCtx, { action: "donation.subscription_linked", entityType: "donation", entityId: d.id });
}

/** A monthly renewal failed: record a failed row (once per invoice) and tell the donor. */
async function onInvoiceFailed(data: PaystackEvent["data"]) {
  const invoice = data.invoice_code;
  const email = data.customer?.email;
  const subCode = data.subscription?.subscription_code ?? data.subscription_code ?? null;
  if (!invoice || !email || typeof data.amount !== "number") return;
  const reference = `BGDI-INV-${invoice.replace(/[^0-9A-Za-z]/g, "").toUpperCase()}`.slice(0, 40);
  const currency: Currency = data.currency === "USD" ? "USD" : "NGN";
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const name = [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(" ").trim() || "Supporter";
    const sup = await upsertSupporter(tx, { name, email });
    const parent = await parentGift(tx, sup.id, data.amount!, currency);
    const [d] = await tx
      .insert(s.donation)
      .values({
        supporterId: sup.id,
        reference,
        amountMinor: data.amount!,
        currency,
        frequency: "monthly",
        designationProgrammeId: parent?.designationProgrammeId ?? null,
        status: "failed",
        provider: "paystack",
        subscriptionCode: subCode,
        isAnonymous: parent?.isAnonymous ?? false,
      })
      .onConflictDoNothing({ target: s.donation.reference })
      .returning({ id: s.donation.id });
    if (!d) return;
    const id = await queueTemplate(
      { templateKey: "donation.failed", to: email, channel: "email", vars: { link: `${appUrl()}/donate` }, eventKey: `donation.failed:${reference}` },
      tx,
    );
    if (id) ids.push(id);
    await audit(tx, webhookCtx, { action: "donation.failed", entityType: "donation", entityId: d.id, meta: { renewal: true } });
  });
  await dispatch(ids).catch(() => log("failed-notice dispatch failed", { reference }));
}

async function onSubscriptionDisable(data: PaystackEvent["data"]) {
  const code = data.subscription_code;
  if (!code) return;
  const [d] = await db
    .select({ id: s.donation.id })
    .from(s.donation)
    .where(eq(s.donation.subscriptionCode, code))
    .orderBy(desc(s.donation.createdAt))
    .limit(1);
  if (d) await audit(db, webhookCtx, { action: "donation.subscription_disabled", entityType: "donation", entityId: d.id });
}

/* ---------- Public progress (spec/11 §3) ---------- */

/** Money raised for a programme in its target currency. NGN and USD are never added together. */
export async function raisedFor(programmeId: string, currency: string) {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${s.donation.amountMinor}), 0)::bigint` })
    .from(s.donation)
    .where(
      and(
        eq(s.donation.designationProgrammeId, programmeId),
        eq(s.donation.status, "paid"),
        eq(s.donation.currency, currency as Currency),
      ),
    );
  return Number(r?.total ?? 0);
}
