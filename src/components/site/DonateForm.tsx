"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { donateAction } from "@/app/[locale]/(site)/donate/actions";
import { DONATION_LIMITS, donationInput, type Currency } from "@/server/validation/donation";

type Presets = { NGN: number[]; USD: number[] };

const money = (n: number, c: Currency) =>
  c === "NGN" ? `₦${new Intl.NumberFormat("en-NG").format(n)}` : `$${new Intl.NumberFormat("en-US").format(n)}`;

export function DonateForm({
  locale,
  presets,
  usdEnabled,
  programmes,
  impactLines = {},
}: {
  locale: string;
  presets: Presets;
  usdEnabled: boolean;
  programmes: { id: string; name: string }[];
  impactLines?: Record<string, string>;
}) {
  const t = useTranslations("donate");
  const router = useRouter();
  const ids = useId();
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [amount, setAmount] = useState<number | null>(presets.NGN[1] ?? presets.NGN[0] ?? 5000);
  const [other, setOther] = useState("");
  const [frequency, setFrequency] = useState<"one_off" | "monthly">("one_off");
  const [designation, setDesignation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setAnon] = useState(false);
  const [wantsUpdates, setUpdates] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const value = other ? Number(other.replace(/[^\d]/g, "")) : (amount ?? 0);
  const lim = DONATION_LIMITS[currency];
  const busy = pending || leaving;

  const fieldError = (key: string) => {
    const code = fields[key];
    if (!code) return null;
    if (key === "amount") {
      const k = code === "amountMax" ? "errAmountMax" : "errAmountMin";
      return t(k, { min: money(lim.min, currency), max: money(lim.max, currency) });
    }
    return t(`err_${key}` as "err_name");
  };
  const errProps = (key: string) =>
    fields[key] ? { "aria-invalid": true as const, "aria-describedby": `${ids}-${key}-err` } : {};
  const ErrorText = ({ k }: { k: string }) =>
    fields[k] ? (
      <span id={`${ids}-${k}-err`} className="error">
        {fieldError(k)}
      </span>
    ) : null;

  const switchCurrency = (c: Currency) => {
    setCurrency(c);
    setOther("");
    setAmount(presets[c][1] ?? presets[c][0] ?? null);
    setFields({});
  };

  const submit = () => {
    setError(null);
    const raw = { amount: value, currency, frequency, designation, name, email, phone, message, isAnonymous, wantsUpdates };
    const local = donationInput.safeParse(raw);
    if (!local.success) {
      setFields(Object.fromEntries(local.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFields({});
    start(async () => {
      const r = await donateAction(locale, raw).catch(() => ({ ok: false as const, code: "network" }));
      if (r.ok) {
        if (r.redirectUrl) {
          setLeaving(true);
          window.location.assign(r.redirectUrl);
        } else router.push(`/donate/thank-you?ref=${encodeURIComponent(r.reference)}`);
        return;
      }
      if ("fields" in r && r.fields) setFields(r.fields);
      setError(
        "code" in r && r.code === "rate_limited"
          ? t("errRateLimited")
          : "code" in r && (r.code === "provider" || r.code === "network")
            ? t("errProvider")
            : t("error"),
      );
    });
  };

  return (
    <form
      className="card grid gap-6 !p-5 sm:!p-8"
      noValidate
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="field">
        <legend>{t("frequency")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["one_off", "monthly"] as const).map((f) => (
            <button key={f} type="button" className="opt" aria-pressed={frequency === f} onClick={() => setFrequency(f)}>
              {f === "one_off" ? t("oneOff") : t("monthly")}
            </button>
          ))}
        </div>
      </fieldset>

      {usdEnabled && (
        <fieldset className="field">
          <legend>{t("currency")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["NGN", "USD"] as const).map((c) => (
              <button key={c} type="button" className="opt" aria-pressed={currency === c} onClick={() => switchCurrency(c)}>
                {c === "NGN" ? t("naira") : t("dollar")}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="field">
        <legend>{t("amount")}</legend>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {presets[currency].map((p) => (
            <button
              key={p}
              type="button"
              className="opt tabular"
              aria-pressed={!other && amount === p}
              onClick={() => {
                setAmount(p);
                setOther("");
              }}
            >
              {money(p, currency)}
            </button>
          ))}
        </div>
        {!other && amount !== null && impactLines[`${currency}:${amount}`] && (
          <p className="hint">{impactLines[`${currency}:${amount}`]}</p>
        )}
        <label className="sr-only" htmlFor={`${ids}-other`}>
          {t("other")}
        </label>
        <input
          id={`${ids}-other`}
          className="input mt-1 tabular"
          inputMode="numeric"
          placeholder={t("otherPlaceholder", { min: money(lim.min, currency) })}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          {...errProps("amount")}
        />
        <ErrorText k="amount" />
      </fieldset>

      <div className="field">
        <label htmlFor={`${ids}-des`}>{t("designation")}</label>
        <select id={`${ids}-des`} className="input" value={designation} onChange={(e) => setDesignation(e.target.value)}>
          <option value="">{t("whereNeeded")}</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${ids}-name`}>{t("name")}</label>
        <input id={`${ids}-name`} className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} {...errProps("name")} />
        <ErrorText k="name" />
      </div>
      <div className="field">
        <label htmlFor={`${ids}-email`}>{t("email")}</label>
        <input
          id={`${ids}-email`}
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...errProps("email")}
        />
        <ErrorText k="email" />
      </div>
      <div className="field">
        <label htmlFor={`${ids}-phone`}>
          {t("phone")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <input id={`${ids}-phone`} className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} {...errProps("phone")} />
        <ErrorText k="phone" />
      </div>
      <div className="field">
        <label htmlFor={`${ids}-msg`}>
          {t("message")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <textarea id={`${ids}-msg`} className="input !min-h-[88px]" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#1A1712]" checked={isAnonymous} onChange={(e) => setAnon(e.target.checked)} />
        {t("anonymous")}
      </label>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#1A1712]" checked={wantsUpdates} onChange={(e) => setUpdates(e.target.checked)} />
        {t("updates")}
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--lg btn--block" disabled={busy}>
        {leaving
          ? t("redirecting")
          : pending
            ? t("processing")
            : frequency === "monthly"
              ? t("submitMonthly", { amount: value ? money(value, currency) : "" })
              : t("submitAmount", { amount: value ? money(value, currency) : "" })}
      </button>
      <p className="text-[14px] text-muted" aria-live="polite">
        {t("secure")}
      </p>
    </form>
  );
}
