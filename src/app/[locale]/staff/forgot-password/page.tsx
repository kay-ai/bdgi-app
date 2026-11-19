import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/StaffForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffAuth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("staffAuth");
  return (
    <>
      <h1 className="t-h2">{t("forgotTitle")}</h1>
      <p className="text-muted">{t("forgotLead")}</p>
      <ForgotPasswordForm />
    </>
  );
}
