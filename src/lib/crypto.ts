import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Field encryption, AES-256-GCM (spec/01 §10).
 * Stored format: "v1:" + base64(iv | tag | ciphertext).
 * In local development without ENCRYPTION_KEY a fixed dev key is used and a warning is printed once.
 */
let warned = false;
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("ENCRYPTION_KEY is required in production");
  if (!warned) {
    console.warn("[crypto] ENCRYPTION_KEY not set; using the development key");
    warned = true;
  }
  return Buffer.alloc(32, 7);
}

export function encrypt(plain: string): string;
export function encrypt(plain: string | null | undefined): string | null;
export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decrypt(stored: string): string;
export function decrypt(stored: string | null | undefined): string | null;
export function decrypt(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith("v1:")) return stored;
  const buf = Buffer.from(stored.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 lookup hash for phones and emails (lower-cased, trimmed). */
export function lookupHash(value: string): string {
  return createHmac("sha256", key()).update(value.trim().toLowerCase()).digest("hex");
}

export function secureCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Random URL-safe token for links (consent, newsletter, report shares). */
export function newToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function newNumericCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 8-character Crockford base32 code for certificates, receipts and campaigns (spec/01 §3 rule 7). */
export function humanCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CROCKFORD[randomInt(0, 32)];
  return out;
}
