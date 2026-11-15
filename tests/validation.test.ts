import { describe, expect, it } from "vitest";
import { contactRules, stepAbout } from "@/server/validation/join";

const uuid = "0190a8f2-1111-7000-8000-000000000001";
const about = {
  firstName: "Adaeze",
  surname: "Okafor",
  age: 14,
  gender: "female",
  classLevel: "JSS3",
  stateId: uuid,
  lgaId: "",
  schoolId: uuid,
  schoolOther: "",
};
const contact = {
  language: "en",
  phone: "",
  guardianName: "Mrs Okafor",
  guardianRelationship: "mother",
  guardianPhone: "08031234567",
  guardianChannel: "whatsapp",
  avatarKey: "a07",
};

describe("student intake: about", () => {
  it("accepts a complete answer", () => expect(stepAbout.safeParse(about).success).toBe(true));
  it("needs a school unless not in school", () => {
    const r = stepAbout.safeParse({ ...about, schoolId: "" });
    expect(r.success).toBe(false);
    expect(stepAbout.safeParse({ ...about, schoolId: "", classLevel: "not_in_school" }).success).toBe(true);
  });
  it("rejects digits in a first name", () => expect(stepAbout.safeParse({ ...about, firstName: "Ada1" }).success).toBe(false));
});

describe("student intake: contact", () => {
  it("requires a guardian under 18", () => {
    const r = contactRules(14, "none").safeParse({ ...contact, guardianName: "", guardianPhone: "" });
    expect(r.success).toBe(false);
  });
  it("does not require a guardian at 18", () =>
    expect(contactRules(18, "none").safeParse({ ...contact, guardianName: "", guardianRelationship: "", guardianPhone: "" }).success).toBe(true));
  it("flags the same number for student and guardian", () => {
    const r = contactRules(14, "own_smartphone").safeParse({ ...contact, phone: "08031234567" });
    expect(r.success).toBe(false);
  });
  it("allows the same number on a shared family phone", () =>
    expect(contactRules(14, "shared_smartphone").safeParse({ ...contact, phone: "08031234567" }).success).toBe(true));
});
