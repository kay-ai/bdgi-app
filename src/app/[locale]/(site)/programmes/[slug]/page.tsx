import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { Shape } from "@/components/site/Shape";
import { Close } from "@/components/site/Close";
import { programmePhoto } from "@/content/photos";
import { fmt, money } from "@/lib/format";
import { raisedFor } from "@/server/services/donations";
import { getHistoricalFigure, getProgramme, listFaqs, listLessonPlans, listProgrammes } from "@/server/services/public";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await listProgrammes()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProgramme(slug);
  return p ? { title: p.nameEn, description: p.summaryEn } : {};
}

export default async function ProgrammePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = await getProgramme(slug);
  if (!p || p.status !== "published") notFound();
  const t = await getTranslations("programmes");
  const [lessons, figure, faqs] = await Promise.all([
    listLessonPlans(p.id),
    getHistoricalFigure(slug),
    listFaqs(p.isEnrolling ? ["students", "guardians"] : ["donors"]),
  ]);
  // Fundraising progress (spec/11 §3), in the target's own currency only.
  const target = p.fundraisingTargetMinor && p.fundraisingCurrency ? { minor: p.fundraisingTargetMinor, currency: p.fundraisingCurrency } : null;
  const raised = target ? await raisedFor(p.id, target.currency) : 0;
  const pct = target ? Math.min(100, Math.round((raised / target.minor) * 100)) : 0;
  const photo = programmePhoto[slug] ?? "programmeOther";
  const external = slug === "edutracka" ? "https://edutracka.ai" : null;
  const cta = p.isEnrolling
    ? { label: t("join"), href: `/join/student?programme=${slug}` }
    : { label: t("support"), href: "/donate" };

  return (
    <>
      <section className="hero-photo" aria-labelledby="p-h">
        <div className="hero-photo__media">
          <Photo slot={photo} alt={p.nameEn} priority sizes="100vw" />
        </div>
        <div className="wrap">
          <div className="hero-box">
            <h1 id="p-h" className="t-h1">
              {p.nameEn}
            </h1>
            <p>{p.summaryEn}</p>
            <p className="t-label !text-[14px]">
              {p.maxAge < 99 ? t("forWho", { min: p.minAge, max: p.maxAge }) : null}
              {p.maxAge < 99 && p.defaultSessions > 0 ? " · " : null}
              {p.defaultSessions > 0 ? t("sessions", { count: p.defaultSessions }) : null}
            </p>
            <div className="btn-row">
              {external ? (
                <a href={external} className="btn btn--lg" rel="noopener">
                  {t("visit")}
                </a>
              ) : (
                <Link href={cta.href} className="btn btn--lg">
                  {cta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {lessons.length > 0 && (
        <section className="screen" aria-labelledby="sess-h">
          <div className="wrap">
            <div className="grid12 flex-1 items-center">
              <div className="col-span-6 lg:col-span-5 grid gap-8 self-start">
                <h2 id="sess-h" className="t-h2">
                  {t("sessionTitle")}
                </h2>
                <ol className="steps grid gap-3" role="list">
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <h3>{l.titleEn}</h3>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="col-span-6 lg:col-start-7">
                <Shape shape="pebble" slot="session" alt={p.nameEn} />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="screen screen--surface" aria-labelledby="fig-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-start">
            <div className="col-span-6 lg:col-span-5 grid gap-6">
              <h2 id="fig-h" className="t-h2">
                {t("figuresTitle")}
              </h2>
              {figure.students > 0 ? (
                <dl className="grid gap-6">
                  <div>
                    <dt className="t-label">{t("students")}</dt>
                    <dd className="t-figure">{fmt(figure.students)}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t("schools")}</dt>
                    <dd className="t-figure">{fmt(figure.schools)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted">{t("noFigures")}</p>
              )}
              {target && (
                <div className="grid gap-3">
                  <h3 className="t-label" id="raise-h">
                    {t("raisedTitle")}
                  </h3>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-labelledby="raise-h"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-valuetext={t("raised", { raised: money(raised, target.currency), target: money(target.minor, target.currency) })}
                  >
                    <span style={{ width: `${Math.max(pct, raised > 0 ? 2 : 0)}%` }} />
                  </div>
                  <p className="tabular">{t("raised", { raised: money(raised, target.currency), target: money(target.minor, target.currency) })}</p>
                  <div>
                    <Link href="/donate" className="link">
                      {t("support")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
            {faqs.length > 0 && (
              <div className="col-span-6 lg:col-start-7 grid gap-6">
                <h2 className="t-h3">{t("faqTitle")}</h2>
                <dl className="rows">
                  {faqs.slice(0, 4).map((f) => (
                    <div key={f.id} className="border-t border-line py-4">
                      <dt className="font-medium">{f.questionEn}</dt>
                      <dd className="text-muted">{f.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </section>

      {external ? null : (
        <Close title={t("closeTitle", { name: p.nameEn })} lead={p.isEnrolling ? t("closeLead") : t("closeLeadSupport")} cta={cta.label} href={cta.href} />
      )}
    </>
  );
}
