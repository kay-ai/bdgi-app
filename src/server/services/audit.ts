import "server-only";
import { db, schema as s } from "@/db";

export type Actor = { personId: string; roles: string[] } | null;
export type Ctx = { actor: Actor; locale: "en" | "yo"; ip?: string | null; userAgent?: string | null };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Append-only audit trail (spec/02 §8). */
export async function audit(
  tx: Tx | typeof db,
  ctx: Ctx,
  e: { action: string; entityType: string; entityId: string; subjectPersonId?: string | null; meta?: object },
) {
  await tx.insert(s.auditEvent).values({
    actorPersonId: ctx.actor?.personId ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    subjectPersonId: e.subjectPersonId ?? null,
    meta: e.meta ?? {},
    ip: ctx.ip ?? null,
  });
}
