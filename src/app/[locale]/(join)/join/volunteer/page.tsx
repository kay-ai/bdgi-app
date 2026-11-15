import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getIntakeOptions } from "@/server/services/join-data";
import { VolunteerForm } from "@/components/join/VolunteerForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("volunteer");
  return { title: t("title"), description: t("lead") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const options = await getIntakeOptions();
  return <VolunteerForm options={options} locale={locale} />;
}
