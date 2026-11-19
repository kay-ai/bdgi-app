import "server-only";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash, newNumericCode, newToken } from "@/lib/crypto";
import type { Actor } from "@/server/permissions/can";
import type { ContactChange, StudentProfile } from "@/server/validation/join";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { hit } from "./rate-limit";
import { contactMode, reach } from "./reach";

type Exec = Pick<typeof db, "select" | "insert" | "update" | "delete">;
type Answers = { q1: number; q2: number; q3: number; q4: number; q5: number };

/** Dreams and help answers (D-019: on the Hub profile, or from an older full sign-up). */
export async function saveProfileAnswers(exec: Exec, personId: string, p: Pick<StudentProfile, "dreams" | "help">, programmeIds?: string[]) {
  const values = {
    dreamCareer: p.dreams.dreamCareer,
    interests: p.dreams.interests,
    communityDream: p.dreams.communityDream || null,
    needs: p.help.needs,
    needsOther: p.help.needsOther || null,
    schoolSubject: p.help.schoolSubject || null,
    hasOwnPhone: p.help.deviceAccess === "own_smartphone",
    deviceAccess: p.help.deviceAccess,
    completedAt: new Date(),
    updatedAt: new Date(),
  };
  await exec
    .insert(s.intakeResponse)
    .values({ personId, programmeIds: programmeIds ?? [], ...values })
    .onConflictDoUpdate({ target: s.intakeResponse.personId, set: programmeIds ? { ...values, programmeIds } : values });
}

/** The five check-in statements: her baseline. Score on 0–100 is the mean of the 1–5 answers × 20 (spec/05 §2 step 3). */
export async function saveBaseline(exec: Exec, personId: string, answers: Answers) {
  const mean = Object.values(answers).reduce((a, b) => a + b, 0) / 5;
  await exec
    .insert(s.assessment)
    .values({ personId, type: "baseline", selfAnswers: answers, selfScore: String(mean * 20) })
    .onConflictDoUpdate({
      target: [s.assessment.personId, s.assessment.cohortId, s.assessment.type],
      set: { selfAnswers: answers, selfScore: String(mean * 20), takenAt: new Date() },
    });
}

/** What the Hub profile page shows: her answers so far and the emails we hold. */
export async function profileFor(actor: Actor) {
  const [p] = await db.select().from(s.person).where(eq(s.person.id, actor.personId));
  if (!p) return null;
  const [intake] = await db.select().from(s.intakeResponse).where(eq(s.intakeResponse.personId, p.id));
  const [baseline] = await db
    .select({ answers: s.assessment.selfAnswers })
    .from(s.assessment)
    .where(and(eq(s.assessment.personId, p.id), eq(s.assessment.type, "baseline"), isNull(s.assessment.cohortId)));
  const g = await pendingGuardian(p.id);
  return {
    firstName: p.firstName,
    avatarKey: p.avatarKey ?? "a01",
    email: p.email ? decrypt(p.email) : "",
    isAdult: (p.ageAtSignup ?? 0) >= 18,
    // A guardian's email can be changed only while we are still waiting for their permission.
    guardian: g ? { name: g.firstName, email: g.email ? decrypt(g.email) : "" } : null,
    complete: !!intake?.completedAt && !!baseline,
    dreams: { dreamCareer: intake?.dreamCareer ?? "", interests: intake?.interests ?? [], communityDream: intake?.communityDream ?? "" },
    help: { needs: intake?.needs ?? [], schoolSubject: intake?.schoolSubject ?? "", needsOther: intake?.needsOther ?? "", deviceAccess: intake?.deviceAccess ?? "" },
    checkin: (baseline?.answers ?? {}) as Partial<Answers>,
  };
}

/** Is her profile finished? Drives the "Finish your profile" card on the Hub home. */
export async function profileComplete(personId: string) {
  const [intake] = await db.select({ at: s.intakeResponse.completedAt }).from(s.intakeResponse).where(eq(s.intakeResponse.personId, personId));
  const [baseline] = await db
    .select({ n: count() })
    .from(s.assessment)
    .where(and(eq(s.assessment.personId, personId), eq(s.assessment.type, "baseline"), isNull(s.assessment.cohortId)));
  return !!intake?.at && (baseline?.n ?? 0) > 0;
}

export async function saveProfile(ctx: Ctx & { actor: Actor }, input: StudentProfile) {
  const { actor } = ctx;
  const personId = actor.personId;
  await db.transaction(async (tx) => {
    await saveProfileAnswers(tx, personId, input);
    await saveBaseline(tx, personId, input.checkin);
    await tx.update(s.person).set({ avatarKey: input.avatarKey, updatedAt: new Date() }).where(eq(s.person.id, personId));
    await audit(tx, ctx, { action: "profile.update", entityType: "person", entityId: personId, subjectPersonId: personId });
  });
}

/** The guardian whose permission is still awaited for this student, if any. */
async function pendingGuardian(studentId: string) {
  const [row] = await db
    .select({ consentId: s.consent.id, guardian: s.person })
    .from(s.consent)
    .innerJoin(s.person, eq(s.person.id, s.consent.guardianId))
    .where(and(eq(s.consent.studentId, studentId), eq(s.consent.type, "participation"), isNull(s.consent.givenAt), isNull(s.consent.withdrawnAt)))
    .limit(1);
  return row ? { ...row.guardian, consentId: row.consentId } : null;
}

export type ContactChangeResult = { ok: true; sentTo: string | null } | { ok: false; code: "rate_limited" | "invalid" | "not_pending" | "email_required" };

/**
 * Change a student's own email, or her guardian's while permission is still awaited (D-019).
 * A new guardian email gets a fresh permission request; the old link and code stop working.
 */
export async function changeContact(ctx: Ctx, studentId: string, change: ContactChange): Promise<ContactChangeResult> {
  if (!(await hit(`contact.change:${studentId}`, 5, 86400))) return { ok: false, code: "rate_limited" };
  const [student] = await db.select().from(s.person).where(and(eq(s.person.id, studentId), isNull(s.person.deletedAt)));
  if (!student) return { ok: false, code: "invalid" };
  let sentTo: string | null = null;

  if (change.email !== undefined) {
    const email = change.email || null;
    if (!email && (student.ageAtSignup ?? 0) >= 18 && contactMode() === "email") return { ok: false, code: "email_required" };
    await db
      .update(s.person)
      .set({
        email: encrypt(email),
        emailHash: email ? lookupHash(email) : null,
        ...(email && contactMode() === "email" ? { preferredChannel: "email" as const } : {}),
        updatedAt: new Date(),
      })
      .where(eq(s.person.id, studentId));
    await audit(db, ctx, { action: "contact.change_email", entityType: "person", entityId: studentId, subjectPersonId: studentId });
  }

  if (change.guardianEmail) {
    const current = await pendingGuardian(studentId);
    if (!current) return { ok: false, code: "not_pending" };
    const hash = lookupHash(change.guardianEmail);
    if (current.emailHash !== hash) {
      const guardianId = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: s.person.id })
          .from(s.person)
          .where(and(eq(s.person.emailHash, hash), ne(s.person.id, studentId), isNull(s.person.deletedAt)));
        const [others] = await tx
          .select({ n: count() })
          .from(s.guardianLink)
          .where(and(eq(s.guardianLink.guardianId, current.id), ne(s.guardianLink.studentId, studentId)));
        let id: string;
        if (existing) id = existing.id;
        else if ((others?.n ?? 0) === 0) {
          // Only this girl's guardian, so it was a typo: correct it in place.
          await tx
            .update(s.person)
            .set({ email: encrypt(change.guardianEmail!), emailHash: hash, preferredChannel: "email", updatedAt: new Date() })
            .where(eq(s.person.id, current.id));
          id = current.id;
        } else {
          // The old address belongs to a guardian of other children too: this is someone else.
          const [ng] = await tx
            .insert(s.person)
            .values({
              firstName: current.firstName,
              surname: current.surname,
              gender: "prefer_not_to_say",
              email: encrypt(change.guardianEmail!),
              emailHash: hash,
              language: current.language,
              preferredChannel: "email",
              stateId: current.stateId,
              status: "active",
            })
            .returning({ id: s.person.id });
          id = ng!.id;
          await tx.insert(s.personRole).values({ personId: id, role: "guardian" });
        }
        if (id !== current.id) {
          const [link] = await tx
            .select()
            .from(s.guardianLink)
            .where(and(eq(s.guardianLink.guardianId, current.id), eq(s.guardianLink.studentId, studentId)));
          await tx.delete(s.guardianLink).where(and(eq(s.guardianLink.guardianId, current.id), eq(s.guardianLink.studentId, studentId)));
          await tx
            .insert(s.guardianLink)
            .values({ guardianId: id, studentId, relationship: link?.relationship ?? "other", isPrimary: true })
            .onConflictDoNothing();
          await tx.update(s.consent).set({ guardianId: id, updatedAt: new Date() }).where(eq(s.consent.id, current.consentId));
          const [hasRole] = await tx
            .select({ n: count() })
            .from(s.personRole)
            .where(and(eq(s.personRole.personId, id), eq(s.personRole.role, "guardian")));
          if (!hasRole?.n) await tx.insert(s.personRole).values({ personId: id, role: "guardian" });
        }
        await audit(tx, ctx, { action: "contact.change_guardian_email", entityType: "person", entityId: studentId, subjectPersonId: studentId });
        return id;
      });
      sentTo = await sendConsentRequest(studentId, guardianId, current.consentId);
    }
  }
  return { ok: true, sentTo };
}

/** A fresh permission link and code to the guardian; any earlier link and code stop working. */
async function sendConsentRequest(studentId: string, guardianId: string, consentId: string) {
  const [g] = await db.select().from(s.person).where(eq(s.person.id, guardianId));
  const [student] = await db.select().from(s.person).where(eq(s.person.id, studentId));
  const to = g ? reach(g) : null;
  if (!g || !student || !to) return null;
  const token = newToken();
  const code = newNumericCode();
  await db
    .update(s.consent)
    .set({ tokenHash: lookupHash(token), codeHash: lookupHash(code), codeAttempts: 0, updatedAt: new Date() })
    .where(eq(s.consent.id, consentId));
  const [school] = student.schoolId ? await db.select({ name: s.school.name }).from(s.school).where(eq(s.school.id, student.schoolId)) : [];
  const [orgPhone] = await db.select({ value: s.setting.value }).from(s.setting).where(eq(s.setting.key, "org_phone"));
  const id = await queueTemplate({
    templateKey: "consent.request",
    ...to,
    personId: guardianId,
    language: g.language === "yo" ? "yo" : "en",
    vars: {
      guardianName: g.firstName,
      studentFirstName: student.firstName,
      schoolName: school?.name ?? student.schoolOther ?? "",
      link: `${process.env.APP_URL ?? "http://localhost:3000"}/consent/${token}`,
      code,
      orgPhone: String(orgPhone?.value ?? ""),
    },
    eventKey: `consent.request:${studentId}:${Date.now()}`,
    storeVars: false,
  });
  if (id) await dispatch([id]);
  return to.to;
}
