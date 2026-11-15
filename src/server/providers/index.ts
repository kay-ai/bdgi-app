import "server-only";

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string };
export interface MessageProvider {
  name: string;
  send(input: { to: string; body: string; subject?: string | null }): Promise<SendResult>;
}

/** Console adapter (spec/01 §1): logs to the terminal; the message row is the record. */
const consoleProvider = (channel: string): MessageProvider => ({
  name: `console:${channel}`,
  async send({ to, body, subject }) {
    const masked = to.length > 6 ? `${to.slice(0, 4)}…${to.slice(-3)}` : "…";
    console.info(`[${channel}] to ${masked}${subject ? ` · ${subject}` : ""}\n  ${body}`);
    return { ok: true, providerId: `console-${Date.now()}` };
  },
});

export function providerFor(channel: "whatsapp" | "sms" | "email"): MessageProvider {
  const env = {
    whatsapp: process.env.WHATSAPP_PROVIDER,
    sms: process.env.SMS_PROVIDER,
    email: process.env.EMAIL_PROVIDER,
  }[channel];
  if (env && env !== "console") {
    // Real adapters (meta, termii, ses) arrive in M8; refusing loudly beats a silent no-op.
    throw new Error(`${channel} provider "${env}" is not implemented yet`);
  }
  return consoleProvider(channel);
}
