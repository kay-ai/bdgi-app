import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GroupForm } from "@/components/console/GroupForms";
import { requirePermission } from "@/server/auth/current";
import { groupFormOptions } from "@/server/services/console-groups";

export const metadata = { title: "New group" };
export const dynamic = "force-dynamic";

export default async function NewGroupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("cohort.manage", "/console/groups/new");
  const t = await getTranslations("console.groups");
  const { programmes, schools } = await groupFormOptions(actor);
  return (
    <>
      <div className="grid gap-2">
        <Link href="/console/groups" className="uline w-fit text-[15px]">
          {t("back")}
        </Link>
        <h1 className="t-h2">{t("newTitle")}</h1>
        <p className="text-muted">{t("newLead")}</p>
      </div>
      {schools.length === 0 ? <div className="card !p-6 text-muted">{t("noSchools")}</div> : <GroupForm programmes={programmes} schools={schools} />}
    </>
  );
}
