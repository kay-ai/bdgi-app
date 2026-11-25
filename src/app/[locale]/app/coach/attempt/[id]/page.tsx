import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check, Gauge, MessageCircleWarning, RotateCcw, Target, Timer, Trophy, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AttemptWaiting, ListenFeedback, SpeakButton } from "@/components/coach/CoachClient";
import { Bar, GOLD, Hero, requireStudent, Stars, Tile } from "@/components/coach/parts";
import { SKILL, SKILLS } from "@/server/coach/curriculum";
import { coachHome, feedbackScript, getAttempt } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coach.card");
  return { title: t("barsTitle") };
}

/** Waiting screen while the speech is scored, then the scorecard (spec/12 §2 steps 5–6). */
export default async function AttemptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireStudent(`/app/coach/attempt/${id}`);
  const t = await getTranslations("coach");
  const a = await getAttempt(actor, id);
  if (!a) notFound();

  const back = (
    <Link href="/app/coach" className="uline justify-self-start text-[15px]">
      {t("back")}
    </Link>
  );
  const retryHref = a.lesson ? `/app/coach/lesson/${a.lesson.key}` : a.kind === "placement" ? "/app/coach/placement" : "/app/coach/practice";

  if (["uploaded", "transcribing", "scoring"].includes(a.status)) {
    return (
      <>
        {back}
        <AttemptWaiting id={a.id} />
      </>
    );
  }

  if (a.status !== "done" || !a.feedback || !a.scores) {
    const reason = a.rejectReason && ["too_short", "too_few_words", "unclear", "server"].includes(a.rejectReason) ? a.rejectReason : "server";
    return (
      <>
        {back}
        <div className="card grid gap-3 !p-6">
          <h1 className="t-h3">{t("rejected.title")}</h1>
          <p>{t(`rejected.${reason}` as never)}</p>
          <p className="text-[14px] text-muted">{t("rejected.note")}</p>
          <Link href={retryHref} className="btn btn--lg justify-self-start">
            {t("card.tryAgain")}
          </Link>
        </div>
      </>
    );
  }

  const f = a.feedback;
  const b = a.scores.bars;
  const m = a.metrics;
  const home = await coachHome(actor.personId);
  const after = a.scores.ratingsAfter ?? {};
  const otherSide = a.side === "for" ? "against" : a.side === "against" ? "for" : null;

  return (
    <>
      {back}
      <Hero label={t("card.barsTitle")}>
        <p className="text-[14px]" style={{ color: "#b9b3a8" }}>
          {a.title}
        </p>
        <h1 className="sr-only">{t("card.barsTitle")}</h1>
        <Stars n={a.stars ?? 1} label={t("card.stars", { n: a.stars ?? 1 })} size={44} />
        <p className="serif text-[24px] leading-snug">{f.encouragement}</p>
        {f.usedFallback && (
          <p className="text-[14px]" style={{ color: "#b9b3a8" }}>
            {t("card.fallback")}
          </p>
        )}
        <ListenFeedback id={a.id} text={feedbackScript(f)} />
      </Hero>

      {f.focus && a.lesson && (
        <div className="card flex items-start gap-4 !p-5" style={f.focus.passed ? { background: GOLD } : undefined}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: f.focus.passed ? "#1a1712" : "#fbf7ef", color: f.focus.passed ? GOLD : "#1a1712" }} aria-hidden="true">
            {f.focus.passed ? <Trophy size={22} /> : <Target size={22} />}
          </span>
          <div className="grid gap-1">
            <p className="t-h3">{f.focus.passed ? t("card.passed") : t("card.notYet")}</p>
            {f.focus.score !== null && <p className="text-[15px] tabular">{t("card.focusScore", { skill: SKILL[f.focus.skill].name, n: f.focus.score, pass: a.lesson.drill.passScore })}</p>}
            {f.focus.feedback && <p className="text-[15px]">{f.focus.feedback}</p>}
          </div>
        </div>
      )}

      {m && (
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={<Gauge size={18} />} value={String(m.wpm)} label={t("card.wpm")} hot={m.wpm >= 110 && m.wpm <= 160} />
          <Tile icon={<MessageCircleWarning size={18} />} value={String(m.fillerCount)} label={t("card.fillers")} />
          <Tile icon={<Timer size={18} />} value={`${Math.floor(m.durationSeconds / 60)}:${String(Math.round(m.durationSeconds % 60)).padStart(2, "0")}`} label={t("card.time")} />
        </div>
      )}

      {f.betterLine && (
        <section className="grid gap-3" aria-labelledby="better">
          <h2 id="better" className="t-h3">
            {t("card.betterTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card grid content-start gap-2 !p-5">
              <span className="flex items-center gap-2 text-[14px] font-medium text-muted">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ece4d4]" aria-hidden="true">
                  <X size={14} strokeWidth={2.5} />
                </span>
                {t("card.youSaid")}
              </span>
              <p className="text-muted">“{f.betterLine.original}”</p>
            </div>
            <div className="card grid content-start gap-2 !p-5" style={{ borderColor: GOLD, borderWidth: 2 }}>
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: GOLD }} aria-hidden="true">
                  <Check size={14} strokeWidth={2.5} />
                </span>
                {t("card.coachSays")}
              </span>
              <p className="font-medium">“{f.betterLine.improved}”</p>
              <SpeakButton text={f.betterLine.improved} />
            </div>
          </div>
          <p className="text-[15px] text-muted">{f.betterLine.why}</p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { title: t("card.wellDone"), items: f.strengths, icon: <Check size={14} strokeWidth={2.5} />, bg: GOLD },
          { title: t("card.nextTime"), items: f.nextSteps, icon: <ArrowRight size={14} strokeWidth={2.5} />, bg: "#fbf7ef" },
        ].map((g) => (
          <div key={g.title} className="card grid content-start gap-3 !p-5">
            <h2 className="font-medium">{g.title}</h2>
            <ul className="grid gap-2" role="list">
              {g.items.map((x) => (
                <li key={x} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: g.bg }} aria-hidden="true">
                    {g.icon}
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid gap-4" aria-labelledby="bars">
        <h2 id="bars" className="t-h3">
          {t("card.barsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["structure", "argument", "timekeeping", "pace", "fillers", "confidence", "clarity"] as const)
            .filter((k) => b[k] !== null && b[k] !== undefined)
            .map((k) => (
              <Bar key={k} label={t(`card.bars.${k}`)} value={b[k] as number} />
            ))}
        </div>
      </section>

      {Object.keys(after).length > 0 && (
        <section className="grid gap-4" aria-labelledby="moved">
          <h2 id="moved" className="t-h3">
            {t("card.skillsMoved")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SKILLS.filter((s) => after[s.key] !== undefined).map((s) => (
              <Bar key={s.key} label={s.name} value={after[s.key]!} />
            ))}
          </div>
        </section>
      )}

      {a.transcript && (
        <details className="card !p-5">
          <summary className="cursor-pointer font-medium">{t("card.transcript")}</summary>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{a.transcript}</p>
        </details>
      )}

      <div className="btn-row">
        {home.next && home.eligibility.ok ? (
          <Link href={`/app/coach/lesson/${home.next.key}`} className="btn btn--lg btn--gold">
            {home.next.key === a.lesson?.key ? t("card.tryAgain") : t("card.nextLesson")}
          </Link>
        ) : null}
        <Link href={retryHref} className="inline-flex items-center gap-2 uline text-[16px] font-medium">
          <RotateCcw size={18} aria-hidden="true" />
          {a.lesson ? t("card.tryAgain") : t("card.practiseAgain")}
        </Link>
        {a.kind === "free" && otherSide && (
          <Link href={`/app/coach/practice?side=${otherSide}${a.motionId ? `&motion=${a.motionId}` : ""}`} className="uline text-[16px] font-medium">
            {t("card.otherSide")}
          </Link>
        )}
      </div>
    </>
  );
}
