import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/phone";
import { Logo } from "./Logo";

/** footer-dark: directory columns and a legal row (spec/04 §4). */
export async function Footer({ phone, email, city }: { phone: string; email: string; city: string }) {
  const t = await getTranslations("footer");
  const tm = await getTranslations("meta");
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="grid12">
          <div className="col-span-6 grid content-start gap-4 lg:col-span-4">
            <Link href="/" className="logo">
              <Logo label={tm("siteName")} onDark height={56} />
            </Link>
            <p className="muted max-w-[36ch] text-[15px]">{t("mission")}</p>
          </div>
          <div className="col-span-3 lg:col-span-2 lg:col-start-6">
            <h2>{t("organisation")}</h2>
            <ul>
              <li>
                <Link className="uline" href="/about">
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/about/team">
                  {t("team")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/impact">
                  {t("impact")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/contact">
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-span-3 lg:col-span-3">
            <h2>{t("getInvolved")}</h2>
            <ul>
              <li>
                <Link className="uline" href="/join/student">
                  {t("joinStudent")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/join/volunteer">
                  {t("volunteer")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/join/school">
                  {t("school")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/partner">
                  {t("partner")}
                </Link>
              </li>
              <li>
                <Link className="uline" href="/donate">
                  {t("donate")}
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <h2>{t("stayInTouch")}</h2>
            <ul className="muted">
              <li>{city}</li>
              {phone && (
                <li>
                  <a className="uline" href={`tel:${phone}`}>
                    {formatPhone(phone)}
                  </a>
                </li>
              )}
              <li>
                <a className="uline" href={`mailto:${email}`}>
                  {email}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-[14px]">
          <span className="muted">{t("rights", { year })}</span>
          <Link className="uline muted" href="/privacy">
            {t("privacy")}
          </Link>
          <Link className="uline muted" href="/safeguarding">
            {t("safeguarding")}
          </Link>
          <Link className="uline muted" href="/terms">
            {t("terms")}
          </Link>
          <Link className="uline font-medium" href="/report-a-concern">
            {t("reportConcern")}
          </Link>
          <a className="uline muted" href="https://edutracka.ai" rel="noopener">
            {t("edutracka")}
          </a>
          <span className="muted basis-full">{t("credits")}</span>
        </div>
      </div>
    </footer>
  );
}
