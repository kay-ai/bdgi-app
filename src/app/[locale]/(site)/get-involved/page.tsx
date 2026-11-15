import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import type { PhotoKey } from "@/content/photos";
import { FaqList } from "@/components/site/FaqList";
import { listFaqs } from "@/server/services/public";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("getInvolved");
  return { title: t("title"), description: t("lead") };
}

const WAYS: { key: "student" | "volunteer" | "school" | "partner"; href: string; photo: PhotoKey }[] = [
  { key: "student", href: "/join/student", photo: "programmeDebate" },
  { key: "volunteer", href: "/join/volunteer", photo: "volunteersArriving" },
  { key: "school", href: "/join/school", photo: "session" },
  { key: "partner", href: "/partner", photo: "programmeCompetition" },
];

export default async function GetInvolvedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("getInvolved");
  const faqs = await listFaqs(["general", "students", "volunteers", "schools"]);

  return (
    <>
      <section className="screen" aria-labelledby="gi-h">
        <div className="wrap">
          <div className="section-head">
            <h1 id="gi-h" className="t-h1">
              {t("title")}
            </h1>
            <p className="t-lead">{t("lead")}</p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {WAYS.map((w, i) => (
              <li key={w.key}>
                <Link href={w.href} className="card group grid h-full content-start gap-4 !p-0 overflow-hidden">
                  <div className="frame aspect-[4/3] !rounded-none">
                    <Photo slot={w.photo} alt="" sizes="(max-width: 639px) 100vw, 25vw" priority={i < 2} />
                  </div>
                  <div className="grid gap-2 px-5 pb-6">
                    <h2 className="t-h3">{t(w.key)}</h2>
                    <p className="text-muted">{t(`${w.key}Line`)}</p>
                    <span className="t-small text-muted">{t(`${w.key}Time`)}</span>
                    <span className="link mt-2">{t(`${w.key}Cta`)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="after-h">
        <div className="wrap">
          <div className="grid12">
            <div className="col-span-6 lg:col-span-5">
              <h2 id="after-h" className="t-h2">
                {t("afterTitle")}
              </h2>
            </div>
            <ol className="steps col-span-6 grid gap-8 lg:col-start-7" role="list">
              {(["a1", "a2", "a3", "a4"] as const).map((k) => (
                <li key={k}>
                  <h3>{t(k)}</h3>
                  <p>{t(`${k}d`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="screen" aria-labelledby="gifaq-h">
          <div className="wrap">
            <div className="grid12">
              <div className="col-span-6 grid content-start gap-6 lg:col-span-5">
                <h2 id="gifaq-h" className="t-h2">
                  {t("faqTitle")}
                </h2>
                <Link href="/faq" className="link">
                  {t("faqLink")}
                </Link>
              </div>
              <div className="col-span-6 lg:col-start-7">
                <FaqList items={faqs.slice(0, 6)} />
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
