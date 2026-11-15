import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import { providerFor } from "@/server/providers";

type Channel = "whatsapp" | "sms" | "email";

export function render(body: string, vars: Record<string, string | number>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/**
 * Queue one templated message (spec/08 §1–4). Idempotent by `eventKey`: a second call with the
 * same key does nothing. Returns the message id, or null when skipped or already queued.
 */
type Exec = Pick<typeof db, "select" | "insert">;

export async function queueTemplate(input: {
  templateKey: string;
  to: string;
  channel: Channel;
  personId?: string | null;
  vars: Record<string, string | number>;
  eventKey: string;
  language?: "en" | "yo";
}, exec: Exec = db): Promise<string | null> {
  const [tpl] = await exec.select().from(s.messageTemplate).where(eq(s.messageTemplate.key, input.templateKey));
  if (!tpl) throw new Error(`Unknown template ${input.templateKey}`);

  const channel: Channel = (tpl.channels as Channel[]).includes(input.channel)
    ? input.channel
    : ((tpl.channels as Channel[])[0] ?? "sms");

  // Opt-outs: STOP skips everything except authentication messages.
  const [opt] = await exec
    .select()
    .from(s.channelOptOut)
    .where(and(eq(s.channelOptOut.addressHash, lookupHash(input.to)), eq(s.channelOptOut.channel, channel)));

  const bodySource =
    (input.language === "yo" && (channel === "sms" ? tpl.smsBodyYo ?? tpl.bodyYo : tpl.bodyYo)) ||
    (channel === "sms" ? tpl.smsBodyEn ?? tpl.bodyEn : tpl.bodyEn);
  const body = render(bodySource, input.vars);

  const [row] = await exec
    .insert(s.message)
    .values({
      direction: "outbound",
      personId: input.personId ?? null,
      toAddress: encrypt(input.to),
      channel,
      templateKey: tpl.key,
      variables: input.vars,
      bodyRendered: encrypt(body),
      status: opt && tpl.category !== "authentication" ? "skipped" : "queued",
      eventKey: input.eventKey,
    })
    .onConflictDoNothing({ target: s.message.eventKey })
    .returning({ id: s.message.id, status: s.message.status });

  if (!row || row.status === "skipped") return null;
  return row.id;
}

/**
 * Send queued messages. In production this is the `message.send` job on SQS; locally the console
 * adapters run inline right after the request (spec/01 §7).
 */
export async function dispatch(ids: string[]) {
  if (ids.length === 0) return;
  const rows = await db
    .select()
    .from(s.message)
    .where(and(inArray(s.message.id, ids), eq(s.message.status, "queued")));
  for (const m of rows) {
    const [tpl] = m.templateKey
      ? await db.select().from(s.messageTemplate).where(eq(s.messageTemplate.key, m.templateKey))
      : [];
    const res = await providerFor(m.channel).send({
      to: decrypt(m.toAddress),
      body: decrypt(m.bodyRendered),
      subject: tpl?.subjectEn ?? null,
    });
    await db
      .update(s.message)
      .set(
        res.ok
          ? { status: "sent", providerId: res.providerId, sentAt: new Date(), updatedAt: new Date() }
          : { status: "failed", error: res.error, updatedAt: new Date() },
      )
      .where(eq(s.message.id, m.id));
  }
}
