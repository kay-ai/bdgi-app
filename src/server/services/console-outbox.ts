import "server-only";
import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt } from "@/lib/crypto";
import { assertCan } from "@/server/permissions/assert";
import type { Actor } from "@/server/permissions/can";
import { audit } from "./audit";

/**
 * The outbox for admins while real WhatsApp, SMS and email sending isn't connected (M8): every
 * message the app wrote in the last 7 days, in full, so staff can pass on a sign-in code or a
 * guardian's permission link by hand. Bodies are decrypted only here, only for admins, and each
 * view is audited. Staff account messages (invites, password resets) are never shown: their links
 * would let one admin take over another staff account.
 */

export const OUTBOX_KINDS = ["codes", "permission", "all"] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

const PERMISSION_TEMPLATES = ["consent.request", "consent.reminder", "consent.thanks", "consent.declined_ack", "consent.withdrawn"];

export function messagingLive() {
  return ["WHATSAPP_PROVIDER", "SMS_PROVIDER", "EMAIL_PROVIDER"].some((k) => process.env[k] && process.env[k] !== "console");
}

export async function listOutbox(actor: Actor | null, f: { kind?: OutboxKind; to?: string; student?: string }, ip: string | null = null) {
  const ctx = assertCan(actor, "user.manage", { ip });
  const since = new Date(Date.now() - 7 * 86_400_000);
  const parts: (SQL | undefined)[] = [
    eq(s.message.direction, "outbound"),
    gte(s.message.createdAt, since),
    sql`coalesce(${s.message.templateKey}, '') not like 'staff.%'`,
  ];
  if (f.kind === "codes") parts.push(eq(s.message.templateKey, "auth.otp"));
  if (f.kind === "permission") parts.push(inArray(s.message.templateKey, PERMISSION_TEMPLATES));
  // One student: messages to her and to her guardians. Sign-in codes carry no person, so find those by phone number.
  if (f.student && /^[0-9a-f-]{36}$/i.test(f.student)) {
    parts.push(
      sql`(${s.message.personId} = ${f.student} or ${s.message.personId} in (select guardian_id from guardian_link where student_id = ${f.student}))`,
    );
  }
  const rows = await db
    .select({
      id: s.message.id,
      createdAt: s.message.createdAt,
      channel: s.message.channel,
      templateKey: s.message.templateKey,
      status: s.message.status,
      to: s.message.toAddress,
      body: s.message.bodyRendered,
      personName: s.person.firstName,
    })
    .from(s.message)
    .leftJoin(s.person, eq(s.person.id, s.message.personId))
    .where(and(...parts))
    .orderBy(desc(s.message.createdAt))
    .limit(200);

  const digits = (v: string) => v.replace(/\D/g, "");
  const want = f.to?.trim() ? digits(f.to).slice(-10) || f.to.trim().toLowerCase() : "";
  const out = rows
    .map((r) => {
      let to = "";
      let body = "";
      try {
        to = decrypt(r.to) ?? "";
        body = decrypt(r.body) ?? "";
      } catch {
        body = "";
      }
      return { ...r, to, body };
    })
    .filter((r) => !want || digits(r.to).endsWith(want) || r.to.toLowerCase().includes(want))
    .slice(0, 100);

  await audit(db, ctx, { action: "outbox.view", entityType: "message", entityId: "00000000-0000-0000-0000-000000000000", meta: { kind: f.kind ?? "all", filtered: !!want, student: f.student ?? null, shown: out.length } });
  return out;
}
