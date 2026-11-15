import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/components/site/FaqList";
import { Link } from "@/i18n/navigation";
import { listFaqs } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("faq");
  return { title: t("title"), description: t("lead") };
}

const AUDIENCES = ["general", "students", "guardians", "volunteers", "schools", "donors"] as const;

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const faqs = await listFaqs();
  const groups = AUDIENCES.map((a) => ({ a, items: faqs.filter((f) => f.audience === a) })).filter((g) => g.items.length);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.questionEn, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };

  return (
    <div className="wrap py-16 lg:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid12">
        <div className="col-span-6 lg:col-span-4">
          <div className="grid gap-6 lg:sticky lg:top-[calc(var(--nav-h)+32px)]">
            <h1 className="t-h1">{t("title")}</h1>
            <p className="text-muted">{t("lead")}</p>
            <nav aria-label={t("jump")} className="grid gap-2">
              {groups.map((g) => (
                <a key={g.a} href={`#${g.a}`} className="uline w-fit">
                  {t(`audiences.${g.a}`)}
                </a>
              ))}
            </nav>
            <p className="t-small text-muted">
              {t("more")}{" "}
              <Link href="/contact" className="uline text-ink">
                {t("contactLink")}
              </Link>
            </p>
          </div>
        </div>
        <div className="col-span-6 grid gap-16 lg:col-start-6 lg:col-span-7">
          {groups.map((g) => (
            <section key={g.a} id={g.a} aria-labelledby={`h-${g.a}`} className="scroll-mt-[calc(var(--nav-h)+24px)]">
              <h2 id={`h-${g.a}`} className="t-h3 mb-4">
                {t(`audiences.${g.a}`)}
              </h2>
              <FaqList items={g.items} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
