"use server";

import { headers } from "next/headers";
import { donationInput, startDonation } from "@/server/services/donations";

export async function donateAction(locale: string, raw: unknown) {
  const parsed = donationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  }
  const h = await headers();
  const res = await startDonation(
    { actor: null, locale: locale === "yo" ? "yo" : "en", ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1" },
    parsed.data,
  );
  return res.ok ? { ok: true as const, reference: res.reference } : { ok: false as const, code: res.code };
}
