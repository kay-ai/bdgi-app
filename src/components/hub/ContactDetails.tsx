"use client";

import { useTranslations } from "next-intl";
import { EmailRow } from "@/components/join/EmailRow";
import { changeMyContactAction } from "@/app/[locale]/app/profile/actions";

/** Her email and, while permission is awaited, her guardian's: both can be corrected (D-019). */
export function ContactDetails({
  locale,
  email,
  isAdult,
  guardian,
}: {
  locale: string;
  email: string;
  isAdult: boolean;
  guardian: { name: string; email: string } | null;
}) {
  const t = useTranslations("join.student.done");
  const th = useTranslations("hub.profile");
  return (
    <section aria-labelledby="contact-h" className="grid gap-5 rounded-[16px] bg-surface p-5">
      <h2 id="contact-h" className="t-h3">
        {th("contactTitle")}
      </h2>
      <EmailRow label={t("yourEmail")} value={email} required={isAdult} submit={(v) => changeMyContactAction(locale, { email: v })} />
      {guardian && (
        <>
          <EmailRow
            label={t("guardianEmail")}
            value={guardian.email}
            required
            guardian
            submit={(v) => changeMyContactAction(locale, { guardianEmail: v })}
          />
          <p className="text-[15px] text-muted">{th("guardianNote", { name: guardian.name })}</p>
        </>
      )}
    </section>
  );
}
