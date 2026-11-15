import "server-only";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { lookupHash, secureCompare } from "@/lib/crypto";

export async function getIntakeOptions() {
  const states = await db
    .select({ id: s.state.id, code: s.state.code, name: s.state.name, isActive: s.state.isActive })
    .from(s.state)
    .orderBy(asc(s.state.name));
  const lgas = await db
    .select({ id: s.lga.id, stateId: s.lga.stateId, name: s.lga.name })
    .from(s.lga)
    .orderBy(asc(s.lga.name));
  const programmes = await db
    .select({ id: s.programme.id, slug: s.programme.slug, name: s.programme.nameEn, summary: s.programme.summaryEn })
    .from(s.programme)
    .where(eq(s.programme.isEnrolling, true))
    .orderBy(asc(s.programme.sort));
  return { states, lgas, programmes };
}
export type IntakeOptions = Awaited<ReturnType<typeof getIntakeOptions>>;

/** School picker: name contains the typed text (≥ 2 letters), filtered by state (spec/05 §2). */
export async function searchSchools(stateId: string, q: string) {
  if (q.trim().length < 2) return [];
  return db
    .select({ id: s.school.id, name: s.school.name, town: s.school.town, lga: s.lga.name, lgaId: s.school.lgaId })
    .from(s.school)
    .innerJoin(s.lga, eq(s.lga.id, s.school.lgaId))
    .where(and(eq(s.school.stateId, stateId), ilike(s.school.name, `%${q.trim().replace(/[%_]/g, "")}%`), isNull(s.school.deletedAt)))
    .orderBy(asc(s.school.name))
    .limit(12);
}

/** Signed handle for the done screen's "Remind my guardian" button, so ids can't be guessed. */
export const remindHandle = (personId: string) => `${personId}.${lookupHash(`remind:${personId}`).slice(0, 24)}`;
export function readRemindHandle(handle: string): string | null {
  const [id, sig] = handle.split(".");
  if (!id || !sig) return null;
  return secureCompare(sig, lookupHash(`remind:${id}`).slice(0, 24)) ? id : null;
}
