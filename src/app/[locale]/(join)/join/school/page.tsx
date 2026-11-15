import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getIntakeOptions } from "@/server/services/join-data";
import { SchoolForm } from "@/components/join/SchoolForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("school");
  return { title: t("title"), description: t("lead") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const options = await getIntakeOptions();
  return <SchoolForm options={options} locale={locale} />;
}
