import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ContactForm } from "@/components/site/ContactForm";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/server/services/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title"), description: t("lead") };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const st = await getSettings(["org_phone", "org_email", "org_city", "org_address"]);
  const phone = String(st.org_phone ?? "");
  const email = String(st.org_email ?? "");
  const place = [st.org_address, st.org_city].filter(Boolean).join(", ");
  const wa = phone.replace(/\D/g, "");

  return (
    <section className="screen" aria-labelledby="contact-h">
      <div className="wrap">
        <div className="grid12 flex-1 items-start">
          <div className="col-span-6 grid gap-8 lg:col-span-5">
            <div className="grid gap-4">
              <h1 id="contact-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
            </div>
            <dl className="grid gap-5">
              <div className="grid gap-1">
                <dt className="t-label">{t("office")}</dt>
                <dd>{place}</dd>
              </div>
              {phone && (
                <div className="grid gap-1">
                  <dt className="t-label">{t("phone")}</dt>
                  <dd className="flex flex-wrap gap-x-6 gap-y-1">
                    <a className="uline" href={`tel:${phone}`}>
                      {formatPhone(phone)}
                    </a>
                    {wa && (
                      <a className="uline" href={`https://wa.me/${wa}`} rel="noopener" target="_blank">
                        {t("whatsapp")}
                      </a>
                    )}
                  </dd>
                </div>
              )}
              <div className="grid gap-1">
                <dt className="t-label">{t("emailLabel")}</dt>
                <dd>
                  <a className="uline" href={`mailto:${email}`}>
                    {email}
                  </a>
                </dd>
              </div>
            </dl>
            <div className="notice flex gap-4">
              <ShieldAlert size={22} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                {t("concern")}{" "}
                <Link href="/report-a-concern" className="uline font-medium">
                  {t("concernLink")}
                </Link>
              </p>
            </div>
          </div>
          <div className="col-span-6 lg:col-start-7">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
