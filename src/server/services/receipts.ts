import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Attachment } from "@/server/providers";
import { paymentsProvider } from "@/server/providers/payments";
import { buildReceiptPdf, receiptAmount, type ReceiptData } from "@/server/receipts/pdf";
import { decrypt } from "@/lib/crypto";

type Exec = Pick<typeof db, "select">;
const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const METHOD: Record<string, string> = {
  paystack: "Card or bank via Paystack",
  console: "Test payment (no money moved)",
  offline: "Bank transfer or cash",
};

/**
 * Receipts are rendered from the donation row whenever they are needed (email, console download),
 * so there is no stored file to keep in step. `receipt_key` stays empty until media storage (S3) exists.
 */
export async function receiptData(donationId: string): Promise<ReceiptData | null> {
  const [row] = await db
    .select({ d: s.donation, sup: s.supporter, prog: { nameEn: s.programme.nameEn } })
    .from(s.donation)
    .innerJoin(s.supporter, eq(s.supporter.id, s.donation.supporterId))
    .leftJoin(s.programme, eq(s.programme.id, s.donation.designationProgrammeId))
    .where(eq(s.donation.id, donationId));
  if (!row || row.d.status !== "paid" || !row.d.receiptCode || !row.d.paidAt) return null;

  const settings = await db.select().from(s.setting);
  const st = Object.fromEntries(settings.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const str = (k: string) => (typeof st[k] === "string" ? (st[k] as string) : "");

  let manageUrl: string | null = null;
  if (row.d.frequency === "monthly" && row.d.subscriptionCode && row.d.provider === "paystack") {
    manageUrl = await paymentsProvider().manageLink(row.d.subscriptionCode).catch(() => null);
  }

  return {
    org: {
      name: str("org_name") || "Black Girl's Dream Initiative",
      address: [str("org_address"), str("org_city")].filter(Boolean).join(", "),
      email: str("org_email"),
      phone: str("org_phone"),
      cacNumber: str("org_cac_number"),
    },
    supporterName: row.sup.name,
    amountMinor: row.d.amountMinor,
    currency: row.d.currency,
    paidAt: row.d.paidAt,
    reference: row.d.reference,
    receiptCode: row.d.receiptCode,
    designation: row.prog?.nameEn ?? "Where it's needed most",
    frequency: row.d.frequency,
    method: METHOD[row.d.provider] ?? row.d.provider,
    verifyUrl: `${appUrl()}/verify/receipt/${row.d.receiptCode}`,
    manageUrl,
  };
}

export async function receiptPdf(donationId: string): Promise<{ filename: string; content: Uint8Array } | null> {
  const data = await receiptData(donationId);
  if (!data) return null;
  return { filename: `BGDI-receipt-${data.receiptCode}.pdf`, content: await buildReceiptPdf(data) };
}

/** Files to attach when a queued message is sent. Only `donation.receipt` has one today. */
export async function attachmentsFor(templateKey: string | null, vars: unknown): Promise<Attachment[]> {
  if (templateKey !== "donation.receipt") return [];
  const donationId = (vars as { donationId?: string } | null)?.donationId;
  if (!donationId) return [];
  const pdf = await receiptPdf(donationId);
  if (!pdf) throw new Error("Receipt is not available for this donation");
  return [{ filename: pdf.filename, contentType: "application/pdf", content: pdf.content }];
}

/** Public check `/verify/receipt/[code]`: date, amount and "valid" only (spec/11 §2.5). */
export async function verifyReceipt(code: string) {
  if (!/^[0-9A-Z]{4,16}$/.test(code)) return null;
  const [d] = await db
    .select({ amountMinor: s.donation.amountMinor, currency: s.donation.currency, paidAt: s.donation.paidAt, status: s.donation.status })
    .from(s.donation)
    .where(eq(s.donation.receiptCode, code));
  if (!d || !d.paidAt) return null;
  return { amountMinor: d.amountMinor, currency: d.currency, paidAt: d.paidAt, valid: d.status === "paid", refunded: d.status === "refunded" };
}

/**
 * Address and variables for the `donation.receipt` email. The variables are stored with the message
 * row, so they hold nothing that identifies the donor; the name is on the attached PDF only.
 */
export async function receiptMessage(exec: Exec, donationId: string) {
  const [row] = await exec
    .select({ d: s.donation, email: s.supporter.email, prog: s.programme.nameEn })
    .from(s.donation)
    .innerJoin(s.supporter, eq(s.supporter.id, s.donation.supporterId))
    .leftJoin(s.programme, eq(s.programme.id, s.donation.designationProgrammeId))
    .where(eq(s.donation.id, donationId));
  if (!row || row.d.status !== "paid" || !row.d.receiptCode || !row.d.paidAt) return null;
  return {
    to: decrypt(row.email),
    vars: {
      donationId,
      amount: receiptAmount(row.d.amountMinor, row.d.currency),
      date: dateFmt.format(row.d.paidAt),
      reference: row.d.reference,
      designation: row.prog ?? "Where it's needed most",
      receiptCode: row.d.receiptCode,
      verifyUrl: `${appUrl()}/verify/receipt/${row.d.receiptCode}`,
      manage:
        row.d.frequency === "monthly" && row.d.provider === "paystack"
          ? "\n\nThis is a monthly gift. Paystack emails you a link to change or cancel it at any time."
          : "",
    },
  };
}
