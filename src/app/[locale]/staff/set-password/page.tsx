import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SetPasswordForm } from "@/components/auth/StaffForms";
import { peekLinkToken } from "@/server/auth/sign-in";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffAuth");
  return { title: t("setPasswordTitle"), referrer: "no-referrer" };
}

/** From an invite (72 hours) or reset (30 minutes) link. */
export default async function SetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("staffAuth");
  const link = typeof token === "string" ? await peekLinkToken(token) : null;
  return (
    <>
      <h1 className="t-h2">{link?.purpose === "staff_invite" ? t("welcomeTitle") : t("setPasswordTitle")}</h1>
      {link && token ? (
        <SetPasswordForm token={token} />
      ) : (
        <div className="card grid gap-4 !p-5 sm:!p-8">
          <p>{t("linkExpired")}</p>
          <Link href="/staff/forgot-password" className="uline justify-self-start">
            {t("getNewLink")}
          </Link>
        </div>
      )}
    </>
  );
}
