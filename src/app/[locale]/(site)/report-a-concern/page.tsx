import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ConcernForm } from "@/components/site/ConcernForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("concern");
  return { title: t("title"), description: t("lead"), robots: { index: true } };
}

export default async function ConcernPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("concern");
  return (
    <div className="wrap py-16 lg:py-24">
      <div className="grid12">
        <div className="col-span-6 grid content-start gap-6 lg:col-span-5">
          <h1 className="t-h1">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
          <a href="tel:112" className="notice notice--danger flex items-center gap-4 font-medium">
            <Phone size={22} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            {t("danger")}
          </a>
          <p className="t-small text-muted">
            {t("policy")}{" "}
            <Link href="/safeguarding" className="uline text-ink">
              {t("policyLink")}
            </Link>
          </p>
        </div>
        <div className="col-span-6 lg:col-start-7">
          <ConcernForm />
        </div>
      </div>
    </div>
  );
}
