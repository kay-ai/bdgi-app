import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Recorder } from "@/components/coach/Recorder";
import { Blocked, requireStudent } from "@/components/coach/parts";
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
      <h1 className="t-h2">{t("placementTitle")}</h1>
      <p className="text-muted">{t("placementLead")}</p>
      <div className="grid gap-1">
        <span className="text-[14px] text-muted">
          {t("rec.motion")} · {t("rec.side")}: {t("practice.for")}
        </span>
        <p className="serif text-[22px] leading-snug">{PLACEMENT.motion}</p>
      </div>
      {e.ok ? (
        <Recorder kind="placement" side={PLACEMENT.side} targetSeconds={PLACEMENT.targetSeconds} maxSeconds={e.maxSeconds} minSeconds={e.minSeconds} title={t("placementTitle")} />
      ) : (
        <Blocked e={e} />
      )}
    </>
  );
}
