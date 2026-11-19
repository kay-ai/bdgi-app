"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, requestMeta } from "@/server/auth/current";
import { deactivateStaff, inviteStaff, staffInviteInput } from "@/server/auth/staff";
import { Forbidden } from "@/server/permissions/assert";

export type UserActionResult = { ok: true } | { ok: false; code: string; fields?: Record<string, string> };

async function guard(fn: () => Promise<UserActionResult>): Promise<UserActionResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[console] user action failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}

export async function inviteStaffAction(raw: unknown): Promise<UserActionResult> {
  return guard(async () => {
    const parsed = staffInviteInput.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "form")] = "invalid";
      return { ok: false, code: "invalid", fields };
    }
    const actor = await getActor();
    const r = await inviteStaff(actor, parsed.data, { ip: (await requestMeta()).ip });
    revalidatePath("/[locale]/console/admin/users", "page");
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  });
}

export async function deactivateStaffAction(userId: string): Promise<UserActionResult> {
  return guard(async () => {
    if (!z.string().uuid().safeParse(userId).success) return { ok: false, code: "invalid" };
    const actor = await getActor();
    if (!actor) return { ok: false, code: "denied" };
    const r = await deactivateStaff(actor, userId, (await requestMeta()).ip);
    revalidatePath("/[locale]/console/admin/users", "page");
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  });
}
