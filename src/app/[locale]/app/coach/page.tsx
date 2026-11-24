import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { QueuedSpeeches } from "@/components/coach/CoachClient";
import { Bar, Blocked, requireStudent, Stars, Trend } from "@/components/coach/parts";
import { LESSONS, SKILL, SKILLS } from "@/server/coach/curriculum";
import { weakest } from "@/server/coach/tailor";
import { coachHome } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coach");
  return { title: t("title") };
}

/** The coach home: rank, the next lesson picked for this student, their skills, and past speeches. */
export default async function CoachHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStudent("/app/coach");
  const t = await getTranslations("coach");
  const format = await getFormatter();
  const h = await coachHome(actor.personId);
  // Only skills that still need work are tagged, so a tie at 4/5 is not called a focus.
  const focus = new Set(weakest(h.ratings, 2).filter((k) => (h.ratings[k] ?? 0) < 3.5));
  const passed = new Set(h.passed);

  return (
    <>
      <div className="grid gap-2">
        <Link href="/app" className="uline justify-self-start text-[15px]">
          {t("toHub")}
        </Link>
        <h1 className="t-h2">{t("title")}</h1>
      </div>

      {!h.eligibility.ok && <Blocked e={h.eligibility} />}

      <QueuedSpeeches />

      {h.placed && (
        <section className="grid gap-3" aria-labelledby="rank">
          <h2 id="rank" className="t-h3">
            {t("youAre", { rank: t(`rank.${h.rank.rank}`) })}
          </h2>
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={h.rank.mean} aria-label={t("youAre", { rank: t(`rank.${h.rank.rank}`) })}>
            <div className="h-full rounded-full bg-[#FFB800]" style={{ width: `${(h.rank.mean / 5) * 100}%` }} />
          </div>
          <p className="text-[15px] text-muted">{t("rankLead", { mean: h.rank.mean.toFixed(1) })}</p>
        </section>
      )}

      {h.eligibility.ok && !h.placed && (
        <div className="card grid gap-4 !p-6 sm:!p-8">
          <h2 className="t-h3">{t("placementTitle")}</h2>
          <p className="text-muted">{t("placementLead")}</p>
          <Link href="/app/coach/placement" className="btn btn--lg justify-self-start">
            {t("placementStart")}
          </Link>
        </div>
      )}

      {h.eligibility.ok && h.placed && (
        <div className="card grid gap-4 !p-6 sm:!p-8">
          {h.next ? (
            <>
              <p className="text-[15px] font-medium text-muted">{t("nextTitle")}</p>
              <h2 className="t-h3">{h.next.title}</h2>
              <p>{h.next.idea}</p>
              <p className="text-[15px] text-muted">{t("nextWhy", { skill: SKILL[h.next.skill].name.toLowerCase() })}</p>
              <Link href={`/app/coach/lesson/${h.next.key}`} className="btn btn--lg justify-self-start">
                {t("startLesson")}
              </Link>
            </>
          ) : (
            <p>{t("allDone")}</p>
          )}
        </div>
      )}

      {h.eligibility.ok && h.placed && (
        <Link href="/app/coach/practice" className="card grid gap-1 !p-6">
          <span className="font-medium">{t("freeTitle")}</span>
          <span className="text-muted">{t("freeLead")}</span>
        </Link>
      )}

      {h.eligibility.ok && <p className="text-[14px] text-muted">{t("left", { left: h.eligibility.left, cap: h.eligibility.cap })}</p>}

      {h.placed && (
        <section className="grid gap-6" aria-labelledby="skills">
          <h2 id="skills" className="t-h3">
            {t("skillsTitle")}
          </h2>
          {(["content", "delivery"] as const).map((area) => (
            <div key={area} className="grid gap-4">
              <h3 className="text-[16px] font-medium text-muted">{t(area)}</h3>
              {SKILLS.filter((s) => s.area === area).map((s) => {
                const n = LESSONS.filter((l) => l.skill === s.key && passed.has(l.key)).length;
                return (
                  <Bar
                    key={s.key}
                    label={s.name}
                    value={h.ratings[s.key] ?? null}
                    focus={focus.has(s.key) ? t("focus") : undefined}
                    note={`${h.ratings[s.key] === undefined ? t("notRated") + " · " : ""}${t("lessonsPassed", { n })}`}
                  />
                );
              })}
            </div>
          ))}
        </section>
      )}

      <Trend
        points={h.recent
          .filter((r) => r.status === "done")
          .slice(0, 12)
          .reverse()
          .map((r) => ({ stars: r.stars, wpm: r.wpm, fillersPerMin: r.fillersPerMin, date: r.createdAt.toISOString() }))}
      />

      <section className="grid gap-3" aria-labelledby="history">
        <h2 id="history" className="t-h3">
          {t("historyTitle")}
        </h2>
        {h.recent.length === 0 ? (
          <p className="text-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="grid gap-2">
            {h.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/app/coach/attempt/${r.id}`} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
                  <span className="grid gap-0.5">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-[14px] text-muted">
                      {format.dateTime(r.createdAt, { day: "numeric", month: "short" })}
                      {r.wpm !== null && r.status === "done" ? ` · ${r.wpm} wpm · ${r.fillersPerMin}/min fillers` : ""}
                    </span>
                  </span>
                  {r.status === "done" && r.stars ? <Stars n={r.stars} label={t("card.stars", { n: r.stars })} size={20} /> : <span className="text-[14px] text-muted">{t(`status.${r.status}` as never)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
