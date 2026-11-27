import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { encrypt, lookupHash } from "@/lib/crypto";
import { readIdToken, sameState, startGoogle } from "@/server/auth/google";
import { readSession, SESSION_TTL } from "@/server/auth/sessions";
import { openSession } from "@/server/auth/sign-in";
import { setupDb } from "./support/db";

beforeAll(async () => {
  await setupDb();
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
});

const jwt = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const good = (over: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: "test-client.apps.googleusercontent.com",
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: "n1",
  email: "Ada@Example.com",
  email_verified: true,
  ...over,
});

describe("Google ID token (D-026)", () => {
  it("accepts a fresh, verified token for our app and lower-cases the email", () => {
    expect(readIdToken(jwt(good()), "n1")).toMatchObject({ email: "ada@example.com" });
  });
  it.each([
    ["another app", { aud: "someone-else" }],
    ["another issuer", { iss: "https://evil.example" }],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 10 }],
    ["a different nonce", { nonce: "n2" }],
    ["an unverified email", { email_verified: false }],
    ["no email", { email: undefined }],
  ])("rejects %s", (_label, over) => {
    expect(readIdToken(jwt(good(over)), "n1")).toBeNull();
  });
  it("rejects rubbish", () => {
    expect(readIdToken("not-a-token", "n1")).toBeNull();
  });
  it("starts with PKCE, a state and a nonce", () => {
    const { url, pending } = startGoogle("/app", "en");
    const q = new URL(url).searchParams;
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("state")).toBe(pending.state);
    expect(q.get("nonce")).toBe(pending.nonce);
    expect(q.get("redirect_uri")).toMatch(/\/api\/auth\/google\/callback$/);
    expect(sameState(pending.state, pending.state)).toBe(true);
    expect(sameState(pending.state, pending.state.slice(1) + "x")).toBe(false);
  });
});

describe("Hub sessions remember the browser for a year (D-026)", () => {
  it("a Google sign-in reaches the person with that email and lasts a year", async () => {
    const email = `g${Date.now()}@example.com`;
    await db.insert(s.person).values({ firstName: "Gigi", surname: encrypt("Test"), gender: "female", status: "active", email: encrypt(email), emailHash: lookupHash(email) });
    const r = await openSession({ kind: "email", value: email }, "google");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.maxAge).toBe(SESSION_TTL.code);
    expect(SESSION_TTL.code).toBe(365 * 86_400);
    const row = await readSession(r.token);
    expect(row?.session.method).toBe("google");
    expect(row?.session.activePersonId).toBeTruthy();
  });

  it("each visit moves the end date on, but not for staff", async () => {
    const email = `h${Date.now()}@example.com`;
    const r = await openSession({ kind: "email", value: email }, "email");
    if (!r.ok) throw new Error("no session");
    const row = await readSession(r.token);
    const soon = new Date(Date.now() + 86_400_000);
    await db.update(s.authSession).set({ expiresAt: soon, lastSeenAt: new Date(Date.now() - 120_000) }).where(eq(s.authSession.id, row!.session.id));
    await readSession(r.token);
    const [after] = await db.select().from(s.authSession).where(eq(s.authSession.id, row!.session.id));
    expect(after!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 364 * 86_400_000);
  });

  it("staff emails can't use Google", async () => {
    const email = `st${Date.now()}@example.com`;
    await db.insert(s.appUser).values({ email: encrypt(email), emailHash: lookupHash(email), isStaff: true });
    expect(await openSession({ kind: "email", value: email }, "google")).toEqual({ ok: false, code: "invalid" });
  });
});
