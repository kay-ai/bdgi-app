"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GraduationCap, HandCoins, HandHeart, LayoutDashboard, Menu, MessageSquareText, Mic, School, Users, UsersRound, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const ICONS = {
  home: LayoutDashboard,
  students: GraduationCap,
  groups: Users,
  volunteers: HandHeart,
  schools: School,
  donations: HandCoins,
  messages: MessageSquareText,
  ai: Mic,
  users: UsersRound,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number; countLabel?: string };

/**
 * Console frame (DESIGN.md §10): a 240px sidebar on the surface colour with a gold bar on the
 * active item, and a white working area. Below 1024px the sidebar becomes a drawer.
 */
export function ConsoleShell({
  brand,
  items,
  footer,
  labels,
  children,
}: {
  brand: ReactNode;
  items: NavItem[];
  footer: ReactNode;
  labels: { nav: string; open: string; close: string; skip: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/console" ? pathname === "/console" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav aria-label={labels.nav} className="grid gap-1">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const on = active(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`console-nav__item${on ? " is-active" : ""}`}>
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">{i.label}</span>
            {!!i.count && (
              <span className="console-nav__count tabular" aria-label={i.countLabel}>
                {i.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="console">
      <a href="#console-main" className="btn btn--plain sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30">
        {labels.skip}
      </a>
      <aside className="console__side">
        <div className="px-3 pb-6 pt-1">{brand}</div>
        {nav}
        <div className="mt-auto pt-6">{footer}</div>
      </aside>

      <header className="console__top">
        {brand}
        <button type="button" className="console__menu" aria-expanded={open} aria-controls="console-drawer" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className="sr-only">{open ? labels.close : labels.open}</span>
        </button>
      </header>
      {open && (
        <div id="console-drawer" className="console__drawer">
          {nav}
          <div className="mt-6 border-t border-line pt-4">{footer}</div>
        </div>
      )}

      <main id="console-main" className="console__main">
        {children}
      </main>
    </div>
  );
}
