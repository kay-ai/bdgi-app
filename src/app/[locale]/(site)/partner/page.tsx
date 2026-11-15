import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Photo } from "@/components/site/Photo";
import { ContactForm } from "@/components/site/ContactForm";
import { fmt } from "@/lib/format";
import { getPublicTotals, listVisiblePartners } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partner");
  return { title: t("title"), description: t("lead") };
}

export default async function PartnerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("partner");
  const ti = await getTranslations("impact");
  const [totals, partners] = await Promise.all([getPublicTotals(), listVisiblePartners()]);

  return (
    <>
      <section className="screen" aria-labelledby="partner-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-8 self-start lg:col-span-5">
              <h1 id="partner-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
              <ul className="grid grid-cols-3 gap-4" role="list">
                <li className="grid gap-1">
                  <span className="t-figure">{fmt(totals.students)}</span>
                  <span className="t-small text-muted">{ti("studentsLabel")}</span>
                </li>
                <li className="grid gap-1">
                  <span className="t-figure">{fmt(totals.schools)}</span>
                  <span className="t-small text-muted">{ti("schoolsLabel")}</span>
                </li>
                <li className="grid gap-1">
                  <span className="t-figure">{totals.states}</span>
                  <span className="t-small text-muted">{ti("statesLabel")}</span>
                </li>
              </ul>
              <div>
                <a href="#enquiry" className="btn">
                  {t("formTitle")}
                </a>
              </div>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <div className="frame fit aspect-[4/3] w-full">
                <Photo slot="programmeCompetition" alt={t("photoAlt")} priority />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="ways-h">
        <div className="wrap">
          <div className="grid12">
            <div className="col-span-6 grid content-start gap-6 lg:col-span-5">
              <h2 id="ways-h" className="t-h2">
                {t("ways")}
              </h2>
              {partners.length > 0 && (
                <p className="text-muted">
                  {t("current")} {partners.map((p) => p.name).join(", ")}
                </p>
              )}
            </div>
            <ol className="steps col-span-6 grid gap-6 lg:col-start-7" role="list">
              {(["w1", "w2", "w3", "w4", "w5"] as const).map((k) => (
                <li key={k}>
                  <h3>{t(k)}</h3>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="screen" id="enquiry" aria-labelledby="enq-h">
        <div className="wrap">
          <div className="grid12 items-start">
            <div className="col-span-6 grid gap-4 lg:col-span-5">
              <h2 id="enq-h" className="t-h2">
                {t("formTitle")}
              </h2>
              <p className="text-muted">{t("formLead")}</p>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <ContactForm topic="partnership" sentText={t("sent")} submitText={t("submit")} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
