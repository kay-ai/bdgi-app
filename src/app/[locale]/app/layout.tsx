import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/site/Logo";
import { SignOutForm } from "@/components/SignOutForm";
import { currentSession, requireActor } from "@/server/auth/current";
import { profilesForUser } from "@/server/auth/sessions";
import { isStaff } from "@/server/permissions/can";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hub");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The Hub shell (spec/04): who is signed in, a way to switch profile, sign out. */
export default async function HubLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app");
  const row = await currentSession();
  const profiles = row ? await profilesForUser(row.user.id) : [];
  const me = profiles.find((p) => p.personId === actor.personId);
  const t = await getTranslations();
  return (
    <div className="min-h-svh bg-bg">
      <a href="#hub-main" className="skip-link">
        {t("common.skip")}
      </a>
      <header className="site-header">
        <div className="join-bar mx-auto flex max-w-[960px] items-center justify-between gap-4">
          <Link href="/app" className="logo">
            <Logo label={t("meta.siteName")} height={32} />
          </Link>
          <div className="flex items-center gap-4 text-[15px]">
            {isStaff(actor) && (
              <Link href="/console" className="uline">
                {t("hub.toConsole")}
              </Link>
            )}
            {profiles.length > 1 ? (
              <Link href="/sign-in/who" className="flex items-center gap-2 uline" aria-label={t("hub.switchProfile", { name: actor.firstName })}>
                {me && <Avatar avatarKey={me.avatarKey} size={32} />}
                <span>{actor.firstName}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                {me && <Avatar avatarKey={me.avatarKey} size={32} />}
                <span>{actor.firstName}</span>
              </span>
            )}
            <SignOutForm locale={locale} className="uline">
              {t("hub.signOut")}
            </SignOutForm>
          </div>
        </div>
      </header>
      <main id="hub-main" className="mx-auto grid max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-24 pt-8">
        {children}
      </main>
    </div>
  );
}
