import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Primitives for BGDI's own sign-in (DECISIONS.md D-013). Node's crypto only; no outside service.
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/* ---------- Passwords (scrypt) ---------- */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `s1$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend the same time as a real check so timing does not reveal whether an account has a password.
    await scrypt(password, randomBytes(16), KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
    return false;
  }
  const [v, n, r, p, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Staff passwords (spec/03 §1.3): at least 12 characters and not a common password. The list is the
 * most common leaked passwords and the patterns staff are likely to try; see D-013.
 */
const COMMON = new Set(
  [
    "123456789012", "1234567890123", "12345678910", "123456789123", "qwertyuiopas", "qwertyuiop123", "password1234",
    "password12345", "passwordpassword", "iloveyou1234", "abc123456789", "aaaaaaaaaaaa", "111111111111", "000000000000",
    "123123123123", "qwerty123456", "1q2w3e4r5t6y", "letmein12345", "welcome12345", "admin1234567", "administrator",
    "changeme1234", "football1234", "princess1234", "sunshine1234", "monkey123456", "dragon123456", "baseball1234",
    "superman1234", "trustno11234", "starwars1234", "computer1234", "michael12345", "jennifer1234", "whatever1234",
    "blackgirlsdream", "blackgirlsdream1", "bgdi12345678", "bgdipassword", "bgdibgdibgdi", "nigeria12345", "nigeria123456",
    "lagos1234567", "ibadan123456", "ibadan1234567", "oyostate1234", "jesus1234567", "godisgood123", "godisgood1234",
    "blessed12345", "passw0rd1234", "p@ssw0rd1234", "p@ssword1234", "qwerty1234567", "asdfghjkl123", "zxcvbnm12345",
  ].map((x) => x.toLowerCase()),
);

export type PasswordProblem = "too_short" | "too_long" | "common";

export function passwordProblem(password: string, context: string[] = []): PasswordProblem | null {
  if (password.length < 12) return "too_short";
  if (password.length > 128) return "too_long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "common";
  // One repeated character, or a plain run of digits.
  if (/^(.)\1+$/.test(password) || /^\d+$/.test(password)) return "common";
  // The person's own name or email in the password.
  for (const c of context.map((x) => x.toLowerCase().trim()).filter((x) => x.length >= 4)) if (lower.includes(c)) return "common";
  return null;
}

/* ---------- Tokens and codes ---------- */

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const newSessionToken = () => randomBytes(32).toString("base64url");
export const newLinkToken = () => randomBytes(32).toString("base64url");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

/* ---------- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) ---------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totp(secret: string, at = Date.now(), step = 30): string {
  const counter = Math.floor(at / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = h[h.length - 1]! & 15;
  const bin = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Accepts the current code and one step either side, for phone clocks that drift. */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((d) => {
    const expected = totp(secret, at + d * 30_000);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}

export function otpauthUri(secret: string, account: string, issuer = "BGDI Hub") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten backup codes like "4K7Q-9MZT", shown once; only their hashes are kept. */
export function newBackupCodes(count = 10): string[] {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: count }, () => {
    let c = "";
    for (let i = 0; i < 8; i++) c += alphabet[randomInt(0, alphabet.length)];
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}
export const normaliseBackupCode = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, "");
