import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TwoFactorForm } from "@/components/auth/StaffForms";
import { currentSession, safeNext } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffAuth");
  return { title: t("twoFactorTitle") };
}

export default async function TwoFactorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const row = await currentSession();
  if (!row || row.session.method !== "staff") redirect("/staff/sign-in");
  if (row.session.stage === "full") redirect("/console");
  if (!row.user.totpEnabledAt) redirect("/staff/two-factor/setup");
  const t = await getTranslations("staffAuth");
  return (
    <>
      <h1 className="t-h2">{t("twoFactorTitle")}</h1>
      <p className="text-muted">{t("twoFactorLead")}</p>
      <TwoFactorForm next={safeNext(next, "") || undefined} />
    </>
  );
}
