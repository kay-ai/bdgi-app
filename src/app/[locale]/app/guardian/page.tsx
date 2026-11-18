import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";

/** Guardian home. Children, consent and attendance arrive with M4. */
export default async function GuardianHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/guardian");
  if (!hasRole(actor, "guardian")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app/guardian" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{t("guardianTitle")}</p>
        <p className="text-muted">{t("guardianLead")}</p>
      </div>
    </>
  );
}
