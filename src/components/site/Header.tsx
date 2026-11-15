"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { LanguageSwitch } from "./LanguageSwitch";

const NAV = [
  { href: "/about", key: "about" },
  { href: "/programmes", key: "programmes" },
  { href: "/impact", key: "impact" },
  { href: "/stories", key: "stories" },
  { href: "/get-involved", key: "getInvolved" },
] as const;

/** nav-centre: logo left, links centred, actions right. Opaque at every scroll depth. */
export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className="wrap site-header__bar">
        <Link href="/" className="logo">
          <Logo label={t("meta.siteName")} />
        </Link>
        <nav className="site-header__nav" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="uline"
              aria-current={pathname.startsWith(n.href) ? "page" : undefined}
            >
              {t(`nav.${n.key}`)}
            </Link>
          ))}
        </nav>
        <div className="site-header__end">
          <LanguageSwitch className="hide-md" />
          <Link href="/donate" className="uline hide-md">
            {t("common.donate")}
          </Link>
          <Link href="/join" className="btn btn--plain hide-md">
            {t("common.joinProgramme")}
          </Link>
          <button
            type="button"
            className="site-header__toggle"
            aria-expanded={open}
            aria-controls="menu-panel"
            aria-label={open ? t("common.close") : t("common.menu")}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>
        </div>
      </div>
      {open && (
        <div id="menu-panel" className="menu-panel">
          <nav aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="menu-panel__item">
                {t(`nav.${n.key}`)}
              </Link>
            ))}
            <Link href="/donate" className="menu-panel__item">
              {t("common.donate")}
            </Link>
          </nav>
          <div className="mt-8 grid gap-6">
            <Link href="/join" className="btn btn--lg btn--block">
              {t("common.joinProgramme")}
            </Link>
            <LanguageSwitch />
          </div>
        </div>
      )}
    </header>
  );
}
