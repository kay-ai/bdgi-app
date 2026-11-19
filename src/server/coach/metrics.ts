/**
 * Delivery measurements (spec/12 §3), computed in code so they are deterministic and testable.
 * Words come from the transcriber with start/end times in seconds; confidence is null when the
 * transcriber does not give one (Groq Whisper), in which case "clear words" is not scored.
 */

export type Word = { w: string; start: number; end: number; conf: number | null };

export type Metrics = {
  durationSeconds: number;
  wordCount: number;
  wpm: number;
  fillerCount: number;
  fillersPerMin: number;
  clarityPct: number | null;
  meanConfidence: number | null;
  longPauses: number;
  longestPauseS: number;
};

export type DeliveryBars = {
  timekeeping: number;
  pace: number;
  fillers: number;
  clarity: number | null;
  pauses: number;
  confidence: number;
};

const SINGLE_FILLERS = new Set(["um", "uh", "er", "erm", "ah", "hmm", "umm", "uhm"]);
const PHRASE_FILLERS = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
];
const LONG_PAUSE_S = 2.5;
const LIKE_PAUSE_S = 0.3;

const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
const round1 = (n: number) => Math.round(n * 10) / 10;

export function countFillers(words: Word[]): number {
  const t = words.map((x) => norm(x.w));
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    if (SINGLE_FILLERS.has(t[i]!)) {
      n++;
      continue;
    }
    if (PHRASE_FILLERS.some(([a, b]) => t[i] === a && t[i + 1] === b)) {
      n++;
      i++;
      continue;
    }
    // "like" counts only when followed by a pause of 0.3 s or more (spec/12 §3).
    if (t[i] === "like" && words[i + 1] && words[i + 1]!.start - words[i]!.end >= LIKE_PAUSE_S) n++;
  }
  return n;
}

export function computeMetrics(words: Word[], durationSeconds: number): Metrics {
  const spoken = words.filter((w) => norm(w.w));
  const minutes = durationSeconds / 60 || 1 / 60;
  const fillerCount = countFillers(spoken);
  const confs = spoken.map((w) => w.conf).filter((c): c is number => typeof c === "number");
  let longPauses = 0;
  let longest = 0;
  for (let i = 1; i < spoken.length; i++) {
    const gap = spoken[i]!.start - spoken[i - 1]!.end;
    if (gap >= LONG_PAUSE_S) longPauses++;
    if (gap > longest) longest = gap;
  }
  return {
    durationSeconds: round1(durationSeconds),
    wordCount: spoken.length,
    wpm: Math.round(spoken.length / minutes),
    fillerCount,
    fillersPerMin: round1(fillerCount / minutes),
    clarityPct: confs.length ? Math.round((confs.filter((c) => c >= 0.85).length / confs.length) * 100) : null,
    meanConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
    longPauses,
    longestPauseS: round1(longest),
  };
}

/** Timekeeping against the speech's target length. With a 120 s target this is exactly spec/12's bands. */
export function timekeepingBar(seconds: number, target = 120): number {
  const r = seconds / target;
  if (r >= 0.875 && r <= 1.0417) return 5;
  if ((r >= 0.75 && r < 0.875) || (r > 1.0417 && r <= 1.125)) return 4;
  if ((r >= 0.625 && r < 0.75) || (r > 1.125 && r <= 1.25)) return 3;
  if (r >= 0.375 && r < 0.625) return 2;
  return 1;
}

export function paceBar(wpm: number): number {
  if (wpm >= 120 && wpm <= 160) return 5;
  if ((wpm >= 105 && wpm < 120) || (wpm > 160 && wpm <= 175)) return 4;
  if ((wpm >= 90 && wpm < 105) || (wpm > 175 && wpm <= 190)) return 3;
  if ((wpm >= 75 && wpm < 90) || (wpm > 190 && wpm <= 210)) return 2;
  return 1;
}

export function fillersBar(perMin: number): number {
  if (perMin <= 1) return 5;
  if (perMin <= 2) return 4;
  if (perMin <= 4) return 3;
  if (perMin <= 6) return 2;
  return 1;
}

export function clarityBar(pct: number | null): number | null {
  if (pct === null) return null;
  if (pct >= 92) return 5;
  if (pct >= 85) return 4;
  if (pct >= 75) return 3;
  if (pct >= 65) return 2;
  return 1;
}

export function pausesBar(longPauses: number): number {
  if (longPauses === 0) return 5;
  if (longPauses === 1) return 4;
  if (longPauses === 2) return 3;
  if (longPauses <= 4) return 2;
  return 1;
}

export function deliveryBars(m: Metrics, targetSeconds = 120): DeliveryBars {
  const pace = paceBar(m.wpm);
  const fillers = fillersBar(m.fillersPerMin);
  const pauses = pausesBar(m.longPauses);
  return {
    timekeeping: timekeepingBar(m.durationSeconds, targetSeconds),
    pace,
    fillers,
    clarity: clarityBar(m.clarityPct),
    pauses,
    confidence: Math.round((pace + fillers + pauses) / 3),
  };
}

/**
 * Overall stars (spec/12 §3). When a part cannot be measured (clarity without word confidence,
 * content when the scorer failed) its weight is shared out across the rest.
 */
export function overallStars(structure: number | null, argument: number | null, b: DeliveryBars): number {
  const parts: [number, number][] = [
    [0.15, b.timekeeping],
    [0.1, b.pace],
    [0.1, b.fillers],
    [0.1, b.confidence],
  ];
  // Content scores are missing only when the scorer failed; the stars then rest on delivery alone.
  if (structure !== null) parts.push([0.25, structure]);
  if (argument !== null) parts.push([0.25, argument]);
  if (b.clarity !== null) parts.push([0.05, b.clarity]);
  const weight = parts.reduce((a, [w]) => a + w, 0);
  const score = parts.reduce((a, [w, v]) => a + w * v, 0) / weight;
  return Math.min(5, Math.max(1, Math.round(score)));
}

/** Why a recording can't be scored, or null when it can (spec/12 §3: these do not count toward the cap). */
export function rejectReason(m: Metrics, minSeconds = 20): "too_short" | "too_few_words" | "unclear" | null {
  if (m.durationSeconds < minSeconds) return "too_short";
  if (m.wordCount < 30) return "too_few_words";
  if (m.meanConfidence !== null && m.meanConfidence < 0.5) return "unclear";
  return null;
}
