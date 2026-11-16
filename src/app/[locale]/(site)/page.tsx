import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { ProgrammeList } from "@/components/site/ProgrammeList";
import { ReachTiles } from "@/components/site/ReachTiles";
import { Shape } from "@/components/site/Shape";
import { programmePhoto, type PhotoKey } from "@/content/photos";
import { fmt, formatDate } from "@/lib/format";
import { listEvents } from "@/server/services/content";
import {
  getPublicTotals,
  getReachByLga,
  listProgrammes,
  listPublishedStories,
  listVisiblePartners,
} from "@/server/services/public";

export const revalidate = 300;

const HOME_PROGRAMMES = ["debate-and-public-speaking", "inspire-her-future", "ibadan-schools-debate-competition", "eko-dara"];
// big, wide, big, wide: grid-auto-flow dense places the second wide tile under the first.
const WALL: { slot: PhotoKey; big?: boolean }[] = [
  { slot: "student1", big: true },
  { slot: "student2" },
  { slot: "student4", big: true },
  { slot: "student3" },
];
const STEPS: { n: 1 | 2 | 3 | 4; slot: PhotoKey; alt: "photoForm" | "photoGuardian" | "photoGroup" | "photoSession" }[] = [
  { n: 1, slot: "stepForm", alt: "photoForm" },
  { n: 2, slot: "stepGuardian", alt: "photoGuardian" },
  { n: 3, slot: "stepGroup", alt: "photoGroup" },
  { n: 4, slot: "stepSession", alt: "photoSession" },
];

/**
 * Home (tasteskill plan in .taste-skill/plan.md). Kind service. Dealt: hero split, nav-mega,
 * footer-dark, close-photo, rhythm surface-pairs (the gold band and the reach surface), buttons
 * arrow, compositions bleed and strip.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const [totals, programmes, reach, stories, partners, events] = await Promise.all([
    getPublicTotals(),
    listProgrammes(),
    getReachByLga(),
    listPublishedStories(3),
    listVisiblePartners(),
    listEvents(),
  ]);
  const homeProgrammes = HOME_PROGRAMMES.map((slug) => programmes.find((p) => p.slug === slug)).filter(
    (p): p is NonNullable<typeof p> => !!p,
  );
  const competition = programmes.find((p) => p.slug === "ibadan-schools-debate-competition");
  const next = events.upcoming[0];
  // The reach map shows only once partner schools are recorded.
  const hasMap = reach.some((r) => r.schools > 0);

  return (
    <>
      {/* 1 · hero: the catchphrase beside the logo's girl, a BGDI photograph showing through her */}
      <section className="hero-dream" aria-labelledby="hero-h">
        <div className="wrap">
          <div className="hero-dream__text">
            <h1 id="hero-h" className="hero__title">
              {t("hero.title")}
            </h1>
            <p className="hero__lead">{t("hero.lead", { students: fmt(totals.students), schools: fmt(totals.schools) })}</p>
            <div className="btn-row">
              <Link href="/join" className="btn btn--lg">
                {t("hero.primary")}
              </Link>
              <Link href="/programmes" className="link">
                {t("hero.secondary")}
              </Link>
            </div>
            {next && (
              <Link href={`/events/${next.slug}`} className="hero-next">
                <span className="t-label">{t("hero.next")}</span>
                <span>
                  <strong>{next.title}</strong> · {formatDate(next.startsAt.toISOString(), locale)}
                </span>
              </Link>
            )}
          </div>
          <div className="hero-dream__art">
            <span className="hero-dream__disc" aria-hidden="true" />
            <div className="hero-dream__figure">
              <div className="hero-dream__girl">
                <Photo slot="heroDream" alt={t("hero.photoAlt")} priority sizes="(max-width: 1023px) 100vw, 50vw" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · programmes: a peek-list, a photograph per row */}
      <section className="screen" id="programmes" aria-labelledby="programmes-h">
        <div className="wrap">
          <div className="head-row">
            <div>
              <h2 id="programmes-h" className="t-h2">
                {t("programmes.title")}
              </h2>
              <p className="text-muted">{t("programmes.lead")}</p>
            </div>
            <Link href="/programmes" className="link">
              {t("programmes.link")}
            </Link>
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

      {/* 3 · the students: a wall of faces on the gold brand band */}
      <section className="screen screen--gold" id="impact" aria-labelledby="impact-h">
        <div className="wrap">
          <div className="head-row">
            <div>
              <h2 id="impact-h" className="t-h2">
                {t("impact.title", { students: fmt(totals.students) })}
              </h2>
              <p className="muted-on">{t("impact.line1", { schools: fmt(totals.schools), states: totals.states })}</p>
            </div>
            <Link href="/impact" className="link">
              {t("impact.link")}
            </Link>
          </div>
          <div className="wall">
            {WALL.map((w) => (
              <Link key={w.slot} href="/stories" className={w.big ? "wall__big" : undefined} tabIndex={-1} aria-hidden="true">
                <Photo slot={w.slot} alt="" sizes={w.big ? "(max-width: 639px) 100vw, 33vw" : "(max-width: 639px) 50vw, 17vw"} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · the competition: bleed, the full hall across the viewport */}
      {competition && (
        <section className="screen pb-0" id="competition" aria-labelledby="competition-h">
          <div className="wrap">
            <div className="head-row">
              <div>
                <h2 id="competition-h" className="t-h2">
                  {competition.nameEn}
                </h2>
                <p className="text-muted">{competition.summaryEn.split(". ")[0]!.replace(/\.$/, "")}.</p>
              </div>
              <Link href={`/programmes/${competition.slug}`} className="link">
                {t("competition.link")}
              </Link>
            </div>
          </div>
          <Link href={`/programmes/${competition.slug}`} className="bleed m-zoom mt-auto block" tabIndex={-1} aria-hidden="true">
            <Photo slot="hall" alt="" sizes="100vw" />
          </Link>
        </section>
      )}

      {/* 5 · reach on the surface ground */}
      <section className="screen screen--surface" id="reach" aria-labelledby="reach-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-start">
            <div className="col-span-6 lg:col-span-5 grid gap-6">
              <h2 id="reach-h" className="t-h2">
                {t("reach.title")}
              </h2>
              <p>
                {t("reach.lead")}
                {hasMap ? ` ${t("reach.mapNote")}` : null}
              </p>
              <p>{t("impact.line2", { volunteers: fmt(totals.volunteers) })}</p>
              <p>
                <Link href={hasMap ? "/impact#reach" : "/impact"} className="link">
                  {hasMap ? t("reach.link") : t("reach.linkNoMap")}
                </Link>
              </p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              {/* The map shows only once partner schools are recorded; until then, a photograph. */}
              {reach.some((r) => r.schools > 0) ? (
                <ReachTiles lgas={reach} label={t("reach.mapLabel")} low={t("reach.legendLow")} high={t("reach.legendHigh")} />
              ) : (
                <Shape shape="pebble" slot="hallWide" alt={t("reach.photoAlt")} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 6 · steps: four cards, a photograph of each step */}
      <section className="screen" id="steps" aria-labelledby="steps-h">
        <div className="wrap">
          <div className="head-row">
            <div>
              <h2 id="steps-h" className="t-h2">
                {t("steps.title")}
              </h2>
            </div>
            <Link href="/join" className="link">
              {t("hero.primary")}
            </Link>
          </div>
          <ol className="step-cards" role="list">
            {STEPS.map((s) => (
              <li key={s.n} className="step-card">
                <div className="step-card__photo">
                  <Photo slot={s.slot} alt={t(`steps.${s.alt}`)} sizes="(max-width: 639px) 120px, (max-width: 1023px) 50vw, 25vw" />
                </div>
                <div className="step-card__body">
                  <span className="step-num" aria-hidden="true">
                    {s.n}
                  </span>
                  <h3>{t(`steps.s${s.n}t`)}</h3>
                  <p>{t(`steps.s${s.n}`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7 · people: the volunteers, a photo pair */}
      <section className="screen screen--green" id="people" aria-labelledby="people-h">
        <div className="wrap">
          <div className="head-row">
            <div>
              <h2 id="people-h" className="t-h2">
                {t("people.title")}
              </h2>
              <p className="text-[#d6e8df]">{t("people.lead", { volunteers: fmt(totals.volunteers) })}</p>
            </div>
            <Link href="/join/volunteer" className="link">
              {t("people.link")}
            </Link>
          </div>
          <div className="photo-pair">
            <div className="frame">
              <Photo slot="volunteersYellow" alt={t("people.photoA")} sizes="(max-width: 639px) 100vw, 50vw" />
            </div>
            <div className="frame">
              <Photo slot="volunteersSmiling" alt={t("people.photoB")} sizes="(max-width: 639px) 100vw, 50vw" />
            </div>
          </div>
          {partners.length > 0 && (
            <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
              <span className="text-[13px] font-medium text-[#d6e8df]">{t("people.supportedBy")}</span>
              {partners.map((p) => (
                <span key={p.id} className="font-medium">
                  {p.name}
                </span>
              ))}
            </p>
          )}
        </div>
      </section>

      {/* 8 · stories (shown only once BGDI publishes stories) */}
      {stories.length > 0 && (
        <section className="screen" id="stories" aria-labelledby="stories-h">
          <div className="wrap">
            <div className="head-row">
              <div>
                <h2 id="stories-h" className="t-h2">
                  {t("stories.title")}
                </h2>
              </div>
              <Link href="/stories" className="link">
                {t("stories.link")}
              </Link>
            </div>
            <ul className="grid gap-6 md:grid-cols-3" role="list">
              {stories.map((s, i) => (
                <li key={s.id}>
                  <Link href={`/stories/${s.slug}`} className="card group block p-3">
                    <div className="frame aspect-[4/5]">
                      <Photo slot={(["storyA", "storyB", "storyC"] as const)[i % 3]!} alt={s.coverAlt ?? s.titleEn} />
                    </div>
                    <h3 className="t-h3 px-2 pb-2 pt-4">{s.titleEn}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 9 · close-photo */}
      <section className="close-photo" id="closing" aria-labelledby="close-h" data-journey-end>
        <div className="wrap">
          <div className="close-photo__head">
            <div>
              <h2 id="close-h" className="t-h1 max-w-[16ch]">
                {t("close.title")}
              </h2>
              <p className="t-lead max-w-[52ch] text-muted">{t("close.lead")}</p>
            </div>
            <div>
              <Link href="/join" className="btn btn--lg">
                {tc("joinProgramme")}
              </Link>
            </div>
          </div>
          <div className="close-photo__img">
            <Photo slot="stage" alt={t("close.photoAlt")} sizes="(max-width: 1440px) 100vw, 1280px" />
          </div>
        </div>
      </section>
    </>
  );
}
