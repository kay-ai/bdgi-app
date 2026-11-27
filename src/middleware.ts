import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { redirects } from "./server/seed/data";
import { PATH_HEADER } from "./server/auth/path-header";

const intl = createMiddleware(routing);

// Old WordPress paths (spec/04 §8). The `redirect` table holds the same rows for the console;
// the middleware reads this static copy because it runs before the database is reachable.
const redirectMap = new Map(redirects.map(([from, to, code]) => [from, { to, code: code ?? 301 }]));

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const hit = redirectMap.get(path);
  if (hit) {
    if (hit.code === 410) return new NextResponse("Gone", { status: 410 });
    const url = req.nextUrl.clone();
    url.pathname = hit.to;
    return NextResponse.redirect(url, hit.code);
  }

  // The page asked for, so a sign-in guard in a layout can send the person back to it.
  // Always overwritten here, so a client cannot supply its own value.
  req.headers.set(PATH_HEADER, req.nextUrl.pathname + req.nextUrl.search);
  const res = intl(req);

  // A Hub sign-in remembers the browser for a year from the last visit (D-026): the session's end
  // date moves on in the database, and the cookie is renewed here to match. Hub pages only, so
  // public pages stay cacheable. (The name matches SESSION_COOKIE; the middleware can't load it.)
  const session = req.cookies.get("bgdi_session")?.value;
  if (session && /^(\/yo)?\/app(\/|$)/.test(path)) {
    res.cookies.set("bgdi_session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 86_400,
    });
  }

  // Campaign source: ?src=CODE is remembered for 30 days (spec/04 §2).
  const src = req.nextUrl.searchParams.get("src");
  if (src && /^[0-9A-Z]{8}$/i.test(src)) {
    res.cookies.set("src", src.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|embed|.*\\..*).*)", "/wp-login.php"],
};
