import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { ProgrammeList } from "@/components/site/ProgrammeList";
import { ReachTiles } from "@/components/site/ReachTiles";
import { programmePhoto } from "@/content/photos";
import { fmt } from "@/lib/format";
import {
  getPublicTotals,
  getReachByLga,
  listProgrammes,
  listPublishedStories,
  listVisiblePartners,
} from "@/server/services/public";

export const revalidate = 300;

const HOME_PROGRAMMES = ["debate-and-public-speaking", "inspire-her-future", "ibadan-schools-debate-competition", "eko-dara"];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const [totals, programmes, reach, stories, partners] = await Promise.all([
    getPublicTotals(),
    listProgrammes(),
    getReachByLga(),
    listPublishedStories(3),
    listVisiblePartners(),
  ]);
  const ihf = totals.byProgramme.find((p) => p.slug === "inspire-her-future")?.students ?? 0;
  const homeProgrammes = HOME_PROGRAMMES.map((slug) => programmes.find((p) => p.slug === slug)).filter(
    (p): p is NonNullable<typeof p> => !!p,
  );

  return (
    <>
      {/* 1 · top: what BGDI does, for whom, one fact */}
      <section className="hero-photo" aria-labelledby="hero-h">
        <div className="hero-photo__media">
          <Photo slot="heroCompetition" alt={t("hero.photoAlt")} priority sizes="100vw" />
        </div>
        <div className="wrap">
          <div className="hero-box">
            <h1 id="hero-h" className="t-h1-hero">
              {t("hero.title")}
            </h1>
            <p>{t("hero.lead", { students: fmt(totals.students), schools: fmt(totals.schools) })}</p>
            <div className="btn-row">
              <Link href="/join" className="btn btn--lg">
                {t("hero.primary")}
              </Link>
              <Link href="/programmes" className="link">
                {t("hero.secondary")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · programmes */}
      <section className="screen screen--snug" id="programmes" aria-labelledby="programmes-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="programmes-h" className="t-h2">
              {t("programmes.title")}
            </h2>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p>{t("programmes.lead")}</p>
              <Link href="/programmes" className="link">
                {t("programmes.link")}
              </Link>
            </div>
          </div>
          <ProgrammeList
            items={homeProgrammes.map((p) => ({
              slug: p.slug,
              name: p.nameEn,
              line: p.summaryEn.split(". ")[0]!.replace(/\.$/, "") + ".",
              who:
                p.maxAge < 99
                  ? t("programmes.forWho", { min: p.minAge, max: p.maxAge })
                  : t("programmes.forEveryone"),
            }))}
            pictures={Object.fromEntries(
              homeProgrammes.map((p) => [
                p.slug,
                <Photo key={p.slug} slot={programmePhoto[p.slug] ?? "programmeOther"} alt={p.nameEn} />,
              ]),
            )}
          />
        </div>
      </section>

      {/* 3 · impact (surface band, first of the pair) */}
      <section className="screen screen--surface" id="impact" aria-labelledby="impact-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 lg:col-span-5 grid gap-6">
              <h2 id="impact-h" className="t-h2">
                {t("impact.title", { students: fmt(totals.students) })}
              </h2>
              <p className="t-lead">
                {t("impact.line1", { schools: fmt(totals.schools), states: totals.states })}
              </p>
              <p>{t("impact.line2", { volunteers: fmt(totals.volunteers) })}</p>
              {ihf > 0 && <p>{t("impact.line3", { ihf: fmt(ihf) })}</p>}
              <p className="t-small text-muted">{t("impact.source", { note: totals.sourceNote })}</p>
              <p>
                <Link href="/impact" className="link">
                  {t("impact.link")}
                </Link>
              </p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/3] w-full">
                <Photo slot="session" alt={t("impact.photoAlt")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 · reach (surface band, second of the pair) */}
      <section className="screen screen--surface" id="reach" aria-labelledby="reach-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 lg:col-span-5 grid gap-6 self-start">
              <h2 id="reach-h" className="t-h2">
                {t("reach.title")}
              </h2>
              <p>{t("reach.lead")}</p>
              <p>
                <Link href="/impact#reach" className="link">
                  {t("reach.link")}
                </Link>
              </p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <ReachTiles lgas={reach} label={t("reach.mapLabel")} low={t("reach.legendLow")} high={t("reach.legendHigh")} />
            </div>
          </div>
        </div>
      </section>

      {/* 5 · steps */}
      <section className="screen" id="steps" aria-labelledby="steps-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 lg:col-span-5 grid gap-10 self-start">
              <h2 id="steps-h" className="t-h2">
                {t("steps.title")}
              </h2>
              <ol className="steps grid gap-6" role="list">
                {([1, 2, 3, 4] as const).map((n) => (
                  <li key={n}>
                    <h3>{t(`steps.s${n}t`)}</h3>
                    <p>{t(`steps.s${n}`)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/5] w-full">
                <Photo slot="volunteersArriving" alt={t("steps.photoAlt")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 · people */}
      <section className="screen" id="people" aria-labelledby="people-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="people-h" className="t-h2">
              {t("people.title")}
            </h2>
            <p>{t("people.lead", { volunteers: fmt(totals.volunteers) })}</p>
          </div>
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4" role="list">
            {(["portrait1", "portrait2", "portrait3", "portrait4"] as const).map((n) => (
              <li key={n} className="frame aspect-[4/5]">
                <Photo slot={n} alt={t("people.portraitAlt")} sizes="(max-width: 639px) 50vw, 25vw" />
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
            <Link href="/join/volunteer" className="link">
              {t("people.link")}
            </Link>
            {partners.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
                <span className="t-label">{t("people.supportedBy")}</span>
                {partners.map((p) => (
                  <span key={p.id} className="font-medium">
                    {p.name}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 7 · stories (shown only once BGDI publishes stories) */}
      {stories.length > 0 && (
        <section className="screen" id="stories" aria-labelledby="stories-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="stories-h" className="t-h2">
                {t("stories.title")}
              </h2>
            </div>
            <ul className="grid gap-6 md:grid-cols-3" role="list">
              {stories.map((s, i) => (
                <li key={s.id}>
                  <Link href={`/stories/${s.slug}`} className="group block">
                    <div className="frame aspect-[4/5]">
                      <Photo slot={(["storyA", "storyB", "storyC"] as const)[i % 3]!} alt={s.coverAlt ?? s.titleEn} />
                    </div>
                    <h3 className="t-h3 mt-4">{s.titleEn}</h3>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-10">
              <Link href="/stories" className="link">
                {t("stories.link")}
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* 8 · close */}
      <section className="screen" id="closing" aria-labelledby="close-h" data-journey-end>
        <div className="wrap justify-center">
          <div className="grid gap-8 border-t border-line pt-16">
            <h2 id="close-h" className="t-h1 max-w-[18ch]">
              {t("close.title")}
            </h2>
            <p className="t-lead max-w-[52ch] text-muted">{t("close.lead")}</p>
            <div>
              <Link href="/join" className="btn btn--lg">
                {tc("joinProgramme")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
