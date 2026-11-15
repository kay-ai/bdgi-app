/**
 * Nigerian phone normalisation (spec/01 §3 rule 6).
 * Accepts 0803…, 803…, 234803…, +234803… and spaces/dashes. Returns E.164 or null.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, "");
  let national: string;
  if (digits.startsWith("+234")) national = digits.slice(4);
  else if (digits.startsWith("234")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  if (!/^[789][01]\d{8}$/.test(national)) return null;
  return `+234${national}`;
}

/** "+2348031234567" → "0803 123 4567" */
export function formatPhone(e164: string): string {
  const n = e164.replace(/^\+234/, "0");
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

/** Shows only the last three digits, for staff screens that must not reveal the number. */
export function maskPhone(e164: string): string {
  return `•••• ••• •${e164.slice(-3)}`;
}
