import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { assertCan } from "@/server/permissions/assert";
import type { Actor } from "@/server/permissions/can";
import { audit } from "./audit";

/** Sign-up states after the permission step: here the switch is open even without a guardian participation row. */
const PAST_PERMISSION: string[] = ["pending_review", "active", "waitlisted", "paused"];

export type GuardianChild = {
  id: string;
  firstName: string;
  status: string;
  /** The guardian has given permission to take part (and not withdrawn it). */
  participation: boolean;
  /** The AI switch is open: permission given, or the child is already past the permission step (school agreement, adult). */
  canSetAi: boolean;
  aiPractice: boolean;
};

/** The guardian's children with the permissions that matter in the Hub. */
export async function guardianChildren(actor: Actor): Promise<GuardianChild[]> {
  if (!actor.childIds.length) return [];
  const [kids, consents] = await Promise.all([
    db
      .select({ id: s.person.id, firstName: s.person.firstName, status: s.person.status, createdAt: s.person.createdAt })
      .from(s.person)
      .where(and(inArray(s.person.id, actor.childIds), isNull(s.person.deletedAt))),
    db
      .select({ studentId: s.consent.studentId, type: s.consent.type })
      .from(s.consent)
      .where(and(inArray(s.consent.studentId, actor.childIds), isNull(s.consent.withdrawnAt), sql`${s.consent.givenAt} is not null`)),
  ]);
  kids.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return kids.map((k) => ({
    id: k.id,
    firstName: k.firstName,
    status: k.status,
    participation: consents.some((c) => c.studentId === k.id && c.type === "participation"),
    canSetAi: consents.some((c) => c.studentId === k.id && c.type === "participation") || PAST_PERMISSION.includes(k.status),
    aiPractice: consents.some((c) => c.studentId === k.id && c.type === "ai_practice"),
  }));
}

/**
 * A signed-in guardian turns AI speech practice on or off for one child (spec/12 §1). The child must
 * be past the permission step (the guardian said yes on the consent link, or the school's agreement
 * or her age covered it); before that, the consent link is the only way in. Turning it off withdraws the consent row; turning it on adds a new one.
 */
export async function setAiPractice(actor: Actor | null, studentId: string, on: boolean, ip: string | null = null) {
  const ctx = assertCan(actor, "consent.give", { ip, resource: { personId: studentId } });
  const guardianId = actor!.personId;
  const rows = await db
    .select()
    .from(s.consent)
    .where(and(eq(s.consent.studentId, studentId), inArray(s.consent.type, ["participation", "ai_practice"]), isNull(s.consent.withdrawnAt)));
  const participation = rows.find((r) => r.type === "participation" && r.givenAt);
  const [child] = await db.select({ status: s.person.status }).from(s.person).where(eq(s.person.id, studentId));
  if (!participation && !PAST_PERMISSION.includes(child?.status ?? "")) return { ok: false as const, code: "no_participation" as const };
  const current = rows.find((r) => r.type === "ai_practice" && r.givenAt);
  if (!!current === on) return { ok: true as const, aiPractice: on };

  const now = new Date();
  await db.transaction(async (tx) => {
    if (on) {
      const [v] = await tx.select({ value: s.setting.value }).from(s.setting).where(eq(s.setting.key, "consent_text_version"));
      await tx.insert(s.consent).values({
        studentId,
        guardianId,
        type: "ai_practice",
        method: "guardian_otp",
        givenAt: now,
        guardianFullName: participation?.guardianFullName ?? null,
        ip,
        textVersion: String(v?.value ?? participation?.textVersion ?? "v1"),
      });
    } else {
      await tx.update(s.consent).set({ withdrawnAt: now, updatedAt: now }).where(eq(s.consent.id, current!.id));
    }
    await audit(tx, ctx, { action: "consent.change", entityType: "person", entityId: studentId, subjectPersonId: studentId, meta: { ai_practice: on, via: "hub" } });
  });
  return { ok: true as const, aiPractice: on };
}
