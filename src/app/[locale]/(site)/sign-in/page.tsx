import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("title"), robots: { index: false } };
}

/** Placeholder until the Hub's phone-code sign-in ships (spec/03, milestone M3). */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signIn");
  return (
    <section className="screen" aria-labelledby="si-h">
      <div className="wrap justify-center">
        <div className="grid max-w-[640px] gap-8">
          <h1 id="si-h" className="t-h1">
            {t("title")}
          </h1>
          <p className="t-lead text-muted">{t("lead")}</p>
          <ul className="rows" role="list">
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("student")}</span>
              <Link href="/join/student" className="link">
                {t("studentCta")}
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("volunteer")}</span>
              <Link href="/join/volunteer" className="link">
                {t("volunteerCta")}
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("help")}</span>
              <Link href="/contact" className="link">
                {t("helpCta")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
