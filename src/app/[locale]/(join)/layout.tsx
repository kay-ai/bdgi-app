import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/site/Logo";
import { LanguageSwitch } from "@/components/site/LanguageSwitch";

/** One shell for every join flow: logo, language switch, a way out (spec/05). */
export default async function JoinLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="min-h-svh bg-bg">
      <header className="site-header">
        <div className="mx-auto flex h-full max-w-[720px] items-center justify-between gap-4 px-4">
          <Link href="/" className="logo">
            <Logo label={t("meta.siteName")} height={36} />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitch />
            <Link href="/" className="inline-flex h-11 w-11 items-center justify-center" aria-label={t("join.shell.exit")}>
              <X size={22} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[720px] px-4 pb-32 pt-8">
        {children}
      </main>
    </div>
  );
}
