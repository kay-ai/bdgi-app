import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash, secureCompare } from "@/lib/crypto";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { reach } from "./reach";

const MAX_ATTEMPTS = 5;
const OPTIONAL = ["photo", "ai_practice", "stories"] as const;
type ConsentType = "participation" | (typeof OPTIONAL)[number];

/** Everything the public permission page may show: first names and programme only (spec/05 §3). */
export async function loadConsentRequest(token: string) {
  const [req] = await db.select().from(s.consent).where(eq(s.consent.tokenHash, lookupHash(token)));
  if (!req) return { state: "invalid" as const };
  const [student] = await db.select().from(s.person).where(eq(s.person.id, req.studentId));
  if (!student) return { state: "invalid" as const };
  const [guardian] = req.guardianId ? await db.select().from(s.person).where(eq(s.person.id, req.guardianId)) : [];
  const [link] = req.guardianId
    ? await db
        .select()
        .from(s.guardianLink)
        .where(and(eq(s.guardianLink.guardianId, req.guardianId), eq(s.guardianLink.studentId, student.id)))
    : [];
  const [intake] = await db.select().from(s.intakeResponse).where(eq(s.intakeResponse.personId, student.id));
  const programmes = intake?.programmeIds.length
    ? await db.select().from(s.programme).where(inArray(s.programme.id, intake.programmeIds))
    : [];
  const all = await db
    .select()
    .from(s.consent)
    .where(and(eq(s.consent.studentId, student.id), isNull(s.consent.withdrawnAt)));
  const current = Object.fromEntries(
    (["participation", ...OPTIONAL] as ConsentType[]).map((t) => [t, all.some((c) => c.type === t && c.givenAt)]),
  ) as Record<ConsentType, boolean>;

  const expired = !req.givenAt && req.expiresAt && req.expiresAt < new Date();
  const locked = req.codeAttempts >= MAX_ATTEMPTS;
  const state =
    student.status === "left" && req.withdrawnAt
      ? ("withdrawn" as const)
      : student.status === "declined"
        ? ("declined" as const)
        : req.givenAt
          ? ("given" as const)
          : expired
            ? ("expired" as const)
            : locked
              ? ("locked" as const)
              : ("open" as const);

  return {
    state,
    studentFirstName: student.firstName,
    guardianFirstName: guardian?.firstName ?? "",
    relationship: link?.relationship ?? "",
    programme: programmes[0] ? { name: programmes[0].nameEn, summary: programmes[0].summaryEn } : null,
    current,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - req.codeAttempts),
  };
}

type Decision = { token: string; code: string; fullName: string; give: boolean; photo: boolean; aiPractice: boolean; stories: boolean };

export async function decide(ctx: Ctx, d: Decision) {
  const [req] = await db.select().from(s.consent).where(eq(s.consent.tokenHash, lookupHash(d.token)));
  if (!req || !req.guardianId) return { ok: false as const, code: "invalid" as const };
  if (!req.givenAt && req.expiresAt && req.expiresAt < new Date()) return { ok: false as const, code: "expired" as const };
  if (req.codeAttempts >= MAX_ATTEMPTS) return { ok: false as const, code: "locked" as const };
  if (!req.codeHash || !secureCompare(req.codeHash, lookupHash(d.code))) {
    await db.update(s.consent).set({ codeAttempts: req.codeAttempts + 1 }).where(eq(s.consent.id, req.id));
    const left = MAX_ATTEMPTS - req.codeAttempts - 1;
    return left <= 0 ? { ok: false as const, code: "locked" as const } : { ok: false as const, code: "bad_code" as const, left };
  }

  const [student] = await db.select().from(s.person).where(eq(s.person.id, req.studentId));
  const [guardian] = await db.select().from(s.person).where(eq(s.person.id, req.guardianId));
  if (!student || !guardian) return { ok: false as const, code: "invalid" as const };
  const now = new Date();
  const ids: string[] = [];
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/consent/${d.token}`;
  const g = reach(guardian);

  await db.transaction(async (tx) => {
    if (d.give) {
      await tx
        .update(s.consent)
        .set({
          givenAt: req.givenAt ?? now,
          guardianFullName: encrypt(d.fullName),
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          codeAttempts: 0,
          updatedAt: now,
        })
        .where(eq(s.consent.id, req.id));

      const wanted: Record<(typeof OPTIONAL)[number], boolean> = { photo: d.photo, ai_practice: d.aiPractice, stories: d.stories };
      const existing = await tx
        .select()
        .from(s.consent)
        .where(and(eq(s.consent.studentId, student.id), inArray(s.consent.type, [...OPTIONAL]), isNull(s.consent.withdrawnAt)));
      for (const type of OPTIONAL) {
        const row = existing.find((e) => e.type === type);
        if (wanted[type] && !row) {
          await tx.insert(s.consent).values({
            studentId: student.id,
            guardianId: guardian.id,
            type,
            method: "guardian_otp",
            givenAt: now,
            guardianFullName: encrypt(d.fullName),
            ip: ctx.ip ?? null,
            userAgent: ctx.userAgent ?? null,
            textVersion: req.textVersion,
          });
        } else if (!wanted[type] && row) {
          await tx.update(s.consent).set({ withdrawnAt: now, updatedAt: now }).where(eq(s.consent.id, row.id));
        }
      }

      const first = !req.givenAt;
      if (first && student.status === "pending_consent") {
        await tx.update(s.person).set({ status: "pending_review", updatedAt: now }).where(eq(s.person.id, student.id));
      }
      if (first && g) {
        const id = await queueTemplate(
          {
            templateKey: "consent.thanks",
            to: g.to,
            channel: g.channel,
            personId: guardian.id,
            vars: { studentFirstName: student.firstName, link },
            eventKey: `consent.thanks:${req.id}`,
          },
          tx,
        );
        if (id) ids.push(id);
      }
      const st = first ? reach(student) : null;
      if (st) {
        const id = await queueTemplate(
          {
            templateKey: "student.consent_given",
            to: st.to,
            channel: st.channel,
            personId: student.id,
            vars: { firstName: student.firstName, guardianName: guardian.firstName },
            eventKey: `student.consent_given:${req.id}`,
          },
          tx,
        );
        if (id) ids.push(id);
      }
      await audit(tx, ctx, {
        action: first ? "consent.give" : "consent.change",
        entityType: "consent",
        entityId: req.id,
        subjectPersonId: student.id,
        meta: { photo: d.photo, ai_practice: d.aiPractice, stories: d.stories },
      });
    } else {
      await tx.update(s.person).set({ status: "declined", updatedAt: now }).where(eq(s.person.id, student.id));
      await tx
        .insert(s.task)
        .values({
          title: `Guardian declined permission for ${student.firstName}`,
          kind: "manual",
          entityType: "person",
          entityId: student.id,
          stateId: student.stateId,
          dedupeKey: `consent_declined:${student.id}`,
        })
        .onConflictDoNothing({ target: s.task.dedupeKey });
      if (g) {
        const id = await queueTemplate(
          {
            templateKey: "consent.declined_ack",
            to: g.to,
            channel: g.channel,
            personId: guardian.id,
            vars: { studentFirstName: student.firstName, link },
            eventKey: `consent.declined_ack:${req.id}`,
          },
          tx,
        );
        if (id) ids.push(id);
      }
      await audit(tx, ctx, { action: "consent.decline", entityType: "consent", entityId: req.id, subjectPersonId: student.id });
    }
  });
  await dispatch(ids).catch((e) => console.error("[consent] dispatch failed", e));
  return { ok: true as const, given: d.give };
}

/** Withdrawal (spec/02 §15 rule 6): student → left, memberships end, messages stop. */
export async function withdraw(ctx: Ctx, token: string, code: string) {
  const [req] = await db.select().from(s.consent).where(eq(s.consent.tokenHash, lookupHash(token)));
  if (!req || !req.guardianId || !req.codeHash) return { ok: false as const, code: "invalid" as const };
  if (req.codeAttempts >= MAX_ATTEMPTS) return { ok: false as const, code: "locked" as const };
  if (!secureCompare(req.codeHash, lookupHash(code))) {
    await db.update(s.consent).set({ codeAttempts: req.codeAttempts + 1 }).where(eq(s.consent.id, req.id));
    return { ok: false as const, code: "bad_code" as const, left: MAX_ATTEMPTS - req.codeAttempts - 1 };
  }
  const [student] = await db.select().from(s.person).where(eq(s.person.id, req.studentId));
  const [guardian] = await db.select().from(s.person).where(eq(s.person.id, req.guardianId));
  if (!student || !guardian) return { ok: false as const, code: "invalid" as const };
  const now = new Date();
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    await tx
      .update(s.consent)
      .set({ withdrawnAt: now, updatedAt: now })
      .where(and(eq(s.consent.studentId, student.id), isNull(s.consent.withdrawnAt)));
    await tx.update(s.person).set({ status: "left", updatedAt: now }).where(eq(s.person.id, student.id));
    await tx
      .update(s.cohortMember)
      .set({ leftOn: now.toISOString().slice(0, 10), leftReason: "consent_withdrawn", updatedAt: now })
      .where(and(eq(s.cohortMember.personId, student.id), isNull(s.cohortMember.leftOn)));
    const gw = reach(guardian);
    if (gw) {
      const id = await queueTemplate(
        {
          templateKey: "consent.withdrawn",
          to: gw.to,
          channel: gw.channel,
          personId: guardian.id,
          vars: { studentFirstName: student.firstName },
          eventKey: `consent.withdrawn:${req.id}`,
        },
        tx,
      );
      if (id) ids.push(id);
    }
    await audit(tx, ctx, { action: "consent.withdraw", entityType: "consent", entityId: req.id, subjectPersonId: student.id });
  });
  await dispatch(ids).catch((e) => console.error("[consent] dispatch failed", e));
  return { ok: true as const };
}
