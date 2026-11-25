import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, Check, ChevronRight, Mic, Shuffle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { QueuedSpeeches } from "@/components/coach/CoachClient";
import { Blocked, Chip, GOLD, Hero, RankLadder, requireStudent, Stars, Trend } from "@/components/coach/parts";
import { LESSONS, SKILL, SKILLS } from "@/server/coach/curriculum";
import { weakest } from "@/server/coach/tailor";
import { coachHome } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coach");
  return { title: t("title") };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * The coach home (D-024): one dark card with her rank and the next lesson picked for her, two
 * ways in (free practice, the lesson path), her skills as a path of lessons, and past speeches.
 */
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
  const ok = h.eligibility.ok;
  const e = h.eligibility;

  return (
    <>
      <Link href="/app" className="uline justify-self-start text-[15px]">
        {t("toHub")}
      </Link>

      {!e.ok && <Blocked e={e} />}
      <QueuedSpeeches />

      <Hero label={t("title")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="t-h3" style={{ color: "inherit" }}>
            {t("title")}
          </h1>
          {e.ok && (
            <Chip>
              <Mic size={14} aria-hidden="true" />
              {t("home.left", { left: e.left, cap: e.cap })}
            </Chip>
          )}
        </div>

        {h.placed && <RankLadder rank={h.rank.rank} />}

        {ok && !h.placed && (
          <div className="grid gap-4">
            <p className="t-h2" style={{ color: "inherit" }}>
              {t("placementTitle")}
            </p>
            <p style={{ color: "#b9b3a8" }}>{t("home.placementShort")}</p>
            <Link href="/app/coach/placement" className="btn btn--lg btn--block sm:!w-auto sm:justify-self-start">
              <Mic size={20} aria-hidden="true" />
              {t("placementStart")}
            </Link>
          </div>
        )}

        {ok && h.placed && h.next && (
          <div className="grid gap-4 rounded-[20px] p-5" style={{ background: "#26221c" }}>
            <p className="text-[13px] font-medium uppercase tracking-wide" style={{ color: GOLD }}>
              {t("nextTitle")}
            </p>
            <p className="serif text-[26px] leading-tight">{h.next.title}</p>
            <div className="flex flex-wrap gap-2">
              <Chip>{SKILL[h.next.skill].name}</Chip>
              <Chip>{t(`lesson.level${h.next.level}`)}</Chip>
              <Chip>{fmt(h.next.drill.targetSeconds)}</Chip>
            </div>
            <Link href={`/app/coach/lesson/${h.next.key}`} className="btn btn--lg btn--block sm:!w-auto sm:justify-self-start">
              {t("startLesson")}
            </Link>
          </div>
        )}
        {ok && h.placed && !h.next && <p className="serif text-[22px]">{t("allDone")}</p>}
      </Hero>

      {ok && h.placed && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/app/coach/practice" className="card grid content-start gap-2 !p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: GOLD }} aria-hidden="true">
              <Shuffle size={20} />
            </span>
            <span className="font-medium">{t("freeTitle")}</span>
            <span className="text-[14px] text-muted">{t("home.freeShort")}</span>
          </Link>
          <a href="#skills" className="card grid content-start gap-2 !p-4" style={{ color: "inherit", textDecoration: "none" }}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fbf7ef]" aria-hidden="true">
              <BookOpen size={20} />
            </span>
            <span className="font-medium">{t("home.lessons")}</span>
            <span className="text-[14px] text-muted tabular">{t("home.lessonsCount", { n: passed.size, of: LESSONS.length })}</span>
          </a>
        </div>
      )}

      {h.placed && (
        <section className="grid gap-4 scroll-mt-24" id="skills" aria-labelledby="skills-title">
          <h2 id="skills-title" className="t-h3">
            {t("home.pathTitle")}
          </h2>
          {(["content", "delivery"] as const).map((area) => (
            <div key={area} className="grid gap-2">
              <h3 className="text-[13px] font-medium uppercase tracking-wide text-muted">{t(area)}</h3>
              <ul className="grid gap-2" role="list">
                {SKILLS.filter((s) => s.area === area).map((s) => {
                  const r = h.ratings[s.key];
                  const lessons = LESSONS.filter((l) => l.skill === s.key);
                  return (
                    <li key={s.key} className="card flex items-center gap-4 !p-4">
                      <div className="grid flex-1 gap-2">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {s.name}
                          {focus.has(s.key) && (
                            <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: GOLD, color: "#1a1712" }}>
                              {t("focus")}
                            </span>
                          )}
                        </span>
                        <span className="flex gap-1" role="img" aria-label={r === undefined ? t("notRated") : `${r.toFixed(1)} / 5`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: r !== undefined && i <= Math.round(r) ? "#1a1712" : "#ddd5c5" }} />
                          ))}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {lessons.map((l) => {
                          const done = passed.has(l.key);
                          const up = h.next?.key === l.key;
                          const state = done ? t("home.done") : up ? t("home.upNext") : t("home.notYet");
                          return (
                            <Link
                              key={l.key}
                              href={`/app/coach/lesson/${l.key}`}
                              aria-label={`${l.title}: ${state}`}
                              title={l.title}
                              className={`grid h-11 w-11 place-items-center rounded-full text-[15px] font-semibold ${up ? "animate-pulse" : ""}`}
                              style={
                                done
                                  ? { background: GOLD, color: "#1a1712" }
                                  : up
                                    ? { background: "#1a1712", color: "#fbf7ef", boxShadow: `0 0 0 3px ${GOLD}` }
                                    : { background: "#fbf7ef", color: "#67635c", border: "1.5px solid #ddd5c5" }
                              }
                            >
                              {done ? <Check size={20} strokeWidth={2.5} aria-hidden="true" /> : l.level}
                            </Link>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
          <ul className="grid gap-2" role="list">
            {h.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/app/coach/attempt/${r.id}`} className="card flex items-center gap-3 !p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fbf7ef]" aria-hidden="true">
                    {r.kind === "lesson" ? <BookOpen size={18} /> : <Mic size={18} />}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium">{r.title}</span>
                    <span className="text-[13px] text-muted">{format.dateTime(r.createdAt, { day: "numeric", month: "short" })}</span>
                  </span>
                  {r.status === "done" && r.stars ? <Stars n={r.stars} label={t("card.stars", { n: r.stars })} size={16} /> : <span className="text-[13px] text-muted">{t(`status.${r.status}` as never)}</span>}
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
