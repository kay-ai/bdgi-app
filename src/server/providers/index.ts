import "server-only";
import { smtpProvider } from "./smtp";

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string };
export type Attachment = { filename: string; contentType: string; content: Uint8Array };
/** `html` is the branded email version of `body` (D-023); phone channels ignore it. */
export type OutgoingMessage = { to: string; body: string; subject?: string | null; html?: string | null; attachments?: Attachment[] };
export interface MessageProvider {
  name: string;
  send(input: OutgoingMessage): Promise<SendResult>;
}

/**
 * The last few console sends, kept in memory so tests (and a developer in a REPL) can inspect
 * what would have gone out, attachments included. Never filled in production.
 */
const g = globalThis as unknown as { __bgdiOutbox?: (OutgoingMessage & { channel: string })[] };
export const consoleOutbox = (g.__bgdiOutbox ??= []);

/** Console adapter (spec/01 §1): logs to the terminal; the message row is the record. */
const consoleProvider = (channel: string): MessageProvider => ({
  name: `console:${channel}`,
  async send({ to, body, subject, html, attachments }) {
    const masked = to.length > 6 ? `${to.slice(0, 4)}…${to.slice(-3)}` : "…";
    const files = attachments?.length
      ? `\n  attached: ${attachments.map((a) => `${a.filename} (${a.content.byteLength} bytes)`).join(", ")}`
      : "";
    // In production the console adapter never prints bodies: they can hold sign-in codes and links.
    const shown = process.env.NODE_ENV === "production" ? "(body not logged in production)" : body;
    console.info(`[${channel}] to ${masked}${subject ? ` · ${subject}` : ""}\n  ${shown}${files}`);
    if (process.env.NODE_ENV !== "production") {
      consoleOutbox.push({ channel, to, body, subject, html, attachments });
      if (consoleOutbox.length > 50) consoleOutbox.shift();
    }
    return { ok: true, providerId: `console-${Date.now()}` };
  },
});

export function providerFor(channel: "whatsapp" | "sms" | "email"): MessageProvider {
  const env = {
    whatsapp: process.env.WHATSAPP_PROVIDER,
    sms: process.env.SMS_PROVIDER,
    email: process.env.EMAIL_PROVIDER,
  }[channel];
  if (channel === "email" && env === "smtp") return smtpProvider();
  if (env && env !== "console") {
    // Phone adapters (meta, termii) arrive in M8; refusing loudly beats a silent no-op.
    throw new Error(`${channel} provider "${env}" is not implemented yet`);
  }
  return consoleProvider(channel);
}
