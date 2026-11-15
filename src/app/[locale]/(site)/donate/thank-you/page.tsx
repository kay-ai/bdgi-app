import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { naira } from "@/lib/format";
import { getDonationByReference } from "@/server/services/donations";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function ThankYou({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("donate");
  const d = ref ? await getDonationByReference(ref) : null;
  return (
    <section className="screen">
      <div className="wrap">
        <div className="grid max-w-[640px] gap-6">
          <h1 className="t-h1">{t("thanksTitle")}</h1>
          {d?.status === "paid" ? (
            <p className="t-lead">{t("thanksLead", { amount: naira(d.amountMinor), reference: d.reference })}</p>
          ) : (
            <p className="t-lead">{t("thanksPending")}</p>
          )}
          <div>
            <Link href="/impact" className="link">
              {t("thanksLink")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
