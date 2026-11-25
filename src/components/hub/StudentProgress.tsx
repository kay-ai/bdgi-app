import { getFormatter, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Award,
  BookOpen,
  Crown,
  Flame,
  GraduationCap,
  Medal,
  Mic,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { RankLadder } from "@/components/coach/parts";
import type { BadgeKey, StudentGroup, StudentProgress } from "@/server/services/student-progress";

/**
 * The student Hub home (spec/06 §1.1, D-020): pictures and numbers first, few words. One clear
 * action (practise), her rank as a ladder, four stat tiles, the badge she's closest to, a shelf of
 * badges, and her group.
 */

const BADGE_ICON: Record<BadgeKey, LucideIcon> = {
  first_speech: Mic,
  five_speeches: Star,
  twenty_speeches: Trophy,
  first_lesson: BookOpen,
  five_lessons: GraduationCap,
  three_weeks: Flame,
  speaker: Medal,
  debater: Award,
  expert: Crown,
  all_lessons: Sparkles,
};

const RANKS = ["starter", "speaker", "debater", "expert"] as const;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const GOLD = "#FFB800";

/** How far she is towards a badge: what she has and what it needs. */
function goal(key: BadgeKey, p: StudentProgress): [number, number] {
  const rank = p.rank ? RANKS.indexOf(p.rank) : -1;
  switch (key) {
    case "first_speech":
      return [p.speeches, 1];
    case "five_speeches":
      return [p.speeches, 5];
    case "twenty_speeches":
      return [p.speeches, 20];
    case "first_lesson":
      return [p.lessonsPassed, 1];
    case "five_lessons":
      return [p.lessonsPassed, 5];
    case "all_lessons":
      return [p.lessonsPassed, p.lessonsTotal];
    case "three_weeks":
      return [Math.max(p.streak, p.bestStreak), 3];
    case "speaker":
      return [Math.max(rank, 0), 1];
    case "debater":
      return [Math.max(rank, 0), 2];
    case "expert":
      return [Math.max(rank, 0), 3];
  }
}
const COUNTED = new Set<BadgeKey>(["five_speeches", "twenty_speeches", "five_lessons", "all_lessons", "three_weeks"]);

/** The unearned badge she's closest to. */
function nextBadge(p: StudentProgress) {
  return p.badges
    .filter((b) => !b.earned)
    .map((b) => {
      const [have, need] = goal(b.key, p);
      return { key: b.key, have: Math.min(have, need), need, ratio: need ? Math.min(have, need) / need : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio)[0];
}

/** A short "Finish your profile" strip, while the profile isn't done (D-019). */
export async function FinishProfile() {
  const t = await getTranslations("hub.home");
  return (
    <Link href="/app/profile" className="card flex items-center gap-4 !p-4" style={{ borderColor: GOLD, borderWidth: 2 }}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: GOLD }} aria-hidden="true">
        <UserRound size={22} strokeWidth={2} />
      </span>
      <span className="grid flex-1">
        <span className="font-medium">{t("finish")}</span>
        <span className="text-[14px] text-muted">{t("finishShort")}</span>
      </span>
      <ArrowRight size={20} aria-hidden="true" />
    </Link>
  );
}

/** Hello, her rank on a ladder, and one big button to practise. */
export async function HubHero({ name, avatarKey, p, canPractise }: { name: string; avatarKey: string | null; p: StudentProgress; canPractise: boolean }) {
  const t = await getTranslations("hub.home");
  const tr = await getTranslations("coach.rank");
  const href = !canPractise ? "/app/coach" : !p.placed ? "/app/coach/placement" : p.next ? `/app/coach/lesson/${p.next.key}` : "/app/coach";
  return (
    <section className="grid gap-6 rounded-[28px] p-6 sm:p-8" style={{ background: "#1a1712", color: "#fbf7ef" }} aria-labelledby="hub-hello">
      <div className="flex items-center gap-4">
        <Avatar avatarKey={avatarKey ?? "a01"} size={56} />
        <div className="grid">
          <h1 id="hub-hello" className="t-h3" style={{ color: "inherit" }}>
            {t("hello", { name })}
          </h1>
          {p.placed && (
            <p className="text-[15px]" style={{ color: "#b9b3a8" }}>
              {t("rankLabel")}: <strong style={{ color: GOLD, fontWeight: 600 }}>{tr(p.rank!)}</strong>
            </p>
          )}
        </div>
      </div>

      {p.placed ? (
        <RankLadder rank={p.rank!} />
      ) : (
        <div className="grid gap-1">
          <p className="t-h2" style={{ color: "inherit" }}>
            {t("startTitle")}
          </p>
          <p style={{ color: "#b9b3a8" }}>{t("startLead")}</p>
        </div>
      )}

      <div className="grid gap-3">
        <Link href={href} className="btn btn--gold btn--lg btn--block sm:!w-auto sm:justify-self-start">
          <Mic size={20} aria-hidden="true" />
          {!p.placed && canPractise ? t("start") : t("practise")}
        </Link>
        {p.placed && canPractise && (
          <p className="text-[14px]" style={{ color: "#b9b3a8" }}>
            {p.next ? t("nextLesson", { title: p.next.title }) : t("allLessons")}
          </p>
        )}
      </div>
    </section>
  );
}

/** Four tiles: streak, speeches, lessons, stars. */
export async function StatTiles({ p }: { p: StudentProgress }) {
  const t = await getTranslations("hub.home");
  if (!p.placed && p.speeches === 0) return null;
  const pct = p.lessonsTotal ? Math.round((p.lessonsPassed / p.lessonsTotal) * 100) : 0;
  const change = p.starsChange;
  const tiles: { icon: LucideIcon; value: string; label: string; note?: string; hot?: boolean }[] = [
    { icon: Flame, value: String(p.streak), label: t("streak", { n: p.streak }), hot: p.streak > 0 },
    { icon: Mic, value: String(p.speeches), label: t("speeches", { n: p.speeches }), note: p.thisMonth ? t("thisMonth", { n: p.thisMonth }) : undefined },
    { icon: BookOpen, value: `${p.lessonsPassed}/${p.lessonsTotal}`, label: t("lessons"), note: `${pct}%` },
    {
      icon: Star,
      value: p.recentStars !== null ? String(p.recentStars) : "–",
      label: t("stars"),
      note: change ? (change > 0 ? `▲ ${change}` : `▼ ${Math.abs(change)}`) : undefined,
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list">
      {tiles.map((x) => (
        <li key={x.label} className="card grid gap-1 !p-4">
          <span
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: x.hot ? GOLD : "#fbf7ef", color: "#1a1712" }}
            aria-hidden="true"
          >
            <x.icon size={18} strokeWidth={2} />
          </span>
          <span className="t-figure tabular mt-1">{x.value}</span>
          <span className="text-[14px] leading-tight">{x.label}</span>
          {x.note && <span className="text-[13px] text-muted tabular">{x.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** The badge she's closest to, with a bar, then every badge as an icon. */
export async function Badges({ p }: { p: StudentProgress }) {
  const t = await getTranslations("hub.badges");
  const th = await getTranslations("hub.home");
  const earned = p.badges.filter((b) => b.earned).length;
  const next = nextBadge(p);
  const NextIcon = next ? BADGE_ICON[next.key] : null;
  return (
    <section className="grid gap-4" aria-labelledby="badges">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges" className="t-h3">
          {t("title")}
        </h2>
        <span className="text-[15px] font-medium tabular">{t("count", { n: earned, of: p.badges.length })}</span>
      </div>

      {next && NextIcon && (
        <div className="card flex items-center gap-4 !p-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-dashed" style={{ borderColor: GOLD }} aria-hidden="true">
            <NextIcon size={24} strokeWidth={1.75} />
          </span>
          <div className="grid flex-1 gap-1.5">
            <p className="text-[13px] font-medium uppercase tracking-wide text-muted">{th("nextBadge")}</p>
            <p className="font-medium">
              {t(`${next.key}.name`)}
              {COUNTED.has(next.key) && <span className="text-muted"> · {th("toGo", { n: next.need - next.have })}</span>}
            </p>
            <span className="h-2 overflow-hidden rounded-full bg-[#fbf7ef]" role="progressbar" aria-valuemin={0} aria-valuemax={next.need} aria-valuenow={next.have} aria-label={t(`${next.key}.how`)}>
              <span className="block h-full rounded-full" style={{ width: `${Math.max(next.ratio * 100, 4)}%`, background: GOLD }} />
            </span>
            {!COUNTED.has(next.key) && <p className="text-[13px] text-muted">{t(`${next.key}.how`)}</p>}
          </div>
        </div>
      )}

      <ul className="grid grid-cols-5 gap-x-2 gap-y-4" role="list">
        {p.badges.map((b) => {
          const Icon = BADGE_ICON[b.key];
          return (
            <li key={b.key} className="grid justify-items-center gap-1.5 text-center" title={b.earned ? t(`${b.key}.name`) : t(`${b.key}.how`)}>
              <span
                className="grid h-14 w-14 place-items-center rounded-full"
                style={b.earned ? { background: GOLD, color: "#1a1712", boxShadow: "0 0 0 4px #fff1c7" } : { background: "#ece4d4", color: "#9b958a" }}
                aria-hidden="true"
              >
                <Icon size={24} strokeWidth={b.earned ? 1.9 : 1.5} />
              </span>
              <span className={`text-[12px] leading-tight ${b.earned ? "font-medium" : "text-muted"}`}>
                {t(`${b.key}.name`)}
                <span className="sr-only"> · {b.earned ? t("earned") : t(`${b.key}.how`)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Her group in one compact card, or one line about what happens next. */
export async function GroupCard({ group, status }: { group: StudentGroup | null; status: string }) {
  const t = await getTranslations("hub.group");
  const format = await getFormatter();
  if (!group) {
    const waiting = status === "pending_review" || status === "waitlisted";
    return (
      <div className="card flex items-center gap-4 !p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fbf7ef]" aria-hidden="true">
          <Users size={20} />
        </span>
        <span className="grid">
          <span className="font-medium">{waiting ? t("waitingTitle") : t("findingTitle")}</span>
          <span className="text-[14px] text-muted">{t("soon")}</span>
        </span>
      </div>
    );
  }
  const starts = new Date(`${group.startsOn}T00:00:00Z`);
  const started = starts.getTime() <= Date.now();
  const when = [group.meetingDay !== null ? t(`day.${DAYS[group.meetingDay]!}`) : null, group.meetingTime ? group.meetingTime.slice(0, 5) : null, group.venue].filter(Boolean);
  return (
    <section className="card grid gap-3 !p-5" aria-labelledby="my-group">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fbf7ef]" aria-hidden="true">
          <Users size={20} />
        </span>
        <div className="grid">
          <span className="text-[13px] font-medium uppercase tracking-wide text-muted">{t("title")}</span>
          <h2 id="my-group" className="font-medium">
            {group.name}
          </h2>
        </div>
      </div>
      <p className="text-[14px] text-muted">
        {when.length > 0 ? when.join(" · ") : group.school}
        {!started && ` · ${t("startsOn", { date: format.dateTime(starts, { day: "numeric", month: "short" }) })}`}
      </p>
      <ul className="flex flex-wrap gap-2" role="list" aria-label={t("coachesLabel")}>
        {group.coaches.length ? (
          group.coaches.map((c, i) => (
            <li key={i} className="flex items-center gap-2 rounded-full bg-[#fbf7ef] py-1 pl-1 pr-3 text-[14px]">
              <span className="grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold" style={{ background: GOLD }} aria-hidden="true">
                {c.firstName.slice(0, 1)}
              </span>
              {c.firstName}
              {c.initial ? ` ${c.initial}.` : ""}
            </li>
          ))
        ) : (
          <li className="text-[14px] text-muted">{t("noCoach")}</li>
        )}
      </ul>
    </section>
  );
}
