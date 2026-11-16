import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack signs the raw webhook body with HMAC-SHA512 of the secret key (spec/11 §2.3). */
export function signPaystackBody(rawBody: string, secret: string): string {
  return createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyPaystackSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(signPaystackBody(rawBody, secret), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
