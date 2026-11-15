import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/site/Logo";
import { NotFoundView } from "@/components/site/NotFoundView";

/** Fallback for notFound() thrown outside the site group (bad locale, missing story). */
export default async function NotFound() {
  const t = await getTranslations("meta");
  return (
    <>
      <header className="site-header">
        <div className="wrap site-header__bar">
          <Link href="/" className="logo">
            <Logo label={t("siteName")} />
          </Link>
        </div>
      </header>
      <main id="main">
        <NotFoundView />
      </main>
    </>
  );
}
