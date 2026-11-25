import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Lightbulb, Trophy, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SpeakButton } from "@/components/coach/CoachClient";
import { Recorder } from "@/components/coach/Recorder";
import { Blocked, Chip, GOLD, Hero, requireStudent } from "@/components/coach/parts";
import { LESSON, SKILL } from "@/server/coach/curriculum";
import { eligibility, lessonStatus } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: LESSON[key]?.title ?? "Lesson" };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** One lesson (D-024): the idea up top, three steps, weak vs strong, then her turn to speak. */
export default async function LessonPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const lesson = LESSON[key];
  if (!lesson) notFound();
  const actor = await requireStudent(`/app/coach/lesson/${key}`);
  const t = await getTranslations("coach");
  const [e, progress] = await Promise.all([eligibility(actor.personId), lessonStatus(actor.personId, key)]);
  const skill = SKILL[lesson.skill];

  return (
    <>
      <Link href="/app/coach" className="uline justify-self-start text-[15px]">
        {t("back")}
      </Link>

      <Hero label={lesson.title}>
        <div className="flex flex-wrap gap-2">
          <Chip>{skill.name}</Chip>
          <Chip>{t(`lesson.level${lesson.level}`)}</Chip>
          {progress === "passed" && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: GOLD, color: "#1a1712" }}>
              <Trophy size={14} aria-hidden="true" />
              {t("home.done")}
            </span>
          )}
        </div>
        <h1 className="t-h2" style={{ color: "inherit" }}>
          {lesson.title}
        </h1>
        <p className="serif text-[22px] leading-snug" style={{ color: GOLD }}>
          {lesson.idea}
        </p>
      </Hero>

      <section className="grid gap-3" aria-labelledby="how">
        <h2 id="how" className="t-h3">
          {t("lesson.how")}
        </h2>
        <ol className="grid gap-2" role="list">
          {lesson.steps.map((x, i) => (
            <li key={x} className="card flex items-start gap-4 !p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-semibold" style={{ background: GOLD, color: "#1a1712" }} aria-hidden="true">
                {i + 1}
              </span>
              <span className="pt-1.5">{x}</span>
            </li>
          ))}
        </ol>
        <p className="flex items-start gap-2 text-[15px] text-muted">
          <Lightbulb size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">{t("lesson.why")}: </span>
            {lesson.why}
          </span>
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label={t("lesson.strong")}>
        <div className="card grid content-start gap-2 !p-5">
          <span className="flex items-center gap-2 text-[14px] font-medium text-muted">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ece4d4]" aria-hidden="true">
              <X size={14} strokeWidth={2.5} />
            </span>
            {t("lesson.weak")}
          </span>
          <p className="text-muted line-through decoration-1">{lesson.example.weak}</p>
        </div>
        <div className="card grid content-start gap-2 !p-5" style={{ borderColor: GOLD, borderWidth: 2 }}>
          <span className="flex items-center gap-2 text-[14px] font-medium">
            <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: GOLD }} aria-hidden="true">
              <Check size={14} strokeWidth={2.5} />
            </span>
            {t("lesson.strong")}
          </span>
          <p className="font-medium">{lesson.example.strong}</p>
          <SpeakButton text={lesson.example.strong} />
        </div>
        <p className="text-[14px] text-muted sm:col-span-2">{lesson.example.note}</p>
      </section>

      <section className="grid gap-4" aria-labelledby="drill">
        <h2 id="drill" className="t-h3">
          {t("lesson.drillTitle")}
        </h2>
        <p>{lesson.drill.instruction}</p>
        <Hero label={t("rec.motion")}>
          <div className="flex flex-wrap gap-2">
            <Chip>{t(`practice.${lesson.drill.side}`)}</Chip>
            <Chip>{t("lesson.aim", { time: fmt(lesson.drill.targetSeconds) })}</Chip>
          </div>
          <p className="serif text-[24px] leading-snug">{lesson.drill.motion}</p>
        </Hero>
        {e.ok ? (
          <Recorder kind="lesson" lessonKey={lesson.key} side={lesson.drill.side} targetSeconds={lesson.drill.targetSeconds} maxSeconds={e.maxSeconds} minSeconds={Math.min(e.minSeconds, Math.round(lesson.drill.targetSeconds * 0.4))} title={lesson.title} />
        ) : (
          <Blocked e={e} />
        )}
      </section>
    </>
  );
}
