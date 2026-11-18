import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaffSignInForm } from "@/components/auth/StaffForms";
import { safeNext } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffAuth");
  return { title: t("signInTitle") };
}

export default async function StaffSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; done?: string }>;
}) {
  const { locale } = await params;
  const { next, done } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("staffAuth");
  return (
    <>
      <h1 className="t-h2">{t("signInTitle")}</h1>
      <StaffSignInForm next={safeNext(next, "") || undefined} done={done === "1"} />
    </>
  );
}
