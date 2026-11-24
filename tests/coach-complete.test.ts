import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import type { Actor } from "@/server/permissions/can";
import { userMessage } from "@/server/coach/prompt";
import { computeMetrics } from "@/server/coach/metrics";
import { setupDb } from "./support/db";

/**
 * Completing the coach (spec/12, D-015): individual coaching, staff controls, usage and cost,
 * read-aloud, transcript retention, coaches supervising the AI, and the WhatsApp voice-note bot.
 */

process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "bgdi-coach-"));

const voice = { synth: vi.fn(async (_: string) => new Uint8Array([1, 2, 3, 4])) };
let ttsOn = false;
vi.mock("@/server/providers/tts", () => ({ speaker: () => (ttsOn ? { name: "fake", synthesize: voice.synth } : null) }));

const speech = await import("@/server/services/speech");
const admin = await import("@/server/services/coach-admin");
const bot = await import("@/server/services/speech-bot");
const sup = await import("@/server/services/coach-supervision");

const audio = new Uint8Array(4000).fill(7);
let stateId = "";
let schoolId = "";
let programmeId = "";
let seq = 0;

const studentActor = (personId: string): Actor => ({ userId: "u", personId, firstName: "Ada", roles: [{ role: "student", stateId }], childIds: [], coachCohortIds: [], championSchoolIds: [] });
const staff = (role: "admin" | "programme_manager" | "state_lead", personId = "00000000-0000-0000-0000-0000000000aa"): Actor => ({
  userId: "s",
  personId,
  firstName: "Staff",
  roles: [{ role, stateId: role === "state_lead" ? stateId : null }],
  childIds: [],
  coachCohortIds: [],
  championSchoolIds: [],
});
const ctxOf = (actor: Actor | null) => ({ actor, locale: "en" as const, ip: null, userAgent: "vitest" });

async function makeStudent(opts: { phone?: string; status?: "active" | "pending_review" } = {}) {
  seq++;
  const [p] = await db
    .insert(s.person)
    .values({
      firstName: `Ada${"abcdefghijklmnopqrstuvwxyz"[seq % 26]}`,
      surname: "x",
      gender: "female",
      status: opts.status ?? "active",
      ageAtSignup: 14,
      stateId,
      phone: opts.phone ?? null,
      phoneHash: opts.phone ? lookupHash(opts.phone) : null,
    })
    .returning();
  await db.insert(s.personRole).values({ personId: p!.id, role: "student" });
  await db.insert(s.consent).values({ studentId: p!.id, type: "ai_practice", method: "guardian_otp", givenAt: new Date(), textVersion: "t" });
  return p!;
}

async function makeCohort(ai: boolean) {
  seq++;
  const [c] = await db
    .insert(s.cohort)
    .values({ programmeId, schoolId, name: `Debate ${seq}`, term: "2026/27 T1", startsOn: "2026-09-15", endsOn: "2026-12-10", aiCoachEnabled: ai, status: "running" })
    .returning();
  return c!;
}

const join = (cohortId: string, personId: string, role: "student" | "lead_coach" = "student") =>
  db.insert(s.cohortMember).values({ cohortId, personId, role, joinedOn: "2026-09-15" });

beforeAll(async () => {
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "CC", name: "Coach State", isActive: true }).returning();
  const [lg] = await db.insert(s.lga).values({ stateId: st!.id, name: "CC LGA", geoCode: "CC-001" }).returning();
  const [sc] = await db.insert(s.school).values({ name: "Coach Girls High", stateId: st!.id, lgaId: lg!.id }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  schoolId = sc!.id;
  programmeId = pr!.id;
  await db.insert(s.person).values({ id: "00000000-0000-0000-0000-0000000000aa", firstName: "Staff", surname: "s", gender: "female", status: "active" });
  await db.insert(s.motion).values([
    { textEn: "This house would ban homework for junior students", difficulty: "starter" },
    { textEn: "This house believes girls should learn to code", difficulty: "starter" },
  ]);
});

describe("each student is coached on her own (D-015)", () => {
  it("her group never decides whether she may practise, but her speeches are filed under it", async () => {
    const p = await makeStudent();
    expect((await speech.eligibility(p.id)).ok).toBe(true); // not in any group yet
    const c = await makeCohort(false); // the old per-group flag is ignored
    await join(c.id, p.id);
    expect((await speech.eligibility(p.id)).ok).toBe(true);
    const r = await speech.createAttempt(ctxOf(studentActor(p.id)), { audio, contentType: "audio/webm", durationHint: 90, kind: "placement" });
    expect(r.ok).toBe(true);
    const [a] = await db.select().from(s.speechAttempt).where(eq(s.speechAttempt.id, (r as { id: string }).id));
    expect(a!.cohortId).toBe(c.id);
    expect(a!.channel).toBe("web");
  });

  it("the pilot flag is for programme managers and admins only", async () => {
    const c = await makeCohort(false);
    expect(await admin.setCohortPilot(ctxOf(staff("admin")), c.id, true)).toBe(true);
    await expect(admin.setCohortPilot(ctxOf(staff("state_lead")), c.id, false)).rejects.toThrow();
    const [row] = await db.select().from(s.cohort).where(eq(s.cohort.id, c.id));
    expect(row!.isPilotGroup).toBe(true);
  });
});

describe("staff controls (/console/ai)", () => {
  it("only programme managers and admins may change the coach", async () => {
    await expect(admin.aiAdmin(staff("state_lead"))).rejects.toThrow();
    await expect(admin.saveMotion(ctxOf(staff("state_lead")), { textEn: "This house would plant more trees", difficulty: "starter" })).rejects.toThrow();
    expect((await admin.aiAdmin(staff("programme_manager"))).motions.length).toBeGreaterThanOrEqual(2);
  });

  it("saves settings, and the kill switch stops new speeches", async () => {
    const pm = ctxOf(staff("programme_manager"));
    const base = await speech.coachSettings();
    expect(await admin.saveAiSettings(pm, { ...base, minSeconds: 200 })).toEqual({ ok: false, code: "invalid" });
    expect(await admin.saveAiSettings(pm, { ...base, enabled: false, cap: 5, anchors: "Reward examples from Nigeria." })).toEqual({ ok: true });
    const now = await speech.coachSettings();
    expect(now).toMatchObject({ enabled: false, cap: 5, anchors: "Reward examples from Nigeria." });
    const p = await makeStudent();
    expect(await speech.eligibility(p.id)).toMatchObject({ ok: false, reason: "disabled" });
    const [row] = await db.select().from(s.auditEvent).where(eq(s.auditEvent.action, "ai.settings"));
    expect(row!.meta).toMatchObject({ changed: expect.arrayContaining(["enabled", "cap", "anchors"]) });
    await admin.saveAiSettings(pm, { ...base, enabled: true, cap: 8, anchors: "" });
  });

  it("rubric guidance goes into the prompt as data", () => {
    const m = computeMetrics([{ w: "hello", start: 0, end: 1, conf: 1 }], 60);
    const msg = JSON.parse(userMessage({ firstName: "Ada", motion: "M", side: "for", kind: "free", lesson: null, weakestSkills: [], transcript: "t", metrics: m, anchors: "Be strict on examples." }));
    expect(msg.rubricAnchors).toBe("Be strict on examples.");
    expect(JSON.parse(userMessage({ firstName: "Ada", motion: "M", side: "for", kind: "free", lesson: null, weakestSkills: [], transcript: "t", metrics: m })).rubricAnchors).toBeUndefined();
  });

  it("adds, edits, retires and imports motions without duplicates", async () => {
    const pm = ctxOf(staff("programme_manager"));
    const add = await admin.saveMotion(pm, { textEn: "This house would make school uniforms optional", difficulty: "intermediate", sdg: 4 });
    expect(add.ok).toBe(true);
    expect(await admin.saveMotion(pm, { textEn: "THIS HOUSE WOULD MAKE SCHOOL UNIFORMS OPTIONAL", difficulty: "starter" })).toEqual({ ok: false, code: "duplicate" });
    const id = (add as { id: string }).id;
    expect((await admin.saveMotion(pm, { id, textEn: "This house would make school uniforms optional on Fridays", difficulty: "intermediate" })).ok).toBe(true);
    expect(await admin.setMotionActive(pm, id, false)).toBe(true);
    expect((await speech.motionsFor()).some((m) => m.id === id)).toBe(false);

    expect(admin.parseMotionList("1. This house would ban plastic bags\nadvanced | This house believes exams should be abolished\nshort", "starter")).toEqual([
      { textEn: "This house would ban plastic bags", difficulty: "starter" },
      { textEn: "This house believes exams should be abolished", difficulty: "advanced" },
    ]);
    const r = await admin.importMotions(pm, "This house would ban plastic bags\nThis house would ban homework for junior students\nadvanced | This house believes exams should be abolished", "intermediate");
    expect(r).toEqual({ added: 2, skipped: 1 });
    const [m] = await db.select().from(s.motion).where(eq(s.motion.textEn, "This house believes exams should be abolished"));
    expect(m!.difficulty).toBe("advanced");
  });

  it("usage and estimated cost count this month's speeches", async () => {
    const p = await makeStudent();
    await db.insert(s.speechAttempt).values([
      { personId: p.id, side: "for", channel: "web", kind: "free", status: "done", durationSeconds: "120", tokensIn: 1_000_000, tokensOut: 100_000, modelId: "openai/gpt-oss-120b", overallStars: 4 },
      { personId: p.id, side: "for", channel: "whatsapp", kind: "free", status: "rejected", durationSeconds: "60" },
    ]);
    const u = await admin.aiUsage();
    expect(u.scored).toBeGreaterThanOrEqual(1);
    expect(u.rejected).toBeGreaterThanOrEqual(1);
    expect(u.viaWhatsapp).toBeGreaterThanOrEqual(1);
    // 3 audio minutes on Amazon Transcribe + 1M/0.1M tokens on gpt-oss-120b.
    expect(admin.estimateCost({ audioMinutes: 3, tokensIn: 1_000_000, tokensOut: 100_000, model: "openai/gpt-oss-120b", transcriber: "aws" })).toBeCloseTo(3 * 0.024 + 0.15 + 0.06, 5);
    expect(admin.estimateCost({ audioMinutes: 3, tokensIn: 5000, tokensOut: 500, model: "console", transcriber: "console" })).toBe(0);
  });
});

describe("staff and coach views (spec/12 §4)", () => {
  it("the cohort tab lists speeches per student and who hasn't tried", async () => {
    const c = await makeCohort(true);
    const keen = await makeStudent();
    const shy = await makeStudent();
    await join(c.id, keen.id);
    await join(c.id, shy.id);
    await db.insert(s.speechAttempt).values({ personId: keen.id, cohortId: c.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 3 });
    const d = (await admin.cohortAi(staff("admin"), c.id))!;
    expect(d.tried.map((r) => r.personId)).toEqual([keen.id]);
    expect(d.notTried.map((r) => r.personId)).toEqual([shy.id]);
    expect(d.tried[0]).toMatchObject({ attemptsMonth: 1, avgStars: 3 });
  });

  it("staff see transcripts, and the read is audited", async () => {
    const p = await makeStudent();
    await db.insert(s.speechAttempt).values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 4, transcript: encrypt("My speech about school") });
    const admins = staff("admin");
    const d = (await admin.studentAttempts(ctxOf(admins), p.id))!;
    expect(d.attempts[0]!.transcript).toBe("My speech about school");
    const [log] = await db.select().from(s.auditEvent).where(and(eq(s.auditEvent.action, "speech.view_transcript"), eq(s.auditEvent.subjectPersonId, p.id)));
    expect(log).toBeTruthy();
    // A state lead from another state can't.
    const otherLead: Actor = { ...staff("state_lead"), roles: [{ role: "state_lead", stateId: "00000000-0000-0000-0000-000000000001" }] };
    await expect(admin.studentAttempts(ctxOf(otherLead), p.id)).rejects.toThrow();
  });

});

describe("human coaches supervise the AI (D-015)", () => {
  async function setup() {
    const c = await makeCohort(false);
    const [coach] = await db.insert(s.person).values({ firstName: "Coach", surname: "y", gender: "female", status: "active" }).returning();
    await db.insert(s.personRole).values({ personId: coach!.id, role: "volunteer" });
    await join(c.id, coach!.id, "lead_coach");
    const actor: Actor = { userId: "c", personId: coach!.id, firstName: "Coach", roles: [{ role: "volunteer", stateId: null }], childIds: [], coachCohortIds: [c.id], championSchoolIds: [] };
    const student = async () => {
      const p = await makeStudent();
      await join(c.id, p.id);
      await db.insert(s.consent).values({ studentId: p.id, type: "participation", method: "guardian_otp", givenAt: new Date(), textVersion: "t" });
      return p;
    };
    return { c, actor, student };
  }
  const fb = (next: string, usedFallback = false) => ({
    strengths: ["Clear opening."],
    nextSteps: [next],
    encouragement: "Great",
    betterLine: { original: "I think it good", improved: "It is good because it helps us.", why: "Gives a reason" },
    focus: null,
    usedFallback,
  });
  const DAY = 86_400_000;

  it("shows each student's own progress, flags who needs a look, and never shows transcripts", async () => {
    const { c, actor, student } = await setup();
    const keen = await student();
    const quiet = await student();
    const newbie = await student();
    const hidden = await makeStudent(); // in the group, but no participation permission
    await join(c.id, hidden.id);
    for (const [i, stars] of [1, 2, 2].entries())
      await db.insert(s.speechAttempt).values({ personId: keen.id, cohortId: c.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: stars, transcript: encrypt("secret words"), feedback: fb(`Step ${i}`), createdAt: new Date(Date.now() - i * 1000) });
    await db.insert(s.speechAttempt).values({ personId: quiet.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 4, feedback: fb("x"), createdAt: new Date(Date.now() - 20 * DAY) });

    const [g] = await sup.supervision(actor);
    expect(g!.students.map((x) => x.id).sort()).toEqual([keen.id, quiet.id, newbie.id].sort());
    const k = g!.students.find((x) => x.id === keen.id)!;
    expect(k).toMatchObject({ scored: 3, unreviewed: 3 });
    expect(k.recentStars!).toBeLessThanOrEqual(2);
    expect(k.attention).toContain("low_stars");
    expect(g!.students.find((x) => x.id === quiet.id)!.attention).toContain("quiet");
    expect(g!.students.find((x) => x.id === newbie.id)!.attention).toContain("never_tried");
    expect(g!.students[g!.students.length - 1]!.attention.length).toBeLessThanOrEqual(k.attention.length);

    const detail = (await sup.studentForCoach(actor, keen.id))!;
    expect(detail.scorecards).toHaveLength(3);
    expect(detail.scorecards[0]!.feedback!.betterLine!.improved).toBe("It is good because it helps us.");
    expect(JSON.stringify(detail)).not.toContain("secret words");
    expect(JSON.stringify(detail)).not.toMatch(/transcript/i);
    // Students outside her groups, or without permission, are not hers to see.
    expect(await sup.studentForCoach(actor, hidden.id)).toBeNull();
    expect(await sup.studentForCoach(actor, (await makeStudent()).id)).toBeNull();
  });

  it("a coach's concern about a scorecard reaches staff, who resolve it", async () => {
    const { actor, student } = await setup();
    const p = await student();
    const [a1] = await db.insert(s.speechAttempt).values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 1, feedback: fb("Speak louder"), createdAt: new Date(Date.now() - 1000) }).returning();
    const [a2] = await db.insert(s.speechAttempt).values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 4, feedback: fb("Add an example", true) }).returning();
    const ctx = ctxOf(actor);

    expect(await sup.reviewScorecard(ctx, { attemptId: a1!.id, verdict: "concern" })).toEqual({ ok: false, code: "invalid" }); // a reason is needed
    expect(await sup.reviewScorecard(ctx, { attemptId: a1!.id, verdict: "concern", reason: "score_wrong", note: "She argued well; 1 star is unfair." })).toEqual({ ok: true });
    expect(await sup.reviewScorecard(ctx, { attemptId: a2!.id, verdict: "ok" })).toEqual({ ok: true });
    const [other] = await db.insert(s.speechAttempt).values({ personId: (await makeStudent()).id, side: "for", channel: "web", kind: "free", status: "done" }).returning();
    expect(await sup.reviewScorecard(ctx, { attemptId: other!.id, verdict: "ok" })).toEqual({ ok: false, code: "not_found" });

    const [g] = await sup.supervision(actor);
    const st = g!.students.find((x) => x.id === p.id)!;
    expect(st.unreviewed).toBe(0);
    expect(st.attention).toEqual(expect.arrayContaining(["concern_open", "ai_fallback"]));

    const { open } = await admin.coachReviews();
    const mine = open.find((r) => r.attemptId === a1!.id)!;
    expect(mine).toMatchObject({ studentName: p.firstName, reviewer: "Coach", reason: "score_wrong", note: "She argued well; 1 star is unfair." });
    const [stored] = await db.select().from(s.coachReview).where(eq(s.coachReview.id, mine.id));
    expect(stored!.note).not.toContain("unfair"); // encrypted at rest
    await expect(admin.resolveReview(ctxOf(staff("state_lead")), mine.id, "")).rejects.toThrow();
    const pm = ctxOf(staff("programme_manager"));
    expect(await admin.resolveReview(pm, mine.id, "Rubric guidance updated")).toBe(true);
    expect((await admin.coachReviews()).open.some((r) => r.id === mine.id)).toBe(false);
    const after = (await sup.studentForCoach(actor, p.id))!;
    expect(after.scorecards.find((x) => x.id === a1!.id)).toMatchObject({ myReview: { verdict: "concern" }, resolved: true });
    expect((await admin.studentAttempts(pm, p.id))!.reviews).toHaveLength(2);
  });
});

describe("read-aloud and retention", () => {
  it("reads the feedback with the voice service once, then from storage; without one it says no_tts", async () => {
    const p = await makeStudent();
    const [a] = await db
      .insert(s.speechAttempt)
      .values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", overallStars: 4, feedback: { strengths: ["A"], nextSteps: ["B"], encouragement: "Well done.", betterLine: null, focus: null, usedFallback: false } })
      .returning();
    ttsOn = false;
    expect(await speech.feedbackAudio(studentActor(p.id), a!.id)).toEqual({ ok: false, code: "no_tts" });
    ttsOn = true;
    expect(await speech.feedbackAudio(studentActor(p.id), a!.id)).toMatchObject({ ok: true });
    expect(await speech.feedbackAudio(studentActor(p.id), a!.id)).toMatchObject({ ok: true });
    expect(voice.synth).toHaveBeenCalledTimes(1);
    expect(voice.synth.mock.calls[0]![0]).toBe("Well done. What you did well. A Try this next time. B");
    // Someone else's attempt is not found.
    const other = await makeStudent();
    expect(await speech.feedbackAudio(studentActor(other.id), a!.id)).toEqual({ ok: false, code: "not_found" });
    ttsOn = false;
  });

  it("deletes transcripts older than 12 months", async () => {
    const p = await makeStudent();
    const old = new Date();
    old.setUTCMonth(old.getUTCMonth() - 13);
    const [a] = await db
      .insert(s.speechAttempt)
      .values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", transcript: encrypt("old words"), words: [], createdAt: old })
      .returning();
    const [b] = await db.insert(s.speechAttempt).values({ personId: p.id, side: "for", channel: "web", kind: "free", status: "done", transcript: encrypt("new words") }).returning();
    expect(await speech.purgeOldTranscripts()).toBeGreaterThanOrEqual(1);
    const [after] = await db.select().from(s.speechAttempt).where(eq(s.speechAttempt.id, a!.id));
    const [kept] = await db.select().from(s.speechAttempt).where(eq(s.speechAttempt.id, b!.id));
    expect(after!.transcript).toBeNull();
    expect(after!.words).toBeNull();
    expect(kept!.transcript).not.toBeNull();
  });
});

describe("WhatsApp voice-note coach (spec/12 §7)", () => {
  const phone = "+2348031110001";
  let studentId = "";

  it("doesn't recognise an unknown number", async () => {
    const r = await bot.handleBotMessage({ from: "2348039999999", text: "hi" });
    expect(r.reply).toContain("couldn't find a student");
  });

  it("sends a motion, takes a voice note on it, and answers SCORE and STOP", async () => {
    const p = await makeStudent({ phone });
    studentId = p.id;
    const first = await bot.handleBotMessage({ from: "2348031110001", text: "hello", providerMessageId: "m1" });
    expect(first.reply).toMatch(/^Hi Ada.*Send a voice note/);
    const [state] = await db.select().from(s.botState).where(eq(s.botState.personId, p.id));
    expect(state!.motionId).toBeTruthy();

    const again = await bot.handleBotMessage({ from: "2348031110001", text: "hello", providerMessageId: "m1" });
    expect(again).toEqual({ reply: null, duplicate: true });

    const n = await bot.handleBotMessage({ from: "2348031110001", text: "new", providerMessageId: "m2" });
    const [state2] = await db.select().from(s.botState).where(eq(s.botState.personId, p.id));
    expect(n.reply).toContain("Send a voice note");
    expect(state2!.motionId).not.toBe(state!.motionId);

    const v = await bot.handleBotMessage({ from: "2348031110001", audio: { bytes: audio, contentType: "audio/ogg" }, providerMessageId: "m3" });
    expect(v.reply).toContain("Your coach is listening");
    const [a] = await db.select().from(s.speechAttempt).where(eq(s.speechAttempt.id, v.attemptId!));
    expect(a).toMatchObject({ channel: "whatsapp", motionId: state2!.motionId, personId: p.id });
    expect(await db.select().from(s.botState).where(eq(s.botState.personId, p.id))).toHaveLength(0);

    expect(await speech.processAttempt(v.attemptId!)).toMatchObject({ status: "done" });
    const [result] = await db.select().from(s.message).where(and(eq(s.message.personId, p.id), eq(s.message.templateKey, "speech.result")));
    expect(result!.channel).toBe("whatsapp");

    const sc = await bot.handleBotMessage({ from: "2348031110001", text: "SCORE", providerMessageId: "m4" });
    expect(sc.reply).toMatch(/Your last speech: ★/);
    await bot.handleBotMessage({ from: "2348031110001", text: "new", providerMessageId: "m5" });
    const stop = await bot.handleBotMessage({ from: "2348031110001", text: "stop", providerMessageId: "m6" });
    expect(stop.reply).toContain("cleared your motion");
    expect(await db.select().from(s.botState).where(eq(s.botState.personId, p.id))).toHaveLength(0);
  });

  it("a voice note with no pending motion is an open speech; an ineligible student is told why", async () => {
    // The last speech above may still count as "busy" for a few minutes; use a fresh student.
    const p = await makeStudent({ phone: "+2348031110002" });
    const v = await bot.handleBotMessage({ from: "08031110002", audio: { bytes: audio, contentType: "audio/ogg" } });
    const [a] = await db.select().from(s.speechAttempt).where(eq(s.speechAttempt.id, v.attemptId!));
    expect(a).toMatchObject({ motionId: null, side: "open", channel: "whatsapp" });

    await db.update(s.consent).set({ withdrawnAt: new Date() }).where(eq(s.consent.studentId, studentId));
    const r = await bot.handleBotMessage({ from: phone, text: "NEW" });
    expect(r.reply).toContain("needs to allow AI speech practice");
    expect(p.id).toBeTruthy();
  });

  it("a guardian's phone works for an only child, and not for several", async () => {
    const child = await makeStudent();
    const [g] = await db.insert(s.person).values({ firstName: "Mama", surname: "z", gender: "female", status: "active", phone: "+2348031110003", phoneHash: lookupHash("+2348031110003") }).returning();
    await db.insert(s.personRole).values({ personId: g!.id, role: "guardian" });
    await db.insert(s.guardianLink).values({ guardianId: g!.id, studentId: child.id, relationship: "mother" });
    const one = await bot.handleBotMessage({ from: "+2348031110003", text: "hi" });
    expect(one.personId).toBe(child.id);
    const second = await makeStudent();
    await db.insert(s.guardianLink).values({ guardianId: g!.id, studentId: second.id, relationship: "mother" });
    expect((await bot.handleBotMessage({ from: "+2348031110003", text: "hi" })).reply).toContain("More than one student");
  });
});
