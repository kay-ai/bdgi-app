import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { setRequestLocale } from "next-intl/server";
import { db, schema as s } from "@/db";
import { LiveBanner } from "@/components/hub/LiveBanner";
import { Badges, FinishProfile, GroupCard, HubHero, StatTiles } from "@/components/hub/StudentProgress";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { liveSessionFor, nextSessionFor } from "@/server/services/sessions";
import { eligibility } from "@/server/services/speech";
import { profileComplete } from "@/server/services/student-profile";
import { studentGroups, studentProgress } from "@/server/services/student-progress";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

/** Student home (spec/06 §1.1): her rank and one button to practise, her stats, badges and group. */
export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app");
  if (!hasRole(actor, "student")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app" ? "/sign-in/no-access" : home);
  }
  const [complete, progress, groups, elig, [me], live] = await Promise.all([
    profileComplete(actor.personId),
    studentProgress(actor.personId),
    studentGroups(actor.personId),
    eligibility(actor.personId),
    db.select({ status: s.person.status, avatarKey: s.person.avatarKey }).from(s.person).where(eq(s.person.id, actor.personId)),
    liveSessionFor(actor.personId),
  ]);
  const group = groups.find((g) => g.current) ?? null;
  const next = group && !live ? await nextSessionFor(group.id) : null;
  return (
    <>
      {/* D-025: a live session comes first, with a pulsing button to join. */}
      {live && <LiveBanner live={live} />}
      <HubHero name={actor.firstName} avatarKey={me?.avatarKey ?? null} p={progress} canPractise={elig.ok} />
      {/* D-019: sign-up asks only the essentials; the rest is asked here. */}
      {!complete && <FinishProfile />}
      <StatTiles p={progress} />
      <Badges p={progress} />
      <GroupCard group={group} status={me?.status ?? "active"} next={next?.startsAt ?? null} />
    </>
  );
}
