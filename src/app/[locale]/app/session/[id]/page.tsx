import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, MessageCircle, ShieldCheck, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Chip, Hero } from "@/components/coach/parts";
import { Attendance, EndSession } from "@/components/hub/Live";
import { VideoCall } from "@/components/hub/VideoCall";
import { requireActor } from "@/server/auth/current";
import { hasRole } from "@/server/permissions/can";
import { sessionRoom } from "@/server/services/sessions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live session" };

/**
 * A group session (D-025). While it is live the video call sits right here in the Hub; coaches also
 * get the attendance list and the End button. Coming in marks a student present.
 */
export default async function SessionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireActor(`/app/session/${id}`);
  const room = await sessionRoom(actor, id);
  if (!room) notFound();
  const t = await getTranslations("live");
  const format = await getFormatter();
  const home = hasRole(actor, "student") ? "/app" : "/app/volunteer";
  const when = format.dateTime(room.session.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

  return (
    <>
      <Link href={home} className="uline inline-flex w-fit items-center gap-2 text-[15px]">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>

      <Hero label={room.cohort.name}>
        <div className="flex flex-wrap items-center gap-2">
          {room.live ? (
            <Chip light>
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#d93025] opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#d93025]" />
              </span>
              {t("liveNow")}
            </Chip>
          ) : (
            <Chip>{t(`status.${room.session.status}` as "status.planned")}</Chip>
          )}
          <Chip>{room.cohort.school}</Chip>
        </div>
        <div className="grid gap-1">
          <h1 className="t-h2" style={{ color: "#fbf7ef" }}>
            {room.cohort.name}
          </h1>
          <p className="text-[#d8d1c4]">{when}</p>
        </div>
      </Hero>

      {room.live ? (
        room.joinUrl ? (
          <VideoCall joinUrl={room.joinUrl} title={t("videoTitle", { name: room.cohort.name })} />
        ) : (
          <div className="card grid place-items-center gap-3 !p-10 text-center">
            <Video size={36} aria-hidden="true" />
            <p className="font-medium">{room.provider === "none" ? t("noVideoTitle") : t("videoError")}</p>
            <p className="max-w-[46ch] text-muted">{room.provider === "none" ? t("noVideoLead") : t("videoErrorLead")}</p>
          </div>
        )
      ) : (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{room.session.status === "held" ? t("endedTitle") : t("notLiveTitle")}</p>
          <p className="text-muted">{room.session.status === "held" ? t("endedLead") : t("notLiveLead")}</p>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-[14px] bg-surface p-4 text-[15px]">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        {t("safety")}
      </p>

      {room.runs && (
        <section className="card grid gap-4 !p-6" aria-labelledby="att">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="att" className="t-h3">
              {t("attendanceTitle")}
            </h2>
            {room.live && <EndSession sessionId={room.session.id} />}
          </div>
          <Attendance
            sessionId={room.session.id}
            live={room.live}
            roster={room.roster.map((r) => ({ personId: r.personId, firstName: r.firstName, status: (r.status as "present" | "absent" | "excused" | null) ?? null }))}
          />
        </section>
      )}

      <Link href="/app/chat" className="uline inline-flex w-fit items-center gap-2">
        <MessageCircle size={18} aria-hidden="true" />
        {t("toChat")}
      </Link>
    </>
  );
}
