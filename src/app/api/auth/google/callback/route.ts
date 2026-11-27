import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/crypto";
import { safeNext } from "@/server/auth/current";
import { finishGoogle, GOOGLE_COOKIE, sameState, type GoogleStart } from "@/server/auth/google";
import { SESSION_COOKIE } from "@/server/auth/sessions";
import { openSession } from "@/server/auth/sign-in";
import { hit } from "@/server/services/rate-limit";

/** Google sends the person back here (D-026). Any failure goes back to sign-in with a message. */
export async function GET(req: NextRequest) {
  const raw = req.cookies.get(GOOGLE_COOKIE)?.value;
  let pending: GoogleStart | null = null;
  try {
    pending = raw ? (JSON.parse(decrypt(raw) ?? "null") as GoogleStart) : null;
  } catch {
    pending = null;
  }
  const prefix = pending?.locale === "yo" ? "/yo" : "";
  const to = (path: string) => new URL(`${prefix}${path}`, req.nextUrl.origin);
  const fail = (why: "failed" | "cancelled" | "deactivated" | "staff" | "rate_limited") => {
    const res = NextResponse.redirect(to(`/sign-in?google=${why}`), 303);
    res.cookies.delete({ name: GOOGLE_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return fail("cancelled");
  const code = q.get("code");
  const state = q.get("state");
  if (!pending || !code || !state || !sameState(state, pending.state)) return fail("failed");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (ip && !(await hit(`google-ip:${ip}`, 30, 3600))) return fail("rate_limited");

  const who = await finishGoogle(code, pending);
  if (!who) return fail("failed");
  const r = await openSession({ kind: "email", value: who.email }, "google", { ip, userAgent: req.headers.get("user-agent") });
  if (!r.ok) return fail(r.code === "deactivated" ? "deactivated" : "staff");

  const next = pending.next ? safeNext(pending.next, "/app") : undefined;
  const dest = r.next === "/sign-in/who" || r.next === "/join" ? (next ? `${r.next}?next=${encodeURIComponent(next)}` : r.next) : (next ?? r.next);
  const res = NextResponse.redirect(to(dest), 303);
  res.cookies.set(SESSION_COOKIE, r.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: r.maxAge });
  res.cookies.delete({ name: GOOGLE_COOKIE, path: "/api/auth/google" });
  return res;
}
