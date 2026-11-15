import "server-only";
import { and, asc, count, countDistinct, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Public figures never show a count under 5 as a number (spec/14 M9, spec/04 §6.5). */
export const MIN_PUBLIC_COUNT = 5;
export type PublicCount = number | "lt5";
export const publicCount = (n: number): PublicCount => (n > 0 && n < MIN_PUBLIC_COUNT ? "lt5" : n);

export type PublicTotals = {
  students: number;
  girls: number;
  schools: number;
  volunteers: number;
  states: number;
  sourceNote: string;
  byProgramme: { slug: string; name: string; students: number }[];
};

/**
 * Historical figures plus live Hub counts (spec/04 §2). Live students count only those marked
 * completed in a cohort; until M9's metric definitions land, the historical table carries the totals.
 */
export async function getPublicTotals(): Promise<PublicTotals> {
  const hist = await db
    .select({
      programmeId: s.historicalImpact.programmeId,
      students: s.historicalImpact.students,
      girls: s.historicalImpact.girls,
      schools: s.historicalImpact.schools,
      volunteers: s.historicalImpact.volunteers,
      stateId: s.historicalImpact.stateId,
      sourceNote: s.historicalImpact.sourceNote,
    })
    .from(s.historicalImpact);

  const [live] = await db
    .select({ students: countDistinct(s.cohortMember.personId) })
    .from(s.cohortMember)
    .where(and(eq(s.cohortMember.role, "student"), eq(s.cohortMember.completed, true)));

  const [liveVolunteers] = await db
    .select({ n: count() })
    .from(s.volunteerProfile)
    .where(eq(s.volunteerProfile.stage, "active"));

  const activeStates = await db.select({ n: count() }).from(s.state).where(eq(s.state.isActive, true));

  const programmes = await db.select().from(s.programme).orderBy(asc(s.programme.sort));
  const byProgramme = programmes
    .map((p) => ({
      slug: p.slug,
      name: p.nameEn,
      students: hist.filter((h) => h.programmeId === p.id).reduce((a, h) => a + h.students, 0),
    }))
    .filter((p) => p.students > 0);

  // Headline "students trained" counts the weekly training programmes (kind debate); one-day events
  // such as Inspire Her Future are reported on their own line so no student is counted twice.
  const trainingIds = new Set(programmes.filter((p) => p.kind === "debate").map((p) => p.id));
  const training = hist.filter((h) => trainingIds.has(h.programmeId));
  const main = training[0] ?? hist[0];
  return {
    students: training.reduce((a, h) => a + h.students, 0) + (live?.students ?? 0),
    girls: hist.reduce((a, h) => a + (h.girls ?? 0), 0),
    schools: hist.reduce((a, h) => Math.max(a, h.schools), 0),
    volunteers: hist.reduce((a, h) => a + h.volunteers, 0) + (liveVolunteers?.n ?? 0),
    states: activeStates[0]?.n ?? 0,
    sourceNote: main?.sourceNote ?? "",
    byProgramme,
  };
}

export async function getHistoricalFigure(slug: string) {
  const [row] = await db
    .select({ students: sql<number>`coalesce(sum(${s.historicalImpact.students}),0)::int`, schools: sql<number>`coalesce(max(${s.historicalImpact.schools}),0)::int` })
    .from(s.historicalImpact)
    .innerJoin(s.programme, eq(s.programme.id, s.historicalImpact.programmeId))
    .where(eq(s.programme.slug, slug));
  return row ?? { students: 0, schools: 0 };
}

export async function listProgrammes() {
  return db
    .select()
    .from(s.programme)
    .where(eq(s.programme.status, "published"))
    .orderBy(asc(s.programme.sort));
}

export async function getProgramme(slug: string) {
  const [p] = await db.select().from(s.programme).where(eq(s.programme.slug, slug));
  return p ?? null;
}

export async function listLessonPlans(programmeId: string) {
  return db
    .select()
    .from(s.lessonPlan)
    .where(eq(s.lessonPlan.programmeId, programmeId))
    .orderBy(asc(s.lessonPlan.position));
}

export async function listTeam() {
  return db.select().from(s.teamMember).where(eq(s.teamMember.isVisible, true)).orderBy(asc(s.teamMember.sort));
}

export async function listVisiblePartners() {
  return db.select().from(s.partner).where(eq(s.partner.isVisible, true)).orderBy(asc(s.partner.sort));
}

export async function listFaqs(audiences?: string[]) {
  const rows = await db
    .select()
    .from(s.faq)
    .where(eq(s.faq.status, "published"))
    .orderBy(asc(s.faq.sort));
  return rows
    .filter((r) => !audiences || audiences.includes(r.audience))
    .map((r) => ({ ...r, answer: (r.answerEn as { text?: string }).text ?? "" }));
}

export async function listPublishedStories(limit = 3) {
  return db
    .select()
    .from(s.story)
    .where(and(eq(s.story.status, "published"), isNull(s.story.deletedAt)))
    .orderBy(sql`${s.story.publishedAt} desc`)
    .limit(limit);
}

/** Schools BGDI works with, counted by LGA, for the reach map. */
export async function getReachByLga() {
  const lgas = await db
    .select({ id: s.lga.id, name: s.lga.name, stateCode: s.state.code, stateName: s.state.name })
    .from(s.lga)
    .innerJoin(s.state, eq(s.state.id, s.lga.stateId))
    .where(inArray(s.state.code, ["OY", "OS"]))
    .orderBy(asc(s.state.code), asc(s.lga.name));
  const schools = await db
    .select({ lgaId: s.school.lgaId, n: count() })
    .from(s.school)
    .where(and(inArray(s.school.partnershipStatus, ["active", "agreement_signed"]), isNull(s.school.deletedAt)))
    .groupBy(s.school.lgaId);
  const byLga = new Map(schools.map((r) => [r.lgaId, r.n]));
  return lgas.map((l) => ({ ...l, schools: byLga.get(l.id) ?? 0 }));
}

export async function getSettings(keys: string[]) {
  const rows = await db.select().from(s.setting).where(inArray(s.setting.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
}
