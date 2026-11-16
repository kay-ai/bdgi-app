"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { recordOfflineAction } from "@/app/[locale]/console/donations/actions";
import { offlineGiftInput } from "@/server/validation/donation";

/** Record a bank transfer or cash gift (spec/11 §3). A receipt is emailed on save. */
export function OfflineGiftForm({ programmes }: { programmes: { id: string; name: string }[] }) {
  const t = useTranslations("console");
  const router = useRouter();
  const ids = useId();
  const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  const [v, setV] = useState({
    supporterName: "",
    supporterEmail: "",
    amount: "",
    currency: "NGN",
    date: today,
    method: "bank_transfer",
    designation: "",
    note: "",
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const invalid = (k: string) => (fields[k] ? { "aria-invalid": true as const, "aria-describedby": `${ids}-${k}-e` } : {});
  const Err = ({ k }: { k: string }) => (fields[k] ? <span id={`${ids}-${k}-e`} className="error">{t("fieldInvalid")}</span> : null);

  return (
    <form
      className="card grid max-w-[640px] gap-5 !p-5 sm:!p-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const local = offlineGiftInput.safeParse(v);
        if (!local.success) {
          setFields(Object.fromEntries(local.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setFields({});
        start(async () => {
          const r = await recordOfflineAction(v);
          if (r.ok) router.push("/console/donations?provider=offline");
          else {
            if (r.fields) setFields(r.fields);
            setError(t("actionFailed"));
          }
        });
      }}
    >
      <div className="field">
        <label htmlFor={`${ids}-n`}>{t("supporterName")}</label>
        <input id={`${ids}-n`} className="input" value={v.supporterName} onChange={set("supporterName")} {...invalid("supporterName")} />
        <Err k="supporterName" />
      </div>
      <div className="field">
        <label htmlFor={`${ids}-e`}>{t("email")}</label>
        <input id={`${ids}-e`} type="email" className="input" value={v.supporterEmail} onChange={set("supporterEmail")} {...invalid("supporterEmail")} />
        <span className="hint">{t("offlineEmailHint")}</span>
        <Err k="supporterEmail" />
      </div>
      <div className="grid gap-5 min-[480px]:grid-cols-[2fr_1fr]">
        <div className="field">
          <label htmlFor={`${ids}-a`}>{t("amountMajor")}</label>
          <input id={`${ids}-a`} inputMode="numeric" className="input tabular" value={v.amount} onChange={set("amount")} {...invalid("amount")} />
          <Err k="amount" />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-c`}>{t("currency")}</label>
          <select id={`${ids}-c`} className="input" value={v.currency} onChange={set("currency")}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div className="grid gap-5 min-[480px]:grid-cols-2">
        <div className="field">
          <label htmlFor={`${ids}-d`}>{t("dateReceived")}</label>
          <input id={`${ids}-d`} type="date" className="input" max={today} value={v.date} onChange={set("date")} {...invalid("date")} />
          <Err k="date" />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-m`}>{t("method")}</label>
          <select id={`${ids}-m`} className="input" value={v.method} onChange={set("method")}>
            <option value="bank_transfer">{t("bankTransfer")}</option>
            <option value="cash">{t("cash")}</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${ids}-g`}>{t("designation")}</label>
        <select id={`${ids}-g`} className="input" value={v.designation} onChange={set("designation")}>
          <option value="">{t("whereNeeded")}</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${ids}-o`}>{t("note")}</label>
        <textarea id={`${ids}-o`} className="input !min-h-[88px]" maxLength={500} value={v.note} onChange={set("note")} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--lg" disabled={pending}>
        {pending ? t("saving") : t("saveGift")}
      </button>
    </form>
  );
}
