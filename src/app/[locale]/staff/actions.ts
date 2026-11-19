"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentSession, requestMeta, safeNext, setSessionCookie } from "@/server/auth/current";
import { SESSION_TTL } from "@/server/auth/sessions";
import { finishTotpSetup, requestPasswordReset, setPasswordWithToken, staffPasswordSignIn, staffSecondStep } from "@/server/auth/sign-in";

/** Staff sign-in actions (spec/03 §1.3). Each returns a code the form turns into a message. */

export type FormState = { error?: string; sent?: boolean; codes?: string[] } | null;

const str = (fd: FormData, k: string, max = 200) => z.string().max(max).catch("").parse(fd.get(k) ?? "");
const withNext = (path: string, next: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

export async function staffSignInAction(_: FormState, fd: FormData): Promise<FormState> {
  const next = safeNext(str(fd, "next", 300), "");
  const r = await staffPasswordSignIn(str(fd, "email"), str(fd, "password", 200), await requestMeta());
  if (!r.ok) return { error: r.code };
  // The cookie lives as long as a full staff session; the database row decides what it can do and when it ends.
  await setSessionCookie(r.token, SESSION_TTL.staff);
  redirect(withNext(r.next, next));
}

export async function staffTwoFactorAction(_: FormState, fd: FormData): Promise<FormState> {
  const row = await currentSession();
  if (!row) return { error: "expired" };
  const r = await staffSecondStep(row, str(fd, "code", 20), await requestMeta());
  if (!r.ok) return { error: r.code };
  redirect(safeNext(str(fd, "next", 300), r.next));
}

export async function finishSetupAction(_: FormState, fd: FormData): Promise<FormState> {
  const row = await currentSession();
  if (!row) return { error: "expired" };
  const r = await finishTotpSetup(row, str(fd, "code", 20), await requestMeta());
  if (!r.ok) return { error: r.code };
  // No cookie change here, so the page is not re-rendered and the codes stay on screen.
  // Shown once on the page; never stored in plain text.
  return { codes: r.backupCodes };
}

export async function setPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const password = str(fd, "password", 200);
  if (password !== str(fd, "confirm", 200)) return { error: "mismatch" };
  const r = await setPasswordWithToken(str(fd, "token", 100), password, await requestMeta());
  if (!r.ok) return { error: r.code };
  redirect("/staff/sign-in?done=1");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requestPasswordReset(str(fd, "email"), await requestMeta());
  return { sent: true };
}
