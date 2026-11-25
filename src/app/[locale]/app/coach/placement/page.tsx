import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Recorder } from "@/components/coach/Recorder";
import { Blocked, Chip, Hero, requireStudent } from "@/components/coach/parts";
import { PLACEMENT } from "@/server/coach/curriculum";
import { eligibility } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coach");
  return { title: t("placementTitle") };
}

/** The first speech: two minutes on a starter motion. It rates every skill and builds the path. */
export default async function Placement({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStudent("/app/coach/placement");
  const t = await getTranslations("coach");
  const e = await eligibility(actor.personId);
  return (
    <>
      <Link href="/app/coach" className="uline justify-self-start text-[15px]">
        {t("back")}
      </Link>
      <Hero label={t("placementTitle")}>
        <div className="grid gap-2">
          <h1 className="t-h2" style={{ color: "inherit" }}>
            {t("placementTitle")}
          </h1>
          <p style={{ color: "#b9b3a8" }}>{t("home.placementShort")}</p>
        </div>
        <div className="grid gap-3 rounded-[20px] p-5" style={{ background: "#26221c" }}>
          <div className="flex flex-wrap gap-2">
            <Chip>{t("practice.for")}</Chip>
            <Chip>{t("lesson.aim", { time: `${Math.floor(PLACEMENT.targetSeconds / 60)}:${String(PLACEMENT.targetSeconds % 60).padStart(2, "0")}` })}</Chip>
          </div>
          <p className="serif text-[24px] leading-snug">{PLACEMENT.motion}</p>
        </div>
      </Hero>
      {e.ok ? (
        <Recorder kind="placement" side={PLACEMENT.side} targetSeconds={PLACEMENT.targetSeconds} maxSeconds={e.maxSeconds} minSeconds={e.minSeconds} title={t("placementTitle")} />
      ) : (
        <Blocked e={e} />
      )}
    </>
  );
}
