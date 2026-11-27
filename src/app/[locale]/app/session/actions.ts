"use server";

import { revalidatePath } from "next/cache";
import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { addSession, cancelSession, endSession, generateSessions, recordAttendance, sessionRoster, startSession } from "@/server/services/sessions";

export type SessionResult = { ok: true; id?: string; created?: number; saved?: number } | { ok: false; code: string };

/** Each service re-checks permission; this layer maps errors to codes and refreshes the pages. */
async function run<T extends { ok: boolean }>(fn: (actor: Awaited<ReturnType<typeof getActor>>, ip: string | null) => Promise<T>): Promise<T | { ok: false; code: string }> {
  try {
    const actor = await getActor();
    const r = await fn(actor, (await requestMeta()).ip);
    revalidatePath("/[locale]/app", "layout");
    revalidatePath("/[locale]/console/groups", "layout");
    return r;
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[sessions] action failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}

/** The coach's attendance list, re-read every few seconds while the session page is open. */
export async function rosterAction(sessionId: string): Promise<{ personId: string; status: "present" | "absent" | "excused" | null }[] | null> {
  const rows = await sessionRoster(await getActor(), String(sessionId)).catch(() => null);
  return rows ? rows.map((r) => ({ personId: r.personId, status: r.status as "present" | "absent" | "excused" | null })) : null;
}

export async function startSessionAction(sessionId: string): Promise<SessionResult> {
  return run((actor, ip) => startSession(actor, String(sessionId), ip));
}
export async function endSessionAction(sessionId: string): Promise<SessionResult> {
  return run((actor, ip) => endSession(actor, String(sessionId), ip));
}
export async function attendanceAction(sessionId: string, input: unknown): Promise<SessionResult> {
  return run((actor, ip) => recordAttendance(actor, String(sessionId), input, ip));
}
export async function generateSessionsAction(cohortId: string): Promise<SessionResult> {
  return run((actor, ip) => generateSessions(actor, String(cohortId), ip));
}
export async function addSessionAction(cohortId: string, input: unknown): Promise<SessionResult> {
  return run((actor, ip) => addSession(actor, String(cohortId), input, ip));
}
export async function cancelSessionAction(sessionId: string, reason: string): Promise<SessionResult> {
  return run((actor, ip) => cancelSession(actor, String(sessionId), String(reason ?? ""), ip));
}
