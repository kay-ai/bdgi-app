import "server-only";
import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, humanCode, lookupHash } from "@/lib/crypto";
import type { DonationFilters, OfflineGiftInput } from "@/server/validation/donation";
import { audit, type Ctx } from "./audit";
import { assertCan } from "@/server/permissions/assert";
import type { Actor } from "@/server/permissions/can";
import { dispatch, queueTemplate } from "./messaging";
import { receiptMessage } from "./receipts";

export const PAGE_SIZE = 25;
type Currency = "NGN" | "USD";


/** Start of the month / year in Lagos time (UTC+1, no daylight saving). */
function lagosStart(kind: "month" | "year", now = new Date()) {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const y = lagos.getUTCFullYear();
  const m = kind === "month" ? lagos.getUTCMonth() : 0;
  return new Date(Date.UTC(y, m, 1) - 60 * 60 * 1000);
}
const lagosDay = (iso: string) => new Date(`${iso}T00:00:00+01:00`);

function where(f: Partial<DonationFilters>): SQL | undefined {
  const parts: SQL[] = [];
  if (f.status) parts.push(eq(s.donation.status, f.status));
  if (f.frequency) parts.push(eq(s.donation.frequency, f.frequency));
  if (f.currency) parts.push(eq(s.donation.currency, f.currency));
  if (f.provider) parts.push(eq(s.donation.provider, f.provider));
  if (f.designation === "general") parts.push(isNull(s.donation.designationProgrammeId));
  else if (f.designation) parts.push(eq(s.donation.designationProgrammeId, f.designation));
  if (f.from) parts.push(gte(s.donation.createdAt, lagosDay(f.from)));
  if (f.to) parts.push(lt(s.donation.createdAt, new Date(lagosDay(f.to).getTime() + 86_400_000)));
  return parts.length ? and(...parts) : undefined;
}

const listColumns = {
  id: s.donation.id,
  createdAt: s.donation.createdAt,
  paidAt: s.donation.paidAt,
  reference: s.donation.reference,
  amountMinor: s.donation.amountMinor,
  currency: s.donation.currency,
  frequency: s.donation.frequency,
  status: s.donation.status,
  provider: s.donation.provider,
  supporterId: s.supporter.id,
  supporterName: s.supporter.name,
  designation: s.programme.nameEn,
  campaign: s.campaign.name,
};

function listQuery(f: Partial<DonationFilters>) {
  return db
    .select(listColumns)
    .from(s.donation)
    .innerJoin(s.supporter, eq(s.supporter.id, s.donation.supporterId))
    .leftJoin(s.programme, eq(s.programme.id, s.donation.designationProgrammeId))
    .leftJoin(s.campaign, eq(s.campaign.id, s.donation.sourceCampaignId))
    .where(where(f))
    .orderBy(desc(s.donation.createdAt));
}

export type DonationRow = Awaited<ReturnType<typeof listQuery>>[number];

export async function listDonations(actor: Actor | null, filters: DonationFilters) {
  assertCan(actor, "donation.view");
  const page = filters.page ?? 1;
  const [rows, [total]] = await Promise.all([
    listQuery(filters).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(s.donation).where(where(filters)),
  ]);
  return { rows, total: total?.n ?? 0, page, pages: Math.max(1, Math.ceil((total?.n ?? 0) / PAGE_SIZE)) };
}

type Money = Partial<Record<Currency, number>>;
const toMoney = (rows: { currency: Currency; total: number | string }[]): Money =>
  Object.fromEntries(rows.map((r) => [r.currency, Number(r.total)]));

/** Totals for the top of the page (spec/11 §3). Paid gifts only; currencies kept apart. */
export async function donationTotals(actor: Actor | null, now = new Date()) {
  assertCan(actor, "donation.view");
  const paid = eq(s.donation.status, "paid");
  const total = sql<string>`coalesce(sum(${s.donation.amountMinor}), 0)`;
  const sumSince = (since: Date) =>
    db
      .select({ currency: s.donation.currency, total })
      .from(s.donation)
      .where(and(paid, gte(s.donation.paidAt, since)))
      .groupBy(s.donation.currency);

  const [month, year, byDesignation, byFrequency, average, firstGifts] = await Promise.all([
    sumSince(lagosStart("month", now)),
    sumSince(lagosStart("year", now)),
    db
      .select({ designation: s.programme.nameEn, currency: s.donation.currency, total })
      .from(s.donation)
      .leftJoin(s.programme, eq(s.programme.id, s.donation.designationProgrammeId))
      .where(paid)
      .groupBy(s.programme.nameEn, s.donation.currency)
      .orderBy(desc(total)),
    db
      .select({ frequency: s.donation.frequency, currency: s.donation.currency, total, gifts: count() })
      .from(s.donation)
      .where(paid)
      .groupBy(s.donation.frequency, s.donation.currency),
    db
      .select({ currency: s.donation.currency, total: sql<string>`coalesce(round(avg(${s.donation.amountMinor})), 0)` })
      .from(s.donation)
      .where(paid)
      .groupBy(s.donation.currency),
    // Each supporter's first paid gift, to tell new supporters this year from returning ones.
    db
      .select({ supporterId: s.donation.supporterId, first: sql<string>`min(${s.donation.paidAt})`, last: sql<string>`max(${s.donation.paidAt})` })
      .from(s.donation)
      .where(paid)
      .groupBy(s.donation.supporterId),
  ]);

  const yearStart = lagosStart("year", now).getTime();
  let newThisYear = 0;
  let returningThisYear = 0;
  for (const g of firstGifts) {
    if (new Date(g.last).getTime() < yearStart) continue;
    if (new Date(g.first).getTime() >= yearStart) newThisYear++;
    else returningThisYear++;
  }

  return {
    month: toMoney(month),
    year: toMoney(year),
    byDesignation: byDesignation.map((r) => ({ designation: r.designation, currency: r.currency, total: Number(r.total) })),
    oneOff: toMoney(byFrequency.filter((r) => r.frequency === "one_off")),
    monthly: toMoney(byFrequency.filter((r) => r.frequency === "monthly")),
    average: toMoney(average),
    supporters: { newThisYear, returningThisYear },
  };
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Guard against spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV export of the filtered list. No email or phone (spec/03 §4.2); logged as `export.create`. */
export async function exportDonationsCsv(actor: Actor | null, filters: DonationFilters, ip?: string | null) {
  const ctx = assertCan(actor, "donation.view", { ip });
  const rows = await listQuery(filters);
  const header = ["date", "paid_at", "reference", "supporter", "amount", "currency", "frequency", "designation", "status", "provider", "campaign"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.createdAt, r.paidAt, r.reference, r.supporterName, (r.amountMinor / 100).toFixed(2), r.currency, r.frequency, r.designation ?? "Where it's needed most", r.status, r.provider, r.campaign]
        .map(csvCell)
        .join(","),
    );
  }
  const { page: _page, ...filterMeta } = filters;
  await audit(db, ctx, { action: "export.create", entityType: "donation", entityId: "00000000-0000-0000-0000-000000000000", meta: { filters: filterMeta, rows: rows.length } });
  return lines.join("\r\n") + "\r\n";
}

export async function getSupporter(actor: Actor | null, id: string) {
  assertCan(actor, "donation.view");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [sup] = await db.select().from(s.supporter).where(eq(s.supporter.id, id));
  if (!sup) return null;
  const gifts = await db
    .select(listColumns)
    .from(s.donation)
    .innerJoin(s.supporter, eq(s.supporter.id, s.donation.supporterId))
    .leftJoin(s.programme, eq(s.programme.id, s.donation.designationProgrammeId))
    .leftJoin(s.campaign, eq(s.campaign.id, s.donation.sourceCampaignId))
    .where(eq(s.donation.supporterId, id))
    .orderBy(desc(s.donation.createdAt));
  const totals: Money = {};
  for (const g of gifts) if (g.status === "paid") totals[g.currency] = (totals[g.currency] ?? 0) + g.amountMinor;
  return {
    id: sup.id,
    name: sup.name,
    email: decrypt(sup.email),
    phone: decrypt(sup.phone),
    wantsUpdates: sup.wantsUpdates,
    notes: sup.notes ?? "",
    createdAt: sup.createdAt,
    gifts,
    totals,
  };
}

export async function saveSupporterNotes(actor: Actor | null, id: string, notes: string, ip?: string | null) {
  const ctx = assertCan(actor, "donation.manage", { ip });
  const [row] = await db
    .update(s.supporter)
    .set({ notes: notes.trim().slice(0, 2000) || null, updatedAt: new Date() })
    .where(eq(s.supporter.id, id))
    .returning({ id: s.supporter.id });
  if (!row) return false;
  await audit(db, ctx, { action: "supporter.notes", entityType: "supporter", entityId: id });
  return true;
}

/** Send the receipt again (a new message row each time; the original stays as sent). */
export async function resendReceipt(actor: Actor | null, donationId: string, ip?: string | null) {
  const ctx = assertCan(actor, "donation.manage", { ip });
  const r = await receiptMessage(db, donationId);
  if (!r) return { ok: false as const, code: "not_paid" };
  const id = await queueTemplate({
    templateKey: "donation.receipt",
    to: r.to,
    channel: "email",
    vars: r.vars,
    eventKey: `donation.receipt:${donationId}:resend:${Date.now()}`,
  });
  await audit(db, ctx, { action: "donation.receipt_resent", entityType: "donation", entityId: donationId });
  if (id) await dispatch([id]);
  return { ok: true as const };
}

/** Bank transfer or cash (spec/11 §3): status `paid`, provider `offline`, receipt emailed. */
export async function recordOfflineGift(actor: Actor | null, input: OfflineGiftInput, ip?: string | null) {
  const ctx: Ctx = assertCan(actor, "donation.manage", { ip });
  const reference = `BGDI-${humanCode(10)}`;
  const ids: string[] = [];
  const donationId = await db.transaction(async (tx) => {
    const hash = lookupHash(input.supporterEmail);
    let [sup] = await tx.select({ id: s.supporter.id }).from(s.supporter).where(eq(s.supporter.emailHash, hash));
    if (!sup) {
      [sup] = await tx
        .insert(s.supporter)
        .values({ name: input.supporterName, email: encrypt(input.supporterEmail), emailHash: hash })
        .returning({ id: s.supporter.id });
    }
    const [d] = await tx
      .insert(s.donation)
      .values({
        supporterId: sup!.id,
        reference,
        amountMinor: input.amount * 100,
        currency: input.currency,
        frequency: "one_off",
        designationProgrammeId: input.designation || null,
        status: "paid",
        provider: "offline",
        providerReference: input.method,
        paidAt: new Date(`${input.date}T12:00:00+01:00`),
        receiptCode: humanCode(),
        message: encrypt(input.note ?? null),
      })
      .returning({ id: s.donation.id });
    await audit(tx, ctx, { action: "donation.record_offline", entityType: "donation", entityId: d!.id, meta: { method: input.method } });
    return d!.id;
  });
  const r = await receiptMessage(db, donationId);
  if (r) {
    const id = await queueTemplate({ templateKey: "donation.receipt", to: r.to, channel: "email", vars: r.vars, eventKey: `donation.receipt:${donationId}` });
    if (id) ids.push(id);
  }
  await dispatch(ids).catch(() => console.info("[donations] receipt dispatch failed", JSON.stringify({ reference })));
  return { ok: true as const, reference, donationId };
}

/** After refunding in Paystack's dashboard, record it here. The receipt check then shows "refunded". */
export async function markRefunded(actor: Actor | null, donationId: string, note: string, ip?: string | null) {
  const ctx = assertCan(actor, "donation.manage", { ip });
  const [d] = await db
    .update(s.donation)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(and(eq(s.donation.id, donationId), eq(s.donation.status, "paid")))
    .returning({ id: s.donation.id });
  if (!d) return { ok: false as const, code: "not_paid" };
  await audit(db, ctx, { action: "donation.refund", entityType: "donation", entityId: d.id, meta: { note: note.trim().slice(0, 300) || null } });
  return { ok: true as const };
}

export async function designatedProgrammes() {
  return db
    .select({ id: s.programme.id, name: s.programme.nameEn })
    .from(s.programme)
    .where(eq(s.programme.acceptsDesignatedGifts, true))
    .orderBy(s.programme.nameEn);
}
