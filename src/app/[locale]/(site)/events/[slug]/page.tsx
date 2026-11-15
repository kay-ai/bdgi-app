import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Cover } from "@/components/site/Cover";
import { bodyParagraphs, getEvent } from "@/server/services/content";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEvent(slug);
  return e ? { title: e.titleEn, description: e.summaryEn } : {};
}

export default async function EventPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const e = await getEvent(slug);
  if (!e) notFound();
  const t = await getTranslations("events");
  const when = new Intl.DateTimeFormat(locale === "yo" ? "yo-NG" : "en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(e.startsAt);
  const paras = bodyParagraphs(e.bodyEn);
  const isUpcoming = e.startsAt.getTime() > Date.now();

  return (
    <article className="wrap py-16 lg:py-24">
      <Link href="/events" className="uline t-small text-muted">
        {t("back")}
      </Link>
      <div className="grid12 mt-8">
        <div className="col-span-6 grid content-start gap-6 lg:col-span-6">
          <h1 className="t-h1">{e.titleEn}</h1>
          <p className="t-lead text-muted">{e.summaryEn}</p>
          <dl className="grid gap-4 border-t border-line pt-6">
            <div className="grid gap-1">
              <dt className="t-label">{t("when")}</dt>
              <dd>{when} WAT</dd>
            </div>
            <div className="grid gap-1">
              <dt className="t-label">{t("where")}</dt>
              <dd>
                {e.isOnline ? (
                  t("online")
                ) : e.venue ? (
                  <a className="uline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue)}`} rel="noopener" target="_blank">
                    {e.venue}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          {isUpcoming && e.registration === "external_link" && e.registrationUrl && (
            <div>
              <a href={e.registrationUrl} className="btn btn--lg" rel="noopener" target="_blank">
                {t("register")}
              </a>
            </div>
          )}
          <div className="grid max-w-[640px] gap-5">
            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
        <div className="col-span-6 lg:col-start-8 lg:col-span-5">
          <div className="frame aspect-[4/5] w-full">
            <Cover src={e.coverKey} alt="" fallback="programmeCompetition" priority />
          </div>
        </div>
      </div>
    </article>
  );
}
