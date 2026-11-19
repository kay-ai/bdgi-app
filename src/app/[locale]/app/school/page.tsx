import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";

/** School champion home. Arrives with M4. */
export default async function SchoolHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/school");
  if (!hasRole(actor, "school_champion")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app/school" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{t("schoolTitle")}</p>
        <p className="text-muted">{t("schoolLead")}</p>
      </div>
    </>
  );
}
