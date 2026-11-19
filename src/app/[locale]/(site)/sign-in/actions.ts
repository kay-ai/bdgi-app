"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto";
import { requestMeta, safeNext, setSessionCookie } from "@/server/auth/current";
import { parseSubject, requestSignInCode, verifySignInCode, type Subject } from "@/server/auth/sign-in";

/** Which phone or email is waiting for a code; encrypted, httpOnly, 15 minutes. */
const PENDING = "bgdi_signin";

async function readPending(): Promise<Subject | null> {
  try {
    const raw = decrypt((await cookies()).get(PENDING)?.value ?? null);
    const v = raw ? (JSON.parse(raw) as Subject) : null;
    return v && (v.kind === "phone" || v.kind === "email") && typeof v.value === "string" ? v : null;
  } catch {
    return null;
  }
}

export type SendResult = { ok: true } | { ok: false; code: "phone" | "email" | "rate_limited" };

export async function sendCodeAction(kind: "phone" | "email", raw: string): Promise<SendResult> {
  const k = kind === "email" ? "email" : "phone";
  const subject = parseSubject(k, z.string().max(200).catch("").parse(raw));
  if (!subject) return { ok: false, code: k };
  const r = await requestSignInCode(subject, await requestMeta());
  if (!r.ok) return r;
  (await cookies()).set(PENDING, encrypt(JSON.stringify(subject)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return { ok: true };
}

export async function resendCodeAction(): Promise<SendResult | { ok: false; code: "expired" }> {
  const subject = await readPending();
  if (!subject) return { ok: false, code: "expired" };
  return requestSignInCode(subject, await requestMeta());
}

export type VerifyResult = { ok: false; code: "invalid" | "expired" | "too_many" | "rate_limited" | "deactivated" | "no_pending" };

export async function verifyCodeAction(code: string, next?: string): Promise<VerifyResult> {
  const subject = await readPending();
  if (!subject) return { ok: false, code: "no_pending" };
  const r = await verifySignInCode(subject, z.string().max(12).catch("").parse(code).replace(/\D/g, ""), await requestMeta());
  if (!r.ok) return r;
  await setSessionCookie(r.token, r.maxAge);
  (await cookies()).delete(PENDING);
  // The chooser and /join take priority over `next`; a single profile goes on to `next` if given.
  redirect(r.next === "/sign-in/who" || r.next === "/join" ? (next ? `${r.next}?next=${encodeURIComponent(safeNext(next, "/app"))}` : r.next) : safeNext(next, r.next));
}

/** For the verify page: the masked address the code went to, or null if there is none pending. */
export async function pendingSubject(): Promise<{ kind: "phone" | "email"; masked: string } | null> {
  const s = await readPending();
  if (!s) return null;
  if (s.kind === "phone") return { kind: "phone", masked: `${s.value.slice(0, 4)} ••• ••• ${s.value.slice(-3)}` };
  const [user, domain] = s.value.split("@");
  return { kind: "email", masked: `${user!.slice(0, 2)}•••@${domain}` };
}
