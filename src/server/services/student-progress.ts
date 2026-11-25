import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt } from "@/lib/crypto";
import { LESSON, LESSONS, SKILLS, type SkillKey } from "@/server/coach/curriculum";
import { nextLesson, rankFor, type Rank, type Ratings } from "@/server/coach/tailor";

/**
 * A student's own progress (D-020): what the Hub home and the console student page show. It comes
 * from the speech coach, so it is hers alone, whatever group she is in. Badges are worked out from
 * the same records each time instead of being stored, so they can never disagree with them.
 */

export const BADGES = [
  { key: "first_speech", need: (p: Counts) => p.speeches >= 1 },
  { key: "five_speeches", need: (p: Counts) => p.speeches >= 5 },
  { key: "twenty_speeches", need: (p: Counts) => p.speeches >= 20 },
  { key: "first_lesson", need: (p: Counts) => p.lessons >= 1 },
  { key: "five_lessons", need: (p: Counts) => p.lessons >= 5 },
  { key: "three_weeks", need: (p: Counts) => p.bestStreak >= 3 },
  { key: "speaker", need: (p: Counts) => p.rank !== null && p.rank !== "starter" },
  { key: "debater", need: (p: Counts) => p.rank === "debater" || p.rank === "expert" },
  { key: "expert", need: (p: Counts) => p.rank === "expert" },
  { key: "all_lessons", need: (p: Counts) => p.lessons >= LESSONS.length },
] as const;
export type BadgeKey = (typeof BADGES)[number]["key"];

type Counts = { speeches: number; lessons: number; bestStreak: number; rank: Rank | null };

const WEEK = 7 * 86_400_000;
/** Monday 00:00 UTC of the week a date falls in, as a week number. */
const weekOf = (d: Date) => Math.floor((d.getTime() + 3 * 86_400_000) / WEEK);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/**
 * Weeks in a row with at least one scored speech: weekly rather than daily, to suit shared phones
 * (spec/13 §1). `current` counts back from this week, or from last week if she hasn't spoken yet
 * this week; `best` is the longest run ever.
 */
export function streaks(dates: Date[], now = new Date()) {
  const weeks = [...new Set(dates.map(weekOf))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && weeks[i] === weeks[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const have = new Set(weeks);
  let w = weekOf(now);
  if (!have.has(w)) w -= 1;
  let current = 0;
  while (have.has(w)) {
    current++;
    w--;
  }
  return { current, best };
}

export type StudentProgress = {
  placed: boolean;
  rank: Rank | null;
  mean: number | null;
  lessonsPassed: number;
  lessonsTotal: number;
  next: { key: string; title: string } | null;
  speeches: number;
  thisMonth: number;
  recentStars: number | null;
  starsChange: number | null;
  stars: number[];
  streak: number;
  bestStreak: number;
  lastAt: Date | null;
  skills: { key: SkillKey; name: string; rating: number | null }[];
  badges: { key: BadgeKey; earned: boolean }[];
};

export async function studentProgress(personId: string, now = new Date()): Promise<StudentProgress> {
  const [skills, lessons, done] = await Promise.all([
    db.select({ k: s.coachSkill.skillKey, r: s.coachSkill.rating }).from(s.coachSkill).where(eq(s.coachSkill.personId, personId)),
    db.select({ k: s.coachLesson.lessonKey, status: s.coachLesson.status }).from(s.coachLesson).where(eq(s.coachLesson.personId, personId)),
    db
      .select({ stars: s.speechAttempt.overallStars, createdAt: s.speechAttempt.createdAt })
      .from(s.speechAttempt)
      .where(and(eq(s.speechAttempt.personId, personId), eq(s.speechAttempt.status, "done")))
      .orderBy(desc(s.speechAttempt.createdAt)),
  ]);
  const ratings = Object.fromEntries(skills.map((x) => [x.k, Number(x.r)])) as Ratings;
  const placed = skills.length > 0;
  const passed = new Set(lessons.filter((l) => l.status === "passed").map((l) => l.k));
  const rank = placed ? rankFor(ratings) : null;
  const next = placed ? nextLesson(ratings, passed) : null;
  const stars = done.map((d) => d.stars).filter((n): n is number => n !== null);
  const recent = avg(stars.slice(0, 3));
  const before = avg(stars.slice(3, 6));
  const { current, best } = streaks(
    done.map((d) => d.createdAt),
    now,
  );
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const counts: Counts = { speeches: done.length, lessons: passed.size, bestStreak: best, rank: rank?.rank ?? null };
  return {
    placed,
    rank: rank?.rank ?? null,
    mean: rank?.mean ?? null,
    lessonsPassed: passed.size,
    lessonsTotal: LESSONS.length,
    next: next ? { key: next.key, title: LESSON[next.key]!.title } : null,
    speeches: done.length,
    thisMonth: done.filter((d) => d.createdAt >= monthStart).length,
    recentStars: recent,
    starsChange: recent !== null && before !== null ? Math.round((recent - before) * 10) / 10 : null,
    stars: stars.slice(0, 12).reverse(),
    streak: current,
    bestStreak: best,
    lastAt: done[0]?.createdAt ?? null,
    skills: SKILLS.map((k) => ({ key: k.key, name: k.name, rating: ratings[k.key] ?? null })),
    badges: BADGES.map((b) => ({ key: b.key, earned: b.need(counts) })),
  };
}

export type StudentGroup = {
  id: string;
  name: string;
  school: string;
  status: string;
  startsOn: string;
  endsOn: string;
  meetingDay: number | null;
  meetingTime: string | null;
  venue: string | null;
  coaches: { firstName: string; initial: string; role: string }[];
  current: boolean;
};

/** The groups a student is or was in, newest first, with each group's current coaches. */
export async function studentGroups(personId: string): Promise<StudentGroup[]> {
  const rows = await db
    .select({
      id: s.cohort.id,
      name: s.cohort.name,
      school: s.school.name,
      status: s.cohort.status,
      startsOn: s.cohort.startsOn,
      endsOn: s.cohort.endsOn,
      meetingDay: s.cohort.meetingDay,
      meetingTime: s.cohort.meetingTime,
      venue: s.cohort.venue,
      leftOn: s.cohortMember.leftOn,
    })
    .from(s.cohortMember)
    .innerJoin(s.cohort, eq(s.cohort.id, s.cohortMember.cohortId))
    .innerJoin(s.school, eq(s.school.id, s.cohort.schoolId))
    .where(and(eq(s.cohortMember.personId, personId), eq(s.cohortMember.role, "student"), isNull(s.cohort.deletedAt)))
    .orderBy(desc(s.cohort.startsOn));
  if (!rows.length) return [];
  const coaches = await db
    .select({ cohortId: s.cohortMember.cohortId, firstName: s.person.firstName, surname: s.person.surname, role: s.cohortMember.role })
    .from(s.cohortMember)
    .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
    .where(
      and(
        inArray(
          s.cohortMember.cohortId,
          rows.map((r) => r.id),
        ),
        inArray(s.cohortMember.role, ["lead_coach", "assistant_coach"]),
        isNull(s.cohortMember.leftOn),
      ),
    );
  const initial = (enc: string) => {
    try {
      return (decrypt(enc) ?? "").slice(0, 1).toUpperCase();
    } catch {
      return "";
    }
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    school: r.school,
    status: r.status,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    meetingDay: r.meetingDay,
    meetingTime: r.meetingTime,
    venue: r.venue,
    current: r.leftOn === null && r.status !== "completed" && r.status !== "cancelled",
    coaches: coaches
      .filter((c) => c.cohortId === r.id)
      .sort((a, b) => (a.role === "lead_coach" ? -1 : b.role === "lead_coach" ? 1 : 0))
      .map((c) => ({ firstName: c.firstName, initial: initial(c.surname), role: c.role })),
  }));
}
