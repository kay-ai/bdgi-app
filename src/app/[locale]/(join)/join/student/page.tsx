import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getIntakeOptions } from "@/server/services/join-data";
import { contactMode } from "@/server/services/reach";
import { StudentIntakeForm } from "@/components/join/StudentIntakeForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join.chooser");
  return { title: t("student"), robots: { index: false } };
}

export default async function StudentJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ programme?: string }>;
}) {
  const { locale } = await params;
  const { programme } = await searchParams;
  setRequestLocale(locale);
  const options = await getIntakeOptions();
  return <StudentIntakeForm options={options} locale={locale} preselect={programme ?? null} contactMode={contactMode()} />;
}
