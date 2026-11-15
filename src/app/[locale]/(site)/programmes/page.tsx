import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import { Close } from "@/components/site/Close";
import { programmePhoto } from "@/content/photos";
import { listProgrammes } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("programmes");
  return { title: t("title"), description: t("lead") };
}

const MAIN = ["debate-and-public-speaking", "inspire-her-future", "ibadan-schools-debate-competition", "eko-dara"];

export default async function ProgrammesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("programmes");
  const tc = await getTranslations("common");
  const all = await listProgrammes();
  const main = all.filter((p) => MAIN.includes(p.slug));
  const other = all.filter((p) => !MAIN.includes(p.slug));

  return (
    <>
      <section className="screen" style={{ ["--h" as string]: 2 }} aria-labelledby="prog-h">
        <div className="wrap">
          <div className="section-head">
            <h1 id="prog-h" className="t-h1">
              {t("title")}
            </h1>
            <p className="t-lead">{t("lead")}</p>
          </div>
          <ul className="grid gap-x-6 gap-y-12 md:grid-cols-2" role="list">
            {main.map((p) => (
              <li key={p.id}>
                <Link href={`/programmes/${p.slug}`} className="group grid gap-4">
                  <div className="frame aspect-[3/2]">
                    <Photo slot={programmePhoto[p.slug] ?? "programmeOther"} alt={p.nameEn} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="t-h3">
                      <span className="uline group-hover:[background-size:100%_1px]">{p.nameEn}</span>
                    </h2>
                    <p className="max-w-[56ch] text-muted">{p.summaryEn}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="screen screen--surface" aria-labelledby="other-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="other-h" className="t-h2">
              {t("otherTitle")}
            </h2>
          </div>
          <ul className="rows" role="list">
            {other.map((p) => (
              <li key={p.id}>
                <Link href={`/programmes/${p.slug}`} className="group grid gap-1 md:grid-cols-[1fr_2fr] md:gap-6">
                  <span className="serif text-[24px]">
                    <span className="uline group-hover:[background-size:100%_1px]">{p.nameEn}</span>
                  </span>
                  <span className="text-muted">{p.summaryEn}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Close title={t("closeTitle", { name: main[0]?.nameEn ?? "" })} lead={t("closeLead")} cta={tc("joinProgramme")} href="/join/student" />
    </>
  );
}
