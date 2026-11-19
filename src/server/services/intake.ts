import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash, newNumericCode, newToken } from "@/lib/crypto";
import type { StudentIntake } from "@/server/validation/join";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { hit } from "./rate-limit";

export type IntakeResult =
  | { ok: true; data: { personId: string; firstName: string; guardianName: string | null; isAdult: boolean; duplicate: boolean } }
  | { ok: false; error: { code: "too_fast" | "rate_limited" | "invalid" | "server"; message: string } };

const CONSENT_TTL_DAYS = 14;
const MIN_FILL_MS = 20_000;

/** spec/05 §2 "On submit". */
export async function submitStudent(ctx: Ctx, input: StudentIntake): Promise<IntakeResult> {
  if (input.website) return { ok: false, error: { code: "invalid", message: "invalid" } };
  if (Date.now() - input.startedAt < MIN_FILL_MS) return { ok: false, error: { code: "too_fast", message: "tooFast" } };
  if (ctx.ip && !(await hit(`intake:ip:${ctx.ip}`, 10, 3600))) {
    return { ok: false, error: { code: "rate_limited", message: "rateLimited" } };
  }
  const { about, dreams, help, contact, checkin } = input;
  const guardianPhone = contact.guardianPhone || null;
  if (guardianPhone && !(await hit(`intake:phone:${lookupHash(guardianPhone)}`, 5, 3600))) {
    return { ok: false, error: { code: "rate_limited", message: "rateLimited" } };
  }

  const isAdult = about.age >= 18;
  const settingsRows = await db.select().from(s.setting).where(sql`${s.setting.key} in ('org_phone','consent_text_version')`);
  const setting = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const orgPhone = String(setting.org_phone ?? "");
  const textVersion = String(setting.consent_text_version ?? "v1");

  // Campaign source
  let campaignId: string | null = null;
  if (input.source) {
    const [c] = await db.select({ id: s.campaign.id }).from(s.campaign).where(eq(s.campaign.code, input.source));
    campaignId = c?.id ?? null;
  }

  const messageIds: string[] = [];

  const result = await db.transaction(async (tx) => {
    // 2. Duplicate check: same first name + surname + school, or same guardian phone + first name.
    const sameName = await tx
      .select({ id: s.person.id, surname: s.person.surname })
      .from(s.person)
      .where(
        and(
          sql`lower(${s.person.firstName}) = lower(${about.firstName})`,
          about.schoolId ? eq(s.person.schoolId, about.schoolId) : isNull(s.person.schoolId),
          isNull(s.person.deletedAt),
        ),
      );
    let existing = sameName.find((p) => decrypt(p.surname)?.toLowerCase() === about.surname.toLowerCase());
    if (!existing && guardianPhone) {
      const [g] = await tx
        .select({ id: s.person.id, surname: s.person.surname })
        .from(s.guardianLink)
        .innerJoin(s.person, eq(s.person.id, s.guardianLink.studentId))
        .innerJoin(sql`person as guardian`, sql`guardian.id = ${s.guardianLink.guardianId}`)
        .where(
          and(sql`guardian.phone_hash = ${lookupHash(guardianPhone)}`, sql`lower(${s.person.firstName}) = lower(${about.firstName})`),
        );
      existing = g;
    }

    const school = about.schoolId
      ? (await tx.select().from(s.school).where(eq(s.school.id, about.schoolId)))[0] ?? null
      : null;

    const personValues = {
      firstName: about.firstName,
      surname: encrypt(about.surname),
      ageAtSignup: about.age,
      gender: about.gender,
      phone: encrypt(contact.phone || null),
      phoneHash: contact.phone ? lookupHash(contact.phone) : null,
      language: contact.language,
      preferredChannel: contact.phone ? (help.deviceAccess === "basic_phone" ? ("sms" as const) : ("whatsapp" as const)) : ("sms" as const),
      stateId: about.stateId,
      lgaId: about.lgaId || school?.lgaId || null,
      schoolId: about.schoolId || null,
      schoolOther: about.schoolOther || null,
      classLevel: about.classLevel,
      avatarKey: contact.avatarKey,
      sourceCampaignId: campaignId,
      updatedAt: new Date(),
    };

    // 4. Status
    const agreement = school
      ? (
          await tx
            .select()
            .from(s.schoolAgreement)
            .where(and(eq(s.schoolAgreement.schoolId, school.id), eq(s.schoolAgreement.coversConsent, true)))
        )[0] ?? null
      : null;
    const status = isAdult || agreement ? ("pending_review" as const) : ("pending_consent" as const);

    let personId: string;
    if (existing) {
      personId = existing.id;
      await tx.update(s.person).set(personValues).where(eq(s.person.id, personId));
    } else {
      const [p] = await tx
        .insert(s.person)
        .values({ ...personValues, status })
        .returning({ id: s.person.id });
      personId = p!.id;
      await tx.insert(s.personRole).values({ personId, role: "student" });
    }

    // 3. Intake answers and baseline
    const intake = {
      dreamCareer: dreams.dreamCareer,
      interests: dreams.interests,
      communityDream: dreams.communityDream || null,
      needs: help.needs,
      needsOther: help.needsOther || null,
      schoolSubject: help.schoolSubject || null,
      programmeIds: dreams.programmeIds,
      hasOwnPhone: help.deviceAccess === "own_smartphone",
      deviceAccess: help.deviceAccess,
      completedAt: new Date(),
      updatedAt: new Date(),
    };
    await tx
      .insert(s.intakeResponse)
      .values({ personId, ...intake })
      .onConflictDoUpdate({ target: s.intakeResponse.personId, set: intake });

    const answers = { q1: checkin.q1, q2: checkin.q2, q3: checkin.q3, q4: checkin.q4, q5: checkin.q5 };
    const mean = Object.values(answers).reduce((a, b) => a + b, 0) / 5;
    // Score on 0–100: mean of 1–5 answers × 20 (spec/05 §2 step 3).
    await tx
      .insert(s.assessment)
      .values({ personId, type: "baseline", selfAnswers: answers, selfScore: String(mean * 20) })
      .onConflictDoUpdate({
        target: [s.assessment.personId, s.assessment.cohortId, s.assessment.type],
        set: { selfAnswers: answers, selfScore: String(mean * 20), takenAt: new Date() },
      });

    // Guardian
    let guardianId: string | null = null;
    if (guardianPhone && contact.guardianName) {
      const hash = lookupHash(guardianPhone);
      const [g] = await tx.select({ id: s.person.id }).from(s.person).where(eq(s.person.phoneHash, hash));
      if (g) guardianId = g.id;
      else {
        const [ng] = await tx
          .insert(s.person)
          .values({
            firstName: contact.guardianName.split(" ")[0]!,
            surname: encrypt(contact.guardianName.split(" ").slice(1).join(" ") || "-"),
            gender: "prefer_not_to_say",
            phone: encrypt(guardianPhone),
            phoneHash: hash,
            language: contact.language,
            preferredChannel: contact.guardianChannel,
            whatsappOptIn: contact.guardianChannel === "whatsapp",
            stateId: about.stateId,
            status: "active",
          })
          .returning({ id: s.person.id });
        guardianId = ng!.id;
        await tx.insert(s.personRole).values({ personId: guardianId, role: "guardian" });
      }
      await tx
        .insert(s.guardianLink)
        .values({ guardianId, studentId: personId, relationship: contact.guardianRelationship || "other", isPrimary: true })
        .onConflictDoNothing();
    }

    // Consent
    const studentFirst = about.firstName;
    const schoolName = school?.name ?? about.schoolOther ?? "";
    if (isAdult) {
      await tx.insert(s.consent).values({
        studentId: personId,
        type: "participation",
        method: "self_adult",
        givenAt: new Date(),
        textVersion,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
    } else if (agreement && guardianId && guardianPhone) {
      await tx.insert(s.consent).values({
        studentId: personId,
        guardianId,
        type: "participation",
        method: "school_agreement",
        schoolAgreementId: agreement.id,
        givenAt: new Date(),
        textVersion,
      });
      const id = await queueTemplate({
        templateKey: "consent.school_notice",
        to: guardianPhone,
        channel: contact.guardianChannel,
        personId: guardianId,
        language: contact.language,
        vars: { schoolName, studentFirstName: studentFirst, programmeName: "", link: "" },
        eventKey: `consent.school_notice:${personId}`,
      }, tx);
      if (id) messageIds.push(id);
    } else if (guardianId && guardianPhone) {
      const token = newToken();
      const code = newNumericCode();
      const pending = await tx
        .select({ id: s.consent.id })
        .from(s.consent)
        .where(and(eq(s.consent.studentId, personId), eq(s.consent.type, "participation"), isNull(s.consent.givenAt)));
      const values = {
        studentId: personId,
        guardianId,
        type: "participation" as const,
        method: "guardian_otp" as const,
        tokenHash: lookupHash(token),
        codeHash: lookupHash(code),
        codeAttempts: 0,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + CONSENT_TTL_DAYS * 864e5),
        textVersion,
      };
      if (pending[0]) await tx.update(s.consent).set(values).where(eq(s.consent.id, pending[0].id));
      else await tx.insert(s.consent).values(values);

      const link = `${process.env.APP_URL ?? "http://localhost:3000"}/consent/${token}`;
      const id = await queueTemplate({
        templateKey: "consent.request",
        to: guardianPhone,
        channel: contact.guardianChannel,
        personId: guardianId,
        language: contact.language,
        vars: { guardianName: contact.guardianName, studentFirstName: studentFirst, schoolName, link, code, orgPhone },
        eventKey: `consent.request:${personId}:${Date.now()}`,
        // The link and code are secrets: kept only inside the encrypted body.
        storeVars: false,
      }, tx);
      if (id) messageIds.push(id);
    }

    // 5. Student welcome
    if (contact.phone) {
      const id = await queueTemplate({
        templateKey: "student.welcome",
        to: contact.phone,
        channel: help.deviceAccess === "basic_phone" ? "sms" : "whatsapp",
        personId,
        language: contact.language,
        vars: { firstName: studentFirst, guardianName: contact.guardianName || "" },
        eventKey: `student.welcome:${personId}`,
      }, tx);
      if (id) messageIds.push(id);
    }

    // 6. Inbox item for staff, scoped by state
    await tx
      .insert(s.task)
      .values({
        title: `New student sign-up: ${studentFirst}`,
        kind: "intake_review",
        entityType: "person",
        entityId: personId,
        stateId: about.stateId,
        dedupeKey: `intake_review:${personId}`,
      })
      .onConflictDoNothing({ target: s.task.dedupeKey });

    await audit(tx, ctx, {
      action: existing ? "intake.resubmit" : "intake.submit",
      entityType: "person",
      entityId: personId,
      subjectPersonId: personId,
      meta: { clientId: input.clientId, status },
    });

    return { personId, duplicate: !!existing };
  });

  // Send after commit (the job worker does this in production).
  await dispatch(messageIds).catch((e) => console.error("[intake] dispatch failed", e));

  return {
    ok: true,
    data: {
      personId: result.personId,
      firstName: about.firstName,
      guardianName: contact.guardianName || null,
      isAdult,
      duplicate: result.duplicate,
    },
  };
}

/** "Remind my guardian": re-sends the consent request, at most 3 times (spec/05 §2 step 7). */
export async function remindGuardian(ctx: Ctx, personId: string) {
  if (!(await hit(`consent.remind:${personId}`, 3, 14 * 86400))) return { ok: false as const };
  const [row] = await db
    .select({ consent: s.consent, guardian: s.person })
    .from(s.consent)
    .innerJoin(s.person, eq(s.person.id, s.consent.guardianId))
    .where(and(eq(s.consent.studentId, personId), eq(s.consent.type, "participation"), isNull(s.consent.givenAt)));
  if (!row || !row.guardian.phone) return { ok: false as const };
  const [student] = await db.select().from(s.person).where(eq(s.person.id, personId));
  const token = newToken();
  const code = newNumericCode();
  await db
    .update(s.consent)
    .set({ tokenHash: lookupHash(token), codeHash: lookupHash(code), codeAttempts: 0, updatedAt: new Date() })
    .where(eq(s.consent.id, row.consent.id));
  const id = await queueTemplate({
    templateKey: "consent.reminder",
    to: decrypt(row.guardian.phone),
    channel: row.guardian.preferredChannel,
    personId: row.guardian.id,
    vars: {
      studentFirstName: student?.firstName ?? "",
      link: `${process.env.APP_URL ?? "http://localhost:3000"}/consent/${token}`,
      code,
    },
    eventKey: `consent.reminder:${personId}:${Date.now()}`,
    storeVars: false,
  });
  if (id) await dispatch([id]);
  await audit(db, ctx, { action: "consent.remind", entityType: "consent", entityId: row.consent.id, subjectPersonId: personId });
  return { ok: true as const };
}
