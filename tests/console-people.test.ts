import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt } from "@/lib/crypto";
import { Forbidden } from "@/server/permissions/assert";
import type { Actor, Role } from "@/server/permissions/can";
import { decide } from "@/server/services/consent";
import { listOutbox } from "@/server/services/console-outbox";
import { decideSchoolRequest, decideStudent, decideVolunteer, listSchools, listStudents, listVolunteers } from "@/server/services/console-people";
import { guardianChildren, setAiPractice } from "@/server/services/guardian";
import { submitStudent } from "@/server/services/intake";
import { eligibility } from "@/server/services/speech";
import type { StudentIntake } from "@/server/validation/join";
import { setupDb } from "./support/db";

/** Console lists and approval, the guardian's AI practice switch, and the admin outbox. */

const ctx = { actor: null, locale: "en" as const, ip: "203.0.113.9", userAgent: "vitest" };
let stateId = "";
let otherStateId = "";
let lgaId = "";
let schoolId = "";
let programmeId = "";
let seq = 0;

/** An actor backed by a real person row (audit events point at it). */
async function actor(roles: [Role, string | null][], over: Partial<Actor> = {}): Promise<Actor> {
  const personId =
    over.personId ??
    (await db.insert(s.person).values({ firstName: "Staff", surname: "enc", gender: "female", status: "active" }).returning({ id: s.person.id }))[0]!.id;
  return {
    userId: randomUUID(),
    firstName: "Staff",
    roles: roles.map(([role, sid]) => ({ role, stateId: sid })),
    childIds: [],
    coachCohortIds: [],
    championSchoolIds: [],
    ...over,
    personId,
  };
}

beforeAll(async () => {
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "CP", name: "Console State", isActive: true }).returning();
  const [st2] = await db.insert(s.state).values({ code: "CQ", name: "Other State", isActive: true }).returning();
  const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "CP LGA", geoCode: "CP-001" }).returning();
  const [sc] = await db.insert(s.school).values({ name: "CP Girls High", stateId: st!.id, lgaId: lg!.id }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  otherStateId = st2!.id;
  lgaId = lg!.id;
  schoolId = sc!.id;
  programmeId = pr!.id;
  admin = await actor([["admin", null]]);
  await db.update(s.setting).set({ value: { start: "00:00", end: "00:00" } }).where(eq(s.setting.key, "quiet_hours"));
});

function intake(age = 13): StudentIntake {
  seq++;
  return {
    clientId: randomUUID(),
    startedAt: Date.now() - 60_000,
    about: { firstName: `Kemi${seq}`, surname: "Bello", age, gender: "female", classLevel: "JSS2", stateId, lgaId: "", schoolId, schoolOther: "" },
    dreams: { dreamCareer: "Doctor", interests: ["stem"], communityDream: "", programmeIds: [programmeId] },
    help: { needs: ["confidence"], schoolSubject: "", needsOther: "", deviceAccess: "own_smartphone" },
    contact: {
      language: "en",
      email: "",
      guardianEmail: "",
      phone: `+234812${String(3000000 + seq).slice(-7)}`,
      guardianName: "Bola Bello",
      guardianRelationship: "mother",
      guardianPhone: `+234805${String(4000000 + seq).slice(-7)}`,
      guardianChannel: "whatsapp",
      avatarKey: "a02",
    },
    checkin: { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, privacy: true },
  };
}

async function joinStudent(age = 13) {
  const r = await submitStudent(ctx, intake(age));
  if (!r.ok) throw new Error("intake failed");
  const [link] = await db.select().from(s.guardianLink).where(eq(s.guardianLink.studentId, r.data.personId));
  return { studentId: r.data.personId, guardianId: link?.guardianId ?? null };
}

async function permissionMessage(guardianId: string) {
  const [m] = await db
    .select()
    .from(s.message)
    .where(and(eq(s.message.personId, guardianId), eq(s.message.templateKey, "consent.request")));
  const body = decrypt(m!.bodyRendered)!;
  return { body, token: /\/consent\/([\w-]+)/.exec(body)![1]!, code: /(\d{6})/.exec(body.replace(/\/consent\/[\w-]+/, ""))![1]! };
}

async function giveParticipation(guardianId: string, aiPractice = false) {
  const { token, code } = await permissionMessage(guardianId);
  const r = await decide(ctx, { token, code, fullName: "Bola Bello", give: true, photo: false, aiPractice, stories: false });
  expect(r.ok).toBe(true);
}

let admin: Actor;

describe("guardian Hub: AI speech practice switch", () => {
  it("needs the main permission first, then turns AI practice on and off", async () => {
    const { studentId, guardianId } = await joinStudent();
    const mum = await actor([["guardian", null]], { personId: guardianId!, childIds: [studentId] });

    expect(await setAiPractice(mum, studentId, true)).toEqual({ ok: false, code: "no_participation" });
    expect((await guardianChildren(mum))[0]).toMatchObject({ id: studentId, participation: false, aiPractice: false, status: "pending_consent" });

    await giveParticipation(guardianId!);
    expect(await eligibility(studentId)).toMatchObject({ ok: false, reason: "no_consent" });

    expect(await setAiPractice(mum, studentId, true)).toEqual({ ok: true, aiPractice: true });
    expect((await guardianChildren(mum))[0]).toMatchObject({ participation: true, aiPractice: true });
    expect((await eligibility(studentId)).ok).toBe(true);

    expect(await setAiPractice(mum, studentId, false)).toEqual({ ok: true, aiPractice: false });
    expect(await eligibility(studentId)).toMatchObject({ ok: false, reason: "no_consent" });
    const live = await db
      .select()
      .from(s.consent)
      .where(and(eq(s.consent.studentId, studentId), eq(s.consent.type, "ai_practice"), isNull(s.consent.withdrawnAt)));
    expect(live).toHaveLength(0);
  });

  it("refuses a guardian who isn't this child's guardian", async () => {
    const { studentId, guardianId } = await joinStudent();
    await giveParticipation(guardianId!);
    const stranger = await actor([["guardian", null]], { childIds: [] });
    await expect(setAiPractice(stranger, studentId, true)).rejects.toBeInstanceOf(Forbidden);
    const student = await actor([["student", null]], { personId: studentId });
    await expect(setAiPractice(student, studentId, true)).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("console: students", () => {
  it("lists students with review first and approves one once permission is in", async () => {
    const { studentId, guardianId } = await joinStudent();
    const list = await listStudents(admin, {});
    const row = list.rows.find((r) => r.id === studentId)!;
    expect(row).toMatchObject({ status: "pending_consent", surname: "Bello", guardian: "Bola", canDecide: false });

    expect(await decideStudent(admin, studentId, "approve")).toEqual({ ok: false, code: "wrong_status" });
    await giveParticipation(guardianId!);
    const waiting = await listStudents(admin, { status: "pending_review" });
    expect(waiting.rows[0]!.status).toBe("pending_review");
    expect(waiting.rows.find((r) => r.id === studentId)).toMatchObject({ canDecide: true, participation: true });

    expect(await decideStudent(admin, studentId, "approve")).toEqual({ ok: true, status: "active" });
    const [p] = await db.select({ status: s.person.status }).from(s.person).where(eq(s.person.id, studentId));
    expect(p!.status).toBe("active");
    const [a] = await db.select().from(s.auditEvent).where(and(eq(s.auditEvent.action, "student.approve"), eq(s.auditEvent.entityId, studentId)));
    expect(a!.actorPersonId).toBe(admin.personId);
  });

  it("adults skip the guardian and can be approved straight away; declining needs review status", async () => {
    const { studentId } = await joinStudent(19);
    expect(await decideStudent(admin, studentId, "decline")).toEqual({ ok: true, status: "declined" });
    expect(await decideStudent(admin, studentId, "approve")).toEqual({ ok: false, code: "wrong_status" });
  });

  it("state leads see and decide only their own state; others can't open the list", async () => {
    const { studentId } = await joinStudent(18);
    const lead = await actor([["state_lead", stateId]]);
    const elsewhere = await actor([["state_lead", otherStateId]]);
    expect((await listStudents(lead, {})).rows.some((r) => r.id === studentId)).toBe(true);
    expect((await listStudents(elsewhere, {})).rows.some((r) => r.id === studentId)).toBe(false);
    await expect(decideStudent(elsewhere, studentId, "approve")).rejects.toBeInstanceOf(Forbidden);
    await expect(listStudents(await actor([["volunteer", null]]), {})).rejects.toBeInstanceOf(Forbidden);
    expect(await decideStudent(lead, studentId, "waitlist")).toEqual({ ok: true, status: "waitlisted" });
  });
});

describe("console: volunteers and schools", () => {
  async function addVolunteer() {
    seq++;
    const [p] = await db
      .insert(s.person)
      .values({ firstName: `Tolu${seq}`, surname: "enc", gender: "female", status: "pending_review", stateId, phone: null })
      .returning();
    await db.insert(s.personRole).values({ personId: p!.id, role: "volunteer" });
    await db.insert(s.volunteerProfile).values({ personId: p!.id, motivation: "I want to coach debate.", skills: ["debate"] });
    return p!.id;
  }

  it("approving a volunteer makes them active; decided applications can't be decided again", async () => {
    const id = await addVolunteer();
    const list = await listVolunteers(admin, { status: "applied" });
    expect(list.rows.find((r) => r.id === id)).toMatchObject({ stage: "applied", canDecide: true, refs: 0 });
    expect(await decideVolunteer(admin, id, "approve")).toEqual({ ok: true });
    const [v] = await db.select().from(s.volunteerProfile).where(eq(s.volunteerProfile.personId, id));
    expect(v!.stage).toBe("active");
    expect(v!.activatedAt).toBeInstanceOf(Date);
    expect(await decideVolunteer(admin, id, "decline")).toEqual({ ok: false, code: "wrong_status" });
    await expect(decideVolunteer(await actor([["content_editor", null]]), await addVolunteer(), "approve")).rejects.toBeInstanceOf(Forbidden);
  });

  it("school requests can be marked contacted, then accepted", async () => {
    const [r] = await db
      .insert(s.schoolRequest)
      .values({ schoolNameOther: "Unity Girls College", stateId, requesterName: "Mrs Ade", requesterRole: "principal", requesterPhone: "enc" })
      .returning();
    const data = await listSchools(admin, {});
    expect(data.requests.find((x) => x.id === r!.id)).toMatchObject({ school: "Unity Girls College", status: "new", canDecide: true });
    expect(data.canEdit).toBe(true);
    expect(await decideSchoolRequest(admin, r!.id, "contacted")).toEqual({ ok: true, status: "contacted" });
    expect(await decideSchoolRequest(admin, r!.id, "accept")).toEqual({ ok: true, status: "accepted" });
    expect(await decideSchoolRequest(admin, r!.id, "decline")).toEqual({ ok: false, code: "wrong_status" });
    await expect(decideSchoolRequest(await actor([["state_lead", otherStateId]]), r!.id, "decline")).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("console: outbox", () => {
  it("shows admins the guardian's permission link and code, and nobody else", async () => {
    const { studentId, guardianId } = await joinStudent();
    const { token, code } = await permissionMessage(guardianId!);
    const rows = await listOutbox(admin, { student: studentId, kind: "permission" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toContain(`/consent/${token}`);
    expect(rows[0]!.body).toContain(code);
    expect(rows[0]!.to).toMatch(/^\+234805/);
    await expect(listOutbox(await actor([["programme_manager", null]]), {})).rejects.toBeInstanceOf(Forbidden);
    const [a] = await db.select().from(s.auditEvent).where(eq(s.auditEvent.action, "outbox.view"));
    expect(a).toBeTruthy();
  });

  it("never shows staff account messages", async () => {
    await db.insert(s.message).values({ direction: "outbound", toAddress: "x", channel: "email", templateKey: "staff.password_reset", bodyRendered: "secret", status: "sent" });
    const rows = await listOutbox(admin, {});
    expect(rows.some((r) => r.templateKey?.startsWith("staff."))).toBe(false);
  });
});

describe("guardian Hub: children already past the permission step", () => {
  it("opens the switch for a child taking part without a guardian permission row", async () => {
    const [kid] = await db.insert(s.person).values({ firstName: "Bisi", surname: "enc", gender: "female", status: "active", ageAtSignup: 14 }).returning();
    await db.insert(s.personRole).values({ personId: kid!.id, role: "student" });
    const mum = await actor([["guardian", null]], { childIds: [kid!.id] });
    expect((await guardianChildren(mum))[0]).toMatchObject({ participation: false, canSetAi: true });
    expect(await setAiPractice(mum, kid!.id, true)).toEqual({ ok: true, aiPractice: true });
    expect((await eligibility(kid!.id)).ok).toBe(true);
  });
});
