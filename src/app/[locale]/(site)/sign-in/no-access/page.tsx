import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/actions/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("noAccessTitle"), robots: { index: false } };
}

/** Signed in, but this page is not part of what the person can do. */
export default async function NoAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signIn");
  return (
    <section className="screen" aria-labelledby="sn-h">
      <div className="wrap justify-center">
        <div className="grid w-full max-w-[520px] gap-6">
          <h1 id="sn-h" className="t-h1">
            {t("noAccessTitle")}
          </h1>
          <p className="t-lead text-muted">{t("noAccessLead")}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/app" className="btn">
              {t("toHome")}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="btn btn--plain">
                {t("signOutSwitch")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
