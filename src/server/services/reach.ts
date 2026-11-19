import "server-only";
import { decrypt } from "@/lib/crypto";

type Channel = "whatsapp" | "sms" | "email";
type Contact = { phone: string | null; email: string | null; preferredChannel: Channel };

/**
 * How families are reached while WhatsApp and SMS are not connected (D-018). `email` (the default)
 * asks for email addresses at join and sends codes, permission links and updates by email; `phone`
 * restores the phone-first journey of spec/05.
 */
export function contactMode(): "email" | "phone" {
  return process.env.CONTACT_MODE === "phone" ? "phone" : "email";
}

/**
 * Where to send a person a message, from their stored (encrypted) contact details. In email mode,
 * their email whenever we hold one. Otherwise their preferred channel if we hold that address, then
 * their phone, then their email. Null when we hold neither.
 */
export function reach(p: Contact, mode: "email" | "phone" = contactMode()) {
  return reachPlain({ ...p, phone: p.phone ? decrypt(p.phone) : null, email: p.email ? decrypt(p.email) : null }, mode);
}

/** As `reach`, for addresses we already hold in the clear (a form being submitted). */
export function reachPlain(p: Contact, mode: "email" | "phone" = contactMode()): { to: string; channel: Channel } | null {
  const { phone, email } = p;
  if (email && (mode === "email" || p.preferredChannel === "email")) return { to: email, channel: "email" };
  if (phone) return { to: phone, channel: p.preferredChannel === "email" ? "whatsapp" : p.preferredChannel };
  if (email) return { to: email, channel: "email" };
  return null;
}
