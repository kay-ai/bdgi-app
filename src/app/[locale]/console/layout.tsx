import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { consoleAllowed } from "@/server/services/console-access";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Console" };

/** Staff console shell (spec/07). Only Donations exists so far; see DECISIONS.md D-012 for access. */
export default async function ConsoleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!consoleAllowed("donation.view")) notFound();
  const t = await getTranslations("console");
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#console-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 btn btn--plain">
        {t("skip")}
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/console/donations" className="font-medium">
            {t("title")}
          </Link>
          <nav aria-label={t("nav")} className="flex gap-4 text-[15px]">
            <Link href="/console/donations" className="uline">
              {t("donations")}
            </Link>
          </nav>
          <span className="badge badge--initiated ml-auto">{t("devOnly")}</span>
        </div>
      </header>
      <main id="console-main" className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
