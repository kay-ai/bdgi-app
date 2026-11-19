import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/current";
import { can, isStaff } from "@/server/permissions/can";

/** Console home. The tiles of spec/07 §1 arrive with M5; until then, the areas this person can open. */
export default async function ConsoleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff("/console");
  const t = await getTranslations("console");
  const areas = [
    { href: "/console/students", title: t("students"), lead: t("studentsLead"), show: can(actor, "intake.review") },
    { href: "/console/volunteers", title: t("volunteers"), lead: t("volunteersLead"), show: can(actor, "volunteer.view_applications") && isStaff(actor) },
    { href: "/console/schools", title: t("schools"), lead: t("schoolsLead"), show: can(actor, "school.view") && isStaff(actor) },
    { href: "/console/donations", title: t("donations"), lead: t("donationsLead"), show: can(actor, "donation.view") },
    { href: "/console/messages", title: t("messages"), lead: t("messagesLead"), show: can(actor, "user.manage") },
    { href: "/console/admin/users", title: t("users"), lead: t("usersLead"), show: can(actor, "user.manage") },
  ].filter((a) => a.show);
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      {areas.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {areas.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="card grid h-full gap-2 !p-6">
                <span className="t-h3">{a.title}</span>
                <span className="text-muted">{a.lead}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{t("nothingYet")}</p>
          <p className="text-muted">{t("nothingYetLead")}</p>
        </div>
      )}
    </>
  );
}
