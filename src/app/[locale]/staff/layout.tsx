import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/site/Logo";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** A plain shell for staff sign-in: logo, one card, nothing else to click. */
export default async function StaffAuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="min-h-svh bg-bg">
      <header className="site-header">
        <div className="join-bar mx-auto flex max-w-[560px] items-center justify-between gap-4">
          <Link href="/" className="logo">
            <Logo label={t("meta.siteName")} height={36} />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-[560px] gap-6 px-4 pb-24 pt-8">
        {children}
      </main>
    </div>
  );
}
