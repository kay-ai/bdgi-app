import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import { normalisePhone } from "@/lib/phone";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { hit } from "./rate-limit";

const phoneOrEmpty = z
  .string()
  .trim()
  .transform((v, c) => {
    if (!v) return "";
    const n = normalisePhone(v);
    if (!n) {
      c.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return n;
  });

/* ---------- Contact and partner enquiries (spec/04 §6.9, §6.11) ---------- */

export const contactInput = z.object({
  name: z.string().trim().min(2).max(100),
  reach: z.string().trim().min(5).max(200),
  topic: z.enum(["general", "partnership", "media", "volunteering", "school", "other"]),
  message: z.string().trim().min(5).max(4000),
  website: z.string().max(0).optional(),
});

export async function submitContact(ctx: Ctx, input: z.infer<typeof contactInput>) {
  if (input.website) return { ok: true as const };
  if (ctx.ip && !(await hit(`form:${ctx.ip}`, 10, 3600))) return { ok: false as const, code: "rate_limited" };
  const isEmail = input.reach.includes("@");
  const phone = isEmail ? null : normalisePhone(input.reach);
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(s.contactMessage)
      .values({
        name: input.name,
        email: isEmail ? encrypt(input.reach) : null,
        phone: phone ? encrypt(phone) : !isEmail ? encrypt(input.reach) : null,
        topic: input.topic,
        message: input.message,
      })
      .returning({ id: s.contactMessage.id });
    await tx.insert(s.task).values({
      title: `${input.topic === "partnership" ? "Partnership enquiry" : "Contact message"} from ${input.name}`,
      kind: "manual",
      entityType: "contact_message",
      entityId: m!.id,
    });
    if (isEmail) {
      const id = await queueTemplate(
        { templateKey: "contact.auto_reply", to: input.reach, channel: "email", vars: {}, eventKey: `contact.auto_reply:${m!.id}` },
        tx,
      );
      if (id) ids.push(id);
    }
    await audit(tx, ctx, { action: "contact.submit", entityType: "contact_message", entityId: m!.id });
  });
  await dispatch(ids).catch(() => {});
  return { ok: true as const };
}

/* ---------- Report a concern (spec/09) ---------- */

export const concernInput = z.object({
  category: z.enum(["physical", "emotional", "sexual", "neglect", "online", "bullying", "volunteer_conduct", "data_privacy", "other"]),
  description: z.string().trim().min(20).max(5000),
  immediateDanger: z.boolean(),
  anonymous: z.boolean(),
  name: z.string().trim().max(100),
  contact: z.string().trim().max(200),
  website: z.string().max(0).optional(),
});

export async function submitConcern(ctx: Ctx, input: z.infer<typeof concernInput>) {
  if (input.website) return { ok: false as const, code: "invalid" };
  if (ctx.ip && !(await hit(`concern:${ctx.ip}`, 5, 3600))) return { ok: false as const, code: "rate_limited" };
  const year = new Date().getFullYear();
  const ids: string[] = [];
  const reference = await db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.safeguardingCase)
      .where(sql`${s.safeguardingCase.reference} like ${`SG-${year}-%`}`);
    const ref = `SG-${year}-${String(n + 1).padStart(4, "0")}`;
    const [c] = await tx
      .insert(s.safeguardingCase)
      .values({
        reference: ref,
        reporterIsAnonymous: input.anonymous,
        reporterName: input.anonymous ? null : encrypt(input.name || null),
        reporterContact: input.anonymous ? null : encrypt(input.contact || null),
        category: input.category,
        severity: input.immediateDanger ? "emergency" : "medium",
        description: encrypt(input.description),
        immediateDanger: input.immediateDanger,
        source: "web_form",
      })
      .returning({ id: s.safeguardingCase.id });
    // Notify safeguarding leads with no details in the message (spec/08 staff.case_new).
    const leads = await tx
      .select({ id: s.person.id, phone: s.person.phone, channel: s.person.preferredChannel })
      .from(s.personRole)
      .innerJoin(s.person, eq(s.person.id, s.personRole.personId))
      .where(sql`${s.personRole.role} in ('safeguarding_lead','admin') and ${s.personRole.revokedAt} is null`);
    for (const l of leads) {
      if (!l.phone) continue;
      const { decrypt } = await import("@/lib/crypto");
      const id = await queueTemplate(
        {
          templateKey: "staff.case_new",
          to: decrypt(l.phone),
          channel: l.channel,
          personId: l.id,
          vars: { reference: ref, severity: input.immediateDanger ? "emergency" : "medium", link: `${process.env.APP_URL ?? ""}/console` },
          eventKey: `staff.case_new:${c!.id}:${l.id}`,
        },
        tx,
      );
      if (id) ids.push(id);
    }
    await audit(tx, ctx, { action: "case.create", entityType: "safeguarding_case", entityId: c!.id });
    return ref;
  });
  await dispatch(ids).catch(() => {});
  return { ok: true as const, reference };
}

/* ---------- Volunteer application (spec/05 §4) ---------- */

export const SKILLS = ["debate", "public_speaking", "stem", "coding", "writing", "leadership", "financial_literacy", "judging", "photography", "logistics"] as const;
const reference = z.object({ name: z.string().trim().min(2).max(100), relationship: z.string().trim().min(2).max(60), phone: phoneOrEmpty.refine((v) => !!v, "phone") });

export const volunteerInput = z.object({
  firstName: z.string().trim().min(2).max(40),
  surname: z.string().trim().min(2).max(60),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say"]),
  phone: phoneOrEmpty.refine((v) => !!v, "phone"),
  email: z.string().trim().email().max(200),
  stateId: z.string().uuid(),
  lgaId: z.string().uuid().or(z.literal("")),
  occupation: z.string().trim().max(100),
  organisation: z.string().trim().max(100),
  isNysc: z.boolean(),
  isAlumna: z.boolean(),
  skills: z.array(z.enum(SKILLS)).min(1),
  motivation: z.string().trim().min(50).max(600),
  ref1: reference,
  ref2: reference,
  agreeChecks: z.literal(true),
  agreeSafeguarding: z.literal(true),
  agreePrivacy: z.literal(true),
  website: z.string().max(0).optional(),
});

export function ageOn(dob: string, at = new Date()) {
  const d = new Date(dob);
  let a = at.getFullYear() - d.getFullYear();
  if (at < new Date(at.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export async function submitVolunteer(ctx: Ctx, input: z.infer<typeof volunteerInput>) {
  if (input.website) return { ok: false as const, code: "invalid" };
  if (ageOn(input.dateOfBirth) < 18) return { ok: false as const, code: "too_young" };
  if (ctx.ip && !(await hit(`form:${ctx.ip}`, 10, 3600))) return { ok: false as const, code: "rate_limited" };
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(s.person)
      .values({
        firstName: input.firstName,
        surname: encrypt(input.surname),
        dateOfBirth: encrypt(input.dateOfBirth),
        gender: input.gender,
        phone: encrypt(input.phone),
        phoneHash: lookupHash(input.phone),
        email: encrypt(input.email),
        emailHash: lookupHash(input.email),
        stateId: input.stateId,
        lgaId: input.lgaId || null,
        status: "pending_review",
      })
      .returning({ id: s.person.id });
    const personId = p!.id;
    await tx.insert(s.personRole).values({ personId, role: "volunteer" });
    await tx.insert(s.volunteerProfile).values({
      personId,
      stage: "applied",
      skills: input.skills,
      occupation: input.occupation || null,
      organisation: input.organisation || null,
      isNysc: input.isNysc,
      isAlumna: input.isAlumna,
      motivation: input.motivation,
    });
    for (const r of [input.ref1, input.ref2]) {
      await tx.insert(s.volunteerReference).values({ volunteerId: personId, name: r.name, relationship: r.relationship, phone: encrypt(r.phone) });
    }
    await tx.insert(s.task).values({
      title: `Check references for ${input.firstName}`,
      kind: "reference_check",
      entityType: "person",
      entityId: personId,
      stateId: input.stateId,
      dedupeKey: `reference_check:${personId}`,
    });
    const id = await queueTemplate(
      {
        templateKey: "volunteer.application_received",
        to: input.phone,
        channel: "whatsapp",
        personId,
        vars: { firstName: input.firstName, link: `${process.env.APP_URL ?? ""}/app` },
        eventKey: `volunteer.application_received:${personId}`,
      },
      tx,
    );
    if (id) ids.push(id);
    await audit(tx, ctx, { action: "volunteer.apply", entityType: "person", entityId: personId });
  });
  await dispatch(ids).catch(() => {});
  return { ok: true as const };
}

/* ---------- School request (spec/05 §5) ---------- */

export const schoolInput = z.object({
  schoolName: z.string().trim().min(3).max(150),
  stateId: z.string().uuid(),
  lgaId: z.string().uuid().or(z.literal("")),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["principal", "vice_principal", "teacher", "counsellor", "other"]),
  phone: phoneOrEmpty.refine((v) => !!v, "phone"),
  email: z.string().trim().email().max(200).or(z.literal("")),
  programmeId: z.string().uuid().or(z.literal("")),
  approxStudents: z.coerce.number().int().min(0).max(5000).optional(),
  term: z.string().trim().max(100),
  message: z.string().trim().max(2000),
  website: z.string().max(0).optional(),
});

export async function submitSchoolRequest(ctx: Ctx, input: z.infer<typeof schoolInput>) {
  if (input.website) return { ok: false as const, code: "invalid" };
  if (ctx.ip && !(await hit(`form:${ctx.ip}`, 10, 3600))) return { ok: false as const, code: "rate_limited" };
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(s.schoolRequest)
      .values({
        schoolNameOther: input.schoolName,
        stateId: input.stateId,
        lgaId: input.lgaId || null,
        requesterName: input.name,
        requesterRole: input.role,
        requesterPhone: encrypt(input.phone),
        requesterEmail: encrypt(input.email || null),
        programmeId: input.programmeId || null,
        approxStudents: input.approxStudents ?? null,
        preferredTerm: input.term || null,
        message: input.message || null,
      })
      .returning({ id: s.schoolRequest.id });
    await tx.insert(s.task).values({
      title: `School request: ${input.schoolName}`,
      kind: "manual",
      entityType: "school_request",
      entityId: r!.id,
      stateId: input.stateId,
    });
    const id = await queueTemplate(
      {
        templateKey: "school.request_received",
        to: input.phone,
        channel: "whatsapp",
        vars: { name: input.name, schoolName: input.schoolName },
        eventKey: `school.request_received:${r!.id}`,
      },
      tx,
    );
    if (id) ids.push(id);
    await audit(tx, ctx, { action: "school.request", entityType: "school_request", entityId: r!.id });
  });
  await dispatch(ids).catch(() => {});
  return { ok: true as const };
}
