"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import type { Ctx } from "@/server/services/audit";
import { importMotions, resolveReview, saveAiSettings, saveMotion, setCohortPilot, setMotionActive } from "@/server/services/coach-admin";

export type AiResult = { ok: true; added?: number; skipped?: number } | { ok: false; code: string };

const uuid = z.string().uuid();

async function ctx(): Promise<Ctx> {
  const meta = await requestMeta();
  return { actor: await getActor(), locale: "en", ip: meta.ip, userAgent: meta.userAgent };
}

async function guard(fn: () => Promise<AiResult>): Promise<AiResult> {
  try {
    const r = await fn();
    revalidatePath("/[locale]/console/ai", "layout");
    return r;
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[console] ai action failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}

export async function saveAiSettingsAction(raw: unknown): Promise<AiResult> {
  return guard(async () => saveAiSettings(await ctx(), raw));
}

export async function saveMotionAction(raw: unknown): Promise<AiResult> {
  return guard(async () => {
    const r = await saveMotion(await ctx(), raw);
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  });
}

export async function setMotionActiveAction(id: string, active: boolean): Promise<AiResult> {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return { ok: false, code: "invalid" };
    return (await setMotionActive(await ctx(), id, active === true)) ? { ok: true } : { ok: false, code: "not_found" };
  });
}

export async function importMotionsAction(text: string, level: string): Promise<AiResult> {
  return guard(async () => {
    const t = z.string().max(50_000).safeParse(text);
    if (!t.success || !t.data.trim()) return { ok: false, code: "invalid" };
    const r = await importMotions(await ctx(), t.data, String(level));
    return { ok: true, ...r };
  });
}

export async function setPilotAction(cohortId: string, isPilotGroup: boolean): Promise<AiResult> {
  return guard(async () => {
    if (!uuid.safeParse(cohortId).success || typeof isPilotGroup !== "boolean") return { ok: false, code: "invalid" };
    return (await setCohortPilot(await ctx(), cohortId, isPilotGroup)) ? { ok: true } : { ok: false, code: "not_found" };
  });
}

export async function resolveReviewAction(reviewId: string, resolution: string): Promise<AiResult> {
  return guard(async () => {
    if (!uuid.safeParse(reviewId).success) return { ok: false, code: "invalid" };
    const text = z.string().max(1000).catch("").parse(resolution);
    return (await resolveReview(await ctx(), reviewId, text)) ? { ok: true } : { ok: false, code: "not_found" };
  });
}
