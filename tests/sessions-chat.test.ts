import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import type { Actor } from "@/server/permissions/can";
import { loadActor } from "@/server/permissions/scope";
import { blockedContent, groupChats, myChats, openDirect, readThread, reportMessage, sendMessage, unreadCount } from "@/server/services/chat";
import { addSession, cancelSession, coachSessions, endSession, generateSessions, liveSessionFor, recordAttendance, sessionRoom, startSession, watInstant, weeklyDates } from "@/server/services/sessions";
import { setupDb } from "./support/db";

/** Live group sessions and group chat (D-025). */

let stateId = "";
let schoolId = "";
let cohortId = "";
let otherCohortId = "";
let admin: Actor;
let coach: Actor;
let amara: Actor;
let bisi: Actor;
let outsider: Actor;
let seq = 0;

async function person(first: string, role: "student" | "volunteer" | "admin", email?: string) {
  seq++;
  const mail = email ?? `${first.toLowerCase()}${seq}@example.test`;
  const [p] = await db
    .insert(s.person)
    .values({ firstName: first, surname: encrypt("Test"), gender: "female", status: "active", stateId, schoolId, ageAtSignup: role === "student" ? 15 : null, email: encrypt(mail), emailHash: lookupHash(mail), preferredChannel: "email" })
    .returning();
  await db.insert(s.personRole).values({ personId: p!.id, role });
  return p!;
}

async function cohort(name: string) {
  const [pr] = await db.select().from(s.programme).limit(1);
  const [c] = await db
    .insert(s.cohort)
    .values({ programmeId: pr!.id, schoolId, name, term: "T2", startsOn: "2027-01-05", endsOn: "2027-02-02", meetingDay: 2, meetingTime: "14:00", venue: "Library", status: "running" })
    .returning();
  return c!.id;
}

const join = (cid: string, personId: string, role: "student" | "lead_coach") => db.insert(s.cohortMember).values({ cohortId: cid, personId, role, joinedOn: "2027-01-01" });

beforeAll(async () => {
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "SC", name: "Session State", isActive: true }).returning();
  const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "SC LGA", geoCode: "SC-001" }).returning();
  const [sc] = await db.insert(s.school).values({ name: "SC Girls High", stateId: st!.id, lgaId: lg!.id }).returning();
  stateId = st!.id;
  schoolId = sc!.id;
  cohortId = await cohort("Debate Club");
  otherCohortId = await cohort("Other Club");
  const a = await person("Admin", "admin");
  const c = await person("Funmi", "volunteer");
  const s1 = await person("Amara", "student");
  const s2 = await person("Bisi", "student");
  const s3 = await person("Kemi", "student");
  await join(cohortId, c.id, "lead_coach");
  await join(cohortId, s1.id, "student");
  await join(cohortId, s2.id, "student");
  await join(otherCohortId, s3.id, "student");
  admin = (await loadActor("u", a.id))!;
  coach = (await loadActor("u", c.id))!;
  amara = (await loadActor("u", s1.id))!;
  bisi = (await loadActor("u", s2.id))!;
  outsider = (await loadActor("u", s3.id))!;
  await db.update(s.setting).set({ value: { start: "00:00", end: "00:00" } }).where(eq(s.setting.key, "quiet_hours"));
});

describe("planning sessions", () => {
  it("works out weekly dates and Lagos times", () => {
    expect(weeklyDates("2027-01-05", "2027-02-02", 2)).toEqual(["2027-01-05", "2027-01-12", "2027-01-19", "2027-01-26", "2027-02-02"]);
    expect(weeklyDates("2027-01-06", "2027-01-20", 2)).toEqual(["2027-01-12", "2027-01-19"]);
    expect(watInstant("2027-01-05", "14:00").toISOString()).toBe("2027-01-05T13:00:00.000Z");
  });

  it("creates each weekly session once; only staff may", async () => {
    await expect(generateSessions(coach, cohortId)).rejects.toThrow();
    expect(await generateSessions(admin, cohortId)).toEqual({ ok: true, created: 5 });
    expect(await generateSessions(admin, cohortId)).toEqual({ ok: true, created: 0 });
    const one = await addSession(admin, cohortId, { date: "2027-02-06", time: "10:00", durationMinutes: 90 });
    expect(one.ok).toBe(true);
    if (one.ok) expect(await cancelSession(admin, one.id, "Public holiday")).toEqual({ ok: true });
  });
});

describe("a live session", () => {
  let sessionId = "";
  const at = (iso: string) => new Date(iso);

  it("can't start long before its time, or be started by a student", async () => {
    const [first] = await db.select().from(s.session).where(eq(s.session.cohortId, cohortId)).orderBy(s.session.startsAt).limit(1);
    sessionId = first!.id;
    expect(await startSession(coach, sessionId, null, at("2027-01-05T11:00:00Z"))).toEqual({ ok: false, code: "too_early" });
    await expect(startSession(amara, sessionId, null, at("2027-01-05T13:00:00Z"))).rejects.toThrow();
  });

  it("starts: students get one email each and see it live; others don't", async () => {
    const now = at("2027-01-05T12:50:00Z");
    expect(await startSession(coach, sessionId, null, now)).toEqual({ ok: true, id: sessionId });
    expect(await startSession(coach, sessionId, null, now)).toEqual({ ok: true, id: sessionId }); // idempotent
    const msgs = await db.select().from(s.message).where(eq(s.message.templateKey, "session.started"));
    expect(msgs.map((m) => m.personId).sort()).toEqual([amara.personId, bisi.personId].sort());
    expect((await liveSessionFor(amara.personId, now))?.id).toBe(sessionId);
    expect(await liveSessionFor(outsider.personId, now)).toBeNull();
    const home = await coachSessions(coach, now);
    expect(home[0]!.live?.id).toBe(sessionId);
  });

  it("lets members in (a student is marked present), keeps others out", async () => {
    const now = at("2027-01-05T13:05:00Z");
    const room = await sessionRoom(amara, sessionId, now);
    expect(room?.live).toBe(true);
    expect(room?.runs).toBe(false);
    expect(room?.provider).toBe("none");
    expect(await sessionRoom(outsider, sessionId, now)).toBeNull();
    const [att] = await db.select().from(s.attendance).where(and(eq(s.attendance.sessionId, sessionId), eq(s.attendance.personId, amara.personId)));
    expect(att?.status).toBe("present");
    const asCoach = await sessionRoom(coach, sessionId, now);
    expect(asCoach?.runs).toBe(true);
    expect(asCoach?.roster.map((r) => r.firstName).sort()).toEqual(["Amara", "Bisi"]);
  });

  it("the coach corrects attendance, but only for her group's students", async () => {
    const r = await recordAttendance(coach, sessionId, { marks: [{ personId: bisi.personId, status: "excused" }, { personId: outsider.personId, status: "present" }] });
    expect(r).toEqual({ ok: true, saved: 1 });
    await expect(recordAttendance(amara, sessionId, { marks: [] })).rejects.toThrow();
  });

  it("ends: held, the coach's hours logged once, no longer live", async () => {
    const now = at("2027-01-05T14:00:00Z");
    expect(await endSession(coach, sessionId, null, now)).toEqual({ ok: true });
    expect(await endSession(coach, sessionId, null, now)).toEqual({ ok: false, code: "not_live" });
    const [sess] = await db.select().from(s.session).where(eq(s.session.id, sessionId));
    expect(sess!.status).toBe("held");
    const hours = await db.select().from(s.hoursEntry).where(eq(s.hoursEntry.sessionId, sessionId));
    expect(hours).toHaveLength(1);
    expect(hours[0]!.hours).toBe("1.00");
    expect(await liveSessionFor(amara.personId, now)).toBeNull();
  });
});

describe("chat", () => {
  it("refuses contact details and links", () => {
    expect(blockedContent("call me on 0803 123 4567")).toBe("phone");
    expect(blockedContent("my email is amara@gmail.com")).toBe("email");
    expect(blockedContent("see www.example.com")).toBe("link");
    expect(blockedContent("see tiktok.com/@me")).toBe("link");
    expect(blockedContent("Great speech today! Session 3 at 2pm.")).toBeNull();
  });

  it("each group has one chat its members can use", async () => {
    const mine = await myChats(amara);
    const group = mine.threads.find((t) => t.kind === "group")!;
    expect(group.title).toBe("Debate Club");
    expect(await sendMessage(amara, group.id, "Hello everyone!")).toMatchObject({ ok: true });
    expect(await sendMessage(amara, group.id, "text me 08031234567")).toEqual({ ok: false, code: "blocked_phone" });
    expect(await sendMessage(outsider, group.id, "hi")).toEqual({ ok: false, code: "not_allowed" });
    expect(await readThread(outsider, group.id)).toBeNull();
    expect(await unreadCount(bisi.personId)).toBe(1);
    const read = await readThread(bisi, group.id);
    expect(read?.messages.map((m) => m.body)).toEqual(["Hello everyone!"]);
    expect(await unreadCount(bisi.personId)).toBe(0);
  });

  it("allows private chat only between a coach and a student of the same group", async () => {
    expect(await openDirect(amara, cohortId, bisi.personId)).toEqual({ ok: false, code: "not_allowed" });
    expect(await openDirect(coach, otherCohortId, outsider.personId)).toEqual({ ok: false, code: "not_allowed" });
    const d = await openDirect(coach, cohortId, amara.personId);
    expect(d.ok).toBe(true);
    const again = await openDirect(amara, cohortId, coach.personId);
    expect(again).toEqual(d);
    if (!d.ok) return;
    expect(await sendMessage(coach, d.id, "Well done on your opening today.")).toMatchObject({ ok: true });
    expect(await readThread(bisi, d.id)).toBeNull();
    expect((await myChats(coach)).startable.map((x) => x.firstName)).toEqual(["Bisi"]);
  });

  it("staff can read every chat, and it is audited", async () => {
    const chats = await groupChats(admin, cohortId);
    expect(chats.map((c) => c.kind)).toEqual(["direct", "group"]);
    const direct = chats.find((c) => c.kind === "direct")!;
    const r = await readThread(admin, direct.id);
    expect(r?.as).toBe("staff");
    expect(await sendMessage(admin, direct.id, "hello")).toEqual({ ok: false, code: "not_allowed" });
    const logs = await db.select().from(s.auditEvent).where(and(eq(s.auditEvent.action, "chat.view"), eq(s.auditEvent.entityId, direct.id)));
    expect(logs).toHaveLength(1);
    expect(await groupChats(coach, cohortId)).toEqual([]);
  });

  it("a reported message is hidden from the chat and opens a safeguarding case", async () => {
    const group = (await myChats(amara)).threads.find((t) => t.kind === "group")!;
    const sent = await sendMessage(bisi, group.id, "something unkind");
    if (!sent.ok) throw new Error("send failed");
    expect(await reportMessage(amara, sent.id)).toEqual({ ok: true });
    const forStudent = await readThread(amara, group.id);
    expect(forStudent?.messages.find((m) => m.id === sent.id)).toMatchObject({ body: null, reported: true });
    const forStaff = await readThread(admin, group.id);
    expect(forStaff?.messages.find((m) => m.id === sent.id)).toMatchObject({ body: "something unkind", reported: true });
    const [m] = await db.select().from(s.chatMessage).where(eq(s.chatMessage.id, sent.id));
    const [c] = await db.select().from(s.safeguardingCase).where(eq(s.safeguardingCase.id, m!.caseId!));
    expect(c).toMatchObject({ category: "online", source: "in_app", aboutPersonId: bisi.personId, cohortId });
  });
});
