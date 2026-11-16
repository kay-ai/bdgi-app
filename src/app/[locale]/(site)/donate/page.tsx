import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { DonateForm } from "@/components/site/DonateForm";
import { getSettings, listFaqs, listProgrammes } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("donate");
  return { title: t("title"), description: t("lead") };
}

export default async function DonatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("donate");
  const [programmes, st, faqs] = await Promise.all([
    listProgrammes(),
    getSettings(["donation_presets", "donations_usd_enabled", "donation_impact_lines"]),
    listFaqs(["donors"]),
  ]);
  const saved = (st.donation_presets ?? {}) as { NGN?: number[]; USD?: number[] };
  const presets = {
    NGN: (saved.NGN ?? [2000, 5000, 10000, 25000, 50000]).slice(0, 6),
    USD: (saved.USD ?? [10, 25, 50, 100]).slice(0, 6),
  };
  // Impact lines stay hidden until BGDI confirms real unit costs (spec/11 §1.3): keys like "NGN:5000".
  const impactLines = (st.donation_impact_lines ?? {}) as Record<string, string>;

  return (
    <>
      <section className="screen" aria-labelledby="donate-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-start">
            <div className="col-span-6 lg:col-span-5 grid gap-8">
              <h1 id="donate-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
              <div className="frame aspect-[4/3] w-full max-lg:hidden">
                <Photo slot="session" alt={t("photoAlt")} />
              </div>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <DonateForm
                locale={locale}
                presets={presets}
                usdEnabled={st.donations_usd_enabled === true}
                impactLines={impactLines}
                programmes={programmes.filter((p) => p.acceptsDesignatedGifts).map((p) => ({ id: p.id, name: p.nameEn }))}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="screen screen--surface" aria-labelledby="ways-h">
        <div className="wrap">
          <div className="grid12">
            <div className="col-span-6 lg:col-span-5 grid content-start gap-6">
              <h2 id="ways-h" className="t-h2">
                {t("otherWaysTitle")}
              </h2>
              <ul className="rows" role="list">
                <li className="grid gap-1">
                  <span className="font-medium">{t("bank")}</span>
                  <span className="text-muted">{t("bankPending")}</span>
                </li>
                <li className="grid gap-2">
                  <span className="font-medium">{t("partner")}</span>
                  <Link href="/partner" className="link self-start">
                    {t("partnerLink")}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-6 lg:col-start-7 grid content-start gap-6">
              <h2 className="t-h3">{t("questions")}</h2>
              <dl>
                {faqs.map((f) => (
                  <div key={f.id} className="border-t border-line py-4">
                    <dt className="font-medium">{f.questionEn}</dt>
                    <dd className="text-muted">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
