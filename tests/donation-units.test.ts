import { describe, expect, it } from "vitest";
import { signPaystackBody, verifyPaystackSignature } from "@/lib/paystack-signature";
import { buildReceiptPdf, pdfSafe, receiptAmount } from "@/server/receipts/pdf";
import { donationInput } from "@/server/validation/donation";

const base = { amount: 5000, currency: "NGN", frequency: "one_off", designation: "", name: "Ada", email: "ada@example.test" };

describe("donation input", () => {
  it("accepts a normal gift and fills defaults", () => {
    const r = donationInput.parse(base);
    expect(r).toMatchObject({ isAnonymous: false, wantsUpdates: false });
    expect(r.phone).toBeUndefined();
  });
  it("applies naira limits", () => {
    expect(donationInput.safeParse({ ...base, amount: 499 }).success).toBe(false);
    expect(donationInput.safeParse({ ...base, amount: 500 }).success).toBe(true);
    expect(donationInput.safeParse({ ...base, amount: 5_000_000 }).success).toBe(true);
    expect(donationInput.safeParse({ ...base, amount: 5_000_001 }).success).toBe(false);
  });
  it("applies dollar limits", () => {
    expect(donationInput.safeParse({ ...base, currency: "USD", amount: 1 }).success).toBe(false);
    expect(donationInput.safeParse({ ...base, currency: "USD", amount: 2 }).success).toBe(true);
    expect(donationInput.safeParse({ ...base, currency: "USD", amount: 5_001 }).success).toBe(false);
  });
  it("rejects fractions, bad email and bad phone with i18n keys", () => {
    const r = donationInput.safeParse({ ...base, amount: 500.5, email: "nope", phone: "call me" });
    expect(r.success).toBe(false);
    const msgs = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(msgs).toMatchObject({ amount: "amount", email: "email", phone: "phone" });
  });
});

describe("Paystack signature", () => {
  const secret = "sk_test_unit_fixture";
  const body = '{"event":"charge.success","data":{"reference":"BGDI-X"}}';
  it("matches HMAC-SHA512 of the raw body", () => {
    expect(verifyPaystackSignature(body, signPaystackBody(body, secret), secret)).toBe(true);
  });
  it("rejects any change, a missing signature or an empty secret", () => {
    const sig = signPaystackBody(body, secret);
    expect(verifyPaystackSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyPaystackSignature(body, sig.slice(0, -2) + "00", secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, sig, "")).toBe(false);
  });
});

describe("receipt PDF", () => {
  it("writes amounts without the naira sign and keeps Yorùbá letters readable", () => {
    expect(receiptAmount(500000, "NGN")).toBe("NGN 5,000.00");
    expect(pdfSafe("Èkó Dára")).toBe("Èkó Dára");
    expect(pdfSafe("Ọlọ́run ṣe")).toBe("Olorun se");
  });
  it("builds a one-page PDF", async () => {
    const bytes = await buildReceiptPdf({
      org: { name: "Black Girl's Dream Initiative", address: "Ibadan", email: "info@example.test", phone: "", cacNumber: "" },
      supporterName: "Ṣadé Ọlá",
      amountMinor: 500000,
      currency: "NGN",
      paidAt: new Date("2026-11-17T10:00:00Z"),
      reference: "BGDI-ABCDEFGHJK",
      receiptCode: "ABCD1234",
      designation: "Èkó Dára",
      frequency: "monthly",
      method: "Card or bank via Paystack",
      verifyUrl: "https://bgdi.test/verify/receipt/ABCD1234",
      manageUrl: "https://paystack.com/manage/x",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
