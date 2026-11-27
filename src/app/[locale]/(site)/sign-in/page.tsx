import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SendCodeForm } from "@/components/auth/SignInForms";
import { contactMode } from "@/server/services/reach";
import { googleEnabled } from "@/server/auth/google";

const GOOGLE_ERRORS = ["failed", "cancelled", "deactivated", "staff", "rate_limited"] as const;

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
  searchParams: Promise<{ via?: string; next?: string; google?: string }>;
}) {
  const { locale } = await params;
  const { via, next, google } = await searchParams;
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
          {google && (GOOGLE_ERRORS as readonly string[]).includes(google) && (
            <p className="error rounded-[14px] bg-surface p-4" role="alert">
              {t(`googleErr.${google}` as "googleErr.failed")}
            </p>
          )}
          {googleEnabled() && (
            <>
              {/* A plain link: the route sends the browser on to Google with a full page load. */}
              <a
                href={`/api/auth/google?locale=${locale === "yo" ? "yo" : "en"}${typeof next === "string" ? `&next=${encodeURIComponent(next)}` : ""}`}
                className="btn btn--plain btn--lg btn--block !bg-white !text-[#1a1712] ring-1 ring-[#1a1712]/15"
              >
                <GoogleMark />
                {t("google")}
              </a>
              <p className="flex items-center gap-3 text-[14px] text-muted" aria-hidden="true">
                <span className="h-px flex-1 bg-current opacity-30" />
                {t("or")}
                <span className="h-px flex-1 bg-current opacity-30" />
              </p>
            </>
          )}
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

/** Google's "G", in its own colours, as its brand guidelines ask for the sign-in button. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
