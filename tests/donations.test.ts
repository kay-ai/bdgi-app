import { randomBytes } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { signPaystackBody } from "@/lib/paystack-signature";
import { consoleOutbox } from "@/server/providers";
import { confirmDonation, initiateDonation } from "@/server/services/donations";
import {
  donationTotals,
  exportDonationsCsv,
  getSupporter,
  listDonations,
  markRefunded,
  recordOfflineGift,
  resendReceipt,
} from "@/server/services/console-donations";
import { ConsoleDenied } from "@/server/services/console-access";
import { verifyReceipt } from "@/server/services/receipts";
import { donationFilters, donationInput, type DonationInput } from "@/server/validation/donation";
import { POST as webhook } from "@/app/api/webhooks/paystack/route";
import { setupDb } from "./support/db";

/**
 * M2 acceptance (spec/14): Paystack test-mode donations end to end against an in-memory database.
 * Paystack's API is replaced by a fake `fetch`; the secret below is a throwaway made up for this run
 * (it is never sent anywhere), standing in for a `sk_test_` key.
 */
const SECRET = `sk_test_${randomBytes(20).toString("hex")}`;
const ctx = { actor: null, locale: "en" as const, ip: null };

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let verifyResponse: Record<string, unknown> | null = null;

function fakePaystack() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    const ok = (data: unknown) => new Response(JSON.stringify({ status: true, message: "ok", data }), { status: 200 });
    if (url.endsWith("/transaction/initialize"))
      return ok({ authorization_url: `https://checkout.paystack.com/${body!.reference}`, reference: body!.reference });
    if (url.endsWith("/plan")) return ok({ plan_code: `PLN_${String(body!.amount)}` });
    if (url.includes("/transaction/verify/")) return ok(verifyResponse);
    if (url.includes("/manage/link")) return ok({ link: "https://paystack.com/manage/subscriptions/test" });
    return new Response(JSON.stringify({ status: false, message: "not found" }), { status: 404 });
  });
}

const gift = (over: Partial<DonationInput> = {}): DonationInput =>
  donationInput.parse({
    amount: 5000,
    currency: "NGN",
    frequency: "one_off",
    designation: "",
    name: "Test Donor",
    email: `donor-${randomBytes(4).toString("hex")}@example.test`,
    isAnonymous: false,
    wantsUpdates: true,
    ...over,
  });

const chargeSuccess = (reference: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({
    event: "charge.success",
    data: {
      id: 4099260516,
      status: "success",
      reference,
      amount: 500000,
      currency: "NGN",
      fees: 17500,
      paid_at: "2026-11-17T10:00:00.000Z",
      customer: { email: "donor@example.test", first_name: "Test", last_name: "Donor" },
      plan: {},
      ...over,
    },
  });

const post = (body: string, signature: string | null) =>
  webhook(
    new Request("http://localhost/api/webhooks/paystack", {
      method: "POST",
      body,
      headers: signature ? { "x-paystack-signature": signature, "content-type": "application/json" } : {},
    }),
  );

async function countRows() {
  const [d] = await db.select({ n: count() }).from(s.donation);
  const [m] = await db.select({ n: count() }).from(s.message);
  const [a] = await db.select({ n: count() }).from(s.auditEvent).where(eq(s.auditEvent.action, "donation.paid"));
  return { donations: d!.n, messages: m!.n, paidAudits: a!.n, outbox: consoleOutbox.length };
}

beforeAll(async () => {
  await setupDb();
});

beforeEach(() => {
  calls = [];
  verifyResponse = null;
  vi.stubEnv("PAYMENTS_PROVIDER", "paystack");
  vi.stubEnv("PAYSTACK_SECRET_KEY", SECRET);
  vi.stubEnv("APP_URL", "https://bgdi.test");
  vi.stubGlobal("fetch", fakePaystack());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("M2: a test-mode NGN donation", () => {
  it("initiates, the webhook marks it paid, a receipt PDF is emailed, and the console shows it", async () => {
    const input = gift();
    const started = await initiateDonation(ctx, input);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.redirectUrl).toBe(`https://checkout.paystack.com/${started.reference}`);

    // Paystack was asked for a checkout in kobo, NGN, with a callback to the thank-you page.
    const init = calls.find((c) => c.url.endsWith("/transaction/initialize"))!;
    expect(init.method).toBe("POST");
    expect(init.body).toMatchObject({
      amount: 500000,
      currency: "NGN",
      email: input.email,
      reference: started.reference,
      callback_url: `https://bgdi.test/donate/thank-you?ref=${started.reference}`,
    });
    expect(init.body!.plan).toBeUndefined();

    let [row] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));
    expect(row!.status).toBe("initiated");
    expect(row!.provider).toBe("paystack");

    const outboxBefore = consoleOutbox.length;
    const body = chargeSuccess(started.reference, { customer: { email: input.email } });
    const res = await post(body, signPaystackBody(body, SECRET));
    expect(res.status).toBe(200);

    [row] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));
    expect(row!.status).toBe("paid");
    expect(row!.providerFeeMinor).toBe(17500);
    expect(row!.paidAt?.toISOString()).toBe("2026-11-17T10:00:00.000Z");
    expect(row!.providerReference).toBe("4099260516");
    expect(row!.receiptCode).toMatch(/^[0-9A-Z]{8}$/);

    // Receipt: one message row, sent, with the PDF attached.
    const msgs = await db.select().from(s.message).where(eq(s.message.eventKey, `donation.receipt:${row!.id}`));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.status).toBe("sent");
    expect(JSON.stringify(msgs[0]!.variables)).not.toContain(input.email);
    expect(JSON.stringify(msgs[0]!.variables)).not.toContain("Test Donor");

    expect(consoleOutbox.length).toBe(outboxBefore + 1);
    const sent = consoleOutbox.at(-1)!;
    expect(sent.channel).toBe("email");
    expect(sent.to).toBe(input.email);
    expect(sent.subject).toBe("Thank you for your gift to BGDI");
    expect(sent.body).toContain("NGN 5,000.00");
    expect(sent.body).toContain(started.reference);
    expect(sent.attachments).toHaveLength(1);
    const pdf = sent.attachments![0]!;
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.filename).toBe(`BGDI-receipt-${row!.receiptCode}.pdf`);
    expect(Buffer.from(pdf.content.slice(0, 5)).toString("latin1")).toBe("%PDF-");

    // Console: in the list, in the totals, on the supporter page.
    const list = await listDonations(donationFilters.parse({ status: "paid", provider: "paystack" }));
    const listed = list.rows.find((r) => r.reference === started.reference);
    expect(listed).toMatchObject({ amountMinor: 500000, currency: "NGN", frequency: "one_off", status: "paid", supporterName: "Test Donor" });
    const totals = await donationTotals(new Date("2026-11-20T12:00:00Z"));
    expect(totals.month.NGN).toBeGreaterThanOrEqual(500000);
    const sup = await getSupporter(listed!.supporterId);
    expect(sup?.email).toBe(input.email);
    expect(sup?.wantsUpdates).toBe(true);
    expect(sup?.gifts.map((g) => g.reference)).toContain(started.reference);

    // Public receipt check shows date, amount and validity only.
    const check = await verifyReceipt(row!.receiptCode!);
    expect(check).toEqual({ amountMinor: 500000, currency: "NGN", paidAt: row!.paidAt, valid: true, refunded: false });
  });

  it("replaying the webhook duplicates nothing", async () => {
    const started = await initiateDonation(ctx, gift());
    if (!started.ok) throw new Error("initiate failed");
    const body = chargeSuccess(started.reference);
    const sig = signPaystackBody(body, SECRET);

    expect((await post(body, sig)).status).toBe(200);
    const after1 = await countRows();
    const [first] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));

    for (let i = 0; i < 3; i++) expect((await post(body, sig)).status).toBe(200);
    const after4 = await countRows();
    const [again] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));

    expect(after4).toEqual(after1);
    expect(again!.receiptCode).toBe(first!.receiptCode);
    expect(again!.updatedAt.getTime()).toBe(first!.updatedAt.getTime());

    // The thank-you page afterwards also changes nothing.
    verifyResponse = { status: "success", amount: 500000, currency: "NGN", fees: 17500, paid_at: "2026-11-17T10:00:00.000Z", id: 1 };
    expect((await confirmDonation(started.reference))?.status).toBe("paid");
    expect(await countRows()).toEqual(after1);
  });

  it("rejects a tampered signature with 401 and changes nothing", async () => {
    const started = await initiateDonation(ctx, gift());
    if (!started.ok) throw new Error("initiate failed");
    const body = chargeSuccess(started.reference);
    const before = await countRows();

    // Signed with the wrong secret.
    expect((await post(body, signPaystackBody(body, `sk_test_${"0".repeat(40)}`))).status).toBe(401);
    // A genuine signature over a different body (amount raised after signing).
    const tampered = body.replace('"amount":500000', '"amount":50000000');
    expect((await post(tampered, signPaystackBody(body, SECRET))).status).toBe(401);
    // Missing and malformed signatures.
    expect((await post(body, null)).status).toBe(401);
    expect((await post(body, "not-hex")).status).toBe(401);

    const [row] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));
    expect(row!.status).toBe("initiated");
    expect(await countRows()).toEqual(before);
  });
});

describe("Paystack details", () => {
  it("does not mark paid when the amount differs from what was asked", async () => {
    const started = await initiateDonation(ctx, gift());
    if (!started.ok) throw new Error("initiate failed");
    const body = chargeSuccess(started.reference, { amount: 100 });
    expect((await post(body, signPaystackBody(body, SECRET))).status).toBe(200);
    const [row] = await db.select().from(s.donation).where(eq(s.donation.reference, started.reference));
    expect(row!.status).toBe("initiated");
  });

  it("the thank-you page verifies with Paystack instead of trusting the link", async () => {
    const ok = await initiateDonation(ctx, gift());
    const bad = await initiateDonation(ctx, gift());
    if (!ok.ok || !bad.ok) throw new Error("initiate failed");
    verifyResponse = { status: "success", amount: 500000, currency: "NGN", fees: 100, paid_at: "2026-11-17T11:00:00.000Z", id: 7 };
    expect((await confirmDonation(ok.reference))?.status).toBe("paid");
    expect(calls.some((c) => c.url.endsWith(`/transaction/verify/${ok.reference}`))).toBe(true);
    verifyResponse = { status: "abandoned", amount: 500000, currency: "NGN", fees: null, paid_at: null, id: 8 };
    expect((await confirmDonation(bad.reference))?.status).toBe("failed");
    expect(await confirmDonation("BGDI-NOPE")).toBeNull();
  });

  it("monthly gifts create a plan once, link the subscription and record renewals once", async () => {
    const email = `monthly-${randomBytes(4).toString("hex")}@example.test`;
    const a = await initiateDonation(ctx, gift({ frequency: "monthly", amount: 2000, email }));
    const b = await initiateDonation(ctx, gift({ frequency: "monthly", amount: 2000 }));
    if (!a.ok || !b.ok) throw new Error("initiate failed");
    expect(calls.filter((c) => c.url.endsWith("/plan"))).toHaveLength(1);
    const inits = calls.filter((c) => c.url.endsWith("/transaction/initialize"));
    expect(inits.every((c) => c.body!.plan === "PLN_200000")).toBe(true);

    const paid = chargeSuccess(a.reference, { amount: 200000, plan: { plan_code: "PLN_200000" }, customer: { email } });
    await post(paid, signPaystackBody(paid, SECRET));

    const sub = JSON.stringify({
      event: "subscription.create",
      data: { subscription_code: "SUB_test123", amount: 200000, customer: { email }, plan: { plan_code: "PLN_200000" } },
    });
    expect((await post(sub, signPaystackBody(sub, SECRET))).status).toBe(200);
    const [first] = await db.select().from(s.donation).where(eq(s.donation.reference, a.reference));
    expect(first!.subscriptionCode).toBe("SUB_test123");

    const renewal = chargeSuccess("T1234567890renew", { amount: 200000, plan: { plan_code: "PLN_200000" }, customer: { email } });
    const sig = signPaystackBody(renewal, SECRET);
    await post(renewal, sig);
    await post(renewal, sig);
    const renewals = await db.select().from(s.donation).where(eq(s.donation.reference, "T1234567890renew"));
    expect(renewals).toHaveLength(1);
    expect(renewals[0]).toMatchObject({ status: "paid", frequency: "monthly", subscriptionCode: "SUB_test123", supporterId: first!.supporterId });
    const receipts = await db.select().from(s.message).where(eq(s.message.eventKey, `donation.receipt:${renewals[0]!.id}`));
    expect(receipts).toHaveLength(1);
  });

  it("a failed renewal is recorded once and the donor is told", async () => {
    const evt = JSON.stringify({
      event: "invoice.payment_failed",
      data: {
        invoice_code: "INV_abc123",
        amount: 200000,
        currency: "NGN",
        customer: { email: "renewal-failed@example.test" },
        subscription: { subscription_code: "SUB_x" },
      },
    });
    const sig = signPaystackBody(evt, SECRET);
    await post(evt, sig);
    await post(evt, sig);
    const rows = await db.select().from(s.donation).where(eq(s.donation.reference, "BGDI-INV-INVABC123"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("failed");
    const notices = await db.select().from(s.message).where(eq(s.message.eventKey, "donation.failed:BGDI-INV-INVABC123"));
    expect(notices).toHaveLength(1);
  });

  it("refuses a live key unless explicitly allowed", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_" + "x".repeat(40));
    const r = await initiateDonation(ctx, gift());
    expect(r).toEqual({ ok: false, code: "provider" });
    expect(calls).toHaveLength(0);
  });

  it("refuses USD until it is switched on, and unknown designations", async () => {
    expect(await initiateDonation(ctx, gift({ currency: "USD", amount: 10 }))).toEqual({ ok: false, code: "currency" });
    expect(await initiateDonation(ctx, gift({ designation: "0190a8f2-1111-7000-8000-000000000001" }))).toEqual({ ok: false, code: "designation" });
  });
});

describe("console payments provider", () => {
  it("settles at once, and amounts ending in 13 fail", async () => {
    vi.stubEnv("PAYMENTS_PROVIDER", "console");
    const ok = await initiateDonation(ctx, gift({ amount: 2000 }));
    const bad = await initiateDonation(ctx, gift({ amount: 513 }));
    if (!ok.ok || !bad.ok) throw new Error("initiate failed");
    expect(ok.redirectUrl).toBeNull();
    expect((await confirmDonation(ok.reference))?.status).toBe("paid");
    expect((await confirmDonation(bad.reference))?.status).toBe("failed");
    expect(calls).toHaveLength(0);
  });
});

describe("console donations", () => {
  it("records an offline gift with a receipt, resends it, and marks a refund", async () => {
    const before = consoleOutbox.length;
    const r = await recordOfflineGift({
      supporterName: "Offline Giver",
      supporterEmail: "offline@example.test",
      amount: 100000,
      currency: "NGN",
      date: "2026-11-02",
      method: "bank_transfer",
      designation: "",
      note: "Transfer from GTBank",
    });
    expect(r.ok).toBe(true);
    expect(consoleOutbox.length).toBe(before + 1);
    expect(consoleOutbox.at(-1)!.attachments?.[0]?.contentType).toBe("application/pdf");

    expect((await resendReceipt(r.donationId)).ok).toBe(true);
    expect(consoleOutbox.length).toBe(before + 2);

    expect((await markRefunded(r.donationId, "Refunded at donor's request")).ok).toBe(true);
    expect((await markRefunded(r.donationId, "again")).ok).toBe(false);
    const [d] = await db.select().from(s.donation).where(eq(s.donation.id, r.donationId));
    expect(d!.status).toBe("refunded");
    expect(await verifyReceipt(d!.receiptCode!)).toMatchObject({ valid: false, refunded: true });
    const audits = await db
      .select()
      .from(s.auditEvent)
      .where(and(eq(s.auditEvent.entityId, r.donationId), eq(s.auditEvent.action, "donation.refund")));
    expect(audits).toHaveLength(1);
  });

  it("exports CSV without contact details and logs the export", async () => {
    const csv = await exportDonationsCsv(donationFilters.parse({}));
    expect(csv.split("\r\n")[0]).toBe("date,paid_at,reference,supporter,amount,currency,frequency,designation,status,provider,campaign");
    expect(csv).not.toContain("@example.test");
    const [e] = await db.select({ n: count() }).from(s.auditEvent).where(eq(s.auditEvent.action, "export.create"));
    expect(e!.n).toBeGreaterThan(0);
  });

  it("is closed in production until sign-in (M3) exists", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(listDonations(donationFilters.parse({}))).rejects.toBeInstanceOf(ConsoleDenied);
    await expect(donationTotals()).rejects.toBeInstanceOf(ConsoleDenied);
    await expect(exportDonationsCsv(donationFilters.parse({}))).rejects.toBeInstanceOf(ConsoleDenied);
  });
});
