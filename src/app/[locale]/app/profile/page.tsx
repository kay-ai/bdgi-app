import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ContactDetails } from "@/components/hub/ContactDetails";
import { StudentProfileForm } from "@/components/hub/StudentProfileForm";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { profileFor } from "@/server/services/student-profile";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

/** Her profile (D-019): the questions sign-up no longer asks, and her contact emails. */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/profile");
  if (!hasRole(actor, "student")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub.profile");
  const p = await profileFor(actor);
  if (!p) redirect("/sign-in/no-access");
  return (
    <>
      <Link href="/app" className="uline justify-self-start text-[15px]">
        {t("back")}
      </Link>
      <p className="sr-only">{p.complete ? t("leadDone") : t("lead")}</p>
      <StudentProfileForm locale={locale} firstName={actor.firstName} initial={{ avatarKey: p.avatarKey, dreams: p.dreams, help: p.help, checkin: p.checkin }} />
      <ContactDetails locale={locale} email={p.email} isAdult={p.isAdult} guardian={p.guardian} />
    </>
  );
}
