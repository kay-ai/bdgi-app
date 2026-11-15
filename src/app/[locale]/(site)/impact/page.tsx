import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Photo } from "@/components/site/Photo";
import { Close } from "@/components/site/Close";
import { ReachTiles } from "@/components/site/ReachTiles";
import { fmt } from "@/lib/format";
import { getPublicTotals, getReachByLga } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("impact");
  return { title: t("title"), description: t("lead") };
}

export default async function ImpactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("impact");
  const th = await getTranslations("home");
  const [totals, reach] = await Promise.all([getPublicTotals(), getReachByLga()]);
  const max = Math.max(...totals.byProgramme.map((p) => p.students), 1);
  const shown = (n: number) => (n > 0 && n < 5 ? "<5" : fmt(n));

  return (
    <>
      <section className="screen" aria-labelledby="impact-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 lg:col-span-5 grid gap-8 self-start">
              <h1 id="impact-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="text-muted">{t("lead")}</p>
              <ul className="grid gap-3 text-[20px]">
                <li>
                  <span className="t-figure">{fmt(totals.students)}</span> {t("studentsLabel")}
                </li>
                <li>
                  <span className="t-figure">{fmt(totals.schools)}</span> {t("schoolsLabel")}
                </li>
                <li>
                  <span className="t-figure">{fmt(totals.volunteers)}</span> {t("volunteersLabel")}
                </li>
                <li>
                  <span className="t-figure">{totals.states}</span> {t("statesLabel")}
                </li>
              </ul>
              <p className="t-small text-muted">{th("impact.source", { note: totals.sourceNote })}</p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/5] w-full">
                <Photo slot="session" alt={th("impact.photoAlt")} priority />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="byprog-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="byprog-h" className="t-h2">
              {t("byProgrammeTitle")}
            </h2>
            <p>{t("byProgrammeLead")}</p>
          </div>
          {/* Flat bars, direct labels on the marks, no legend (DESIGN.md §10) */}
          <ul className="grid max-w-[880px] gap-6" role="list">
            {totals.byProgramme.map((p) => (
              <li key={p.slug} className="grid gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular">{shown(p.students)}</span>
                </div>
                <div className="h-3 bg-[#e6dcc6]" aria-hidden="true">
                  <div className="h-full bg-ink" style={{ width: `${(p.students / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="screen" id="reach" aria-labelledby="reach-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-start">
            <div className="col-span-6 lg:col-span-5 grid gap-6">
              <h2 id="reach-h" className="t-h2">
                {t("reachTitle")}
              </h2>
              <p>{th("reach.lead")}</p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <ReachTiles lgas={reach} label={th("reach.mapLabel")} low={th("reach.legendLow")} high={th("reach.legendHigh")} />
            </div>
          </div>
          <details className="mt-12">
            <summary className="cursor-pointer font-medium">{t("tableCaption")}</summary>
            <table className="mt-4 w-full max-w-[720px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">{t("tableLga")}</th>
                  <th className="py-2 font-medium">{t("tableState")}</th>
                  <th className="py-2 text-right font-medium">{t("tableSchools")}</th>
                </tr>
              </thead>
              <tbody>
                {reach
                  .filter((r) => r.schools > 0)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.stateName}</td>
                      <td className="py-2 text-right tabular">{r.schools}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="measure-h">
        <div className="wrap">
          <div className="grid12">
            <div className="col-span-6 lg:col-span-5">
              <h2 id="measure-h" className="t-h2">
                {t("measureTitle")}
              </h2>
            </div>
            <ol className="steps col-span-6 grid gap-6 lg:col-start-7" role="list">
              <li>
                <p className="!text-ink">{t("measure1")}</p>
              </li>
              <li>
                <p className="!text-ink">{t("measure2")}</p>
              </li>
              <li>
                <p className="!text-ink">{t("measure3")}</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <Close title={t("closeTitle")} lead={t("closeLead")} cta={t("closeTitle")} href="/donate" />
    </>
  );
}
