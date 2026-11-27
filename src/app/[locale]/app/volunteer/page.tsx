import { redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarClock, MessageCircle, Users, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { CoachSupervision } from "@/components/hub/CoachSupervision";
import { QuickAddSession, StartSession } from "@/components/hub/Live";
import { GOLD } from "@/components/coach/parts";
import { supervision } from "@/server/services/coach-supervision";
import { coachSessions } from "@/server/services/sessions";

/**
 * Volunteer home: each of her groups with its next session (start it, or join it while live) and
 * its chat (D-025), then supervising the AI speech coach for her students (D-015).
 */
export const dynamic = "force-dynamic";

export default async function VolunteerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/volunteer");
  if (!hasRole(actor, "volunteer")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app/volunteer" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  const tl = await getTranslations("live");
  const format = await getFormatter();
  const [groups, mine] = await Promise.all([supervision(actor), coachSessions(actor)]);
  const when = (d: Date) => format.dateTime(d, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      {mine.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{t("volunteerTitle")}</p>
          <p className="text-muted">{t("volunteerLead")}</p>
        </div>
      ) : (
        <section className="grid gap-3" aria-labelledby="my-groups">
          <h2 id="my-groups" className="t-h3">
            {tl("groupsTitle")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2" role="list">
            {mine.map((g) => (
              <li
                key={g.id}
                className={`grid gap-4 rounded-[24px] p-5 ${g.live ? "on-dark" : "card"}`}
                style={g.live ? { background: "#1a1712", color: "#fbf7ef" } : undefined}
              >
                <div className="grid gap-1">
                  {g.live && (
                    <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
                      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff5a4e] opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a4e]" />
                      </span>
                      {tl("liveNow")}
                    </span>
                  )}
                  <h3 className="text-[20px] font-semibold">{g.name}</h3>
                  <p className={`flex items-center gap-2 text-[14px] ${g.live ? "text-[#d8d1c4]" : "text-muted"}`}>
                    <Users size={16} aria-hidden="true" />
                    {g.school} · {tl("students", { n: g.students })}
                  </p>
                </div>
                {g.live ? (
                  <Link href={`/app/session/${g.live.id}`} className="btn btn--gold btn--plain">
                    <Video size={18} aria-hidden="true" />
                    {tl("rejoin")}
                  </Link>
                ) : g.next ? (
                  <div className="grid gap-3">
                    <p className="flex items-center gap-2 text-[15px] font-medium">
                      <CalendarClock size={18} aria-hidden="true" />
                      {tl("next", { when: when(g.next.startsAt) })}
                    </p>
                    {g.next.canStart ? <StartSession sessionId={g.next.id} /> : <p className="text-[14px] text-muted">{tl("startHint")}</p>}
                  </div>
                ) : (
                  <p className="text-[14px] text-muted">{tl("noneScheduled")}</p>
                )}
                {!g.live && g.status !== "completed" && g.status !== "cancelled" && <QuickAddSession cohortId={g.id} offerStartNow={!g.next?.canStart} />}
                <Link href="/app/chat" className="uline inline-flex w-fit items-center gap-2 text-[15px]">
                  <MessageCircle size={18} aria-hidden="true" />
                  {tl("groupChat")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CoachSupervision groups={groups} />
    </>
  );
}
