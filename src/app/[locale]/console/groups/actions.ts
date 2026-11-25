"use server";

import { revalidatePath } from "next/cache";
import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { addCoach, addStudents, assignCoach, removeMember, saveGroup, studentCandidates } from "@/server/services/console-groups";

export type GroupResult = { ok: true; id?: string; added?: number } | { ok: false; code: string };

/** Every action re-checks the permission in the service; this layer only maps errors to codes. */
async function run<T extends { ok: boolean }>(fn: (actor: Awaited<ReturnType<typeof getActor>>, ip: string | null) => Promise<T>): Promise<T | { ok: false; code: string }> {
  try {
    const actor = await getActor();
    const ip = (await requestMeta()).ip;
    const r = await fn(actor, ip);
    revalidatePath("/[locale]/console/groups", "layout");
    return r;
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[groups] action failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}

export async function saveGroupAction(id: string | null, input: unknown): Promise<GroupResult> {
  return run((actor, ip) => saveGroup(actor, id, input, ip));
}

export async function addStudentsAction(cohortId: string, personIds: string[], notify: boolean): Promise<GroupResult> {
  return run((actor, ip) => addStudents(actor, cohortId, Array.isArray(personIds) ? personIds.map(String) : [], notify === true, ip));
}

export async function removeMemberAction(cohortId: string, personId: string, reason: string): Promise<GroupResult> {
  return run((actor, ip) => removeMember(actor, String(cohortId), String(personId), String(reason ?? ""), ip));
}

export async function assignCoachAction(cohortId: string, input: unknown): Promise<GroupResult> {
  return run((actor, ip) => assignCoach(actor, String(cohortId), input, ip));
}

export async function addCoachAction(input: unknown): Promise<GroupResult> {
  return run((actor, ip) => addCoach(actor, input, ip));
}

export type Candidate = { id: string; firstName: string; surname: string; age: number | null; classLevel: string | null; school: string | null; sameSchool: boolean; otherGroup: string | null; status: string };

export async function searchStudentsAction(cohortId: string, q: string): Promise<Candidate[]> {
  try {
    return await studentCandidates(await getActor(), String(cohortId), String(q ?? "").slice(0, 60));
  } catch {
    return [];
  }
}
