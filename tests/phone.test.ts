import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalisePhone } from "@/lib/phone";

describe("normalisePhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["0803 123 4567", "+2348031234567"],
    ["803-123-4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["07011112222", "+2347011112222"],
    ["09151234567", "+2349151234567"],
  ])("accepts %s", (input, out) => expect(normalisePhone(input)).toBe(out));

  it.each(["", "12345", "0603123456", "0803123456", "080312345678", "+44 7700 900123"])("rejects %s", (input) =>
    expect(normalisePhone(input)).toBeNull(),
  );
});

describe("formatting", () => {
  it("formats for display", () => expect(formatPhone("+2348031234567")).toBe("0803 123 4567"));
  it("masks all but the last three digits", () => expect(maskPhone("+2348031234567")).toBe("•••• ••• •567"));
});
