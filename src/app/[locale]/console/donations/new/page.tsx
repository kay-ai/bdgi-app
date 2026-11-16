import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OfflineGiftForm } from "@/components/console/OfflineGiftForm";
import { designatedProgrammes } from "@/server/services/console-donations";
import { consoleCtx } from "@/server/services/console-access";

export default async function NewOfflineGift({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  consoleCtx("donation.manage");
  const t = await getTranslations("console");
  const programmes = await designatedProgrammes();
  return (
    <>
      <div className="grid gap-2">
        <Link href="/console/donations" className="link link--bare justify-self-start text-[14px] text-muted">
          ← {t("donations")}
        </Link>
        <h1 className="t-h2">{t("recordOffline")}</h1>
        <p className="max-w-[640px] text-muted">{t("offlineLead")}</p>
      </div>
      <OfflineGiftForm programmes={programmes} />
    </>
  );
}
