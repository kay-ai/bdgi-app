import { getFormatter, getTranslations } from "next-intl/server";
import { Award, BookOpen, Crown, Flame, GraduationCap, Medal, Mic, Sparkles, Star, Trophy, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { BadgeKey, StudentGroup, StudentProgress } from "@/server/services/student-progress";

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

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Her group, or what happens next when she isn't in one yet (spec/06 §1.1). */
export async function GroupCard({ group, status }: { group: StudentGroup | null; status: string }) {
  const t = await getTranslations("hub.group");
  const format = await getFormatter();
  if (!group) {
    const waiting = status === "pending_review" || status === "waitlisted";
    return (
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{waiting ? t("waitingTitle") : t("findingTitle")}</p>
        <p className="text-muted">{waiting ? t("waitingLead") : t("findingLead")}</p>
      </div>
    );
  }
  const starts = new Date(`${group.startsOn}T00:00:00Z`);
  const started = starts.getTime() <= Date.now();
  const when = [
    group.meetingDay !== null ? t(`day.${DAYS[group.meetingDay]!}`) : null,
    group.meetingTime ? group.meetingTime.slice(0, 5) : null,
    group.venue,
  ].filter(Boolean);
  return (
    <section className="card grid gap-3 !p-6" aria-labelledby="my-group">
      <p className="text-[15px] font-medium text-muted">{t("title")}</p>
      <h2 id="my-group" className="t-h3">
        {group.name}
      </h2>
      <p className="text-muted">
        {group.school}
        {" · "}
        {started ? t("since", { date: format.dateTime(starts, { day: "numeric", month: "long" }) }) : t("startsOn", { date: format.dateTime(starts, { weekday: "long", day: "numeric", month: "long" }) })}
      </p>
      {when.length > 0 && <p className="text-[15px]">{t("meets", { when: when.join(" · ") })}</p>}
      <p className="text-[15px]">
        {group.coaches.length
          ? t("coaches", { n: group.coaches.length, names: group.coaches.map((c) => `${c.firstName}${c.initial ? ` ${c.initial}.` : ""}`).join(", ") })
          : t("noCoach")}
      </p>
    </section>
  );
}

/** Her own progress from the speech coach: rank, lessons, speeches, streak and stars. */
export async function ProgressCard({ p, canPractise }: { p: StudentProgress; canPractise: boolean }) {
  const t = await getTranslations("hub.progress");
  const tr = await getTranslations("coach.rank");
  if (!p.placed) {
    return (
      <section className="card grid gap-3 !p-6" aria-labelledby="progress">
        <h2 id="progress" className="t-h3">
          {t("title")}
        </h2>
        <p className="text-muted">{t("notStarted")}</p>
        {canPractise && (
          <Link href="/app/coach/placement" className="btn justify-self-start">
            {t("firstSpeech")}
          </Link>
        )}
      </section>
    );
  }
  const change = p.starsChange;
  const tiles = [
    { label: t("lessons"), value: t("lessonsValue", { n: p.lessonsPassed, of: p.lessonsTotal }) },
    { label: t("speeches"), value: String(p.speeches), note: t("thisMonth", { n: p.thisMonth }) },
    { label: t("streak"), value: t("weeks", { n: p.streak }), note: p.bestStreak > p.streak ? t("best", { n: p.bestStreak }) : undefined },
    {
      label: t("stars"),
      value: p.recentStars !== null ? `${p.recentStars} ★` : "–",
      note: change === null ? undefined : change > 0 ? t("up", { n: change }) : change < 0 ? t("down", { n: Math.abs(change) }) : t("steady"),
    },
  ];
  return (
    <section className="card grid gap-5 !p-6" aria-labelledby="progress">
      <div className="grid gap-2">
        <p className="text-[15px] font-medium text-muted">{t("title")}</p>
        <h2 id="progress" className="t-h3">
          {t("youAre", { rank: tr(p.rank!) })}
        </h2>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={p.mean ?? 1} aria-label={t("youAre", { rank: tr(p.rank!) })}>
          <div className="h-full rounded-full bg-[#FFB800]" style={{ width: `${((p.mean ?? 1) / 5) * 100}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        {tiles.map((x) => (
          <div key={x.label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted">{x.label}</dt>
            <dd className="text-[20px] font-medium tabular">{x.value}</dd>
            {x.note && <dd className="text-[13px] text-muted">{x.note}</dd>}
          </div>
        ))}
      </dl>
      {p.next && canPractise && (
        <div className="grid gap-2 border-t border-line pt-4">
          <p className="text-[14px] text-muted">{t("nextLesson")}</p>
          <Link href={`/app/coach/lesson/${p.next.key}`} className="font-medium uline w-fit">
            {p.next.title} →
          </Link>
        </div>
      )}
    </section>
  );
}

/** Badges: the earned ones in gold, the rest dimmed with how to earn them. */
export async function Badges({ badges }: { badges: StudentProgress["badges"] }) {
  const t = await getTranslations("hub.badges");
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="grid gap-3" aria-labelledby="badges">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges" className="t-h3">
          {t("title")}
        </h2>
        <span className="text-[14px] text-muted">{t("count", { n: earned, of: badges.length })}</span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
        {badges.map((b) => {
          const Icon = BADGE_ICON[b.key];
          return (
            <li key={b.key} className={`card grid justify-items-center gap-2 !p-4 text-center ${b.earned ? "" : "opacity-60"}`}>
              <span
                className={`grid h-12 w-12 place-items-center rounded-full ${b.earned ? "bg-[#FFB800] text-[#1a1408]" : "border border-dashed border-current text-muted"}`}
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span className="text-[15px] font-medium">{t(`${b.key}.name`)}</span>
              <span className="text-[13px] text-muted">{b.earned ? t("earned") : t(`${b.key}.how`)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
