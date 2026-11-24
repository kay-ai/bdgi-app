import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Bar, Stars } from "@/components/coach/parts";
import { ReviewScorecard } from "@/components/hub/ReviewScorecard";
import { requireActor } from "@/server/auth/current";
import { hasRole } from "@/server/permissions/can";
import { studentForCoach } from "@/server/services/coach-supervision";

export const dynamic = "force-dynamic";
export const metadata = { title: "Student's speech coaching", robots: { index: false } };

const BARS = ["structure", "argument", "timekeeping", "pace", "fillers", "clarity"] as const;

/**
 * One student's AI coaching, for her human coach (D-015): where she is on her own path and every
 * recent scorecard with the AI's feedback, each to be marked "looks right" or "needs a look".
 */
export default async function CoachStudentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireActor(`/app/volunteer/student/${id}`);
  if (!hasRole(actor, "volunteer")) redirect("/app");
  const d = await studentForCoach(actor, id);
  if (!d) notFound();
  const t = await getTranslations("hub.supervise");
  const tc = await getTranslations("coach.card.bars");
  const format = await getFormatter();
  const s = d.summary;

  return (
    <>
      <div className="grid gap-2">
        <Link href="/app/volunteer" className="uline justify-self-start text-[15px]">
          {t("back")}
        </Link>
        <h1 className="t-h2">{t("studentTitle", { name: s.firstName })}</h1>
        <p className="text-muted">{t("studentLead")}</p>
      </div>

      {s.attention.length > 0 && (
        <section className="card grid gap-2 !p-5" aria-labelledby="look-h">
          <h2 id="look-h" className="font-medium">
            {t("needsLook")}
          </h2>
          <ul className="grid list-disc gap-1 pl-5 text-[15px]">
            {s.attention.map((a) => (
              <li key={a}>{t(`attentionHelp.${a}`, { reason: s.cannotPractise ? t(`why.${s.cannotPractise}` as "why.cap") : "" })}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4" aria-labelledby="path-h">
        <h2 id="path-h" className="t-h3">
          {t("pathTitle")}
        </h2>
        {s.rank ? (
          <>
            <p>
              {t("pathLine", { rank: t(`rank.${s.rank}`), mean: s.mean?.toFixed(1) ?? "–", passed: s.lessonsPassed, total: s.lessonsTotal })}
            </p>
            {s.nextLesson && <p className="text-[15px] text-muted">{t("nextLesson", { lesson: s.nextLesson, skills: s.weakest.join(", ").toLowerCase() })}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {d.skills.map((k) => (
                <Bar key={k.key} label={k.name} value={k.rating} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted">{t("notPlaced")}</p>
        )}
        <p className="text-[14px] text-muted">{t("activity", { scored: s.scored, month: s.thisMonth })}</p>
      </section>

      <section className="grid gap-4" aria-labelledby="cards-h">
        <div className="grid gap-1">
          <h2 id="cards-h" className="t-h3">
            {t("cardsTitle")}
          </h2>
          <p className="text-[15px] text-muted">{t("cardsLead")}</p>
        </div>
        {d.scorecards.length === 0 && <p className="text-muted">{t("noCards")}</p>}
        {d.scorecards.map((c) => (
          <article key={c.id} className="card grid gap-3 !p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-0.5">
                <h3 className="font-medium">{c.title}</h3>
                {c.motion && <p className="text-[14px] text-muted">“{c.motion}” · {t(`side.${c.side}` as "side.for")}</p>}
              </div>
              <span className="flex items-center gap-2 text-[13px] text-muted">
                {c.stars ? <Stars n={c.stars} label={t("starsOf", { n: c.stars })} size={16} /> : null}
                {format.dateTime(c.createdAt, { day: "numeric", month: "short" })}
                {c.channel === "whatsapp" ? " · WhatsApp" : ""}
              </span>
            </div>

            {c.status !== "done" ? (
              <p className="text-[15px] text-muted">{t(`status.${c.status}` as "status.failed", { reason: c.rejectReason ? t(`reject.${c.rejectReason}` as "reject.server") : "" })}</p>
            ) : (
              <>
                {c.metrics && <p className="text-[14px] tabular text-muted">{t("numbers", { wpm: c.metrics.wpm, fillers: c.metrics.fillersPerMin, seconds: Math.round(c.metrics.durationSeconds) })}</p>}
                {c.bars && (
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
                    {BARS.filter((k) => c.bars![k] !== null && c.bars![k] !== undefined).map((k) => (
                      <span key={k}>
                        {tc(k)} {c.bars![k]}/5
                      </span>
                    ))}
                  </p>
                )}
                {c.feedback && (
                  <div className="grid gap-3 text-[15px]">
                    {c.feedback.usedFallback && <p className="text-[14px] text-muted">{t("fallback")}</p>}
                    <p className="serif text-[18px] leading-snug">{c.feedback.encouragement}</p>
                    {c.feedback.focus && (
                      <p>
                        <span className="font-medium">{c.feedback.focus.passed ? t("lessonPassed") : t("lessonNotYet")} </span>
                        {c.feedback.focus.score !== null && c.lessonPass !== null ? t("focusScore", { n: c.feedback.focus.score, pass: c.lessonPass }) : ""}
                        {c.feedback.focus.feedback ? ` ${c.feedback.focus.feedback}` : ""}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[14px] font-medium">{t("didWell")}</p>
                        <ul className="list-disc pl-5">
                          {c.feedback.strengths.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[14px] font-medium">{t("nextTime")}</p>
                        <ul className="list-disc pl-5">
                          {c.feedback.nextSteps.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {c.feedback.betterLine && (
                      <div className="grid gap-1 rounded-[12px] bg-bg p-3">
                        <p className="text-[14px] font-medium">{t("betterLine")}</p>
                        <p className="text-muted">“{c.feedback.betterLine.original}”</p>
                        <p>→ “{c.feedback.betterLine.improved}”</p>
                        <p className="text-[13px] text-muted">{c.feedback.betterLine.why}</p>
                      </div>
                    )}
                  </div>
                )}
                <ReviewScorecard attemptId={c.id} current={c.myReview} resolved={c.resolved} />
              </>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
