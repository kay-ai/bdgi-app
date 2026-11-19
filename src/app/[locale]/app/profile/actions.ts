"use server";

import { revalidatePath } from "next/cache";
import { getActor, requestMeta } from "@/server/auth/current";
import { hasRole } from "@/server/permissions/can";
import { changeContact, saveProfile } from "@/server/services/student-profile";
import { contactChange, studentProfile } from "@/server/validation/join";

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string> } };

async function student() {
  const actor = await getActor();
  return actor && hasRole(actor, "student") ? actor : null;
}

/** The Hub profile: what sign-up no longer asks (D-019). */
export async function saveProfileAction(locale: string, raw: unknown): Promise<Result<null>> {
  const actor = await student();
  if (!actor) return { ok: false, error: { code: "denied", message: "server" } };
  const parsed = studentProfile.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: { code: "invalid", message: "server", fieldErrors } };
  }
  const meta = await requestMeta();
  await saveProfile({ actor, locale: locale === "yo" ? "yo" : "en", ip: meta.ip, userAgent: meta.userAgent }, parsed.data);
  revalidatePath("/[locale]/app", "layout");
  return { ok: true, data: null };
}

/** Her own email, or her guardian's while permission is still awaited. */
export async function changeMyContactAction(locale: string, raw: unknown): Promise<Result<{ sentTo: string | null }>> {
  const actor = await student();
  const parsed = contactChange.safeParse(raw);
  if (!actor || !parsed.success) return { ok: false, error: { code: "invalid", message: "email" } };
  const meta = await requestMeta();
  const r = await changeContact({ actor, locale: locale === "yo" ? "yo" : "en", ip: meta.ip, userAgent: meta.userAgent }, actor.personId, parsed.data);
  return r.ok ? { ok: true, data: { sentTo: r.sentTo } } : { ok: false, error: { code: r.code, message: r.code } };
}
