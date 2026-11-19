import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { naira, usd } from "@/lib/format";
import { confirmDonation } from "@/server/services/donations";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("donate");
  return { title: t("thanksTitle"), robots: { index: false } };
}

/**
 * After checkout (spec/11 §2.2). The status comes from the database, settled by the webhook or by
 * asking Paystack here; the `ref` in the link alone never shows a gift as paid.
 */
export default async function ThankYou({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; reference?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("donate");
  const ref = sp.ref ?? sp.reference;
  const d = ref ? await confirmDonation(ref) : null;
  const amount = d ? (d.currency === "USD" ? usd(d.amountMinor) : naira(d.amountMinor)) : "";

  const state = !d ? "missing" : d.status === "paid" ? "paid" : d.status === "initiated" ? "pending" : "failed";

  return (
    <section className="screen">
      <div className="wrap">
        <div className="grid max-w-[640px] gap-6" role="status" aria-live="polite">
          {state === "paid" && (
            <>
              <h1 className="t-h1">{t("thanksTitle")}</h1>
              <p className="t-lead">{t("thanksLead", { amount, reference: d!.reference })}</p>
              {d!.frequency === "monthly" && <p className="text-muted">{t("thanksMonthly")}</p>}
              <div>
                <Link href="/impact" className="link">
                  {t("thanksLink")}
                </Link>
              </div>
            </>
          )}
          {state === "pending" && (
            <>
              <h1 className="t-h1">{t("pendingTitle")}</h1>
              <p className="t-lead">{t("thanksPending")}</p>
              <p className="text-muted">{t("pendingReference", { reference: d!.reference })}</p>
              <div>
                <Link href={`/donate/thank-you?ref=${encodeURIComponent(d!.reference)}`} className="link">
                  {t("pendingCheck")}
                </Link>
              </div>
            </>
          )}
          {(state === "failed" || state === "missing") && (
            <>
              <h1 className="t-h1">{t("failedTitle")}</h1>
              <p className="t-lead">{state === "failed" ? t("failedLead") : t("missingLead")}</p>
              <div>
                <Link href="/donate" className="btn btn--lg">
                  {t("tryAgain")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
