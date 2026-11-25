import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db, schema as s } from "@/db";
import { Badges, GroupCard, ProgressCard } from "@/components/hub/StudentProgress";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { eligibility } from "@/server/services/speech";
import { profileComplete } from "@/server/services/student-profile";
import { studentGroups, studentProgress } from "@/server/services/student-progress";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

/** Student home (spec/06 §1.1): her group, her own progress and badges, and the speech coach. */
export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app");
  if (!hasRole(actor, "student")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  const [complete, progress, groups, elig, [me]] = await Promise.all([
    profileComplete(actor.personId),
    studentProgress(actor.personId),
    studentGroups(actor.personId),
    eligibility(actor.personId),
    db.select({ status: s.person.status }).from(s.person).where(eq(s.person.id, actor.personId)),
  ]);
  const group = groups.find((g) => g.current) ?? null;
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
      <GroupCard group={group} status={me?.status ?? "active"} />
      <ProgressCard p={progress} canPractise={elig.ok} />
      <Link href="/app/coach" className="card grid gap-2 !p-6">
        <span className="t-h3">{t("coachTitle")}</span>
        <span className="text-muted">{t("coachLead")}</span>
        <span className="font-medium">{t("coachOpen")} →</span>
      </Link>
      <Badges badges={progress.badges} />
    </>
  );
}
