import { LESSONS, SKILLS, type Lesson, type SkillKey } from "./curriculum";
import type { DeliveryBars } from "./metrics";

/**
 * How the path adapts to each student (DECISIONS.md D-015):
 * - Every scored speech rates the skills it shows (content skills by the scorer, delivery skills
 *   by the measurements). A rating is a running average: 60% history, 40% this speech, so one
 *   bad day doesn't undo weeks of progress.
 * - In a lesson drill the skill being taught moves a little faster (50/50).
 * - The next lesson is the unpassed lesson of the weakest skill. Ties go to the earlier skill in
 *   the path (an opening before rebuttal), because later skills build on earlier ones.
 */

export type Ratings = Partial<Record<SkillKey, number>>;
export type ContentScores = Partial<Record<SkillKey, number | null>>;

export function deliveryScores(b: DeliveryBars): Record<"pace" | "fluency" | "timekeeping", number> {
  return { pace: b.pace, fluency: Math.round((b.fillers + b.pauses) / 2), timekeeping: b.timekeeping };
}

const clamp = (n: number) => Math.min(5, Math.max(1, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** New ratings after one speech. Skills not shown in this speech (score null/undefined) don't move. */
export function updateRatings(current: Ratings, scores: Partial<Record<SkillKey, number | null>>, focus?: SkillKey): Ratings {
  const next: Ratings = { ...current };
  for (const s of SKILLS) {
    const score = scores[s.key];
    if (score === null || score === undefined) continue;
    const old = current[s.key];
    const w = s.key === focus ? 0.5 : 0.4;
    next[s.key] = r2(clamp(old === undefined ? score : old * (1 - w) + score * w));
  }
  return next;
}

export function passedLesson(lesson: Lesson, focusScore: number) {
  return focusScore >= lesson.drill.passScore;
}

/** The next lesson for this student, or null when every lesson is passed. Null ratings = no placement yet. */
export function nextLesson(ratings: Ratings, passed: Set<string>): Lesson | null {
  const order = SKILLS.map((s) => s.key);
  const open = (skill: SkillKey) => LESSONS.filter((l) => l.skill === skill && !passed.has(l.key)).sort((a, b) => a.level - b.level)[0];
  const candidates = order
    .map((k, i) => ({ k, i, lesson: open(k), rating: ratings[k] ?? 1 }))
    .filter((c) => c.lesson);
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.rating - b.rating || a.i - b.i);
  return candidates[0]!.lesson!;
}

export type Rank = "starter" | "speaker" | "debater" | "expert";

/** Overall rank from the ratings. "Expert debater" needs every skill strong, not just a good average. */
export function rankFor(ratings: Ratings): { rank: Rank; mean: number } {
  const vals = SKILLS.map((s) => ratings[s.key] ?? 1);
  const mean = r2(vals.reduce((a, b) => a + b, 0) / vals.length);
  const min = Math.min(...vals);
  const rank: Rank = mean >= 4.2 && min >= 3.5 ? "expert" : mean >= 3.2 ? "debater" : mean >= 2.2 ? "speaker" : "starter";
  return { rank, mean };
}

/** The two weakest rated skills, to tell the scorer what this student has been working on. */
export function weakest(ratings: Ratings, n = 2): SkillKey[] {
  return SKILLS.filter((s) => ratings[s.key] !== undefined)
    .sort((a, b) => ratings[a.key]! - ratings[b.key]!)
    .slice(0, n)
    .map((s) => s.key);
}
