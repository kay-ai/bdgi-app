import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Link } from "@/i18n/navigation";
import { Journey } from "@/components/site/journey/Journey";
import { getSettings } from "@/server/services/public";

// Footer and contact details come from settings; refresh them every five minutes.
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  const st = await getSettings(["org_phone", "org_email", "org_city"]);
  return (
    <div className="has-phone-bar-wrap">
      <a href="#main" className="skip-link">
        {t("skip")}
      </a>
      <Journey />
      <Header />
      <main id="main">{children}</main>
      <Footer phone={String(st.org_phone ?? "")} email={String(st.org_email ?? "")} city={String(st.org_city ?? "")} />
      <div className="phone-bar">
        <Link href="/join" className="btn">
          {t("joinProgramme")}
        </Link>
        <Link href="/donate" className="link link--bare">
          {t("donate")}
        </Link>
      </div>
    </div>
  );
}
