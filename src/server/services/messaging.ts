import "server-only";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import { providerFor } from "@/server/providers";
import { attachmentsFor } from "./receipts";

/**
 * The sending pipeline (spec/08 §2). `queueTemplate` decides whether, when and how a message goes:
 * consent rules, opt-outs, language, quiet hours, the opt-out line. `dispatch` and `sendDueMessages`
 * send what is due, retry with backoff and fall back to the next channel.
 */

type Channel = "whatsapp" | "sms" | "email";
type Exec = Pick<typeof db, "select" | "insert">;

/** Students in these states get only templates marked `allow_before_consent` (spec/08 §2 step 4). */
const BLOCKED_STUDENT_STATUSES = ["pending_consent", "declined", "left", "anonymised"];
/** Safeguarding messages go out even to someone who replied STOP (spec/08 §2 step 3). */
const SAFEGUARDING_TEMPLATES = new Set(["staff.case_new", "concern.received"]);
/** Minutes to wait after the 1st, 2nd and 3rd failure on a channel; the 4th moves to the next channel. */
export const RETRY_MINUTES = [1, 5, 30];
/** Same address, next channel. Email has its own address, so it is never a fallback for a phone. */
const FALLBACK: Partial<Record<Channel, Channel>> = { whatsapp: "sms" };
const OPT_OUT_LINE = { en: "Reply STOP to stop messages.", yo: "Fèsì STOP láti dá àwọn ìfiránṣẹ́ dúró." };

export class MissingVariable extends Error {
  constructor(template: string, variable: string) {
    super(`Template ${template} needs {{${variable}}}`);
  }
}

/** Fill `{{name}}` slots. With a template key, a missing variable fails loudly (spec/08 §2 step 5). */
export function render(body: string, vars: Record<string, string | number | null | undefined>, templateKey?: string) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined || v === null) {
      if (templateKey) throw new MissingVariable(templateKey, k);
      return "";
    }
    return String(v);
  });
}

/** WAT is UTC+1 all year. */
const WAT_OFFSET_MIN = 60;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * If `now` falls inside quiet hours (default 21:00–07:00 Lagos time), the moment they end; else null.
 * A window whose start equals its end means "no quiet hours".
 */
export function quietUntil(now: Date, quiet: { start: string; end: string } = { start: "21:00", end: "07:00" }): Date | null {
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return null;
  const local = (now.getUTCHours() * 60 + now.getUTCMinutes() + WAT_OFFSET_MIN) % 1440;
  const inside = start < end ? local >= start && local < end : local >= start || local < end;
  if (!inside) return null;
  const wait = (end - local + 1440) % 1440;
  const at = new Date(now.getTime() + wait * 60_000);
  at.setUTCSeconds(0, 0);
  return at;
}

async function quietSetting(exec: Exec) {
  const [row] = await exec.select({ value: s.setting.value }).from(s.setting).where(eq(s.setting.key, "quiet_hours"));
  const v = row?.value as { start?: string; end?: string } | undefined;
  return v?.start && v?.end ? { start: v.start, end: v.end } : undefined;
}

/**
 * Queue one templated message (spec/08 §1–4). Idempotent by `eventKey`: a second call with the same
 * key does nothing. Returns the message id when it should be sent (now or after quiet hours), or
 * null when it was skipped (consent, opt-out) or already queued.
 */
export async function queueTemplate(
  input: {
    templateKey: string;
    to: string;
    channel: Channel;
    personId?: string | null;
    vars: Record<string, string | number | null | undefined>;
    eventKey: string;
    language?: "en" | "yo";
    /** false for secrets (sign-in codes, links): the body stays encrypted, the variables are not stored. */
    storeVars?: boolean;
    /** For tests: the time the message is queued. */
    now?: Date;
  },
  exec: Exec = db,
): Promise<string | null> {
  const now = input.now ?? new Date();
  const [tpl] = await exec.select().from(s.messageTemplate).where(eq(s.messageTemplate.key, input.templateKey));
  if (!tpl) throw new Error(`Unknown template ${input.templateKey}`);

  const channels = tpl.channels as Channel[];
  const channel: Channel = channels.includes(input.channel) ? input.channel : (channels[0] ?? "sms");

  // Who it is for: their language, and whether they are a student still waiting on consent.
  const [person] = input.personId
    ? await exec
        .select({ status: s.person.status, language: s.person.language })
        .from(s.person)
        .where(eq(s.person.id, input.personId))
    : [];
  const [studentRole] = input.personId
    ? await exec
        .select({ id: s.personRole.id })
        .from(s.personRole)
        .where(and(eq(s.personRole.personId, input.personId), eq(s.personRole.role, "student"), isNull(s.personRole.revokedAt)))
        .limit(1)
    : [];
  const language: "en" | "yo" = input.language ?? (person?.language === "yo" ? "yo" : "en");

  let skip: string | null = null;
  if (person && studentRole && BLOCKED_STUDENT_STATUSES.includes(person.status) && !tpl.allowBeforeConsent) {
    skip = `consent:${person.status}`;
  }

  // Opt-outs: STOP skips everything except authentication and safeguarding; a consent request is
  // sent once even to someone who opted out, then stops (spec/08 §2 step 3).
  if (!skip && tpl.category !== "authentication" && !SAFEGUARDING_TEMPLATES.has(tpl.key)) {
    const [opt] = await exec
      .select({ id: s.channelOptOut.id })
      .from(s.channelOptOut)
      .where(and(eq(s.channelOptOut.addressHash, lookupHash(input.to)), eq(s.channelOptOut.channel, channel)));
    if (opt) {
      const firstConsentRequest =
        tpl.key === "consent.request" &&
        !(
          input.personId &&
          (
            await exec
              .select({ id: s.message.id })
              .from(s.message)
              .where(and(eq(s.message.personId, input.personId), eq(s.message.templateKey, "consent.request"), sql`${s.message.status} <> 'skipped'`))
              .limit(1)
          ).length
        );
      if (!firstConsentRequest) skip = "opted_out";
    }
  }

  const source =
    (language === "yo" && (channel === "sms" ? (tpl.smsBodyYo ?? tpl.bodyYo) : tpl.bodyYo)) ||
    (channel === "sms" ? (tpl.smsBodyEn ?? tpl.bodyEn) : tpl.bodyEn);
  let body = render(source, input.vars, tpl.key);
  if (channel !== "email" && tpl.category !== "authentication" && !/\bSTOP\b/.test(body)) {
    body = `${body} ${OPT_OUT_LINE[language]}`;
  }

  // Quiet hours apply to phones (WhatsApp and SMS); urgent templates and email go at once.
  const sendAfter = !skip && channel !== "email" && !tpl.ignoresQuietHours ? quietUntil(now, await quietSetting(exec)) : null;

  const [row] = await exec
    .insert(s.message)
    .values({
      direction: "outbound",
      personId: input.personId ?? null,
      toAddress: encrypt(input.to),
      channel,
      templateKey: tpl.key,
      variables: input.storeVars === false ? {} : input.vars,
      bodyRendered: encrypt(body),
      status: skip ? "skipped" : "queued",
      error: skip,
      sendAfter,
      eventKey: input.eventKey,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: s.message.eventKey })
    .returning({ id: s.message.id, status: s.message.status });

  if (!row || row.status === "skipped") return null;
  return row.id;
}

type MessageRow = typeof s.message.$inferSelect;

async function sendOne(m: MessageRow, now: Date): Promise<void> {
  const [tpl] = m.templateKey ? await db.select().from(s.messageTemplate).where(eq(s.messageTemplate.key, m.templateKey)) : [];
  let res: Awaited<ReturnType<ReturnType<typeof providerFor>["send"]>>;
  try {
    res = await providerFor(m.channel).send({
      to: decrypt(m.toAddress),
      body: decrypt(m.bodyRendered),
      subject: tpl?.subjectEn ?? null,
      attachments: await attachmentsFor(m.templateKey, m.variables),
    });
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
  if (res.ok) {
    await db
      .update(s.message)
      .set({ status: "sent", providerId: res.providerId, sentAt: now, error: null, sendAfter: null, updatedAt: now })
      .where(eq(s.message.id, m.id));
    return;
  }

  const attempts = m.attempts + 1;
  if (attempts <= RETRY_MINUTES.length) {
    await db
      .update(s.message)
      .set({ attempts, error: res.error, sendAfter: new Date(now.getTime() + RETRY_MINUTES[attempts - 1]! * 60_000), updatedAt: now })
      .where(eq(s.message.id, m.id));
    return;
  }

  const next = FALLBACK[m.channel];
  if (next && (tpl?.channels as Channel[] | undefined)?.includes(next)) {
    const moved = { ...m, channel: next, attempts: 0 };
    await db.update(s.message).set({ channel: next, attempts: 0, error: res.error, sendAfter: null, updatedAt: now }).where(eq(s.message.id, m.id));
    await sendOne(moved, now);
    return;
  }

  await db.update(s.message).set({ status: "failed", attempts, error: res.error, updatedAt: now }).where(eq(s.message.id, m.id));
  // Consent and session messages matter enough for a person to follow up (spec/08 §2 step 7).
  if (m.templateKey && /^(consent|session)\./.test(m.templateKey)) {
    const [p] = m.personId ? await db.select({ stateId: s.person.stateId }).from(s.person).where(eq(s.person.id, m.personId)) : [];
    await db
      .insert(s.task)
      .values({
        title: `Message could not be delivered (${m.templateKey})`,
        detail: "Every channel failed. Call them, or check the number.",
        kind: "manual",
        entityType: m.personId ? "person" : "message",
        entityId: m.personId ?? m.id,
        stateId: p?.stateId ?? null,
        dedupeKey: `message_failed:${m.id}`,
      })
      .onConflictDoNothing({ target: s.task.dedupeKey });
  }
}

const due = (now: Date) => or(isNull(s.message.sendAfter), lte(s.message.sendAfter, now));

/**
 * Send these messages if they are due. Runs right after the request that queued them; the
 * scheduled sender (`sendDueMessages`) picks up anything delayed or retrying.
 */
export async function dispatch(ids: string[], now = new Date()) {
  if (ids.length === 0) return;
  const rows = await db
    .select()
    .from(s.message)
    .where(and(inArray(s.message.id, ids), eq(s.message.status, "queued"), due(now)));
  for (const m of rows) await sendOne(m, now);
}

/** Everything queued and due: after quiet hours, and retries. Called by `/api/cron/messages`. */
export async function sendDueMessages(now = new Date(), limit = 200) {
  const rows = await db
    .select()
    .from(s.message)
    .where(and(eq(s.message.status, "queued"), eq(s.message.direction, "outbound"), due(now)))
    .orderBy(s.message.createdAt)
    .limit(limit);
  for (const m of rows) await sendOne(m, now);
  return rows.length;
}
