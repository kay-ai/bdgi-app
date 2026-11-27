import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/lib/crypto";
import { safeNext } from "@/server/auth/current";
import { GOOGLE_COOKIE, googleEnabled, startGoogle } from "@/server/auth/google";

/** "Continue with Google" (D-026): remember where we're going, then off to Google. */
export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") === "yo" ? "yo" : "en";
  const prefix = locale === "yo" ? "/yo" : "";
  if (!googleEnabled()) return NextResponse.redirect(new URL(`${prefix}/sign-in`, req.nextUrl.origin), 303);
  const next = safeNext(req.nextUrl.searchParams.get("next"), "") || undefined;
  const { url, pending } = startGoogle(next, locale);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(GOOGLE_COOKIE, encrypt(JSON.stringify(pending)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
