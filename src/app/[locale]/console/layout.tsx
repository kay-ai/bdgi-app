import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/actions/auth";
import { requireStaff } from "@/server/auth/current";
import { can, hasRole, isStaff } from "@/server/permissions/can";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Console" };

/** Staff console shell (spec/07). Menu items are hidden when the actor lacks the permission. */
export default async function ConsoleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff("/console");
  const t = await getTranslations("console");
  const items = [
    { href: "/console/students", label: t("students"), show: can(actor, "intake.review") },
    { href: "/console/volunteers", label: t("volunteers"), show: can(actor, "volunteer.view_applications") && isStaff(actor) },
    { href: "/console/schools", label: t("schools"), show: can(actor, "school.view") && isStaff(actor) },
    { href: "/console/donations", label: t("donations"), show: can(actor, "donation.view") },
    { href: "/console/messages", label: t("messages"), show: can(actor, "user.manage") },
    { href: "/console/admin/users", label: t("users"), show: can(actor, "user.manage") },
  ].filter((i) => i.show);

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#console-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 btn btn--plain">
        {t("skip")}
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/console" className="font-medium">
            {t("title")}
          </Link>
          <nav aria-label={t("nav")} className="flex flex-wrap gap-4 text-[15px]">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="uline">
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-[15px]">
            {hasRole(actor, "volunteer") && (
              <Link href="/app/volunteer" className="uline">
                {t("toHub")}
              </Link>
            )}
            <span className="text-muted">{actor.firstName}</span>
            <form action={signOutAction}>
              <button type="submit" className="uline">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="console-main" className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
