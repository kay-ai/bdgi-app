"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConsoleDenied } from "@/server/services/console-access";
import { markRefunded, recordOfflineGift, resendReceipt, saveSupporterNotes } from "@/server/services/console-donations";
import { offlineGiftInput } from "@/server/validation/donation";

type Result = { ok: true; reference?: string; supporterId?: string } | { ok: false; code: string; fields?: Record<string, string> };

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
const uuid = z.string().uuid();

async function guard(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConsoleDenied) return { ok: false, code: "denied" };
    console.error("[console] donation action failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}

export async function resendReceiptAction(donationId: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(donationId).success) return { ok: false, code: "invalid" };
    const r = await resendReceipt(donationId, await ip());
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  });
}

export async function markRefundedAction(donationId: string, note: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(donationId).success) return { ok: false, code: "invalid" };
    const r = await markRefunded(donationId, z.string().max(300).catch("").parse(note), await ip());
    revalidatePath("/[locale]/console/donations", "layout");
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  });
}

export async function saveNotesAction(supporterId: string, notes: string): Promise<Result> {
  return guard(async () => {
    if (!uuid.safeParse(supporterId).success) return { ok: false, code: "invalid" };
    const ok = await saveSupporterNotes(supporterId, z.string().max(2000).catch("").parse(notes), await ip());
    return ok ? { ok: true } : { ok: false, code: "not_found" };
  });
}

export async function recordOfflineAction(raw: unknown): Promise<Result> {
  return guard(async () => {
    const parsed = offlineGiftInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, code: "invalid", fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
    }
    const r = await recordOfflineGift(parsed.data, await ip());
    revalidatePath("/[locale]/console/donations", "layout");
    return { ok: true, reference: r.reference };
  });
}
