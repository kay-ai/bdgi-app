import { NextResponse, type NextRequest } from "next/server";
import { clearSession, currentSession } from "@/server/auth/current";

/**
 * Sign out of this browser. A plain form post rather than a server action: a page left open
 * across a deploy still signs out (a server action from the old build is unknown to the new one).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const prefix = form?.get("locale") === "yo" ? "/yo" : "";
  const origin = req.headers.get("origin");
  const sameSite = !origin || origin === req.nextUrl.origin;
  const row = sameSite ? await currentSession() : null;
  if (sameSite) await clearSession();
  const to = row?.session.method === "staff" ? "/staff/sign-in" : "/sign-in";
  return NextResponse.redirect(new URL(`${prefix}${to}`, req.nextUrl.origin), 303);
}
