import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { listEvents } from "@/server/services/content";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: t("title"), description: t("lead") };
}

function DateBlock({ d, locale }: { d: Date; locale: string }) {
  const loc = locale === "yo" ? "yo-NG" : "en-NG";
  const day = new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "Africa/Lagos" }).format(d);
  const mon = new Intl.DateTimeFormat(loc, { month: "short", timeZone: "Africa/Lagos" }).format(d);
  return (
    <span className="grid h-20 w-20 shrink-0 place-content-center rounded-[var(--r-md)] bg-accent text-center text-accent-ink">
      <span className="font-display text-[30px] leading-none">{day}</span>
      <span className="text-[13px] font-medium uppercase">{mon}</span>
    </span>
  );
}

type Ev = Awaited<ReturnType<typeof listEvents>>["upcoming"][number];

function EventRows({ items, locale, online }: { items: Ev[]; locale: string; online: string }) {
  return (
    <ul className="rows" role="list">
      {items.map((e) => (
        <li key={e.id}>
          <Link href={`/events/${e.slug}`} className="group flex items-center gap-6">
            <DateBlock d={e.startsAt} locale={locale} />
            <span className="grid gap-1">
              <span className="t-h3 group-hover:underline group-hover:underline-offset-4">{e.title}</span>
              <span className="text-muted">{e.isOnline ? online : e.venue}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("events");
  const { upcoming, past } = await listEvents();

  return (
    <>
      <section className="screen" aria-labelledby="events-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-8 self-start lg:col-span-6">
              <div className="grid gap-4">
                <h1 id="events-h" className="t-h1">
                  {t("title")}
                </h1>
                <p className="t-lead text-muted">{t("lead")}</p>
              </div>
              <h2 className="t-label">{t("upcoming")}</h2>
              {upcoming.length ? (
                <EventRows items={upcoming} locale={locale} online={t("online")} />
              ) : (
                <div className="grid gap-4">
                  <p>{t("empty")}</p>
                  <Link href="/programmes/ibadan-schools-debate-competition" className="link">
                    {t("competitionLink")}
                  </Link>
                </div>
              )}
            </div>
            <div className="col-span-6 lg:col-start-8 lg:col-span-5">
              <div className="frame fit aspect-[4/5] w-full">
                <Photo slot="programmeCompetition" alt={t("photoAlt")} priority />
              </div>
            </div>
          </div>
        </div>
      </section>
      {past.length > 0 && (
        <section className="screen screen--surface" aria-labelledby="past-h">
          <div className="wrap">
            <h2 id="past-h" className="t-h2 mb-12">
              {t("past")}
            </h2>
            <EventRows items={past} locale={locale} online={t("online")} />
          </div>
        </section>
      )}
    </>
  );
}
