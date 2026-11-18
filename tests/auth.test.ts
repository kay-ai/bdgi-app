import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import {
  base32Decode,
  base32Encode,
  hashPassword,
  passwordProblem,
  totp,
  verifyPassword,
  verifyTotp,
} from "@/lib/auth-crypto";
import { consoleOutbox } from "@/server/providers";
import { actorForSession, createSession, profilesForUser, readSession, setActivePerson } from "@/server/auth/sessions";
import {
  beginTotpSetup,
  finishTotpSetup,
  nextAfterSignIn,
  parseSubject,
  requestSignInCode,
  setPasswordWithToken,
  staffPasswordSignIn,
  staffSecondStep,
  verifySignInCode,
  type Subject,
} from "@/server/auth/sign-in";
import { deactivateStaff, inviteStaff, listStaff } from "@/server/auth/staff";
import { Forbidden } from "@/server/permissions/assert";
import { hasRole } from "@/server/permissions/can";
import { loadActor } from "@/server/permissions/scope";
import { cohortStudents, toBasicStudent } from "@/server/services/cohort-students";
import { basicStudent, basicStudentList, FORBIDDEN_STUDENT_KEYS } from "@/server/validation/student";
import { setupDb } from "./support/db";

beforeAll(async () => {
  await setupDb();
});

let seq = 0;
const phone = () => `0803${String(1000000 + ++seq).slice(-7)}`;

async function addPerson(p: { firstName: string; surname?: string; phone?: string; email?: string; roles: string[]; dob?: string }) {
  const e164 = p.phone ? parseSubject("phone", p.phone)!.value : null;
  const [row] = await db
    .insert(s.person)
    .values({
      firstName: p.firstName,
      surname: encrypt(p.surname ?? "Testsurname")!,
      dateOfBirth: p.dob ? encrypt(p.dob) : null,
      gender: "female",
      phone: e164 ? encrypt(e164) : null,
      phoneHash: e164 ? lookupHash(e164) : null,
      email: p.email ? encrypt(p.email) : null,
      emailHash: p.email ? lookupHash(p.email) : null,
      status: "active",
      classLevel: "JSS2",
      avatarKey: "a05",
    })
    .returning();
  for (const role of p.roles) {
    await db.insert(s.personRole).values({ personId: row!.id, role: role as "student" });
  }
  return row!;
}

/** Ask for a code and read it from the console outbox, as a person would read their SMS. */
async function codeFor(subject: Subject) {
  const before = consoleOutbox.length;
  expect((await requestSignInCode(subject)).ok).toBe(true);
  const msg = consoleOutbox.at(-1)!;
  expect(consoleOutbox.length === before + 1 || consoleOutbox.length === 50).toBe(true);
  expect(msg.to).toBe(subject.value);
  return /\b(\d{6})\b/.exec(msg.body)![1]!;
}

describe("auth crypto", () => {
  it("hashes passwords with scrypt and checks them in constant time", async () => {
    const h = await hashPassword("a long staff passphrase");
    expect(h.startsWith("s1$")).toBe(true);
    expect(await verifyPassword("a long staff passphrase", h)).toBe(true);
    expect(await verifyPassword("a long staff passphrasf", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("refuses short, common and personal passwords", () => {
    expect(passwordProblem("short")).toBe("too_short");
    expect(passwordProblem("password1234")).toBe("common");
    expect(passwordProblem("111111111111")).toBe("common");
    expect(passwordProblem("adaobi-is-my-name", ["Adaobi"])).toBe("common");
    expect(passwordProblem("river tables sing at noon")).toBeNull();
  });

  it("computes TOTP codes that match RFC 6238", () => {
    // RFC 6238 appendix B, SHA-1 seed "12345678901234567890"; we use the last six digits.
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(totp(secret, 59_000)).toBe("287082");
    expect(totp(secret, 1_111_111_109_000)).toBe("081804");
    expect(verifyTotp(secret, "287082", 59_000 + 30_000)).toBe(true); // one step of drift
    expect(verifyTotp(secret, "287082", 59_000 + 120_000)).toBe(false);
  });
});

describe("phone and email codes (spec/03 §1.1)", () => {
  it("one phone linked to a guardian and two children shows the chooser", async () => {
    const tel = phone();
    const mum = await addPerson({ firstName: "Funke", phone: tel, roles: ["guardian"] });
    const kids = [await addPerson({ firstName: "Ade", roles: ["student"] }), await addPerson({ firstName: "Bisi", roles: ["student"] })];
    for (const k of kids) await db.insert(s.guardianLink).values({ guardianId: mum.id, studentId: k.id, relationship: "mother" });

    const subject = parseSubject("phone", tel)!;
    const r = await verifySignInCode(subject, await codeFor(subject));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next).toBe("/sign-in/who");

    const row = await readSession(r.token);
    expect(row?.session.stage).toBe("full");
    expect(row?.session.activePersonId).toBeNull();
    expect(await actorForSession(row)).toBeNull(); // nobody chosen yet

    const profiles = await profilesForUser(row!.user.id);
    expect(profiles.map((x) => x.firstName)).toEqual(["Funke", "Ade", "Bisi"]);
    expect(nextAfterSignIn(profiles)).toBe("/sign-in/who");

    // Choosing a child acts as that child; a stranger's id is refused.
    expect(await setActivePerson(row!.session.id, row!.user.id, kids[1]!.id)).toBe(true);
    const asChild = await actorForSession(await readSession(r.token));
    expect(asChild?.firstName).toBe("Bisi");
    expect(hasRole(asChild, "student")).toBe(true);
    const stranger = await addPerson({ firstName: "Zed", roles: ["student"] });
    expect(await setActivePerson(row!.session.id, row!.user.id, stranger.id)).toBe(false);
  });

  it("a single profile goes straight to its home with that person active", async () => {
    const tel = phone();
    await addPerson({ firstName: "Kemi", phone: tel, roles: ["student"] });
    const subject = parseSubject("phone", tel)!;
    const r = await verifySignInCode(subject, await codeFor(subject));
    expect(r.ok && r.next).toBe("/app");
    const actor = await actorForSession(await readSession(r.ok ? r.token : ""));
    expect(actor?.firstName).toBe("Kemi");
    const audits = await db.select().from(s.auditEvent).where(and(eq(s.auditEvent.action, "auth.sign_in"), eq(s.auditEvent.entityId, actor!.personId)));
    expect(audits).toHaveLength(1);
  });

  it("an unknown number gets the same answer and lands on /join", async () => {
    const subject = parseSubject("phone", phone())!;
    const r = await verifySignInCode(subject, await codeFor(subject));
    expect(r.ok && r.next).toBe("/join");
  });

  it("codes are single use, replaced by a newer code, and stop after five wrong tries", async () => {
    const tel = phone();
    await addPerson({ firstName: "Yemi", phone: tel, roles: ["student"] });
    const subject = parseSubject("phone", tel)!;
    const first = await codeFor(subject);
    const second = await codeFor(subject);
    if (first !== second) expect((await verifySignInCode(subject, first)).ok).toBe(false);
    const good = await verifySignInCode(subject, second);
    expect(good.ok).toBe(true);
    expect(await verifySignInCode(subject, second)).toMatchObject({ ok: false });

    const third = await codeFor(subject);
    const wrong = third === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect(await verifySignInCode(subject, wrong)).toEqual({ ok: false, code: "invalid" });
    expect(await verifySignInCode(subject, wrong)).toEqual({ ok: false, code: "too_many" });
    expect(await verifySignInCode(subject, third)).toMatchObject({ ok: false }); // even the right code is dead now
  });

  it("never stores the code in the message record", async () => {
    const subject = parseSubject("email", `vol${++seq}@example.test`)!;
    const code = await codeFor(subject);
    const msgs = await db.select().from(s.message).where(eq(s.message.templateKey, "auth.otp"));
    expect(JSON.stringify(msgs.map((m) => m.variables))).not.toContain(code);
  });

  it("rejects things that are not phone numbers or emails", () => {
    expect(parseSubject("phone", "12345")).toBeNull();
    expect(parseSubject("email", "not-an-email")).toBeNull();
    expect(parseSubject("phone", "0803 123 4567")).toEqual({ kind: "phone", value: "+2348031234567" });
  });
});

describe("staff: invite, password, 2-step (spec/03 §1.3)", () => {
  const email = "admin.one@example.test";
  let userId = "";
  let backup: string[] = [];
  let secret = "";

  it("invites the first admin and sets a password from the link", async () => {
    const r = await inviteStaff(null, { firstName: "Ada", surname: "Obi", email, roles: ["admin"], stateId: "" }, { bootstrap: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    userId = r.userId;
    expect(consoleOutbox.at(-1)!.to).toBe(email);
    const token = new URL(r.link).searchParams.get("token")!;
    expect(await setPasswordWithToken(token, "short")).toEqual({ ok: false, code: "too_short" });
    expect(await setPasswordWithToken(token, "river tables sing at noon")).toEqual({ ok: true });
    expect(await setPasswordWithToken(token, "river tables sing at noon")).toEqual({ ok: false, code: "expired" });
  });

  it("refuses a code sign-in for a staff email", async () => {
    const before = consoleOutbox.length;
    const subject = parseSubject("email", email)!;
    expect((await requestSignInCode(subject)).ok).toBe(true);
    expect(consoleOutbox.length).toBe(before); // nothing sent
  });

  it("needs 2-step before any staff role counts", async () => {
    const r = await staffPasswordSignIn(email, "river tables sing at noon");
    expect(r.ok && r.next).toBe("/staff/two-factor/setup");
    const row = await readSession(r.ok ? r.token : "");
    expect(row?.session.stage).toBe("password");
    expect(await actorForSession(row)).toBeNull();

    const setup = await beginTotpSetup(row!);
    secret = setup!.secret;
    expect(setup!.uri).toContain("otpauth://totp/");
    // The form posts back in a new request, which reads the session (and pending secret) again.
    const posted = (await readSession(r.ok ? r.token : ""))!;
    expect(await finishTotpSetup(posted, totp(secret) === "000000" ? "111111" : "000000")).toEqual({ ok: false, code: "invalid" });
    const done = await finishTotpSetup(posted, totp(secret));
    expect(done.ok).toBe(true);
    if (done.ok) backup = done.backupCodes;
    expect(backup).toHaveLength(10);

    const actor = await actorForSession(await readSession(r.ok ? r.token : ""));
    expect(hasRole(actor, "admin")).toBe(true);
  });

  it("accepts a backup code once in place of the app code", async () => {
    const r = await staffPasswordSignIn(email, "river tables sing at noon");
    expect(r.ok && r.next).toBe("/staff/two-factor");
    const row = await readSession(r.ok ? r.token : "");
    expect((await staffSecondStep(row!, backup[0]!)).ok).toBe(true);
    const again = await staffPasswordSignIn(email, "river tables sing at noon");
    const row2 = await readSession(again.ok ? again.token : "");
    expect(await staffSecondStep(row2!, backup[0]!)).toEqual({ ok: false, code: "invalid" });
    expect((await staffSecondStep(row2!, totp(secret))).ok).toBe(true);
  });

  it("strips staff roles from a session that did not pass 2-step", async () => {
    const [p] = await db.select().from(s.person).where(eq(s.person.userId, userId));
    const sess = await createSession({ userId, method: "email", stage: "full", activePersonId: p!.id });
    const actor = await actorForSession(await readSession(sess.token));
    expect(actor).not.toBeNull();
    expect(hasRole(actor, "admin")).toBe(false);
  });

  it("locks the account for 15 minutes after five wrong passwords and emails the owner", async () => {
    const r = await inviteStaff(null, { firstName: "Bayo", surname: "Ade", email: "lock.me@example.test", roles: ["content_editor"], stateId: "" }, { bootstrap: true });
    const token = new URL(r.ok ? r.link : "http://x").searchParams.get("token")!;
    await setPasswordWithToken(token, "river tables sing at noon");
    for (let i = 0; i < 5; i++) expect((await staffPasswordSignIn("lock.me@example.test", "wrong wrong wrong")).ok).toBe(false);
    expect(consoleOutbox.at(-1)).toMatchObject({ to: "lock.me@example.test" });
    expect(await staffPasswordSignIn("lock.me@example.test", "river tables sing at noon")).toEqual({ ok: false, code: "locked" });
  });

  it("only admins manage users, and the last admin cannot be deactivated", async () => {
    const [p] = await db.select().from(s.person).where(eq(s.person.userId, userId));
    const admin = (await loadActor(userId, p!.id))!;
    expect(await deactivateStaff(admin, userId)).toEqual({ ok: false, code: "self" });
    const staff = await listStaff(admin);
    expect(staff.find((u) => u.email === email)).toMatchObject({ name: "Ada Obi", status: "active", roles: ["admin"] });
    expect(staff.find((u) => u.email === "lock.me@example.test")?.status).toBe("no_2fa");
    await expect(listStaff({ ...admin, roles: [{ role: "programme_manager", stateId: null }] })).rejects.toBeInstanceOf(Forbidden);
    const editor = { ...admin, roles: [{ role: "content_editor" as const, stateId: null }] };
    await expect(inviteStaff(editor, { firstName: "X", surname: "Y", email: "x@example.test", roles: ["admin"], stateId: "" })).rejects.toBeInstanceOf(
      Forbidden,
    );
  });
});

describe("volunteer view of students (spec/03 §4.2)", () => {
  it("never contains surname, phone, date of birth or guardian fields", async () => {
    const [st] = await db.insert(s.state).values({ code: "TS", name: "Test State", isActive: true }).returning();
    const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "Test LGA", geoCode: "TS-001" }).returning();
    const [school] = await db.insert(s.school).values({ name: "Test High School", stateId: st!.id, lgaId: lg!.id }).returning();
    const [prog] = await db.select().from(s.programme).limit(1);
    const [cohort] = await db
      .insert(s.cohort)
      .values({ programmeId: prog!.id, schoolId: school!.id, name: "Debate A", term: "2026/27 T1", startsOn: "2026-09-15", endsOn: "2026-12-10" })
      .returning();
    const [other] = await db
      .insert(s.cohort)
      .values({ programmeId: prog!.id, schoolId: school!.id, name: "Debate B", term: "2026/27 T1", startsOn: "2026-09-15", endsOn: "2026-12-10" })
      .returning();

    const coach = await addPerson({ firstName: "Coach", email: "coach@example.test", roles: ["volunteer"] });
    const tel = phone();
    const kid = await addPerson({ firstName: "Amaka", surname: "Secretsurname", phone: tel, dob: "2012-04-01", roles: ["student"] });
    await db.update(s.person).set({ schoolId: school!.id }).where(eq(s.person.id, kid.id));
    const mum = await addPerson({ firstName: "Guardianname", surname: "Guardiansurname", phone: phone(), roles: ["guardian"] });
    await db.insert(s.guardianLink).values({ guardianId: mum.id, studentId: kid.id, relationship: "mother" });
    await db.insert(s.cohortMember).values([
      { cohortId: cohort!.id, personId: coach.id, role: "lead_coach", joinedOn: "2026-09-01" },
      { cohortId: cohort!.id, personId: kid.id, role: "student", joinedOn: "2026-09-01" },
    ]);

    const actor = (await loadActor("00000000-0000-7000-8000-0000000000ff", coach.id))!;
    const students = await cohortStudents(actor, cohort!.id);
    expect(students).toHaveLength(1);
    expect(students[0]).toEqual({
      id: kid.id,
      firstName: "Amaka",
      avatarKey: "a05",
      classLevel: "JSS2",
      schoolName: "Test High School",
      attendancePct: null,
      lastScore: null,
    });

    const body = basicStudentList.parse({ students });
    const json = JSON.stringify(body);
    for (const key of FORBIDDEN_STUDENT_KEYS) expect(json).not.toContain(`"${key}"`);
    for (const secret of ["Secretsurname", parseSubject("phone", tel)!.value, tel, "2012-04-01", "Guardianname", "Guardiansurname"]) {
      expect(json).not.toContain(secret);
    }

    // The schema itself refuses any extra field.
    expect(basicStudent.safeParse({ ...students[0], surname: "X" }).success).toBe(false);
    expect(() => toBasicStudent({ ...students[0]!, avatarKey: "not-an-avatar" })).toThrow();

    // A coach of another cohort gets nothing.
    await expect(cohortStudents(actor, other!.id)).rejects.toBeInstanceOf(Forbidden);
  });
});
