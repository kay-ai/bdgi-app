import "server-only";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash, newNumericCode, newToken } from "@/lib/crypto";
import { contactRules, type StudentIntake } from "@/server/validation/join";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { contactMode, reach, reachPlain } from "./reach";
import { hit } from "./rate-limit";
import { saveBaseline, saveProfileAnswers } from "./student-profile";

export type IntakeResult =
  | { ok: true; data: { personId: string; firstName: string; guardianName: string | null; isAdult: boolean; duplicate: boolean } }
  | { ok: false; error: { code: "too_fast" | "rate_limited" | "invalid" | "server"; message: string } };

const CONSENT_TTL_DAYS = 14;
// The form is short now (D-019); a person still needs a few seconds to fill it in.
const MIN_FILL_MS = 8_000;

/** spec/05 §2 "On submit". */
export async function submitStudent(ctx: Ctx, input: StudentIntake): Promise<IntakeResult> {
  if (input.website) return { ok: false, error: { code: "invalid", message: "invalid" } };
  if (Date.now() - input.startedAt < MIN_FILL_MS) return { ok: false, error: { code: "too_fast", message: "tooFast" } };
  if (ctx.ip && !(await hit(`intake:ip:${ctx.ip}`, 10, 3600))) {
    return { ok: false, error: { code: "rate_limited", message: "rateLimited" } };
  }
  const { about, dreams, help, contact, checkin } = input;
  const mode = contactMode();
  if (!contactRules(about.age, help?.deviceAccess ?? "", mode).safeParse(contact).success) {
    return { ok: false, error: { code: "invalid", message: "invalid" } };
  }
  const guardianPhone = contact.guardianPhone || null;
  const guardianEmail = contact.guardianEmail || null;
  for (const key of [guardianPhone && `phone:${lookupHash(guardianPhone)}`, guardianEmail && `email:${lookupHash(guardianEmail)}`]) {
    if (key && !(await hit(`intake:${key}`, 5, 3600))) return { ok: false, error: { code: "rate_limited", message: "rateLimited" } };
  }
  const studentChannel = help?.deviceAccess === "basic_phone" ? ("sms" as const) : ("whatsapp" as const);
  // Where the guardian's messages go: their email in email mode, else the channel they picked.
  const guardianTo = reachPlain({ phone: guardianPhone, email: guardianEmail, preferredChannel: contact.guardianChannel }, mode);

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
    // 2. Duplicate check: same first name + surname + school, or same guardian phone or email + first name.
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
    if (!existing && (guardianPhone || guardianEmail)) {
      const hashes = [guardianPhone && sql`guardian.phone_hash = ${lookupHash(guardianPhone)}`, guardianEmail && sql`guardian.email_hash = ${lookupHash(guardianEmail)}`].filter(
        (x): x is ReturnType<typeof sql> => !!x,
      );
      const [g] = await tx
        .select({ id: s.person.id, surname: s.person.surname })
        .from(s.guardianLink)
        .innerJoin(s.person, eq(s.person.id, s.guardianLink.studentId))
        .innerJoin(sql`person as guardian`, sql`guardian.id = ${s.guardianLink.guardianId}`)
        .where(
          and(or(...hashes), sql`lower(${s.person.firstName}) = lower(${about.firstName})`),
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
      email: encrypt(contact.email || null),
      emailHash: contact.email ? lookupHash(contact.email) : null,
      language: contact.language,
      preferredChannel: mode === "email" && contact.email ? ("email" as const) : contact.phone ? studentChannel : ("sms" as const),
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
    // Sign-up sends only the programme (D-019); the rest comes from the Hub profile. A submission
    // from the older, longer form (queued offline) still carries everything, so keep it.
    const full = !!(dreams.dreamCareer && dreams.interests?.length && help);
    if (full) {
      await saveProfileAnswers(tx, personId, { dreams: { dreamCareer: dreams.dreamCareer!, interests: dreams.interests!, communityDream: dreams.communityDream ?? "" }, help: help! }, dreams.programmeIds);
    } else {
      await tx
        .insert(s.intakeResponse)
        .values({ personId, programmeIds: dreams.programmeIds })
        .onConflictDoUpdate({ target: s.intakeResponse.personId, set: { programmeIds: dreams.programmeIds, updatedAt: new Date() } });
    }
    const { q1, q2, q3, q4, q5 } = checkin;
    if (q1 && q2 && q3 && q4 && q5) await saveBaseline(tx, personId, { q1, q2, q3, q4, q5 });

    // Guardian
    let guardianId: string | null = null;
    if ((guardianPhone || guardianEmail) && contact.guardianName) {
      const phoneHash = guardianPhone ? lookupHash(guardianPhone) : null;
      const emailHash = guardianEmail ? lookupHash(guardianEmail) : null;
      const [g] = await tx
        .select({ id: s.person.id })
        .from(s.person)
        // Never the girl herself, whose email may be the family's shared address.
        .where(
          and(
            ne(s.person.id, personId),
            or(phoneHash ? eq(s.person.phoneHash, phoneHash) : undefined, emailHash ? eq(s.person.emailHash, emailHash) : undefined),
          ),
        );
      if (g) guardianId = g.id;
      else {
        const [ng] = await tx
          .insert(s.person)
          .values({
            firstName: contact.guardianName.split(" ")[0]!,
            surname: encrypt(contact.guardianName.split(" ").slice(1).join(" ") || "-"),
            gender: "prefer_not_to_say",
            phone: encrypt(guardianPhone),
            phoneHash,
            email: encrypt(guardianEmail),
            emailHash,
            language: contact.language,
            preferredChannel: guardianTo?.channel ?? contact.guardianChannel,
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
    } else if (agreement && guardianId && guardianTo) {
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
        ...guardianTo,
        personId: guardianId,
        language: contact.language,
        vars: { schoolName, studentFirstName: studentFirst, programmeName: "", link: "" },
        eventKey: `consent.school_notice:${personId}`,
      }, tx);
      if (id) messageIds.push(id);
    } else if (guardianId && guardianTo) {
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
        ...guardianTo,
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
    const studentTo = reachPlain({ phone: contact.phone || null, email: contact.email || null, preferredChannel: studentChannel }, mode);
    if (studentTo) {
      const id = await queueTemplate({
        templateKey: "student.welcome",
        ...studentTo,
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
  const to = row ? reach(row.guardian) : null;
  if (!row || !to) return { ok: false as const };
  const [student] = await db.select().from(s.person).where(eq(s.person.id, personId));
  const token = newToken();
  const code = newNumericCode();
  await db
    .update(s.consent)
    .set({ tokenHash: lookupHash(token), codeHash: lookupHash(code), codeAttempts: 0, updatedAt: new Date() })
    .where(eq(s.consent.id, row.consent.id));
  const id = await queueTemplate({
    templateKey: "consent.reminder",
    ...to,
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
