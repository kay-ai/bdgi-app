"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { setAiPractice } from "@/server/services/guardian";

export async function setAiPracticeAction(studentId: string, on: boolean): Promise<{ ok: true; aiPractice: boolean } | { ok: false; code: string }> {
  if (!z.string().uuid().safeParse(studentId).success || typeof on !== "boolean") return { ok: false, code: "invalid" };
  try {
    const r = await setAiPractice(await getActor(), studentId, on, (await requestMeta()).ip);
    revalidatePath("/[locale]/app/guardian", "page");
    return r;
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[guardian] consent change failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}
