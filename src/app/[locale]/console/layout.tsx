import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "@/components/site/Logo";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";
import { SignOutForm } from "@/components/SignOutForm";
import { requireStaff } from "@/server/auth/current";
import { can, hasRole, isStaff } from "@/server/permissions/can";
import { consoleNavCounts } from "@/server/services/console-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Console" };

/** Staff console shell (spec/07, DESIGN.md §10). Menu items are hidden when the actor lacks the permission. */
export default async function ConsoleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff("/console");
  const t = await getTranslations("console");
  const counts = await consoleNavCounts(actor);
  const waiting = (n: number) => t("waitingCount", { n });
  const items: (NavItem & { show: boolean })[] = [
    { href: "/console", label: t("home"), icon: "home", show: true },
    { href: "/console/students", label: t("students"), icon: "students", count: counts.students, countLabel: waiting(counts.students), show: can(actor, "intake.review") },
    { href: "/console/groups", label: t("groupsNav"), icon: "groups", show: can(actor, "cohort.manage") },
    {
      href: "/console/volunteers",
      label: t("volunteers"),
      icon: "volunteers",
      count: counts.volunteers,
      countLabel: waiting(counts.volunteers),
      show: can(actor, "volunteer.view_applications") && isStaff(actor),
    },
    { href: "/console/schools", label: t("schools"), icon: "schools", count: counts.schools, countLabel: waiting(counts.schools), show: can(actor, "school.view") && isStaff(actor) },
    { href: "/console/donations", label: t("donations"), icon: "donations", show: can(actor, "donation.view") },
    { href: "/console/messages", label: t("messages"), icon: "messages", show: can(actor, "user.manage") },
    { href: "/console/ai", label: t("aiCoach"), icon: "ai", show: can(actor, "ai.settings") },
    { href: "/console/admin/users", label: t("users"), icon: "users", show: can(actor, "user.manage") },
  ];

  const brand = (
    <Link href="/console" className="flex items-center gap-2 font-medium">
      <LogoMark className="h-7 w-7" />
      <span>{t("title")}</span>
    </Link>
  );
  const footer = (
    <div className="grid gap-3 px-3 text-[14px]">
      <div className="flex items-center gap-3">
        <span className="console-me" aria-hidden="true">
          {actor.firstName.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 truncate font-medium">{actor.firstName}</span>
      </div>
      {hasRole(actor, "volunteer") && (
        <Link href="/app/volunteer" className="uline w-fit">
          {t("toHub")}
        </Link>
      )}
      <SignOutForm locale={locale} className="console-signout">
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        {t("signOut")}
      </SignOutForm>
    </div>
  );

  return (
    <ConsoleShell
      brand={brand}
      footer={footer}
      items={items.filter((i) => i.show).map(({ show: _, ...i }) => i)}
      labels={{ nav: t("nav"), open: t("menuOpen"), close: t("menuClose"), skip: t("skip") }}
    >
      {children}
    </ConsoleShell>
  );
}
