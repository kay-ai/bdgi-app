import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Continue with Google" for the Hub (D-026): OpenID Connect with the authorization-code flow,
 * PKCE and a state value. Google only proves the email address; from there it is the same as an
 * email code (`openSession`), so a Google account reaches the person whose email matches.
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; without them the button is hidden.
 */

export const GOOGLE_COOKIE = "bgdi_google";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const googleRedirectUri = () => `${appUrl()}/api/auth/google/callback`;
export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const b64url = (b: Buffer) => b.toString("base64url");

/** What we remember in an encrypted cookie between leaving for Google and coming back. */
export type GoogleStart = { state: string; verifier: string; nonce: string; next?: string; locale: "en" | "yo" };

export function startGoogle(next: string | undefined, locale: "en" | "yo"): { url: string; pending: GoogleStart } {
  const pending: GoogleStart = { state: b64url(randomBytes(24)), verifier: b64url(randomBytes(48)), nonce: b64url(randomBytes(24)), next, locale };
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: b64url(createHash("sha256").update(pending.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, pending };
}

export const sameState = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type GoogleIdentity = { email: string; name?: string };

/**
 * Swap the code for tokens and read the ID token. It comes straight from Google's token endpoint
 * over TLS, authenticated with our client secret, so its signature need not be checked again
 * (OpenID Connect Core §3.1.3.7); the issuer, audience, expiry and nonce still are.
 */
export async function finishGoogle(code: string, pending: GoogleStart): Promise<GoogleIdentity | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: pending.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  return typeof body?.id_token === "string" ? readIdToken(body.id_token, pending.nonce) : null;
}

export function readIdToken(idToken: string, nonce: string, now = Date.now()): GoogleIdentity | null {
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
    if (claims.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return null;
    if (claims.nonce !== nonce) return null;
    if (claims.email_verified !== true || typeof claims.email !== "string") return null;
    return { email: claims.email.trim().toLowerCase(), name: typeof claims.name === "string" ? claims.name : undefined };
  } catch {
    return null;
  }
}
