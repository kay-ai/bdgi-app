import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import type { Actor, Role } from "@/server/permissions/can";
import { LESSONS, SKILLS } from "@/server/coach/curriculum";
import { loadActor } from "@/server/permissions/scope";
import { addCoach, addStudents, assignCoach, coachCandidates, groupDetail, listGroups, removeMember, saveGroup, studentCandidates } from "@/server/services/console-groups";
import { studentDetail } from "@/server/services/console-student";
import { supervision } from "@/server/services/coach-supervision";
import { streaks, studentGroups, studentProgress } from "@/server/services/student-progress";
import { setupDb } from "./support/db";

/** Groups, coaches and the student's own progress (D-020, D-021, D-022). */

let stateId = "";
let otherStateId = "";
let schoolId = "";
let programmeId = "";
let admin: Actor;
let seq = 0;

async function actor(roles: [Role, string | null][]): Promise<Actor> {
  const [p] = await db.insert(s.person).values({ firstName: "Staff", surname: encrypt("Lead"), gender: "female", status: "active" }).returning({ id: s.person.id });
  return { userId: randomUUID(), personId: p!.id, firstName: "Staff", roles: roles.map(([role, sid]) => ({ role, stateId: sid })), childIds: [], coachCohortIds: [], championSchoolIds: [] };
}

async function student(opts: { status?: "active" | "waitlisted" | "pending_consent"; consent?: boolean; email?: string } = {}) {
  seq++;
  const [p] = await db
    .insert(s.person)
    .values({ firstName: `Tolu${seq}`, surname: encrypt("Ade"), gender: "female", status: opts.status ?? "active", ageAtSignup: 14, stateId, schoolId, classLevel: "JSS2" })
    .returning();
  await db.insert(s.personRole).values({ personId: p!.id, role: "student" });
  if (opts.consent !== false) await db.insert(s.consent).values({ studentId: p!.id, type: "participation", method: "guardian_otp", givenAt: new Date(), textVersion: "t" });
  const email = opts.email ?? `mum${seq}@example.test`;
  const [g] = await db
    .insert(s.person)
    .values({ firstName: "Mum", surname: encrypt("Ade"), gender: "female", status: "active", email: encrypt(email), emailHash: lookupHash(email), preferredChannel: "email" })
    .returning();
  await db.insert(s.guardianLink).values({ guardianId: g!.id, studentId: p!.id, relationship: "mother" });
  return p!;
}

async function volunteer(stage: "active" | "applied" = "active") {
  seq++;
  const [p] = await db.insert(s.person).values({ firstName: `Ngozi${seq}`, surname: encrypt("Eze"), gender: "female", status: "active", stateId }).returning();
  await db.insert(s.personRole).values({ personId: p!.id, role: "volunteer" });
  await db.insert(s.volunteerProfile).values({ personId: p!.id, stage, motivation: "I want to help girls speak up." });
  return p!;
}

const group = (over: Record<string, unknown> = {}) => ({
  name: `Debate ${++seq}`,
  programmeId,
  schoolId,
  term: "2026/27 T2",
  startsOn: "2027-01-12",
  endsOn: "2027-03-30",
  meetingDay: 2,
  meetingTime: "14:00",
  venue: "Library",
  capacity: 3,
  ...over,
});

beforeAll(async () => {
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "GR", name: "Group State", isActive: true }).returning();
  const [st2] = await db.insert(s.state).values({ code: "GS", name: "Far State", isActive: true }).returning();
  const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "GR LGA", geoCode: "GR-001" }).returning();
  const [sc] = await db.insert(s.school).values({ name: "GR Girls High", stateId: st!.id, lgaId: lg!.id }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  otherStateId = st2!.id;
  schoolId = sc!.id;
  programmeId = pr!.id;
  admin = await actor([["admin", null]]);
  await db.update(s.setting).set({ value: { start: "00:00", end: "00:00" } }).where(eq(s.setting.key, "quiet_hours"));
});

describe("a student's own progress", () => {
  it("counts weeks in a row, not days", () => {
    const now = new Date("2026-11-25T12:00:00Z"); // a Wednesday
    const d = (iso: string) => new Date(`${iso}T10:00:00Z`);
    // This week, last week and the week before; a gap; then two weeks running.
    const r = streaks([d("2026-11-24"), d("2026-11-23"), d("2026-11-18"), d("2026-11-10"), d("2026-10-20"), d("2026-10-13")], now);
    expect(r).toEqual({ current: 3, best: 3 });
    // Nothing yet this week: the run still counts back from last week.
    expect(streaks([d("2026-11-18"), d("2026-11-11")], now).current).toBe(2);
    expect(streaks([d("2026-11-04")], now).current).toBe(0);
  });

  it("shows rank, lessons, speeches and badges from her speech coach records", async () => {
    const p = await student();
    const empty = await studentProgress(p.id);
    expect(empty).toMatchObject({ placed: false, speeches: 0, rank: null });
    expect(empty.badges.every((b) => !b.earned)).toBe(true);

    await db.insert(s.coachSkill).values(SKILLS.map((k) => ({ personId: p.id, skillKey: k.key, rating: "3.40" })));
    await db.insert(s.coachLesson).values({ personId: p.id, lessonKey: LESSONS[0]!.key, status: "passed", attempts: 1, passedAt: new Date() });
    for (let i = 0; i < 5; i++)
      await db.insert(s.speechAttempt).values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: i < 2 ? 2 : 4, createdAt: new Date(Date.now() - i * 3600_000) });
    const pr = await studentProgress(p.id);
    expect(pr).toMatchObject({ placed: true, rank: "debater", lessonsPassed: 1, speeches: 5, thisMonth: 5, streak: 1 });
    const earned = pr.badges.filter((b) => b.earned).map((b) => b.key);
    expect(earned).toEqual(expect.arrayContaining(["first_speech", "five_speeches", "first_lesson", "speaker", "debater"]));
    expect(earned).not.toContain("expert");
    expect(pr.next).not.toBeNull();
  });
});

describe("groups in the console", () => {
  it("staff create a group; a state lead only in her own states", async () => {
    const r = await saveGroup(admin, null, group());
    expect(r.ok).toBe(true);
    expect(await saveGroup(admin, null, group({ endsOn: "2026-01-01" }))).toEqual({ ok: false, code: "invalid" });
    const farLead = await actor([["state_lead", otherStateId]]);
    await expect(saveGroup(farLead, null, group())).rejects.toThrow();
    const lead = await actor([["state_lead", stateId]]);
    expect((await saveGroup(lead, null, group())).ok).toBe(true);
    expect((await listGroups(farLead)).rows).toHaveLength(0);
    expect((await listGroups(lead)).rows.length).toBeGreaterThanOrEqual(2);
    await expect(listGroups(await actor([["volunteer", null]]))).rejects.toThrow();
  });

  it("places students with permission, tells each family once, and keeps to capacity", async () => {
    const { id } = (await saveGroup(admin, null, group())) as { id: string };
    const a = await student();
    const b = await student({ status: "waitlisted" });
    const noPermission = await student({ consent: false });
    const ids = (await studentCandidates(admin, id)).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(ids).not.toContain(noPermission.id);

    expect(await addStudents(admin, id, [a.id, b.id, noPermission.id], true)).toEqual({ ok: true, added: 2 });
    const [bAfter] = await db.select().from(s.person).where(eq(s.person.id, b.id));
    expect(bAfter!.status).toBe("active"); // off the waitlist
    const placed = await db.select().from(s.message).where(like(s.message.eventKey, `student.placed:${id}:%`));
    expect(placed).toHaveLength(2);

    // Removing and adding her again does not message the family twice.
    expect(await removeMember(admin, id, a.id, "moved school")).toEqual({ ok: true });
    expect((await addStudents(admin, id, [a.id], true)).ok).toBe(true);
    expect(await db.select().from(s.message).where(like(s.message.eventKey, `student.placed:${id}:%`))).toHaveLength(2);

    const c = await student();
    const d = await student();
    expect(await addStudents(admin, id, [c.id, d.id], false)).toEqual({ ok: false, code: "full" });

    const detail = (await groupDetail(admin, id))!;
    expect(detail.students.map((m) => m.personId).sort()).toEqual([a.id, b.id].sort());
    expect((await studentGroups(a.id))[0]).toMatchObject({ id, current: true });
  });

  it("only cleared volunteers coach; staff confirm safeguarding when training isn't done", async () => {
    const { id } = (await saveGroup(admin, null, group())) as { id: string };
    const v = await volunteer();
    const applicant = await volunteer("applied");
    const list = await coachCandidates(admin, id);
    expect(list.find((x) => x.id === v.id)).toMatchObject({ cleared: false });
    expect(list.some((x) => x.id === applicant.id)).toBe(false);

    expect(await assignCoach(admin, id, { personId: applicant.id, role: "lead_coach", confirmSafeguarding: true })).toEqual({ ok: false, code: "not_active" });
    expect(await assignCoach(admin, id, { personId: v.id, role: "lead_coach" })).toEqual({ ok: false, code: "not_cleared" });
    expect(await assignCoach(admin, id, { personId: v.id, role: "lead_coach", confirmSafeguarding: true })).toEqual({ ok: true });
    const [vp] = await db.select().from(s.volunteerProfile).where(eq(s.volunteerProfile.personId, v.id));
    expect(vp!.safeguardingCheckedBy).toBe(admin.personId);
    const [log] = await db.select().from(s.auditEvent).where(and(eq(s.auditEvent.action, "volunteer.safeguarding_checked"), eq(s.auditEvent.subjectPersonId, v.id)));
    expect(log).toBeTruthy();

    // Her Hub now shows the group's students to supervise.
    const st = await student();
    await addStudents(admin, id, [st.id], false);
    const coach = (await loadActor("u", v.id))!;
    expect(coach.coachCohortIds).toEqual([id]);
    const [g] = await supervision(coach);
    expect(g!.students.map((x) => x.id)).toEqual([st.id]);
    expect((await studentGroups(st.id))[0]!.coaches[0]).toMatchObject({ firstName: v.firstName, initial: "E", role: "lead_coach" });
  });

  it("staff add a coach directly, only with the safeguarding tick, never twice", async () => {
    const { id } = (await saveGroup(admin, null, group())) as { id: string };
    const base = { firstName: "Bisi", surname: "Ola", gender: "female", email: "bisi.coach@example.test", phone: "", stateId };
    expect(await addCoach(admin, { ...base, safeguardingChecked: false })).toEqual({ ok: false, code: "invalid" });
    const r = await addCoach(admin, { ...base, safeguardingChecked: true, cohortId: id, role: "assistant_coach" });
    expect(r.ok).toBe(true);
    const personId = (r as { id: string }).id;
    const [vp] = await db.select().from(s.volunteerProfile).where(eq(s.volunteerProfile.personId, personId));
    expect(vp).toMatchObject({ stage: "active" });
    expect(vp!.safeguardingCheckedAt).toBeTruthy();
    expect((await groupDetail(admin, id))!.coaches.map((c) => c.personId)).toEqual([personId]);
    const [msg] = await db.select().from(s.message).where(eq(s.message.eventKey, `volunteer.activated:${personId}`));
    expect(msg!.channel).toBe("email");
    expect(await addCoach(admin, { ...base, email: "BISI.coach@example.test", safeguardingChecked: true })).toEqual({ ok: false, code: "exists" });
    await expect(addCoach(await actor([["state_lead", otherStateId]]), { ...base, email: "x@example.test", safeguardingChecked: true })).rejects.toThrow();
  });
});

describe("the console student page", () => {
  it("brings her details, family, groups and progress together, within the actor's states", async () => {
    const p = await student();
    const { id } = (await saveGroup(admin, null, group())) as { id: string };
    await addStudents(admin, id, [p.id], false);
    const d = (await studentDetail(admin, p.id))!;
    expect(d.person).toMatchObject({ firstName: p.firstName, surname: "Ade", school: "GR Girls High" });
    expect(d.guardians[0]).toMatchObject({ firstName: "Mum", relationship: "mother" });
    expect(d.permission.find((c) => c.type === "participation")!.state).toBe("given");
    expect(d.permission.find((c) => c.type === "photo")!.state).toBe("none");
    expect(d.groups.map((g) => g.id)).toEqual([id]);
    expect(d.progress.placed).toBe(false);
    expect(JSON.stringify(d)).not.toMatch(/example\.test/); // no contact details on this page

    expect(await studentDetail(await actor([["state_lead", otherStateId]]), p.id)).toBeNull();
    expect((await studentDetail(await actor([["state_lead", stateId]]), p.id))?.person.id).toBe(p.id);
    expect(await studentDetail(await actor([["volunteer", null]]), p.id)).toBeNull();
  });
});
