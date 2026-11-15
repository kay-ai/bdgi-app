"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { volunteerAction } from "@/app/actions/forms";
import type { IntakeOptions } from "@/server/services/join-data";
import { Chips, Q } from "./fields";

const SKILLS = ["debate", "public_speaking", "stem", "coding", "writing", "leadership", "financial_literacy", "judging", "photography", "logistics"] as const;
const GENDERS = ["female", "male", "other", "prefer_not_to_say"] as const;
type Ref = { name: string; relationship: string; phone: string };
const emptyRef: Ref = { name: "", relationship: "", phone: "" };

/** Volunteer application (spec/05 §4): one page, four short groups, references, three agreements. */
export function VolunteerForm({ options, locale }: { options: Pick<IntakeOptions, "states" | "lgas">; locale: string }) {
  const t = useTranslations("volunteer");
  const tf = useTranslations("forms");
  const te = useTranslations("join.errors");
  const [v, setV] = useState({
    firstName: "",
    surname: "",
    dateOfBirth: "",
    gender: "" as (typeof GENDERS)[number] | "",
    phone: "",
    email: "",
    stateId: options.states.find((s) => s.code === "OY")?.id ?? "",
    lgaId: "",
    occupation: "",
    organisation: "",
    isNysc: false,
    isAlumna: false,
    skills: [] as string[],
    motivation: "",
    ref1: { ...emptyRef },
    ref2: { ...emptyRef },
    agreeChecks: false,
    agreeSafeguarding: false,
    agreePrivacy: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const lgas = useMemo(() => options.lgas.filter((l) => l.stateId === v.stateId), [options.lgas, v.stateId]);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));
  const setRef = (k: "ref1" | "ref2", f: keyof Ref, val: string) => setV((o) => ({ ...o, [k]: { ...o[k], [f]: val } }));

  if (done) {
    return (
      <div className="grid gap-8">
        <h1 className="t-h1">{t("doneTitle", { firstName: v.firstName })}</h1>
        <p className="t-lead text-muted">{t("doneLead")}</p>
        <ol className="steps grid gap-6" role="list">
          {(["d1", "d2", "d3", "d4"] as const).map((k) => (
            <li key={k}>
              <h3>{t(k)}</h3>
            </li>
          ))}
        </ol>
        <div>
          <Link href="/" className="link">
            {tf("home")}
          </Link>
        </div>
      </div>
    );
  }

  const msg = (field: string, code: string) => {
    if (code === "phone") return te("phone");
    if (field.startsWith("motivation")) return t("motivationHint");
    if (field.startsWith("agree")) return tf("agree");
    if (field === "skills") return te("pickOne");
    if (field === "gender") return te("pick");
    if (field === "firstName") return te("firstName");
    if (field === "surname") return te("surname");
    if (field === "dateOfBirth") return tf("dob");
    if (field === "email") return tf("email");
    if (/^ref[12]./.test(field)) return tf("required");
    return tf("check");
  };

  const err = (k: string) => errors[k];

  return (
    <form
      className="grid gap-12"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setFailed(null);
        start(async () => {
          const r = await volunteerAction(locale, v);
          if (r.ok) {
            setDone(true);
            window.scrollTo({ top: 0 });
            return;
          }
          if (r.code === "too_young") setFailed(t("tooYoung"));
          else if (r.code === "rate_limited") setFailed(tf("rateLimited"));
          else if (r.code === "invalid") {
            const f = r.fields ?? {};
            setErrors(Object.fromEntries(Object.entries(f).map(([k, c]) => [k, msg(k, c)])));
            setFailed(t("error"));
          } else setFailed(tf("server"));
        });
      }}
    >
      <header className="grid gap-4">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead text-muted">{t("lead")}</p>
      </header>

      <fieldset className="grid gap-6">
        <legend className="t-h3 mb-6">{t("aboutYou")}</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("firstName")} error={err("firstName")} as="label">
            <input className="input" autoComplete="given-name" value={v.firstName} onChange={(e) => set("firstName", e.target.value)} aria-invalid={!!err("firstName")} />
          </Q>
          <Q label={t("surname")} error={err("surname")} as="label">
            <input className="input" autoComplete="family-name" value={v.surname} onChange={(e) => set("surname", e.target.value)} aria-invalid={!!err("surname")} />
          </Q>
        </div>
        <Q label={t("dob")} error={err("dateOfBirth")} as="label">
          <input className="input max-w-[240px]" type="date" autoComplete="bday" value={v.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} aria-invalid={!!err("dateOfBirth")} />
        </Q>
        <Q as="fieldset" label={t("gender")} error={err("gender")}>
          <Chips name={t("gender")} value={v.gender} onChange={(x) => set("gender", x)} options={GENDERS.map((g) => ({ value: g, label: t(`genders.${g}`) }))} />
        </Q>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("phone")} error={err("phone")} as="label">
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!err("phone")} />
          </Q>
          <Q label={t("email")} error={err("email")} as="label">
            <input className="input" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!err("email")} />
          </Q>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("state")} error={err("stateId")} as="label">
            <select
              className="input"
              value={v.stateId}
              onChange={(e) => setV((o) => ({ ...o, stateId: e.target.value, lgaId: "" }))}
            >
              {options.states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Q>
          <Q label={t("lga")} as="label">
            <select className="input" value={v.lgaId} onChange={(e) => set("lgaId", e.target.value)}>
              <option value="">—</option>
              {lgas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Q>
        </div>
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="t-h3 mb-6">{t("experience")}</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("occupation")} as="label">
            <input className="input" value={v.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </Q>
          <Q label={t("organisation")} as="label">
            <input className="input" autoComplete="organization" value={v.organisation} onChange={(e) => set("organisation", e.target.value)} />
          </Q>
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={v.isNysc} onChange={(e) => set("isNysc", e.target.checked)} />
          {t("nysc")}
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={v.isAlumna} onChange={(e) => set("isAlumna", e.target.checked)} />
          {t("alumna")}
        </label>
        <Q as="fieldset" label={t("skills")} error={err("skills")}>
          <Chips name={t("skills")} multiple value={v.skills} onChange={(x) => set("skills", x)} options={SKILLS.map((s) => ({ value: s, label: t(`skillOptions.${s}`) }))} />
        </Q>
        <Q label={t("motivation")} hint={`${t("motivationHint")} ${v.motivation.trim().length}/600`} error={err("motivation")} as="label">
          <textarea className="input" rows={5} maxLength={600} value={v.motivation} onChange={(e) => set("motivation", e.target.value)} aria-invalid={!!err("motivation")} />
        </Q>
      </fieldset>

      {(["ref1", "ref2"] as const).map((k) => (
        <fieldset key={k} className="grid gap-6">
          <legend className="t-h3 mb-2">{t(k)}</legend>
          <p className="text-muted">{t("refHint")}</p>
          <div className="grid gap-6 sm:grid-cols-3">
            <Q label={t("refName")} error={err(`${k}.name`)} as="label">
              <input className="input" value={v[k].name} onChange={(e) => setRef(k, "name", e.target.value)} aria-invalid={!!err(`${k}.name`)} />
            </Q>
            <Q label={t("refRelationship")} error={err(`${k}.relationship`)} as="label">
              <input className="input" value={v[k].relationship} onChange={(e) => setRef(k, "relationship", e.target.value)} aria-invalid={!!err(`${k}.relationship`)} />
            </Q>
            <Q label={t("refPhone")} error={err(`${k}.phone`)} as="label">
              <input className="input" type="tel" inputMode="tel" value={v[k].phone} onChange={(e) => setRef(k, "phone", e.target.value)} aria-invalid={!!err(`${k}.phone`)} />
            </Q>
          </div>
        </fieldset>
      ))}

      <fieldset className="grid gap-4 rounded-[var(--r-lg)] bg-surface p-6">
        <legend className="sr-only">{t("agreements")}</legend>
        {(
          [
            ["agreeChecks", t("agreeChecks"), null],
            ["agreeSafeguarding", t("agreeSafeguarding"), "/safeguarding"],
            ["agreePrivacy", t("agreePrivacy"), "/privacy"],
          ] as const
        ).map(([k, label, href]) => (
          <div key={k} className="grid gap-1">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1A1712]" checked={v[k]} onChange={(e) => set(k, e.target.checked)} />
              <span>
                {label}{" "}
                {href && (
                  <Link href={href} className="uline" target="_blank">
                    {tf("read")}
                  </Link>
                )}
              </span>
            </label>
            {err(k) && (
              <span className="error pl-8 text-[14px] text-danger" role="alert">
                {err(k)}
              </span>
            )}
          </div>
        ))}
      </fieldset>

      <label className="sr-only" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
      </label>

      {failed && (
        <p className="notice notice--danger" role="alert">
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
