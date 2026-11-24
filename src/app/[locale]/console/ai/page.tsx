import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AiSettingsForm, MotionForm, MotionImport, MotionRowActions, PilotSwitch, ResolveReview } from "@/components/console/AiControls";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { aiAdmin } from "@/server/services/coach-admin";

export const metadata = { title: "AI coach" };
export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;

/** `/console/ai` (spec/12 §5): the coach's switches, cohorts, usage and motions. */
export default async function AiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("ai.settings", "/console/ai");
  const t = await getTranslations("console.ai");
  const d = await aiAdmin(actor);
  const u = d.usage;
  const month = new Intl.DateTimeFormat(locale === "yo" ? "yo-NG" : "en-GB", { month: "long", year: "numeric" }).format(new Date());
  const budgetPct = u.budgetUsd ? Math.min(100, Math.round((u.costUsd / u.budgetUsd) * 100)) : 0;

  const tiles = [
    { label: t("tAttempts"), value: String(u.attempts), note: t("tAttemptsNote", { scored: u.scored, rejected: u.rejected, failed: u.failed }) },
    { label: t("tStudents"), value: String(u.students), note: u.attempts ? t("tStudentsNote", { n: (u.attempts / Math.max(1, u.students)).toFixed(1) }) : t("none") },
    { label: t("tStars"), value: u.avgStars !== null ? `${u.avgStars} / 5` : "–", note: t("tStarsNote", { n: u.flagged }) },
    { label: t("tCost"), value: usd(u.costUsd), note: t("tCostNote", { per: u.costPerAttempt !== null ? usd(u.costPerAttempt) : "–", budget: usd(u.budgetUsd) }) },
  ];

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <h1 className="console-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
        {!d.settings.enabled && (
          <p className="rounded-[12px] bg-[#fff1c7] p-4 text-[15px] text-[#5c4600]" role="status">
            {t("pausedBanner")}
          </p>
        )}
      </header>

      <section className="grid gap-4" aria-labelledby="usage">
        <div className="grid gap-1">
          <h2 id="usage" className="t-h3">
            {t("usageTitle", { month })}
          </h2>
          <p className="text-[14px] text-muted">{t("usageLead", { minutes: u.audioMinutes, tin: u.tokensIn.toLocaleString("en-GB"), tout: u.tokensOut.toLocaleString("en-GB"), wa: u.viaWhatsapp })}</p>
        </div>
        <ul className="console-tiles" role="list">
          {tiles.map((x) => (
            <li key={x.label} className="console-tile">
              <span className="text-[14px] text-muted">{x.label}</span>
              <span className="console-figure tabular">{x.value}</span>
              <span className="text-[14px] text-muted">{x.note}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budgetPct} aria-label={t("budgetBar")}>
            <div className="h-full rounded-full bg-[#FFB800]" style={{ width: `${budgetPct}%` }} />
          </div>
          <span className="text-[13px] text-muted">{t("budgetNote", { pct: budgetPct })}</span>
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="reviews">
        <div className="grid gap-1">
          <h2 id="reviews" className="t-h3">
            {t("reviewsTitle")}
          </h2>
          <p className="text-[15px] text-muted">{t("reviewsLead", { ok: d.reviews.month.ok, concern: d.reviews.month.concern })}</p>
        </div>
        {d.reviews.open.length === 0 ? (
          <div className="card !p-5 text-muted">{t("noConcerns")}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("reviewsTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("student")}</th>
                  <th scope="col">{t("speech")}</th>
                  <th scope="col">{t("concernCol")}</th>
                  <th scope="col">{t("raisedBy")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.reviews.open.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/console/ai/student/${r.personId}`} className="uline font-medium">
                        {r.studentName}
                      </Link>
                      {r.cohortName && <div className="text-[13px] text-muted">{r.cohortName}</div>}
                    </td>
                    <td>
                      {r.title}
                      {r.stars ? <div className="text-[13px] text-muted">{"★".repeat(r.stars) + "☆".repeat(5 - r.stars)}</div> : null}
                    </td>
                    <td className="max-w-[360px]">
                      <span className="font-medium">{t(`reason_${r.reason ?? "other"}` as "reason_other")}</span>
                      {r.note && <div className="text-[14px]">{r.note}</div>}
                    </td>
                    <td className="text-[14px]">
                      {r.reviewer}
                      <div className="text-muted">{formatDate(r.createdAt, locale)}</div>
                    </td>
                    <td>
                      <ResolveReview reviewId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="settings">
        <h2 id="settings" className="t-h3">
          {t("settingsTitle")}
        </h2>
        <AiSettingsForm initial={d.settings} />
      </section>

      <section className="grid gap-4" aria-labelledby="cohorts">
        <div className="grid gap-1">
          <h2 id="cohorts" className="t-h3">
            {t("cohortsTitle")}
          </h2>
          <p className="text-[15px] text-muted">{t("cohortsLead")}</p>
        </div>
        {d.cohorts.length === 0 ? (
          <div className="card !p-5 text-muted">{t("noCohorts")}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("cohortsTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("cohort")}</th>
                  <th scope="col">{t("students")}</th>
                  <th scope="col">{t("practising")}</th>
                  <th scope="col">{t("attemptsMonth")}</th>
                  <th scope="col">{t("concernsCol")}</th>
                  <th scope="col">{t("pilot")}</th>
                </tr>
              </thead>
              <tbody>
                {d.cohorts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/console/ai/cohort/${c.id}`} className="uline font-medium">
                        {c.name}
                      </Link>
                      <div className="text-[13px] text-muted">
                        {c.school} · {c.programme} · {c.term}
                      </div>
                    </td>
                    <td className="tabular">{c.students}</td>
                    <td className="tabular">{c.practising}</td>
                    <td className="tabular">{c.attempts}</td>
                    <td className="tabular">{c.openConcerns}</td>
                    <td>
                      <PilotSwitch cohortId={c.id} value={c.isPilotGroup} label={t("pilotFor", { name: c.name })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="recent">
        <h2 id="recent" className="t-h3">
          {t("recentTitle")}
        </h2>
        {d.recent.length === 0 ? (
          <div className="card !p-5 text-muted">{t("noAttempts")}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("recentTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("student")}</th>
                  <th scope="col">{t("speech")}</th>
                  <th scope="col">{t("result")}</th>
                  <th scope="col">{t("when")}</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/console/ai/student/${a.personId}`} className="uline font-medium">
                        {a.firstName}
                      </Link>
                      {a.flagged && <span className="badge badge--failed ml-2">{t("flagged")}</span>}
                    </td>
                    <td>
                      {a.title}
                      {a.channel === "whatsapp" && <span className="ml-2 text-[13px] text-muted">WhatsApp</span>}
                    </td>
                    <td className="tabular">{a.status === "done" && a.stars ? `${"★".repeat(a.stars)}${"☆".repeat(5 - a.stars)}` : t(`st_${a.status}` as "st_done")}</td>
                    <td className="tabular text-muted">{formatDate(a.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="motions">
        <div className="grid gap-1">
          <h2 id="motions" className="t-h3">
            {t("motionsTitle")}
          </h2>
          <p className="text-[15px] text-muted">{t("motionsLead", { active: d.motions.filter((m) => m.isActive).length, all: d.motions.length })}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card grid content-start gap-3 !p-5">
            <h3 className="font-medium">{t("addTitle")}</h3>
            <MotionForm />
          </div>
          <div className="card grid content-start gap-3 !p-5">
            <h3 className="font-medium">{t("importTitle")}</h3>
            <MotionImport />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t("motionsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("motionText")}</th>
                <th scope="col">{t("level")}</th>
                <th scope="col">{t("used")}</th>
                <th scope="col">{t("status")}</th>
                <th scope="col">
                  <span className="sr-only">{t("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.motions.map((m) => (
                <tr key={m.id} className={m.isActive ? "" : "text-muted"}>
                  <td className="max-w-[520px]">
                    {m.textEn}
                    {m.textYo && <div className="text-[13px] text-muted">{m.textYo}</div>}
                  </td>
                  <td>{t(`lvl_${m.difficulty}`)}</td>
                  <td className="tabular">{m.uses}</td>
                  <td>
                    <span className={`badge ${m.isActive ? "badge--active" : "badge--paused"}`}>{m.isActive ? t("active") : t("retired")}</span>
                  </td>
                  <td>
                    <MotionRowActions motion={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
