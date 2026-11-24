import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SpeakButton } from "@/components/coach/CoachClient";
import { Recorder } from "@/components/coach/Recorder";
import { Blocked, requireStudent } from "@/components/coach/parts";
import { LESSON, SKILL } from "@/server/coach/curriculum";
import { eligibility, lessonStatus } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: LESSON[key]?.title ?? "Lesson" };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** One lesson: the idea, why, how, a weak and a strong example, then the student speaks. */
export default async function LessonPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const lesson = LESSON[key];
  if (!lesson) notFound();
  const actor = await requireStudent(`/app/coach/lesson/${key}`);
  const t = await getTranslations("coach");
  const [e, progress] = await Promise.all([
    eligibility(actor.personId),
    lessonStatus(actor.personId, key),
  ]);
  const skill = SKILL[lesson.skill];

  return (
    <>
      <Link href="/app/coach" className="uline justify-self-start text-[15px]">
        {t("back")}
      </Link>
      <div className="grid gap-2">
        <p className="text-[15px] text-muted">
          {t("lesson.skill", { skill: skill.name })} · {t(`lesson.level${lesson.level}`)}
        </p>
        <h1 className="t-h2">{lesson.title}</h1>
      </div>
      {progress === "passed" && <p className="rounded-[12px] bg-surface p-4 text-[15px]">{t("lesson.passed")}</p>}

      <section className="grid gap-2">
        <h2 className="text-[16px] font-medium text-muted">{t("lesson.idea")}</h2>
        <p className="serif text-[22px] leading-snug">{lesson.idea}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-[16px] font-medium text-muted">{t("lesson.why")}</h2>
        <p>{lesson.why}</p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-[16px] font-medium text-muted">{t("lesson.how")}</h2>
        <ol className="grid list-decimal gap-2 pl-6">
          {lesson.steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card grid content-start gap-2 !p-5">
          <span className="text-[14px] font-medium text-muted">{t("lesson.weak")}</span>
          <p className="text-muted line-through decoration-1">{lesson.example.weak}</p>
        </div>
        <div className="card grid content-start gap-2 border-ink !p-5">
          <span className="text-[14px] font-medium">{t("lesson.strong")}</span>
          <p className="font-medium">{lesson.example.strong}</p>
          <SpeakButton text={lesson.example.strong} />
        </div>
        <p className="text-[15px] text-muted sm:col-span-2">{lesson.example.note}</p>
      </section>

      <section className="grid gap-4" aria-labelledby="drill">
        <h2 id="drill" className="t-h3">
          {t("lesson.drillTitle")}
        </h2>
        <p>{lesson.drill.instruction}</p>
        <div className="grid gap-1">
          <span className="text-[14px] text-muted">
            {t("rec.motion")} · {t("rec.side")}: {t(`practice.${lesson.drill.side}`)} · {t("lesson.aim", { time: fmt(lesson.drill.targetSeconds) })}
          </span>
          <p className="serif text-[20px] leading-snug">{lesson.drill.motion}</p>
        </div>
        {e.ok ? (
          <Recorder kind="lesson" lessonKey={lesson.key} side={lesson.drill.side} targetSeconds={lesson.drill.targetSeconds} maxSeconds={e.maxSeconds} minSeconds={Math.min(e.minSeconds, Math.round(lesson.drill.targetSeconds * 0.4))} title={lesson.title} />
        ) : (
          <Blocked e={e} />
        )}
      </section>
    </>
  );
}
