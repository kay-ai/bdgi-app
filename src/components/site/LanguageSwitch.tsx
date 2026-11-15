"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** EN | Yorùbá switch, present on every face (spec/01 §9). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <span className={`inline-flex items-center gap-2 text-[14px] ${className}`}>
      <Link href={pathname} locale="en" className="uline" aria-current={locale === "en" ? "true" : undefined} hrefLang="en">
        EN
      </Link>
      <span aria-hidden="true" className="text-muted">
        |
      </span>
      <Link
        href={pathname}
        locale="yo"
        className="uline"
        aria-current={locale === "yo" ? "true" : undefined}
        hrefLang="yo"
        lang="yo"
      >
        Yorùbá
      </Link>
    </span>
  );
}
