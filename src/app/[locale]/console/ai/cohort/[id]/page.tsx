import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PilotSwitch } from "@/components/console/AiControls";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/server/auth/current";
import { can } from "@/server/permissions/can";
import { cohortAi } from "@/server/services/coach-admin";

export const metadata = { title: "Cohort AI coach" };
export const dynamic = "force-dynamic";

/** A cohort's AI tab (spec/12 §4): usage, attempts per student, and who hasn't tried it yet. */
export default async function CohortAiPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff(`/console/ai/cohort/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("console.ai");
  const d = await cohortAi(actor, id).catch(() => null);
  if (!d) notFound();
  const canSwitch = can(actor, "ai.settings");

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        {canSwitch && (
          <Link href="/console/ai" className="uline w-fit text-[15px]">
            {t("back")}
          </Link>
        )}
        <h1 className="console-title">{d.cohort.name}</h1>
        <p className="text-muted">
          {d.cohort.school} · {t("cohortSummary", { tried: d.tried.length, all: d.students.length, n: d.attemptsMonth })}
        </p>
        {canSwitch && (
          <span className="inline-flex items-center gap-2 text-[15px]">
            <PilotSwitch cohortId={d.cohort.id} value={d.cohort.isPilotGroup} label={t("pilot")} />
            {t("pilot")}
          </span>
        )}
      </header>

      <section className="grid gap-3" aria-labelledby="per-student">
        <h2 id="per-student" className="t-h3">
          {t("perStudent")}
        </h2>
        {d.tried.length === 0 ? (
          <div className="card !p-5 text-muted">{t("noneTried")}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("perStudent")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("student")}</th>
                  <th scope="col">{t("attemptsMonth")}</th>
                  <th scope="col">{t("attemptsAll")}</th>
                  <th scope="col">{t("avgStars")}</th>
                  <th scope="col">{t("lastTried")}</th>
                </tr>
              </thead>
              <tbody>
                {d.tried
                  .sort((a, b) => b.attemptsTotal - a.attemptsTotal)
                  .map((r) => (
                    <tr key={r.personId}>
                      <td>
                        <Link href={`/console/ai/student/${r.personId}`} className="uline font-medium">
                          {r.firstName}
                        </Link>
                      </td>
                      <td className="tabular">{r.attemptsMonth}</td>
                      <td className="tabular">{r.attemptsTotal}</td>
                      <td className="tabular">{r.avgStars ?? "–"}</td>
                      <td className="tabular text-muted">{r.lastAt ? formatDate(r.lastAt, locale) : "–"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="not-tried">
        <h2 id="not-tried" className="t-h3">
          {t("notTried", { n: d.notTried.length })}
        </h2>
        {d.notTried.length === 0 ? (
          <p className="text-muted">{t("everyoneTried")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {d.notTried.map((r) => (
              <li key={r.personId} className="rounded-full border border-line px-3 py-1 text-[15px]">
                {r.firstName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
