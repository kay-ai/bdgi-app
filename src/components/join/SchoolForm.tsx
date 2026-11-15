"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { schoolAction } from "@/app/actions/forms";
import type { IntakeOptions } from "@/server/services/join-data";
import { Chips, Q } from "./fields";

const ROLES = ["principal", "vice_principal", "teacher", "counsellor", "other"] as const;

/** School request (spec/05 §5). */
export function SchoolForm({ options, locale }: { options: IntakeOptions; locale: string }) {
  const t = useTranslations("school");
  const tf = useTranslations("forms");
  const te = useTranslations("join.errors");
  const [v, setV] = useState({
    schoolName: "",
    stateId: options.states.find((s) => s.code === "OY")?.id ?? "",
    lgaId: "",
    name: "",
    role: "" as (typeof ROLES)[number] | "",
    phone: "",
    email: "",
    programmeId: "",
    approxStudents: "",
    term: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const lgas = useMemo(() => options.lgas.filter((l) => l.stateId === v.stateId), [options.lgas, v.stateId]);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));
  const err = (k: string) => errors[k];

  if (done) {
    return (
      <div className="grid gap-8">
        <h1 className="t-h1">{t("doneTitle", { name: v.name.trim() })}</h1>
        <p className="t-lead text-muted">{t("doneLead")}</p>
        <div>
          <Link href="/programmes" className="link">
            {t("doneLink")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-10"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setFailed(null);
        start(async () => {
          const r = await schoolAction(locale, { ...v, approxStudents: v.approxStudents === "" ? undefined : v.approxStudents });
          if (r.ok) {
            setDone(true);
            window.scrollTo({ top: 0 });
            return;
          }
          if (r.code === "rate_limited") setFailed(tf("rateLimited"));
          else if (r.code === "invalid") {
            const f = r.fields ?? {};
            setErrors(Object.fromEntries(Object.entries(f).map(([k, c]) => [k, c === "phone" ? te("phone") : k === "role" ? te("pick") : k === "email" ? tf("email") : k === "schoolName" || k === "name" ? tf("required") : tf("check")])));
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
        <legend className="t-h3 mb-6">{t("schoolGroup")}</legend>
        <Q label={t("school")} error={err("schoolName")} as="label">
          <input className="input" value={v.schoolName} onChange={(e) => set("schoolName", e.target.value)} aria-invalid={!!err("schoolName")} />
        </Q>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("state")} as="label">
            <select className="input" value={v.stateId} onChange={(e) => setV((o) => ({ ...o, stateId: e.target.value, lgaId: "" }))}>
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
        <legend className="t-h3 mb-6">{t("youGroup")}</legend>
        <Q label={t("name")} error={err("name")} as="label">
          <input className="input" autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} />
        </Q>
        <Q as="fieldset" label={t("role")} error={err("role")}>
          <Chips name={t("role")} value={v.role} onChange={(x) => set("role", x)} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} />
        </Q>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("phone")} error={err("phone")} as="label">
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!err("phone")} />
          </Q>
          <Q label={`${t("email")} (${tf("optional")})`} error={err("email")} as="label">
            <input className="input" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!err("email")} />
          </Q>
        </div>
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="t-h3 mb-6">{t("interestGroup")}</legend>
        <Q label={t("programme")} as="label">
          <select className="input" value={v.programmeId} onChange={(e) => set("programmeId", e.target.value)}>
            <option value="">{t("anyProgramme")}</option>
            {options.programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Q>
        <div className="grid gap-6 sm:grid-cols-2">
          <Q label={t("students")} error={err("approxStudents")} as="label">
            <input className="input" inputMode="numeric" value={v.approxStudents} onChange={(e) => set("approxStudents", e.target.value.replace(/\D/g, ""))} />
          </Q>
          <Q label={t("term")} as="label">
            <input className="input" value={v.term} onChange={(e) => set("term", e.target.value)} />
          </Q>
        </div>
        <Q label={`${t("message")} (${tf("optional")})`} as="label">
          <textarea className="input" rows={4} value={v.message} onChange={(e) => set("message", e.target.value)} />
        </Q>
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
