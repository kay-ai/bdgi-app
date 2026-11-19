import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, lookupHash } from "@/lib/crypto";
import { Forbidden } from "@/server/permissions/assert";
import type { Actor } from "@/server/permissions/can";
import { decide, loadConsentRequest, withdraw } from "@/server/services/consent";
import { reissueConsent, runConsentReminders } from "@/server/services/consent-reminders";
import { remindGuardian, submitStudent } from "@/server/services/intake";
import { MissingVariable, dispatch, queueTemplate, quietUntil, sendDueMessages } from "@/server/services/messaging";
import type { StudentIntake } from "@/server/validation/join";
import { setupDb } from "./support/db";

/** M4 acceptance (spec/14): join, guardian permission, withdrawal, reminders and the sending rules. */

const DAY = 86_400_000;
const ctx = { actor: null, locale: "en" as const, ip: "203.0.113.7", userAgent: "vitest" };
let stateId = "";
let schoolId = "";
let programmeId = "";
let seq = 0;

async function setQuiet(start: string, end: string) {
  await db.update(s.setting).set({ value: { start, end } }).where(eq(s.setting.key, "quiet_hours"));
}

beforeAll(async () => {
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "M4", name: "M4 State", isActive: true }).returning();
  const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "M4 LGA", geoCode: "M4-001" }).returning();
  const [sc] = await db.insert(s.school).values({ name: "M4 Girls High", stateId: st!.id, lgaId: lg!.id }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  schoolId = sc!.id;
  programmeId = pr!.id;
});

// The flow tests run at whatever time the suite runs; quiet hours get their own tests below.
beforeEach(async () => {
  await setQuiet("00:00", "00:00");
});

function intake(over: { firstName?: string; surname?: string; age?: number; phone?: string; guardianPhone?: string } = {}): StudentIntake {
  seq++;
  return {
    clientId: randomUUID(),
    startedAt: Date.now() - 60_000,
    about: {
      firstName: over.firstName ?? `Ada${String.fromCharCode(96 + (seq % 26) + 1)}`,
      surname: over.surname ?? "Okafor",
      age: over.age ?? 13,
      gender: "female",
      classLevel: "JSS2",
      stateId,
      lgaId: "",
      schoolId,
      schoolOther: "",
    },
    dreams: { dreamCareer: "Engineer", interests: ["stem"], communityDream: "", programmeIds: [programmeId] },
    help: { needs: ["confidence"], schoolSubject: "", needsOther: "", deviceAccess: "own_smartphone" },
    contact: {
      language: "en",
      email: "",
      guardianEmail: "",
      phone: over.phone ?? `+234810${String(1000000 + seq).slice(-7)}`,
      guardianName: "Ngozi Okafor",
      guardianRelationship: "mother",
      guardianPhone: over.guardianPhone ?? `+234803${String(2000000 + seq).slice(-7)}`,
      guardianChannel: "whatsapp",
      avatarKey: "a03",
    },
    checkin: { q1: 3, q2: 4, q3: 2, q4: 5, q5: 3, privacy: true },
  };
}

async function messagesFor(personId: string, templateKey?: string) {
  return db
    .select()
    .from(s.message)
    .where(templateKey ? and(eq(s.message.personId, personId), eq(s.message.templateKey, templateKey)) : eq(s.message.personId, personId))
    .orderBy(s.message.createdAt);
}

async function guardianOf(studentId: string) {
  const [l] = await db.select().from(s.guardianLink).where(eq(s.guardianLink.studentId, studentId));
  return l!.guardianId;
}

/** Read the link token and code out of the newest consent message, as the guardian would. */
async function linkAndCode(studentId: string) {
  const msgs = (await messagesFor(await guardianOf(studentId))).filter((m) => /^consent\.(request|reminder)$/.test(m.templateKey ?? ""));
  const body = decrypt(msgs.at(-1)!.bodyRendered)!;
  return { token: /\/consent\/([\w-]+)/.exec(body)![1]!, code: /(\d{6})/.exec(body.replace(/\/consent\/[\w-]+/, ""))![1]! };
}

async function submit(over: Parameters<typeof intake>[0] = {}) {
  const r = await submitStudent({ ...ctx, ip: `198.51.100.${seq % 250}` }, intake(over));
  if (!r.ok) throw new Error(`intake failed: ${r.error.code}`);
  return r.data;
}

describe("student intake (spec/05 §2)", () => {
  it("queues the guardian's request within 5 seconds and never stores the code in plain text", async () => {
    const started = Date.now();
    const r = await submit();
    const [student] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    expect(student!.status).toBe("pending_consent");
    const [request] = await messagesFor(await guardianOf(r.personId), "consent.request");
    expect(request!.createdAt.getTime() - started).toBeLessThan(5_000);
    expect(request!.status).toBe("sent");
    expect(request!.variables).toEqual({});
    expect(decrypt(request!.bodyRendered)).toMatch(/Reply STOP to stop messages\.$/);
    // The student's own welcome is allowed before consent.
    const [welcome] = await messagesFor(r.personId, "student.welcome");
    expect(welcome!.status).toBe("sent");
  });

  it("a duplicate submission does not create a second person", async () => {
    const first = intake({ firstName: "Zainab", surname: "Bello" });
    const a = await submitStudent(ctx, first);
    const b = await submitStudent({ ...ctx, ip: "198.51.100.251" }, { ...first, clientId: randomUUID() });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.data.personId).toBe(a.data.personId);
    expect(b.data.duplicate).toBe(true);
    const [n] = await db.select({ n: count() }).from(s.person).where(and(eq(s.person.firstName, "Zainab"), isNull(s.person.deletedAt)));
    expect(n!.n).toBe(1);
    // Same guardian phone + first name, different spelling of the surname: still the same girl.
    const c = await submitStudent({ ...ctx, ip: "198.51.100.252" }, { ...intake({ firstName: "zainab", surname: "Belo", guardianPhone: first.contact.guardianPhone }) });
    expect(c.ok && c.data.personId).toBe(a.data.personId);
    const guardians = await db.select().from(s.person).where(eq(s.person.phoneHash, lookupHash(first.contact.guardianPhone)));
    expect(guardians).toHaveLength(1);
  });

  it("an adult records her own consent and goes straight to review", async () => {
    const r = await submit({ age: 19 });
    const [p] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    expect(p!.status).toBe("pending_review");
    const [c] = await db.select().from(s.consent).where(eq(s.consent.studentId, r.personId));
    expect(c).toMatchObject({ type: "participation", method: "self_adult" });
  });
});

describe("guardian permission (spec/05 §3)", () => {
  it("gives permission: student moves to pending_review and the four consent types are stored", async () => {
    const r = await submit();
    const { token, code } = await linkAndCode(r.personId);
    expect((await loadConsentRequest(token)).state).toBe("open");

    const res = await decide(ctx, { token, code, fullName: "Ngozi Okafor", give: true, photo: true, aiPractice: true, stories: false });
    expect(res).toEqual({ ok: true, given: true });
    const [student] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    expect(student!.status).toBe("pending_review");

    const rows = await db.select().from(s.consent).where(and(eq(s.consent.studentId, r.personId), isNull(s.consent.withdrawnAt)));
    const byType = Object.fromEntries(rows.map((c) => [c.type, c]));
    expect(Object.keys(byType).sort()).toEqual(["ai_practice", "participation", "photo"]);
    for (const c of rows) {
      expect(c.method).toBe("guardian_otp");
      expect(c.givenAt).toBeInstanceOf(Date);
      expect(c.textVersion).toBeTruthy();
      expect(c.ip).toBe("203.0.113.7");
      expect(c.userAgent).toBe("vitest");
      expect(decrypt(c.guardianFullName)).toBe("Ngozi Okafor");
    }

    // Changing the choices later: photo off, stories on.
    const again = await decide(ctx, { token, code, fullName: "Ngozi Okafor", give: true, photo: false, aiPractice: true, stories: true });
    expect(again.ok).toBe(true);
    const now = await db.select().from(s.consent).where(and(eq(s.consent.studentId, r.personId), isNull(s.consent.withdrawnAt)));
    expect(now.map((c) => c.type).sort()).toEqual(["ai_practice", "participation", "stories"]);
    expect((await loadConsentRequest(token)).current).toEqual({ participation: true, photo: false, ai_practice: true, stories: true });

    expect((await messagesFor(await guardianOf(r.personId), "consent.thanks"))[0]!.status).toBe("sent");
    expect((await messagesFor(r.personId, "student.consent_given"))[0]!.status).toBe("sent");
  });

  it("five wrong codes lock the code; a new message unlocks with a new code", async () => {
    const r = await submit();
    const { token, code } = await linkAndCode(r.personId);
    const wrong = code === "000000" ? "111111" : "000000";
    const base = { token, fullName: "Ngozi Okafor", give: true, photo: false, aiPractice: false, stories: false };
    for (let left = 4; left >= 1; left--) expect(await decide(ctx, { ...base, code: wrong })).toEqual({ ok: false, code: "bad_code", left });
    expect(await decide(ctx, { ...base, code: wrong })).toEqual({ ok: false, code: "locked" });
    expect(await decide(ctx, { ...base, code })).toEqual({ ok: false, code: "locked" });
    expect((await loadConsentRequest(token)).state).toBe("locked");

    expect((await remindGuardian(ctx, r.personId)).ok).toBe(true);
    const fresh = await linkAndCode(r.personId);
    expect(fresh.token).not.toBe(token);
    expect((await loadConsentRequest(token)).state).toBe("invalid");
    expect((await decide(ctx, { ...base, token: fresh.token, code: fresh.code })).ok).toBe(true);
  });

  it("declining marks the student declined, thanks the guardian and opens a staff task", async () => {
    const r = await submit();
    const { token, code } = await linkAndCode(r.personId);
    expect(await decide(ctx, { token, code, fullName: "Ngozi Okafor", give: false, photo: false, aiPractice: false, stories: false })).toEqual({
      ok: true,
      given: false,
    });
    const [p] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    expect(p!.status).toBe("declined");
    expect((await messagesFor(await guardianOf(r.personId), "consent.declined_ack"))[0]!.status).toBe("sent");
    const [t] = await db.select().from(s.task).where(eq(s.task.dedupeKey, `consent_declined:${r.personId}`));
    expect(t).toBeDefined();
  });

  it("withdrawal removes the student from cohorts and stops her messages", async () => {
    const r = await submit();
    const { token, code } = await linkAndCode(r.personId);
    await decide(ctx, { token, code, fullName: "Ngozi Okafor", give: true, photo: true, aiPractice: false, stories: false });
    const [cohort] = await db
      .insert(s.cohort)
      .values({ programmeId, schoolId, name: "Debate M4", term: "2026/27 T1", startsOn: "2026-09-15", endsOn: "2026-12-10" })
      .returning();
    await db.insert(s.cohortMember).values({ cohortId: cohort!.id, personId: r.personId, role: "student", joinedOn: "2026-09-15" });
    await db.update(s.person).set({ status: "active" }).where(eq(s.person.id, r.personId));

    expect(await withdraw(ctx, token, code)).toEqual({ ok: true });

    const [p] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    expect(p!.status).toBe("left");
    const [m] = await db.select().from(s.cohortMember).where(eq(s.cohortMember.personId, r.personId));
    expect(m!.leftOn).not.toBeNull();
    expect(m!.leftReason).toBe("consent_withdrawn");
    const live = await db.select().from(s.consent).where(and(eq(s.consent.studentId, r.personId), isNull(s.consent.withdrawnAt)));
    expect(live).toHaveLength(0);
    expect((await messagesFor(await guardianOf(r.personId), "consent.withdrawn"))[0]!.status).toBe("sent");
    expect((await loadConsentRequest(token)).state).toBe("withdrawn");

    // Nothing else reaches her now.
    const id = await queueTemplate({
      templateKey: "student.placed",
      to: decrypt(p!.phone)!,
      channel: "whatsapp",
      personId: r.personId,
      vars: { firstName: "x", cohortName: "x", date: "x", time: "x", venue: "x", coachName: "x" },
      eventKey: `test.placed:${r.personId}`,
    });
    expect(id).toBeNull();
    const [skipped] = await messagesFor(r.personId, "student.placed");
    expect(skipped).toMatchObject({ status: "skipped", error: "consent:left" });
  });

  it("only allow-before-consent templates reach a student still waiting for permission", async () => {
    const r = await submit();
    const [p] = await db.select().from(s.person).where(eq(s.person.id, r.personId));
    const to = decrypt(p!.phone)!;
    const vars = { firstName: "x", programmeName: "x", schoolName: "x" };
    expect(await queueTemplate({ templateKey: "student.waitlisted", to, channel: "sms", personId: r.personId, vars, eventKey: `t.wl:${r.personId}` })).toBeNull();
    const ok = await queueTemplate({ templateKey: "auth.otp", to, channel: "sms", personId: r.personId, vars: { code: "123456" }, eventKey: `t.otp:${r.personId}`, storeVars: false });
    expect(ok).not.toBeNull();
  });
});

describe("consent reminders (spec/05 §3)", () => {
  it("reminds on day 2 and day 6, flags day 10, stops at day 14, and each step happens once", async () => {
    const r = await submit();
    const [c] = await db.select().from(s.consent).where(eq(s.consent.studentId, r.personId));
    const at = (days: number) => new Date(c!.requestedAt.getTime() + days * DAY);
    const guardian = await guardianOf(r.personId);
    const reminders = async () => (await messagesFor(guardian, "consent.reminder")).length;
    const stalled = async () =>
      db.select().from(s.task).where(and(eq(s.task.kind, "consent_stalled"), eq(s.task.entityId, r.personId)));

    await runConsentReminders(at(1.5));
    expect(await reminders()).toBe(0);

    const before = await linkAndCode(r.personId);
    await runConsentReminders(at(2.1));
    await runConsentReminders(at(2.2));
    expect(await reminders()).toBe(1);
    const after = await linkAndCode(r.personId);
    expect(after.token).not.toBe(before.token); // only hashes are stored, so a reminder carries a new link
    expect((await loadConsentRequest(before.token)).state).toBe("invalid");
    expect((await loadConsentRequest(after.token)).state).toBe("open");
    const [rem] = await messagesFor(guardian, "consent.reminder");
    expect(rem!.variables).toEqual({});

    await runConsentReminders(at(6.1));
    await runConsentReminders(at(9));
    expect(await reminders()).toBe(2);
    expect(await stalled()).toHaveLength(0);

    await runConsentReminders(at(10.1));
    await runConsentReminders(at(11));
    expect(await stalled()).toHaveLength(1);
    expect((await stalled())[0]!.detail).toContain("school route");
    expect(await reminders()).toBe(2);

    // The day-6 reminder replaced the day-2 link in turn.
    expect((await loadConsentRequest(after.token)).state).toBe("invalid");
    expect((await loadConsentRequest((await linkAndCode(r.personId)).token)).state).toBe("open");

    // Day 14: the link has expired; nothing more is sent.
    expect((await runConsentReminders(at(14.5))).pending).toBe(0);
    expect(await reminders()).toBe(2);
  });

  it("staff can reissue an expired link; others cannot", async () => {
    const r = await submit();
    const admin: Actor = {
      userId: randomUUID(),
      personId: r.personId, // any real person id works for the audit row
      firstName: "Admin",
      roles: [{ role: "admin", stateId: null }],
      childIds: [],
      coachCohortIds: [],
      championSchoolIds: [],
    };
    const volunteer: Actor = { ...admin, roles: [{ role: "volunteer", stateId: null }] };
    const later = new Date(Date.now() + 15 * DAY);
    await expect(reissueConsent(volunteer, r.personId, { now: later })).rejects.toBeInstanceOf(Forbidden);
    expect(await reissueConsent(admin, r.personId, { now: later })).toEqual({ ok: true });
    const [c] = await db.select().from(s.consent).where(eq(s.consent.studentId, r.personId));
    expect(c!.expiresAt!.getTime()).toBe(later.getTime() + 14 * DAY);
    const { token, code } = await linkAndCode(r.personId);
    expect((await loadConsentRequest(token)).state).toBe("open");
    expect((await decide(ctx, { token, code, fullName: "Ngozi Okafor", give: true, photo: false, aiPractice: false, stories: false })).ok).toBe(true);
  });
});

describe("sending rules (spec/08 §2)", () => {
  // 21:30 in Lagos is 20:30 UTC.
  const lateEvening = new Date("2026-11-18T20:30:00Z");

  it("knows Lagos quiet hours", () => {
    expect(quietUntil(lateEvening)?.toISOString()).toBe("2026-11-19T06:00:00.000Z"); // 07:00 WAT
    expect(quietUntil(new Date("2026-11-19T05:59:00Z"))?.toISOString()).toBe("2026-11-19T06:00:00.000Z");
    expect(quietUntil(new Date("2026-11-19T06:00:00Z"))).toBeNull();
    expect(quietUntil(new Date("2026-11-18T12:00:00Z"))).toBeNull();
    expect(quietUntil(lateEvening, { start: "00:00", end: "00:00" })).toBeNull();
  });

  it("holds phone messages until 07:00, but not sign-in codes or email", async () => {
    await setQuiet("21:00", "07:00");
    const to = `+234809${String(3000000 + ++seq).slice(-7)}`;
    const held = await queueTemplate({
      templateKey: "school.request_received",
      to,
      channel: "sms",
      vars: { name: "Mrs Ade", schoolName: "M4 Girls High" },
      eventKey: `t.quiet:${seq}`,
      now: lateEvening,
    });
    const otp = await queueTemplate({ templateKey: "auth.otp", to, channel: "sms", vars: { code: "123456" }, eventKey: `t.quiet.otp:${seq}`, now: lateEvening, storeVars: false });
    const mail = await queueTemplate({
      templateKey: "school.request_received",
      to: "head@example.test",
      channel: "email",
      vars: { name: "Mrs Ade", schoolName: "M4 Girls High" },
      eventKey: `t.quiet.mail:${seq}`,
      now: lateEvening,
    });
    await dispatch([held!, otp!, mail!], lateEvening);
    const status = async (id: string) => (await db.select().from(s.message).where(eq(s.message.id, id)))[0]!.status;
    expect(await status(held!)).toBe("queued");
    expect(await status(otp!)).toBe("sent");
    expect(await status(mail!)).toBe("sent");

    await sendDueMessages(new Date("2026-11-19T05:30:00Z"));
    expect(await status(held!)).toBe("queued");
    await sendDueMessages(new Date("2026-11-19T06:01:00Z"));
    expect(await status(held!)).toBe("sent");
  });

  it("adds the opt-out line to WhatsApp and SMS, but not to codes or email", async () => {
    const base = { vars: { name: "A", schoolName: "B" } };
    const sms = await queueTemplate({ ...base, templateKey: "school.request_received", to: "+2348090000001", channel: "sms", eventKey: `t.stop.sms:${++seq}` });
    const mail = await queueTemplate({ ...base, templateKey: "school.request_received", to: "a@example.test", channel: "email", eventKey: `t.stop.mail:${seq}` });
    const otp = await queueTemplate({ templateKey: "auth.otp", to: "+2348090000001", channel: "sms", vars: { code: "1" }, eventKey: `t.stop.otp:${seq}` });
    const body = async (id: string) => decrypt((await db.select().from(s.message).where(eq(s.message.id, id)))[0]!.bodyRendered)!;
    expect(await body(sms!)).toMatch(/Reply STOP to stop messages\.$/);
    expect(await body(mail!)).not.toContain("STOP");
    expect(await body(otp!)).not.toContain("STOP");
  });

  it("respects STOP, except for codes, safeguarding and a first consent request", async () => {
    const to = "+2348091112233";
    await db.insert(s.channelOptOut).values({ addressHash: lookupHash(to), channel: "sms" }).onConflictDoNothing();
    const n = ++seq;
    expect(await queueTemplate({ templateKey: "school.request_received", to, channel: "sms", vars: { name: "A", schoolName: "B" }, eventKey: `t.opt.u:${n}` })).toBeNull();
    expect(await queueTemplate({ templateKey: "auth.otp", to, channel: "sms", vars: { code: "1" }, eventKey: `t.opt.a:${n}` })).not.toBeNull();
    expect(
      await queueTemplate({ templateKey: "concern.received", to, channel: "sms", vars: { reference: "SG-2026-0001" }, eventKey: `t.opt.s:${n}` }),
    ).not.toBeNull();

    const [g] = await db
      .insert(s.person)
      .values({ firstName: "Opted", surname: "x", gender: "female", status: "active", phoneHash: lookupHash(to) })
      .returning();
    const req = { templateKey: "consent.request", to, channel: "sms" as const, personId: g!.id, vars: { guardianName: "A", studentFirstName: "B", schoolName: "C", link: "L", code: "1", orgPhone: "P" } };
    expect(await queueTemplate({ ...req, eventKey: `t.opt.c1:${n}` })).not.toBeNull();
    expect(await queueTemplate({ ...req, eventKey: `t.opt.c2:${n}` })).toBeNull();
  });

  it("fails loudly when a template variable is missing", async () => {
    await expect(
      queueTemplate({ templateKey: "school.request_received", to: "+2348090000002", channel: "sms", vars: { name: "A" }, eventKey: `t.missing:${++seq}` }),
    ).rejects.toBeInstanceOf(MissingVariable);
  });
});
