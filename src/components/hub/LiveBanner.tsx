import { getLocale, getTranslations } from "next-intl/server";
import { Video } from "lucide-react";
import { sessionHref } from "@/i18n/navigation";
import { GOLD } from "@/components/coach/parts";

/**
 * Shown at the top of the student Hub while her group's session is live (D-025): one big pulsing
 * gold button to join. The pulse stops for people who ask for less motion.
 */
export async function LiveBanner({ live }: { live: { id: string; cohortName: string } }) {
  const t = await getTranslations("live");
  const locale = await getLocale();
  return (
    <section className="on-dark grid gap-4 rounded-[28px] p-6 sm:flex sm:items-center sm:justify-between" style={{ background: "#1a1712", color: "#fbf7ef" }} aria-labelledby="live-now">
      <div className="grid gap-1">
        <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff5a4e] opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a4e]" />
          </span>
          {t("liveNow")}
        </span>
        <h2 id="live-now" className="t-h3" style={{ color: "#fbf7ef" }}>
          {t("bannerTitle", { name: live.cohortName })}
        </h2>
      </div>
      <a href={sessionHref(live.id, locale)} className="btn btn--gold btn--plain btn--lg live-pulse w-full sm:w-auto">
        <Video size={20} aria-hidden="true" />
        {t("join")}
      </a>
    </section>
  );
}
