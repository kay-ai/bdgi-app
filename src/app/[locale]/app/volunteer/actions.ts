"use server";

import { revalidatePath } from "next/cache";
import { getActor, requestMeta } from "@/server/auth/current";
import { hasRole } from "@/server/permissions/can";
import { reviewScorecard } from "@/server/services/coach-supervision";

/** A coach's "looks right" / "needs a look" on one AI scorecard (D-015). */
export async function reviewScorecardAction(raw: unknown): Promise<{ ok: true } | { ok: false; code: string }> {
  const actor = await getActor();
  if (!actor || !hasRole(actor, "volunteer")) return { ok: false, code: "denied" };
  const meta = await requestMeta();
  try {
    const r = await reviewScorecard({ actor, locale: "en", ip: meta.ip, userAgent: meta.userAgent }, raw);
    revalidatePath("/[locale]/app/volunteer", "layout");
    return r;
  } catch (e) {
    console.error("[volunteer] review failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}
