import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { requestMeta, requireStaff } from "@/server/auth/current";
import { can } from "@/server/permissions/can";
import { studentAttempts } from "@/server/services/coach-admin";

export const metadata = { title: "Speech practice" };
export const dynamic = "force-dynamic";

const BARS = ["structure", "argument", "timekeeping", "pace", "fillers", "clarity"] as const;

/**
 * A student's speech attempts for staff (spec/12 §4 "Console person page: attempts with
 * transcript"). Opening the page writes an audit row (`speech.view_transcript`).
 */
export default async function StudentSpeechPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff(`/console/ai/student/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("console.ai");
  const tc = await getTranslations("coach.card.bars");
  const meta = await requestMeta();
  const d = await studentAttempts({ actor, locale: "en", ip: meta.ip, userAgent: meta.userAgent }, id).catch(() => null);
  if (!d) notFound();

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        {can(actor, "ai.settings") && (
          <Link href="/console/ai" className="uline w-fit text-[15px]">
            {t("back")}
          </Link>
        )}
        <h1 className="console-title">{t("studentTitle", { name: d.person.firstName })}</h1>
        <p className="text-muted">
          {d.eligibility.ok ? t("canPractise", { left: d.eligibility.left, cap: d.eligibility.cap }) : t(`why_${d.eligibility.reason}` as "why_cap")}
          {" · "}
          {t("lessonsPassed", { n: d.lessonsPassed })}
        </p>
        <p className="text-[13px] text-muted">{t("auditNote")}</p>
      </header>

      <section className="grid gap-3" aria-labelledby="skills">
        <h2 id="skills" className="t-h3">
          {t("skills")}
        </h2>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {d.skills.map((s) => (
            <li key={s.key} className="flex justify-between gap-3 border-b border-line py-1 text-[15px]">
              <span>{s.name}</span>
              <span className="tabular text-muted">{s.rating !== null ? `${s.rating.toFixed(1)} / 5` : "–"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4" aria-labelledby="attempts">
        <h2 id="attempts" className="t-h3">
          {t("attemptsTitle", { n: d.attempts.length })}
        </h2>
        {d.attempts.length === 0 && <div className="card !p-5 text-muted">{t("noAttempts")}</div>}
        {d.attempts.map((a) => (
          <article key={a.id} className="card grid gap-3 !p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-medium">
                {a.title}
                {a.flagged && <span className="badge badge--failed ml-2">{t("flagged")}</span>}
              </h3>
              <span className="tabular text-[14px] text-muted">
                {formatDate(a.createdAt, locale)} · {a.channel === "whatsapp" ? "WhatsApp" : t("web")} · {t(`side_${a.side}` as "side_for")}
              </span>
            </div>
            {a.motionText && <p className="text-[15px] text-muted">“{a.motionText}”</p>}
            {a.status !== "done" ? (
              <p className="text-[15px]">
                {t(`st_${a.status}` as "st_done")}
                {a.rejectReason ? ` · ${t(`reject_${a.rejectReason}` as "reject_server")}` : ""}
              </p>
            ) : (
              <>
                <p className="text-[15px]">
                  <span aria-label={t("starsLabel", { n: a.stars ?? 0 })}>{a.stars ? `${"★".repeat(a.stars)}${"☆".repeat(5 - a.stars)}` : ""}</span>
                  {a.metrics && <span className="ml-3 tabular text-muted">{t("numbers", { wpm: a.metrics.wpm, fillers: a.metrics.fillerCount, seconds: Math.round(a.metrics.durationSeconds) })}</span>}
                </p>
                {a.bars && (
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
                    {BARS.filter((k) => a.bars![k] !== null && a.bars![k] !== undefined).map((k) => (
                      <span key={k}>
                        {tc(k)} {a.bars![k]}/5
                      </span>
                    ))}
                  </p>
                )}
                {a.feedback && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[14px] font-medium">{t("strengths")}</p>
                      <ul className="list-disc pl-5 text-[15px]">
                        {a.feedback.strengths.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium">{t("nextSteps")}</p>
                      <ul className="list-disc pl-5 text-[15px]">
                        {a.feedback.nextSteps.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
            {d.reviews
              .filter((r) => r.attemptId === a.id)
              .map((r) => (
                <p key={r.reviewer + r.createdAt.toISOString()} className="rounded-[12px] bg-bg p-3 text-[14px]">
                  <span className="font-medium">
                    {r.verdict === "ok" ? t("reviewOk", { name: r.reviewer }) : t("reviewConcern", { name: r.reviewer, reason: t(`reason_${r.reason ?? "other"}` as "reason_other") })}
                  </span>
                  {r.note ? ` · ${r.note}` : ""}
                  {r.verdict === "concern" && <span className="text-muted"> · {r.resolvedAt ? t("resolvedShort") : t("openShort")}</span>}
                </p>
              ))}
            {a.transcript ? (
              <details>
                <summary className="cursor-pointer text-[15px] font-medium">{t("transcript")}</summary>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{a.transcript}</p>
              </details>
            ) : (
              a.status === "done" && <p className="text-[13px] text-muted">{t("transcriptGone")}</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
