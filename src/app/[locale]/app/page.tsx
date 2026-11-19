import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { profileComplete } from "@/server/services/student-profile";

/** Student home. The speech coach comes first; sessions and badges arrive with M6. */
export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app");
  if (!hasRole(actor, "student")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  const complete = await profileComplete(actor.personId);
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      {!complete && (
        // D-019: sign-up asks only the essentials; the rest is asked here.
        <Link href="/app/profile" className="card grid gap-2 border-2 border-[#FFB800] !p-6">
          <span className="t-h3">{t("finishTitle")}</span>
          <span className="text-muted">{t("finishLead")}</span>
          <span className="font-medium">{t("finishOpen")} →</span>
        </Link>
      )}
      <div className="card grid gap-2 !p-6">
        <p className="font-medium">{t("studentTitle")}</p>
        <p className="text-muted">{t("studentLead")}</p>
      </div>
      <Link href="/app/coach" className="card grid gap-2 !p-6">
        <span className="t-h3">{t("coachTitle")}</span>
        <span className="text-muted">{t("coachLead")}</span>
        <span className="font-medium">{t("coachOpen")} →</span>
      </Link>
    </>
  );
}
