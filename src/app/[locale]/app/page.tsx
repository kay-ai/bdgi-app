import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";

/** Student home. Practice, badges and sessions arrive with M4. */
export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app");
  if (!hasRole(actor, "student")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{t("studentTitle")}</p>
        <p className="text-muted">{t("studentLead")}</p>
      </div>
    </>
  );
}
