"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { concernAction } from "@/app/actions/forms";
import { Chips, Q } from "@/components/join/fields";

const CATEGORIES = ["physical", "emotional", "sexual", "neglect", "online", "bullying", "volunteer_conduct", "data_privacy", "other"] as const;
type Category = (typeof CATEGORIES)[number];

/** Report a concern (spec/09 §2). No sign-in; anonymous hides the name and contact fields. */
export function ConcernForm() {
  const t = useTranslations("concern");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");
  const [danger, setDanger] = useState<"yes" | "no" | "unsure" | "">("");
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (reference) {
    return (
      <div className="notice notice--ok grid gap-4" role="status">
        <p className="t-lead">{t("sent", { reference })}</p>
        <h2 className="font-medium">{t("nextTitle")}</h2>
        <ul className="grid list-disc gap-1 pl-5">
          <li>{t("next1")}</li>
          <li>{t("next2")}</li>
          <li>{t("next3")}</li>
        </ul>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!category) e.category = tf("choose");
    if (description.trim().length < 20) e.description = t("descriptionShort");
    if (!danger) e.danger = tf("choose");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form
      className="grid gap-8"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setFailed(null);
        if (!validate()) return;
        start(async () => {
          const r = await concernAction(locale, {
            category,
            description,
            immediateDanger: danger === "yes",
            anonymous,
            name: anonymous ? "" : name,
            contact: anonymous ? "" : contact,
            website,
          });
          if (r.ok) setReference(r.reference ?? "");
          else setFailed(r.code === "rate_limited" ? tf("rateLimited") : tf("server"));
        });
      }}
    >
      <Q as="fieldset" label={t("category")} error={errors.category}>
        <Chips name={t("category")} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
      </Q>
      <Q label={t("description")} hint={t("descriptionHint")} error={errors.description} as="label">
        <textarea className="input" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
      </Q>
      <Q as="fieldset" label={t("dangerQ")} error={errors.danger}>
        <Chips
          name={t("dangerQ")}
          value={danger}
          onChange={setDanger}
          options={[
            { value: "yes", label: t("yes") },
            { value: "no", label: t("no") },
            { value: "unsure", label: t("unsure") },
          ]}
        />
      </Q>
      {danger === "yes" && (
        <p className="notice notice--danger font-medium" role="alert">
          {t("danger")}
        </p>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        {t("anonymous")}
      </label>
      {!anonymous && (
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="field">
            <span>
              {t("name")} <span className="text-muted">({tf("optional")})</span>
            </span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>
              {t("contact")} <span className="text-muted">({tf("optional")})</span>
            </span>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
        </div>
      )}
      <label className="sr-only" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {failed && (
        <p className="error" role="alert">
          {failed}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn--lg" disabled={pending} aria-busy={pending}>
          {pending ? tf("sending") : t("submit")}
        </button>
      </div>
    </form>
  );
}
