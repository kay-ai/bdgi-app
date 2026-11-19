"use server";

import { cookies, headers } from "next/headers";
import { initiateDonation } from "@/server/services/donations";
import { donationInput } from "@/server/validation/donation";

export type DonateResult =
  | { ok: true; reference: string; redirectUrl: string | null }
  | { ok: false; fields?: Record<string, string>; code?: string };

/** `donations.initiate` (spec/11 §2.1). Validates with the same schema as the form. */
export async function donateAction(locale: string, raw: unknown): Promise<DonateResult> {
  const parsed = donationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  }
  const h = await headers();
  const res = await initiateDonation(
    { actor: null, locale: locale === "yo" ? "yo" : "en", ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1" },
    parsed.data,
    { campaignCode: (await cookies()).get("src")?.value ?? null },
  );
  return res.ok ? { ok: true, reference: res.reference, redirectUrl: res.redirectUrl } : { ok: false, code: res.code };
}
