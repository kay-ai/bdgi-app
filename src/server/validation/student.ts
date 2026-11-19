import { z } from "zod";

/**
 * What a volunteer coach (or school champion) sees of a student (spec/03 §4.2): first name and
 * avatar, class, school, attendance and the last score. `.strict()` rejects any other key, so a
 * surname, phone, date of birth or guardian field can never pass through.
 */
export const basicStudent = z
  .object({
    id: z.string().uuid(),
    firstName: z.string().min(1).max(80),
    avatarKey: z.string().regex(/^a\d{2}$/),
    classLevel: z.enum(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3", "not_in_school"]).nullable(),
    schoolName: z.string().nullable(),
    attendancePct: z.number().int().min(0).max(100).nullable(),
    lastScore: z.number().nullable(),
  })
  .strict();

export type BasicStudent = z.infer<typeof basicStudent>;

export const basicStudentList = z.object({ students: z.array(basicStudent) }).strict();

/** Keys that must never appear in a basic student response. */
export const FORBIDDEN_STUDENT_KEYS = [
  "surname",
  "phone",
  "phoneHash",
  "email",
  "emailHash",
  "dateOfBirth",
  "ageAtSignup",
  "guardian",
  "guardians",
  "guardianId",
  "guardianName",
  "guardianPhone",
  "notes",
] as const;
