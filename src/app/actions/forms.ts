"use server";

import { headers } from "next/headers";
import type { ZodTypeAny, z } from "zod";
import {
  concernInput,
  contactInput,
  schoolInput,
  submitConcern,
  submitContact,
  submitSchoolRequest,
  submitVolunteer,
  volunteerInput,
} from "@/server/services/forms";
import type { Ctx } from "@/server/services/audit";

export type FormResult = { ok: true; reference?: string } | { ok: false; code: string; fields?: Record<string, string> };

async function ctx(locale: string): Promise<Ctx> {
  const h = await headers();
  return {
    actor: null,
    locale: locale === "yo" ? "yo" : "en",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    userAgent: h.get("user-agent"),
  };
}

async function run<S extends ZodTypeAny>(
  schema: S,
  raw: unknown,
  locale: string,
  fn: (c: Ctx, v: z.infer<S>) => Promise<{ ok: true; reference?: string } | { ok: false; code: string }>,
): Promise<FormResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "invalid", fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  }
  try {
    return await fn(await ctx(locale), parsed.data);
  } catch (e) {
    console.error("[forms]", e);
    return { ok: false, code: "server" };
  }
}

export const contactAction = async (locale: string, raw: unknown) => run(contactInput, raw, locale, submitContact);
export const concernAction = async (locale: string, raw: unknown) => run(concernInput, raw, locale, submitConcern);
export const volunteerAction = async (locale: string, raw: unknown) => run(volunteerInput, raw, locale, submitVolunteer);
export const schoolAction = async (locale: string, raw: unknown) => run(schoolInput, raw, locale, submitSchoolRequest);
