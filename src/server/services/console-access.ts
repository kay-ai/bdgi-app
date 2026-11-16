import "server-only";
import type { Ctx } from "./audit";

export type ConsolePermission = "donation.view" | "donation.manage";

export class ConsoleDenied extends Error {
  constructor() {
    super("Not allowed");
  }
}

/**
 * Stand-in for the M3 permission check (spec/03). Sign-in does not exist yet, so the console is
 * open only on a developer's machine and in tests: with NODE_ENV=production (Vercel, including
 * previews) every console page is a 404 and every console action is refused. M3 replaces this
 * with the session's roles: `donation.view` for programme managers and admins (spec/03 §3).
 * See DECISIONS.md D-012.
 */
export function consoleAllowed(_permission: ConsolePermission): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CONSOLE_DEV_ACCESS !== "off";
}

export function consoleCtx(permission: ConsolePermission, extra: Partial<Ctx> = {}): Ctx {
  if (!consoleAllowed(permission)) throw new ConsoleDenied();
  return { actor: null, locale: "en", ip: null, ...extra };
}
