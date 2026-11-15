"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { consentDecision } from "@/server/validation/join";
import { decide, withdraw } from "@/server/services/consent";
import { hit } from "@/server/services/rate-limit";

async function ctx(locale: string) {
  const h = await headers();
  return {
    actor: null,
    locale: (locale === "yo" ? "yo" : "en") as "en" | "yo",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    userAgent: h.get("user-agent"),
  };
}

export async function decideAction(locale: string, raw: unknown) {
  const parsed = consentDecision.safeParse(raw);
  if (!parsed.success) return { ok: false as const, code: "form" as const };
  const c = await ctx(locale);
  if (!(await hit(`consent.verify:${c.ip}`, 30, 3600))) return { ok: false as const, code: "locked" as const };
  return decide(c, parsed.data);
}

export async function withdrawAction(locale: string, raw: unknown) {
  const parsed = z.object({ token: z.string().min(10).max(100), code: z.string().regex(/^\d{6}$/) }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, code: "form" as const };
  return withdraw(await ctx(locale), parsed.data.token, parsed.data.code);
}
