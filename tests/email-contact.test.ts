import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, lookupHash } from "@/lib/crypto";
import { providerFor } from "@/server/providers";
import { remindGuardian, submitStudent } from "@/server/services/intake";
import { reachPlain } from "@/server/services/reach";
import type { StudentIntake } from "@/server/validation/join";
import { setupDb } from "./support/db";

/** D-018: while WhatsApp and SMS are not connected, families join and are reached by email. */

const ctx = { actor: null, locale: "en" as const, ip: null, userAgent: "vitest" };
let stateId = "";
let programmeId = "";
let seq = 0;
const saved = { mode: process.env.CONTACT_MODE };

beforeAll(async () => {
  process.env.CONTACT_MODE = "email";
  await setupDb();
  const [st] = await db.insert(s.state).values({ code: "EM", name: "Email State", isActive: true }).returning();
  const [pr] = await db.select().from(s.programme).limit(1);
  stateId = st!.id;
  programmeId = pr!.id;
});
afterAll(() => {
  if (saved.mode === undefined) delete process.env.CONTACT_MODE;
  else process.env.CONTACT_MODE = saved.mode;
});

function intake(over: { age?: number; email?: string; guardianEmail?: string; firstName?: string } = {}): StudentIntake {
  seq++;
  return {
    clientId: randomUUID(),
    startedAt: Date.now() - 60_000,
    about: { firstName: over.firstName ?? `Ife${seq}`, surname: "Ade", age: over.age ?? 14, gender: "female", classLevel: "SS1", stateId, lgaId: "", schoolId: "", schoolOther: "Email High" },
    dreams: { dreamCareer: "Lawyer", interests: ["stem"], communityDream: "", programmeIds: [programmeId] },
    help: { needs: ["confidence"], schoolSubject: "", needsOther: "", deviceAccess: "own_smartphone" },
    contact: {
      language: "en",
      phone: "",
      email: over.email ?? "",
      guardianName: "Funke Ade",
      guardianRelationship: "mother",
      guardianPhone: "",
      guardianEmail: over.guardianEmail ?? `funke${seq}@example.com`,
      guardianChannel: "whatsapp",
      avatarKey: "a05",
    },
    checkin: { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, privacy: true },
  };
}

async function messages(personId: string, key: string) {
  return db.select().from(s.message).where(and(eq(s.message.personId, personId), eq(s.message.templateKey, key)));
}

async function guardianOf(studentId: string) {
  const [l] = await db.select().from(s.guardianLink).where(eq(s.guardianLink.studentId, studentId));
  return l!.guardianId;
}

describe("joining by email", () => {
  it("emails the guardian's permission request and the student's welcome, with no STOP line", async () => {
    const input = intake({ email: "ife.student@example.com", guardianEmail: "Funke.Mum@Example.com".toLowerCase() });
    const r = await submitStudent(ctx, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const gId = await guardianOf(r.data.personId);
    const [g] = await db.select().from(s.person).where(eq(s.person.id, gId));
    expect(g!.emailHash).toBe(lookupHash("funke.mum@example.com"));
    expect(g!.preferredChannel).toBe("email");
    const [req] = await messages(gId, "consent.request");
    expect(req!.channel).toBe("email");
    expect(decrypt(req!.toAddress)).toBe("funke.mum@example.com");
    expect(decrypt(req!.bodyRendered)).not.toMatch(/STOP/);
    const [welcome] = await messages(r.data.personId, "student.welcome");
    expect(welcome!.channel).toBe("email");
    expect(decrypt(welcome!.toAddress)).toBe("ife.student@example.com");
    const [student] = await db.select().from(s.person).where(eq(s.person.id, r.data.personId));
    expect(student!.emailHash).toBe(lookupHash("ife.student@example.com"));
  });

  it("lets a girl leave her own email blank, and reminds the guardian by email", async () => {
    const r = await submitStudent(ctx, intake());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await messages(r.data.personId, "student.welcome")).toHaveLength(0);
    expect((await remindGuardian(ctx, r.data.personId)).ok).toBe(true);
    const [reminder] = await messages(await guardianOf(r.data.personId), "consent.reminder");
    expect(reminder!.channel).toBe("email");
  });

  it("finds the same guardian by email for a second child", async () => {
    const a = await submitStudent(ctx, intake({ guardianEmail: "shared.mum@example.com", firstName: "Bisi" }));
    const b = await submitStudent(ctx, intake({ guardianEmail: "shared.mum@example.com", firstName: "Tola" }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(await guardianOf(b.data.personId)).toBe(await guardianOf(a.data.personId));
  });

  it("refuses a girl under 18 with no guardian email, and an adult with no email", async () => {
    expect((await submitStudent(ctx, intake({ guardianEmail: "" }))).ok).toBe(false);
    const adult = intake({ age: 19 });
    expect((await submitStudent(ctx, adult)).ok).toBe(false);
    const ok = await submitStudent(ctx, intake({ age: 19, email: "adult@example.com" }));
    expect(ok.ok).toBe(true);
  });
});

describe("reach", () => {
  const p = { phone: "+2348031234567", email: "a@example.com", preferredChannel: "whatsapp" as const };
  it("prefers email in email mode and the phone channel in phone mode", () => {
    expect(reachPlain(p, "email")).toEqual({ to: "a@example.com", channel: "email" });
    expect(reachPlain(p, "phone")).toEqual({ to: "+2348031234567", channel: "whatsapp" });
    expect(reachPlain({ ...p, email: null }, "email")).toEqual({ to: "+2348031234567", channel: "whatsapp" });
    expect(reachPlain({ ...p, phone: null }, "phone")).toEqual({ to: "a@example.com", channel: "email" });
    expect(reachPlain({ ...p, phone: null, email: null })).toBeNull();
  });
});

describe("smtp provider", () => {
  it("refuses to start without a host and sender", () => {
    const keep = { p: process.env.EMAIL_PROVIDER, h: process.env.SMTP_HOST };
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_HOST;
    expect(() => providerFor("email")).toThrow(/SMTP_HOST/);
    if (keep.p === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = keep.p;
    if (keep.h) process.env.SMTP_HOST = keep.h;
  });
});
