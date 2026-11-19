import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VerifyCodeForm } from "@/components/auth/SignInForms";
import { pendingSubject } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("verifyTitle"), robots: { index: false } };
}

/** Step 2: enter the six-digit code. The page reads the same whether or not an account exists. */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("signIn");
  const pending = await pendingSubject();
  return (
    <section className="screen" aria-labelledby="sv-h">
      <div className="wrap justify-center">
        <div className="grid w-full max-w-[520px] gap-8">
          <h1 id="sv-h" className="t-h1">
            {t("verifyTitle")}
          </h1>
          {pending ? (
            <VerifyCodeForm masked={pending.masked} next={typeof next === "string" ? next : undefined} />
          ) : (
            <div className="card grid gap-4 !p-6">
              <p>{t("noPending")}</p>
              <Link href="/sign-in" className="btn justify-self-start">
                {t("startAgain")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
