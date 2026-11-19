import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

/**
 * Shared zod schemas for the join flows (spec/05 §6). Messages are translation keys under
 * `join.errors`, resolved on the client.
 */
const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return "";
    const n = normalisePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phone" });
      return z.NEVER;
    }
    return n;
  });

export const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3", "not_in_school"] as const;
export const INTERESTS = [
  "debate_public_speaking",
  "stem",
  "writing_essays",
  "leadership",
  "arts_media",
  "sports",
  "business_money",
] as const;
export const NEEDS = ["speaking_up", "building_arguments", "confidence", "research", "school_subject", "english", "other"] as const;
export const DEVICES = ["own_smartphone", "shared_smartphone", "basic_phone", "school_computer", "none"] as const;
export const RELATIONSHIPS = ["mother", "father", "aunt", "uncle", "grandparent", "sibling_adult", "other"] as const;
export const AVATARS = Array.from({ length: 24 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);
const AVATAR_KEY = z.string().regex(/^a(0[1-9]|1\d|2[0-4])$/);

export const stepAbout = z
  .object({
    firstName: z.string().trim().min(2, "firstName").max(40, "firstName").regex(/^[\p{L}' -]+$/u, "firstName"),
    surname: z.string().trim().min(2, "surname").max(60, "surname"),
    age: z.coerce.number({ invalid_type_error: "age" }).int().min(8, "age").max(25, "age"),
    gender: z.enum(["female", "male", "prefer_not_to_say"], { message: "pick" }),
    classLevel: z.enum(CLASS_LEVELS, { message: "pick" }),
    stateId: z.string().uuid("pick"),
    lgaId: z.string().uuid("lga").or(z.literal("")),
    schoolId: z.string().uuid().or(z.literal("")),
    schoolOther: z.string().trim().max(120),
  })
  .superRefine((v, ctx) => {
    if (v.classLevel !== "not_in_school" && !v.schoolId && v.schoolOther.length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["schoolId"], message: "school" });
    }
  });

/** Sign-up step 2: just the programme (D-019). */
export const stepProgramme = z.object({
  programmeIds: z.array(z.string().uuid()).min(1, "pickOne"),
});

export const stepDreams = z.object({
  dreamCareer: z.string().trim().min(2, "dream").max(60, "dream"),
  interests: z.array(z.enum(INTERESTS)).min(1, "pickOne"),
  communityDream: z.string().trim().max(200),
  programmeIds: z.array(z.string().uuid()).min(1, "pickOne"),
});

export const stepHelp = z
  .object({
    needs: z.array(z.enum(NEEDS)).min(1, "pickOne"),
    schoolSubject: z.string().trim().max(60),
    needsOther: z.string().trim().max(200),
    deviceAccess: z.enum(DEVICES, { message: "pick" }),
  });

const email = z.string().trim().toLowerCase().email("email").max(200).or(z.literal(""));

export const stepContactBase = z.object({
  language: z.enum(["en", "yo"]),
  phone,
  email: email.default(""),
  guardianName: z.string().trim().max(80),
  guardianRelationship: z.enum(RELATIONSHIPS).or(z.literal("")),
  guardianPhone: phone,
  guardianEmail: email.default(""),
  guardianChannel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
  // Chosen on the Hub profile; sign-up gives a random one.
  avatarKey: AVATAR_KEY.default("a01"),
});

/**
 * Who must give what. In email mode (D-018) a guardian's email is required under 18 and an adult's
 * own email is required; the student's email is optional. In phone mode, the guardian's phone.
 */
export const contactRules = (age: number, deviceAccess: string, mode: "email" | "phone" = "phone") =>
  stepContactBase.superRefine((v, ctx) => {
    if (age < 18) {
      if (v.guardianName.length < 2) ctx.addIssue({ code: "custom", path: ["guardianName"], message: "guardianName" });
      if (!v.guardianRelationship) ctx.addIssue({ code: "custom", path: ["guardianRelationship"], message: "pick" });
      if (mode === "email" && !v.guardianEmail) ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "email" });
      if (mode === "phone" && !v.guardianPhone) ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "phone" });
    } else if (mode === "email" && !v.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "email" });
    }
    // Families often share one email address, so the same email for both is allowed. Sign-up no
    // longer asks about phones (D-019), so a shared number is only refused when we know it isn't shared.
    if (v.phone && v.guardianPhone && v.phone === v.guardianPhone && deviceAccess && deviceAccess !== "shared_smartphone") {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "samePhone" });
    }
  });

const answer = z.coerce.number().int().min(1).max(5);
export const stepCheckin = z.object({
  q1: answer,
  q2: answer,
  q3: answer,
  q4: answer,
  q5: answer,
});

const privacy = z.literal(true, { errorMap: () => ({ message: "privacy" }) });

/**
 * The Hub profile (D-019): what sign-up no longer asks. Dreams, what she'd like help with,
 * the five check-in statements (her baseline) and a picture.
 */
export const studentProfile = z.object({
  dreams: stepDreams.omit({ programmeIds: true }),
  help: stepHelp,
  checkin: stepCheckin,
  avatarKey: AVATAR_KEY,
});
export type StudentProfile = z.infer<typeof studentProfile>;

/** Changing an email after sign-up, on the thank-you screen or the Hub profile. */
export const contactChange = z.object({
  email: email.optional(),
  guardianEmail: z.string().trim().toLowerCase().email("email").max(200).optional(),
});
export type ContactChange = z.infer<typeof contactChange>;

/**
 * The submission, validated again on the server. Sign-up sends the essentials (D-019). The longer
 * answers stay optional so a submission queued offline by the older, longer form still goes through.
 */
export const studentIntake = z.object({
  clientId: z.string().uuid(),
  startedAt: z.number(),
  website: z.string().max(0).optional(), // honeypot
  source: z.string().max(16).optional(),
  about: stepAbout,
  dreams: stepProgramme.merge(stepDreams.omit({ programmeIds: true }).partial()),
  help: stepHelp.optional(),
  contact: stepContactBase,
  checkin: stepCheckin.partial().extend({ privacy }),
});
export type StudentIntake = z.infer<typeof studentIntake>;

export const consentDecision = z.object({
  token: z.string().min(10).max(100),
  code: z.string().regex(/^\d{6}$/, "code"),
  fullName: z.string().trim().min(2).max(100),
  give: z.boolean(),
  photo: z.boolean(),
  aiPractice: z.boolean(),
  stories: z.boolean(),
});
