import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { Close } from "@/components/site/Close";
import { TeamRow } from "@/components/site/TeamCard";
import { fmt } from "@/lib/format";
import { getPublicTotals, listTeam } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("lead") };
}

const VALUES = ["best", "accountability", "leadership", "collaboration", "kindness"] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const ti = await getTranslations("impact");
  const [totals, team] = await Promise.all([getPublicTotals(), listTeam()]);
  const leaders = team.filter((m) => m.group === "leadership").slice(0, 4);

  return (
    <>
      <section className="screen" aria-labelledby="about-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-6 self-start lg:col-span-5">
              <span className="t-label">{t("eyebrow")}</span>
              <h1 id="about-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
              <div>
                <Link href="/get-involved" className="btn">
                  {t("cta")}
                </Link>
              </div>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/5] w-full">
                <Photo slot="founder" alt={t("founderAlt")} priority />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="story-h">
        <div className="wrap">
          <div className="grid12">
            <div className="col-span-6 lg:col-span-5">
              <h2 id="story-h" className="t-h2">
                {t("storyTitle")}
              </h2>
            </div>
            <div className="col-span-6 grid gap-6 lg:col-start-7">
              <p className="t-lead">{t("story1")}</p>
              <p>{t("story2")}</p>
              <dl className="mt-6 grid gap-8 border-t border-line pt-8 sm:grid-cols-2">
                <div className="grid gap-2">
                  <dt className="t-label">{t("missionTitle")}</dt>
                  <dd>{t("mission")}</dd>
                </div>
                <div className="grid gap-2">
                  <dt className="t-label">{t("visionTitle")}</dt>
                  <dd>{t("vision")}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="screen" aria-labelledby="values-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-8 self-start lg:col-span-5">
              <h2 id="values-h" className="t-h2">
                {t("valuesTitle")}
              </h2>
              <ul className="rows rows--tight" role="list">
                {VALUES.map((v) => (
                  <li key={v} className="grid gap-1">
                    <span className="font-medium">{t(`values.${v}.t`)}</span>
                    <span className="text-muted">{t(`values.${v}.d`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/3] w-full">
                <Photo slot="team" alt={t("photoAlt")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="screen screen--dark" aria-labelledby="how-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-6 self-center lg:col-span-5">
              <h2 id="how-h" className="t-h1">
                {t("howTitle")}
              </h2>
              <p className="t-lead text-inv-muted">{t("howLead")}</p>
            </div>
            <dl className="col-span-6 grid grid-cols-2 gap-x-8 gap-y-14 lg:col-start-7">
              {(
                [
                  [fmt(totals.students), ti("studentsLabel")],
                  [fmt(totals.schools), ti("schoolsLabel")],
                  [fmt(totals.volunteers), ti("volunteersLabel")],
                  [String(totals.states), ti("statesLabel")],
                ] as const
              ).map(([n, label]) => (
                <div key={label} className="grid gap-2 border-t border-white/15 pt-6">
                  <dt className="font-display text-[clamp(44px,3vw+24px,72px)] leading-none tabular">{n}</dt>
                  <dd className="text-inv-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="screen" aria-labelledby="leaders-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-8 self-start lg:col-span-5">
              <h2 id="leaders-h" className="t-h2">
                {t("teamTitle")}
              </h2>
              <p className="text-muted">{t("teamLead", { count: team.length })}</p>
              {leaders.length > 0 && (
                <ul className="rows rows--tight" role="list">
                  {leaders.map((m) => (
                    <li key={m.id}>
                      <TeamRow name={m.name} title={m.titleEn} />
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <Link href="/about/team" className="link">
                  {t("teamLink")}
                </Link>
              </div>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/3] w-full">
                <Photo slot="volunteersArriving" alt={t("teamPhotoAlt")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Close title={t("closeTitle")} lead={t("closeLead")} cta={t("cta")} href="/get-involved" />
    </>
  );
}
