import type { Ctx } from "@/server/services/audit";
import { can, type Actor, type Resource } from "./can";

/** Thrown by services when the actor may not do something; pages show "no access", APIs 403. */
export class Forbidden extends Error {
  constructor(public action: string) {
    super(`Not allowed: ${action}`);
  }
}

/** Server-side permission check for a service call; returns the audit context for it. */
export function assertCan(actor: Actor | null, action: string, opts: { ip?: string | null; resource?: Resource } = {}): Ctx {
  if (!can(actor, action, opts.resource)) throw new Forbidden(action);
  return { actor, locale: "en", ip: opts.ip ?? null };
}
