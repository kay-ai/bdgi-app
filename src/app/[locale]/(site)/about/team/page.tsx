import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Shape } from "@/components/site/Shape";
import { TeamRow } from "@/components/site/TeamCard";
import { fmt } from "@/lib/format";
import { getPublicTotals, listTeam } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("title"), description: t("lead") };
}

const GROUPS = ["leadership", "staff", "board", "advisor"] as const;

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("team");
  const [team, totals] = await Promise.all([listTeam(), getPublicTotals()]);

  return (
    <>
      <section className="screen" aria-labelledby="team-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-6 self-start lg:col-span-5">
              <h1 id="team-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <Shape shape="drop" slot="volunteersArriving" alt={t("photoAlt")} priority />
            </div>
          </div>
        </div>
      </section>

      <section className="screen screen--surface" aria-label={t("title")}>
        <div className="wrap">
          <div className="grid gap-14">
            {GROUPS.map((g) => {
              const people = team.filter((m) => m.group === g);
              if (people.length === 0) return null; // board and advisors stay hidden until populated
              return (
                <div key={g} className="grid gap-6">
                  <h2 className="t-h3">{t(`groups.${g}`)}</h2>
                  <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
                    {people.map((m) => (
                      <li key={m.id}>
                        <TeamRow name={m.name} title={m.titleEn} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="screen screen--dark" aria-labelledby="vols-h" data-journey-end>
        <div className="wrap justify-center">
          <div className="grid max-w-[720px] gap-8">
            <h2 id="vols-h" className="t-h1">
              {t("volunteersTitle", { volunteers: fmt(totals.volunteers) })}
            </h2>
            <p className="t-lead text-inv-muted">{t("volunteersLead")}</p>
            <div>
              <Link href="/join/volunteer" className="btn btn--lg">
                {t("volunteersLink")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
