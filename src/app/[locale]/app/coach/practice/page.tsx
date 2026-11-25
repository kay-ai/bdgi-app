import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PracticePicker } from "@/components/coach/CoachClient";
import { Blocked, requireStudent } from "@/components/coach/parts";
import { eligibility, motionsFor } from "@/server/services/speech";

// Personal to the signed-in student: never pre-rendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coach");
  return { title: t("freeTitle") };
}

/** Free practice on any motion (spec/12 §2 step 1). `?motion=&side=` pre-selects, for "Try the other side". */
export default async function Practice({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ motion?: string; side?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStudent("/app/coach/practice");
  const t = await getTranslations("coach");
  const sp = await searchParams;
  const [e, motions] = await Promise.all([eligibility(actor.personId), motionsFor()]);
  const side = sp.side === "against" || sp.side === "open" || sp.side === "for" ? sp.side : undefined;
  return (
    <>
      <Link href="/app/coach" className="uline justify-self-start text-[15px]">
        {t("back")}
      </Link>
      <div className="grid gap-1">
        <h1 className="t-h2">{t("freeTitle")}</h1>
        <p className="text-muted">{t("home.freeShort")}</p>
      </div>
      {e.ok ? (
        <PracticePicker motions={motions.map((m) => ({ id: m.id, text: m.text }))} initialMotion={sp.motion} initialSide={side} maxSeconds={e.maxSeconds} minSeconds={e.minSeconds} />
      ) : (
        <Blocked e={e} />
      )}
    </>
  );
}
