import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadConsentRequest } from "@/server/services/consent";
import { getSettings } from "@/server/services/public";
import { formatPhone } from "@/lib/phone";
import { ConsentForm } from "@/components/join/ConsentForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Guardian permission page (spec/05 §3, DESIGN.md §8.2): a plain reading page a parent can trust. */
export default async function ConsentPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("consent");
  const req = await loadConsentRequest(token);
  const st = await getSettings(["org_phone"]);
  const phone = st.org_phone ? formatPhone(String(st.org_phone)) : "";

  if (req.state === "invalid") {
    return <Message title={t("invalid")} />;
  }
  if (req.state === "expired") return <Message title={t("expired", { phone })} />;
  if (req.state === "locked") return <Message title={t("locked", { phone })} />;
  if (req.state === "withdrawn") {
    return <Message title={t("withdrawnTitle")} body={t("withdrawnLead", { name: req.studentFirstName })} />;
  }

  const name = req.studentFirstName;
  return (
    <article className="grid gap-10 text-[18px] leading-[1.6]">
      <header className="grid gap-4">
        <h1 className="text-[32px] leading-tight sm:text-[40px]">{t("title", { studentFirstName: name })}</h1>
        <p>{t("what")}</p>
        {req.programme && (
          <p>{t("programme", { studentFirstName: name, programme: req.programme.name, summary: req.programme.summary })}</p>
        )}
      </header>
      <section className="grid gap-3">
        <h2 className="text-[24px]">{t("collectTitle")}</h2>
        <ul className="grid list-disc gap-2 pl-5">
          <li>{t("collect1")}</li>
          <li>{t("collect2")}</li>
          <li>{t("collect3")}</li>
          <li>{t("collect4")}</li>
        </ul>
      </section>
      <ConsentForm
        token={token}
        locale={locale}
        name={name}
        initial={req.current}
        state={req.state}
        relationship={req.relationship}
        attemptsLeft={req.attemptsLeft}
        phone={phone}
      />
    </article>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="grid gap-4 pt-8">
      <h1 className="text-[28px] leading-tight">{title}</h1>
      {body && <p className="text-[18px]">{body}</p>}
    </div>
  );
}
