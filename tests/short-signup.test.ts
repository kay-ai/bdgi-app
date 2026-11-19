import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, lookupHash } from "@/lib/crypto";
import type { Actor } from "@/server/permissions/can";
import { loadConsentRequest } from "@/server/services/consent";
import { submitStudent } from "@/server/services/intake";
import { contactHandle, readContactHandle } from "@/server/services/join-data";
import { changeContact, profileComplete, saveProfile } from "@/server/services/student-profile";
import { studentIntake, type StudentIntake } from "@/server/validation/join";
import { setupDb } from "./support/db";

/** D-019: sign-up asks only the essentials; the rest is on the Hub profile, and emails can be corrected. */

const ctx = { actor: null, locale: "en" as const, ip: null, userAgent: "vitest" };
let stateId = "";
let programmeId = "";
let seq = 0;
const saved = process.env.CONTACT_MODE;

beforeAll(async () => {
  process.env.CONTACT_MODE = "email";
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "SH", name: "Short State", isActive: true }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  programmeId = pr!.id;
});
afterAll(() => {
  if (saved === undefined) delete process.env.CONTACT_MODE;
  else process.env.CONTACT_MODE = saved;
});

/** Exactly what the three-step form sends. */
function short(over: { email?: string; guardianEmail?: string; age?: number } = {}) {
  seq++;
  return studentIntake.parse({
    clientId: randomUUID(),
    startedAt: Date.now() - 30_000,
    website: "",
    about: { firstName: `Remi${"abcdefghijklmnopqrstuvwxyz"[seq % 26]}`, surname: "Ola", age: over.age ?? 13, gender: "female", classLevel: "JSS1", stateId, lgaId: "", schoolId: "", schoolOther: "Short High" },
    dreams: { programmeIds: [programmeId] },
    contact: { language: "en", phone: "", email: over.email ?? "", guardianName: "Yemi Ola", guardianRelationship: "mother", guardianPhone: "", guardianEmail: over.guardianEmail ?? `yemi${seq}@example.com` },
    checkin: { privacy: true },
  }) satisfies StudentIntake;
}

async function submit(input: StudentIntake) {
  const r = await submitStudent(ctx, input);
  if (!r.ok) throw new Error(`intake failed: ${r.error.code}`);
  return r.data.personId;
}

const actorFor = (personId: string): Actor => ({ userId: randomUUID(), personId, firstName: "Remi", roles: [{ role: "student", stateId }], childIds: [], coachCohortIds: [], championSchoolIds: [] });

async function guardianOf(studentId: string) {
  const [l] = await db.select().from(s.guardianLink).where(eq(s.guardianLink.studentId, studentId));
  return l!.guardianId;
}

async function lastRequest(guardianId: string) {
  const rows = await db
    .select()
    .from(s.message)
    .where(and(eq(s.message.personId, guardianId), eq(s.message.templateKey, "consent.request")))
    .orderBy(s.message.createdAt);
  return rows.at(-1)!;
}

describe("short sign-up", () => {
  it("saves the essentials and leaves the profile to finish later", async () => {
    const id = await submit(short());
    const [intake] = await db.select().from(s.intakeResponse).where(eq(s.intakeResponse.personId, id));
    expect(intake!.programmeIds).toEqual([programmeId]);
    expect(intake!.dreamCareer).toBeNull();
    expect(intake!.completedAt).toBeNull();
    expect(await profileComplete(id)).toBe(false);
    // The guardian's permission request still goes straight away.
    expect((await lastRequest(await guardianOf(id))).channel).toBe("email");
  });

  it("finishing the profile records her answers and baseline", async () => {
    const id = await submit(short());
    await saveProfile(
      { ...ctx, actor: actorFor(id) },
      {
        dreams: { dreamCareer: "Pilot", interests: ["stem"], communityDream: "" },
        help: { needs: ["confidence"], schoolSubject: "", needsOther: "", deviceAccess: "shared_smartphone" },
        checkin: { q1: 2, q2: 3, q3: 4, q4: 5, q5: 1 },
        avatarKey: "a07",
      },
    );
    expect(await profileComplete(id)).toBe(true);
    const [b] = await db.select().from(s.assessment).where(and(eq(s.assessment.personId, id), eq(s.assessment.type, "baseline"), isNull(s.assessment.cohortId)));
    expect(Number(b!.selfScore)).toBe(60);
    const [p] = await db.select().from(s.person).where(eq(s.person.id, id));
    expect(p!.avatarKey).toBe("a07");
  });

  it("lets a girl share the family email with her guardian without becoming her own guardian", async () => {
    const id = await submit(short({ email: "family@example.com", guardianEmail: "family@example.com" }));
    const gId = await guardianOf(id);
    expect(gId).not.toBe(id);
    const [g] = await db.select().from(s.person).where(eq(s.person.id, gId));
    expect(g!.emailHash).toBe(lookupHash("family@example.com"));
  });
});

describe("changing emails after sign-up", () => {
  it("corrects a mistyped guardian email and sends a fresh permission request", async () => {
    const id = await submit(short({ guardianEmail: "mum@exmaple.com" }));
    const gId = await guardianOf(id);
    const oldToken = /\/consent\/([\w-]+)/.exec(decrypt((await lastRequest(gId)).bodyRendered)!)![1]!;
    const r = await changeContact(ctx, id, { guardianEmail: "mum@example.com" });
    expect(r).toEqual({ ok: true, sentTo: "mum@example.com" });
    expect(await guardianOf(id)).toBe(gId); // corrected in place
    const req = await lastRequest(gId);
    expect(decrypt(req.toAddress)).toBe("mum@example.com");
    expect(await loadConsentRequest(oldToken)).toMatchObject({ state: "invalid" });
  });

  it("moves her to an existing guardian when the new email is theirs", async () => {
    const sibling = await submit(short({ guardianEmail: "papa@example.com" }));
    const id = await submit(short({ guardianEmail: "wrong@example.com" }));
    await changeContact(ctx, id, { guardianEmail: "papa@example.com" });
    expect(await guardianOf(id)).toBe(await guardianOf(sibling));
    const [c] = await db.select().from(s.consent).where(eq(s.consent.studentId, id));
    expect(c!.guardianId).toBe(await guardianOf(sibling));
  });

  it("adds her own email, and refuses a guardian change once permission is given", async () => {
    const id = await submit(short());
    expect((await changeContact(ctx, id, { email: "remi@example.com" })).ok).toBe(true);
    const [p] = await db.select().from(s.person).where(eq(s.person.id, id));
    expect(p!.emailHash).toBe(lookupHash("remi@example.com"));
    await db.update(s.consent).set({ givenAt: new Date() }).where(eq(s.consent.studentId, id));
    expect(await changeContact(ctx, id, { guardianEmail: "late@example.com" })).toEqual({ ok: false, code: "not_pending" });
  });

  it("an adult must keep an email", async () => {
    const id = await submit(short({ age: 19, email: "adult19@example.com", guardianEmail: "" }));
    expect(await changeContact(ctx, id, { email: "" })).toEqual({ ok: false, code: "email_required" });
  });

  it("the thank-you screen's handle works for 7 days", () => {
    const now = Date.now();
    const id = randomUUID();
    const h = contactHandle(id, now);
    expect(readContactHandle(h, now + 6 * 86_400_000)).toBe(id);
    expect(readContactHandle(h, now + 8 * 86_400_000)).toBeNull();
    expect(readContactHandle(h.replace(/.$/, (c) => (c === "a" ? "b" : "a")), now)).toBeNull();
  });
});
