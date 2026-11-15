import { describe, expect, it } from "vitest";
import { decrypt, encrypt, humanCode, lookupHash, newNumericCode, secureCompare } from "@/lib/crypto";

describe("field encryption", () => {
  it("round-trips a value", () => {
    const enc = encrypt("Adaeze");
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain("Adaeze");
    expect(decrypt(enc)).toBe("Adaeze");
  });
  it("uses a fresh IV every time", () => expect(encrypt("same")).not.toBe(encrypt("same")));
  it("passes null through", () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
  it("rejects tampered ciphertext", () => {
    const enc = encrypt("secret");
    const bytes = Buffer.from(enc.slice(3), "base64");
    bytes[bytes.length - 1]! ^= 1;
    expect(() => decrypt(`v1:${bytes.toString("base64")}`)).toThrow();
  });
});

describe("lookup hashes and codes", () => {
  it("hashes deterministically", () => expect(lookupHash("+2348031234567")).toBe(lookupHash("+2348031234567")));
  it("compares in constant time", () => {
    expect(secureCompare("abc", "abc")).toBe(true);
    expect(secureCompare("abc", "abd")).toBe(false);
    expect(secureCompare("abc", "abcd")).toBe(false);
  });
  it("makes numeric codes of the right length", () => expect(newNumericCode(6)).toMatch(/^\d{6}$/));
  it("makes human codes of the right length", () => expect(humanCode(8)).toHaveLength(8));
});
