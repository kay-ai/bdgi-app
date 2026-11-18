import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SetupForm } from "@/components/auth/StaffForms";
import { currentSession } from "@/server/auth/current";
import { beginTotpSetup } from "@/server/auth/sign-in";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffAuth");
  return { title: t("setupTitle") };
}

/** First staff sign-in: scan the QR code (or type the key), confirm one code, keep the backup codes. */
export default async function TwoFactorSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const row = await currentSession();
  if (!row || row.session.method !== "staff") redirect("/staff/sign-in");
  const t = await getTranslations("staffAuth");
  const setup = await beginTotpSetup(row);
  if (!setup) {
    // Already on: either finished just now (the form shows backup codes) or a later visit.
    if (row.session.stage === "full") redirect("/console");
    redirect("/staff/two-factor");
  }
  const svg = await QRCode.toString(setup.uri, { type: "svg", margin: 1, color: { dark: "#1A1712", light: "#FFFFFF" } });
  const key = setup.secret.replace(/(.{4})/g, "$1 ").trim();
  return (
    <>
      <h1 className="t-h2">{t("setupTitle")}</h1>
      <ol className="grid list-decimal gap-2 pl-6">
        <li>{t("setupStep1")}</li>
        <li>{t("setupStep2")}</li>
        <li>{t("setupStep3")}</li>
      </ol>
      <div className="card grid justify-items-center gap-4 !p-5 sm:!p-8">
        {/* Generated here from our own otpauth URI; no user input in the SVG. */}
        <div className="w-[220px] max-w-full" role="img" aria-label={t("qrLabel")} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="grid w-full gap-1 text-center">
          <span className="text-[15px] text-muted">{t("manualKey")}</span>
          <code className="break-all font-mono text-[17px] tabular">{key}</code>
        </div>
      </div>
      <SetupForm />
    </>
  );
}
