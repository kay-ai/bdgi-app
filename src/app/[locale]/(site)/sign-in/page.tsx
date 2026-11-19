import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SendCodeForm } from "@/components/auth/SignInForms";
import { contactMode } from "@/server/services/reach";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("title"), robots: { index: false } };
}

/** Hub sign-in, step 1 (spec/03 §1.1): a code by SMS or WhatsApp, or by email. */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ via?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { via, next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("signIn");
  // D-018: in email mode the code goes by email unless someone asks for their phone.
  const byEmail = via === "email" || (contactMode() === "email" && via !== "phone");
  return (
    <section className="screen" aria-labelledby="si-h">
      <div className="wrap justify-center">
        <div className="grid w-full max-w-[520px] gap-8">
          <div className="grid gap-3">
            <h1 id="si-h" className="t-h1">
              {t("title")}
            </h1>
            <p className="t-lead text-muted">{t(byEmail && contactMode() === "email" ? "leadEmail" : "lead")}</p>
          </div>
          <SendCodeForm initialKind={byEmail ? "email" : "phone"} next={typeof next === "string" ? next : undefined} />
          <ul className="rows" role="list">
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("student")}</span>
              <Link href="/join/student" className="link">
                {t("studentCta")}
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("staff")}</span>
              <Link href="/staff/sign-in" className="link">
                {t("staffCta")}
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4">
              <span>{t("help")}</span>
              <Link href="/contact" className="link">
                {t("helpCta")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
