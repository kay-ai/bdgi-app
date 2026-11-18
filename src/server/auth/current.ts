import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { can, hasRole, isStaff, type Actor, type Role } from "@/server/permissions/can";
import type { Ctx } from "@/server/services/audit";
import { actorForSession, readSession, revokeSession, SESSION_COOKIE } from "./sessions";

/** Request-level helpers (spec/03 §2). Pages and actions use these; services take the Actor. */

export const currentSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSession(token);
});

export const getActor = cache(async (): Promise<Actor | null> => actorForSession(await currentSession()));

export async function requestMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: h.get("user-agent") };
}

export async function ctxFor(actor: Actor | null, locale: "en" | "yo" = "en"): Promise<Ctx> {
  return { actor, locale, ip: (await requestMeta()).ip };
}

export async function setSessionCookie(token: string, maxAge: number) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSession() {
  const jar = await cookies();
  await revokeSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/** Only same-site paths are followed after sign-in. */
export function safeNext(next: string | null | undefined, fallback: string) {
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) && !next.startsWith("/api/") ? next : fallback;
}

const withNext = (path: string, next?: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

/** Signed in with an active person, or off to /sign-in (or the chooser when no profile is picked). */
export async function requireActor(next?: string): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;
  const row = await currentSession();
  if (row?.session.stage === "full" && !row.session.activePersonId) redirect(withNext("/sign-in/who", next));
  redirect(withNext("/sign-in", next));
}

export async function requireRole(roles: Role[], next?: string): Promise<Actor> {
  const actor = await requireActor(next);
  if (!hasRole(actor, ...roles)) redirect("/sign-in/no-access");
  return actor;
}

/** Staff pages: a full staff session (password and 2-step) and a staff role. */
export async function requireStaff(next?: string): Promise<Actor> {
  const row = await currentSession();
  if (row?.session.method === "staff" && row.session.stage === "password") {
    redirect(row.user.totpEnabledAt ? "/staff/two-factor" : "/staff/two-factor/setup");
  }
  const actor = await actorForSession(row);
  if (!actor || row?.session.method !== "staff") redirect(withNext("/staff/sign-in", next));
  if (!isStaff(actor)) redirect("/sign-in/no-access");
  return actor;
}

/** Throws (renders the not-found page) when the actor lacks the permission. */
export async function requirePermission(action: string, next?: string): Promise<Actor> {
  const actor = await requireStaff(next);
  if (!can(actor, action)) redirect("/sign-in/no-access");
  return actor;
}
