import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";

/** Volunteer home. Cohorts and attendance arrive with M4. */
export default async function VolunteerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/volunteer");
  if (!hasRole(actor, "volunteer")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app/volunteer" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{t("volunteerTitle")}</p>
        <p className="text-muted">{t("volunteerLead")}</p>
      </div>
    </>
  );
}
