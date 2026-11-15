"use server";

import { cookies, headers } from "next/headers";
import { studentIntake } from "@/server/validation/join";
import { submitStudent, remindGuardian } from "@/server/services/intake";
import { readRemindHandle, remindHandle, searchSchools } from "@/server/services/join-data";
import type { Ctx } from "@/server/services/audit";

async function ctx(locale: string): Promise<Ctx> {
  const h = await headers();
  return {
    actor: null,
    locale: locale === "yo" ? "yo" : "en",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    userAgent: h.get("user-agent"),
  };
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string> } };

export async function submitStudentAction(
  locale: string,
  raw: unknown,
): Promise<ActionResult<{ firstName: string; guardianName: string | null; isAdult: boolean; handle: string }>> {
  const src = (await cookies()).get("src")?.value;
  const parsed = studentIntake.safeParse({ ...(raw as object), source: src });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] = i.message;
    return { ok: false, error: { code: "invalid", message: "server", fieldErrors } };
  }
  try {
    const res = await submitStudent(await ctx(locale), parsed.data);
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      data: {
        firstName: res.data.firstName,
        guardianName: res.data.guardianName,
        isAdult: res.data.isAdult,
        handle: remindHandle(res.data.personId),
      },
    };
  } catch (e) {
    console.error("[intake] submit failed", e);
    return { ok: false, error: { code: "server", message: "server" } };
  }
}

export async function remindGuardianAction(locale: string, handle: string): Promise<ActionResult<null>> {
  const id = readRemindHandle(handle);
  if (!id) return { ok: false, error: { code: "invalid", message: "server" } };
  const res = await remindGuardian(await ctx(locale), id);
  return res.ok ? { ok: true, data: null } : { ok: false, error: { code: "limit", message: "server" } };
}

export async function searchSchoolsAction(stateId: string, q: string) {
  if (!/^[0-9a-f-]{36}$/.test(stateId)) return [];
  return searchSchools(stateId, q.slice(0, 60));
}
