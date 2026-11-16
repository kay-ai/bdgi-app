import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatDate, naira, usd } from "@/lib/format";
import { verifyReceipt } from "@/server/services/receipts";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("donate");
  return { title: t("verifyTitle"), robots: { index: false } };
}

/** Public receipt check (spec/11 §2.5): date, amount and "valid" only. No names. */
export default async function VerifyReceipt({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("donate");
  const r = await verifyReceipt(code.toUpperCase());
  return (
    <section className="screen">
      <div className="wrap">
        <div className="grid max-w-[640px] gap-6">
          <h1 className="t-h2">{t("verifyTitle")}</h1>
          {r ? (
            <div className="card grid gap-4">
              <p>
                <span className={`badge ${r.valid ? "badge--paid" : "badge--refunded"}`}>
                  {r.valid ? t("verifyValid") : t("verifyRefunded")}
                </span>
              </p>
              <dl className="grid gap-3">
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-muted">{t("verifyCode")}</dt>
                  <dd className="font-medium tabular">{code.toUpperCase()}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-muted">{t("verifyDate")}</dt>
                  <dd className="font-medium">{formatDate(r.paidAt, locale)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-muted">{t("verifyAmount")}</dt>
                  <dd className="font-medium tabular">{r.currency === "USD" ? usd(r.amountMinor) : naira(r.amountMinor)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="t-lead" role="alert">
              {t("verifyNotFound")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
