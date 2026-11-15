"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { donateAction } from "@/app/[locale]/(site)/donate/actions";

export function DonateForm({
  locale,
  presets,
  programmes,
}: {
  locale: string;
  presets: number[];
  programmes: { id: string; name: string }[];
}) {
  const t = useTranslations("donate");
  const router = useRouter();
  const [amount, setAmount] = useState<number | "">(presets[1] ?? 5000);
  const [other, setOther] = useState("");
  const [frequency, setFrequency] = useState<"one_off" | "monthly">("one_off");
  const [designation, setDesignation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAnonymous, setAnon] = useState(false);
  const [wantsUpdates, setUpdates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const naira = (n: number) => `₦${new Intl.NumberFormat("en-NG").format(n)}`;
  const value = other ? Number(other.replace(/\D/g, "")) : amount;

  return (
    <form
      className="card grid gap-6 !p-6 sm:!p-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await donateAction(locale, { amount: value, frequency, designation, name, email, isAnonymous, wantsUpdates });
          if (r.ok) router.push(`/donate/thank-you?ref=${r.reference}`);
          else setError(t("error"));
        });
      }}
    >
      <fieldset className="field">
        <legend className="mb-2 font-medium">{t("frequency")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["one_off", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={frequency === f}
              onClick={() => setFrequency(f)}
              className={`min-h-12 rounded-[8px] ${frequency === f ? "bg-ink text-bg" : "bg-bg"}`}
            >
              {f === "one_off" ? t("oneOff") : t("monthly")}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="mb-2 font-medium">{t("amount")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={!other && amount === p}
              onClick={() => {
                setAmount(p);
                setOther("");
              }}
              className={`min-h-12 rounded-[8px] tabular ${!other && amount === p ? "bg-ink text-bg" : "bg-bg"}`}
            >
              {naira(p)}
            </button>
          ))}
        </div>
        <input className="input mt-2" inputMode="numeric" placeholder={t("other")} aria-label={t("other")} value={other} onChange={(e) => setOther(e.target.value)} />
      </fieldset>
      <label className="field">
        <span>{t("designation")}</span>
        <select className="input" value={designation} onChange={(e) => setDesignation(e.target.value)}>
          <option value="">{t("whereNeeded")}</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t("name")}</span>
        <input className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>{t("email")}</span>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={isAnonymous} onChange={(e) => setAnon(e.target.checked)} />
        {t("anonymous")}
      </label>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={wantsUpdates} onChange={(e) => setUpdates(e.target.checked)} />
        {t("updates")}
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--lg btn--block" disabled={pending || !value || value < 500}>
        {t("submit")} {value ? naira(value) : ""}
      </button>
      <p className="text-[14px] text-muted">{t("secure")}</p>
    </form>
  );
}
