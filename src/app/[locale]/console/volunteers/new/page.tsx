import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NewCoachForm } from "@/components/console/GroupForms";
import { requirePermission } from "@/server/auth/current";
import { can } from "@/server/permissions/can";
import { coachFormStates, listGroups } from "@/server/services/console-groups";

export const metadata = { title: "Add a coach" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

/** Staff add a coach directly, without the website application (D-021). */
export default async function NewCoachPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("volunteer.advance_stage", "/console/volunteers/new");
  const t = await getTranslations("console.groups");
  const sp = await searchParams;
  const group = typeof sp.group === "string" && /^[0-9a-f-]{36}$/.test(sp.group) ? sp.group : undefined;
  const [states, groups] = await Promise.all([
    coachFormStates(actor),
    can(actor, "cohort.manage") ? listGroups(actor).then((r) => r.rows.filter((g) => ["draft", "open", "running"].includes(g.status))) : Promise.resolve([]),
  ]);
  return (
    <>
      <div className="grid gap-2">
        <Link href={group ? `/console/groups/${group}` : "/console/volunteers"} className="uline w-fit text-[15px]">
          {group ? t("back") : t("backVolunteers")}
        </Link>
        <h1 className="t-h2">{t("c.title")}</h1>
        <p className="text-muted">{t("c.lead")}</p>
      </div>
      <NewCoachForm states={states} groups={groups.map((g) => ({ id: g.id, name: g.name, school: g.school }))} groupId={group} />
    </>
  );
}
