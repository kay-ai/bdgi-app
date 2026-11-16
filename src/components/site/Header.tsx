"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Photo } from "./Photo";
import { Logo } from "./Logo";
import { LanguageSwitch } from "./LanguageSwitch";
import type { PhotoKey } from "@/content/photos";

export type NavProgramme = { slug: string; name: string; line: string };

type MenuLink = { href: string; title: string; line: string };
type Panel = {
  key: "about" | "programmes" | "getInvolved";
  href: string;
  label: string;
  columns: MenuLink[][];
  card: { href: string; photo: PhotoKey; title: string; line: string };
};

/**
 * nav-mega (tasteskill): logo left, four words, the main action right. Three words open a flat,
 * full-width panel after 150ms of hover intent (link columns and one picture card); a click on
 * the word goes to its page. Opaque, one hairline, the same at every scroll depth.
 */
export function Header({ programmes }: { programmes: NavProgramme[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<Panel["key"] | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSheet(false);
    setOpen(null);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const m = (k: string) => t(`nav.mega.${k}`);
  const panels: Panel[] = [
    {
      key: "about",
      href: "/about",
      label: t("nav.about"),
      columns: [
        [
          { href: "/about", title: m("aboutUs"), line: m("aboutUsLine") },
          { href: "/about/team", title: m("team"), line: m("teamLine") },
          { href: "/faq", title: m("faq"), line: m("faqLine") },
        ],
        [
          { href: "/stories", title: m("stories"), line: m("storiesLine") },
          { href: "/events", title: m("events"), line: m("eventsLine") },
        ],
      ],
      card: { href: "/about/team", photo: "volunteersYellow", title: m("team"), line: m("teamLine") },
    },
    {
      key: "programmes",
      href: "/programmes",
      label: t("nav.programmes"),
      columns: [
        programmes.slice(0, 2).map((p) => ({ href: `/programmes/${p.slug}`, title: p.name, line: p.line })),
        [
          ...programmes.slice(2, 4).map((p) => ({ href: `/programmes/${p.slug}`, title: p.name, line: p.line })),
          { href: "/programmes", title: m("allProgrammes"), line: m("allProgrammesLine") },
        ],
      ],
      card: { href: "/join/student", photo: "speakers", title: m("joinStudent"), line: m("cardLabel") },
    },
    {
      key: "getInvolved",
      href: "/get-involved",
      label: t("nav.getInvolved"),
      columns: [
        [
          { href: "/join/student", title: m("joinStudent"), line: m("joinStudentLine") },
          { href: "/join/volunteer", title: m("volunteer"), line: m("volunteerLine") },
          { href: "/join/school", title: m("school"), line: m("schoolLine") },
        ],
        [
          { href: "/partner", title: m("partner"), line: m("partnerLine") },
          { href: "/donate", title: m("donate"), line: m("donateLine") },
        ],
      ],
      card: { href: "/join/volunteer", photo: "volunteersSmiling", title: m("volunteer"), line: m("volunteerLine") },
    },
  ];

  const intent = (key: Panel["key"] | null, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(key), delay);
  };
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);
  const active = panels.find((p) => p.key === open);

  return (
    <header className="site-header" onMouseLeave={() => intent(null, 120)}>
      <div className="wrap site-header__bar">
        <Link href="/" className="logo">
          <Logo label={t("meta.siteName")} />
        </Link>
        <nav className="site-header__nav" aria-label="Main">
          {panels.slice(0, 2).map((p) => (
            <NavWord key={p.key} panel={p} open={open === p.key} current={current(p.href)} intent={intent} toggle={setOpen} />
          ))}
          <div className="nav-item" onMouseEnter={() => intent(null, 150)}>
            <Link href="/impact" className="uline" aria-current={current("/impact")}>
              {t("nav.impact")}
            </Link>
          </div>
          <NavWord panel={panels[2]!} open={open === "getInvolved"} current={current("/get-involved")} intent={intent} toggle={setOpen} />
        </nav>
        <div className="site-header__end" onMouseEnter={() => intent(null, 150)}>
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
            aria-expanded={sheet}
            aria-controls="menu-panel"
            aria-label={sheet ? t("common.close") : t("common.menu")}
            onClick={() => setSheet((o) => !o)}
          >
            {sheet ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {active && (
        <div className="mega" id={`mega-${active.key}`} onMouseEnter={() => intent(active.key, 0)}>
          <div className="wrap mega__grid">
            {active.columns.map((col, i) => (
              <div key={i} className="mega__col">
                {i === 0 && <p className="t-label">{m(active.key === "getInvolved" ? "involved" : active.key)}</p>}
                {i > 0 && <p className="t-label" aria-hidden="true">&nbsp;</p>}
                {col.map((l) => (
                  <Link key={l.href} href={l.href} className="mega__link">
                    <strong>{l.title}</strong>
                    <span>{l.line}</span>
                  </Link>
                ))}
              </div>
            ))}
            <Link href={active.card.href} className="mega__card">
              <div className="frame">
                <Photo slot={active.card.photo} alt="" sizes="320px" />
              </div>
              <strong>{active.card.title}</strong>
              <span>{active.card.line}</span>
            </Link>
          </div>
        </div>
      )}

      {sheet && (
        <div id="menu-panel" className="menu-panel">
          <nav aria-label="Main">
            {panels.map((p) => (
              <details key={p.key}>
                <summary className="menu-panel__item">
                  {p.label}
                  <ChevronDown size={22} strokeWidth={1.5} aria-hidden="true" />
                </summary>
                <Link href={p.href} className="menu-panel__sub">
                  {p.label}
                </Link>
                {p.columns.flat().map((l) => (
                  <Link key={l.href} href={l.href} className="menu-panel__sub">
                    {l.title}
                  </Link>
                ))}
              </details>
            ))}
            <Link href="/impact" className="menu-panel__item">
              {t("nav.impact")}
            </Link>
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

function NavWord({
  panel,
  open,
  current,
  intent,
  toggle,
}: {
  panel: Panel;
  open: boolean;
  current?: "page";
  intent: (key: Panel["key"] | null, delay: number) => void;
  toggle: (key: Panel["key"] | null) => void;
}) {
  return (
    <div className="nav-item" onMouseEnter={() => intent(panel.key, 150)}>
      <Link href={panel.href} className="uline" aria-current={current}>
        {panel.label}
      </Link>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`mega-${panel.key}`}
        aria-label={panel.label}
        onClick={() => toggle(open ? null : panel.key)}
        className="ml-1 inline-flex h-11 w-6 items-center justify-center"
      >
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
