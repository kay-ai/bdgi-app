"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { v7 as uuidv7 } from "uuid";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Chips, CircleScale, Q } from "./fields";
import { offlineDb } from "@/offline/db";
import type { IntakeOptions } from "@/server/services/join-data";
import {
  AVATARS,
  CLASS_LEVELS,
  DEVICES,
  INTERESTS,
  NEEDS,
  RELATIONSHIPS,
  contactRules,
  stepAbout,
  stepDreams,
  stepHelp,
} from "@/server/validation/join";
import { remindGuardianAction, searchSchoolsAction, submitStudentAction } from "@/app/[locale]/(join)/join/student/actions";
import type { ZodTypeAny } from "zod";

type Data = {
  clientId: string;
  startedAt: number;
  about: {
    firstName: string;
    surname: string;
    age: number | "";
    gender: "" | "female" | "male" | "prefer_not_to_say";
    classLevel: "" | (typeof CLASS_LEVELS)[number];
    stateId: string;
    lgaId: string;
    schoolId: string;
    schoolName: string;
    schoolOther: string;
    notListed: boolean;
  };
  dreams: { dreamCareer: string; interests: string[]; communityDream: string; programmeIds: string[] };
  help: { needs: string[]; schoolSubject: string; needsOther: string; deviceAccess: string };
  contact: {
    language: "en" | "yo";
    phone: string;
    email: string;
    guardianName: string;
    guardianRelationship: string;
    guardianPhone: string;
    guardianEmail: string;
    guardianChannel: "whatsapp" | "sms";
    avatarKey: string;
  };
  checkin: { q1?: number; q2?: number; q3?: number; q4?: number; q5?: number; privacy: boolean };
};

const DRAFT_ID = "student";
const TOTAL = 5;

function blank(locale: string, preselect: string | undefined): Data {
  return {
    clientId: uuidv7(),
    startedAt: Date.now(),
    about: {
      firstName: "",
      surname: "",
      age: "",
      gender: "",
      classLevel: "",
      stateId: "",
      lgaId: "",
      schoolId: "",
      schoolName: "",
      schoolOther: "",
      notListed: false,
    },
    dreams: { dreamCareer: "", interests: [], communityDream: "", programmeIds: preselect ? [preselect] : [] },
    help: { needs: [], schoolSubject: "", needsOther: "", deviceAccess: "" },
    contact: {
      language: locale === "yo" ? "yo" : "en",
      phone: "",
      email: "",
      guardianName: "",
      guardianRelationship: "",
      guardianPhone: "",
      guardianEmail: "",
      guardianChannel: "whatsapp",
      avatarKey: AVATARS[Math.floor(Math.random() * 24)]!,
    },
    checkin: { privacy: false },
  };
}

type Done = { firstName: string; guardianName: string | null; isAdult: boolean; handle: string | null; queued?: boolean };

export function StudentIntakeForm({
  options,
  locale,
  preselect,
  contactMode = "phone",
}: {
  options: IntakeOptions;
  locale: string;
  preselect: string | null;
  /** D-018: "email" asks for email addresses instead of phone numbers. */
  contactMode?: "email" | "phone";
}) {
  const byEmail = contactMode === "email";
  const t = useTranslations("join");
  const tc = useTranslations("common");
  const preId = options.programmes.find((p) => p.slug === preselect || p.id === preselect)?.id;
  const [data, setData] = useState<Data>(() => blank(locale, preId));
  const [step, setStep] = useState(1);
  const [statement, setStatement] = useState(1);
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, startTransition] = useTransition();
  const loaded = useRef(false);

  // Restore the draft from this phone, then save after every change (spec/05 §2).
  useEffect(() => {
    const store = offlineDb();
    if (!store) {
      loaded.current = true;
      return;
    }
    store.intakeDrafts
      .get(DRAFT_ID)
      .then((d) => {
        if (d) {
          setData((cur) => ({ ...cur, ...(d.data as Data), startedAt: (d.data as Data).startedAt ?? cur.startedAt }));
          setStep(d.step);
        }
      })
      .finally(() => {
        loaded.current = true;
      });
  }, []);
  useEffect(() => {
    if (!loaded.current || done) return;
    offlineDb()?.intakeDrafts.put({ id: DRAFT_ID, data, step, updatedAt: Date.now() });
  }, [data, step, done]);

  const syncQueue = useCallback(async () => {
    const store = offlineDb();
    if (!store || !navigator.onLine) return;
    for (const item of await store.intakeQueue.toArray()) {
      const res = await submitStudentAction(item.locale, item.payload);
      if (res.ok || res.error.code === "invalid") await store.intakeQueue.delete(item.id);
    }
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("online", syncQueue);
    syncQueue();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("online", syncQueue);
    };
  }, [syncQueue]);

  const set = <K extends keyof Data>(k: K, patch: Partial<Data[K]>) =>
    setData((d) => ({ ...d, [k]: { ...(d[k] as object), ...patch } }));

  const age = typeof data.about.age === "number" ? data.about.age : 0;
  const isMinor = age > 0 && age < 18;
  const activeStates = options.states.filter((s) => s.isActive);
  const stateLgas = options.lgas.filter((l) => l.stateId === data.about.stateId);
  const err = (k: string) => (errors[k] ? t(`errors.${errors[k]}` as never) : undefined);

  function check(schema: ZodTypeAny, value: unknown, prefix = "") {
    const r = schema.safeParse(value);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    for (const i of r.error.issues) e[prefix + i.path.join(".")] ??= i.message;
    setErrors(e);
    // Move focus to the first problem so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=alert]")?.closest(".field")?.querySelector<HTMLElement>("input,button,select,textarea")?.focus());
    return false;
  }

  function validateStep(): boolean {
    if (step === 1) {
      const { schoolName: _s, notListed: _n, ...rest } = data.about;
      return check(stepAbout, { ...rest, lgaId: stateLgas.length ? rest.lgaId : rest.lgaId || "" });
    }
    if (step === 2) return check(stepDreams, data.dreams);
    if (step === 3) return check(stepHelp, data.help);
    if (step === 4) return check(contactRules(age, data.help.deviceAccess, contactMode), data.contact);
    return true;
  }

  function go(delta: number) {
    if (delta > 0 && !validateStep()) return;
    setDir(delta);
    setErrors({});
    if (step === 5) {
      const next = statement + delta;
      if (next >= 1 && next <= 6) return setStatement(next);
    }
    const ns = Math.min(TOTAL, Math.max(1, step + delta));
    if (ns === 5) setStatement(delta > 0 ? 1 : 6);
    setStep(ns);
    window.scrollTo({ top: 0 });
  }

  function payload() {
    const { schoolName: _s, notListed: _n, ...about } = data.about;
    return { clientId: data.clientId, startedAt: data.startedAt, website: "", about, dreams: data.dreams, help: data.help, contact: data.contact, checkin: data.checkin };
  }

  function submit() {
    if (!data.checkin.privacy) {
      setErrors({ privacy: "privacy" });
      return;
    }
    setFormError(null);
    const body = payload();
    if (!navigator.onLine) {
      offlineDb()
        ?.intakeQueue.put({ id: data.clientId, payload: body, locale, queuedAt: Date.now() })
        .then(() => offlineDb()?.intakeDrafts.delete(DRAFT_ID));
      setDone({ firstName: data.about.firstName, guardianName: data.contact.guardianName || null, isAdult: !isMinor, handle: null, queued: true });
      return;
    }
    startTransition(async () => {
      const res = await submitStudentAction(locale, body);
      if (res.ok) {
        await offlineDb()?.intakeDrafts.delete(DRAFT_ID);
        setDone(res.data);
      } else if (res.error.code === "invalid" && res.error.fieldErrors) {
        setFormError(t("errors.server"));
      } else {
        setFormError(t(`errors.${res.error.message}` as never));
      }
    });
  }

  if (done) return <DoneScreen done={done} avatarKey={data.contact.avatarKey} locale={locale} />;

  const stepNames = ["about", "dreams", "help", "contact", "checkin"] as const;
  const progress = (step - 1 + (step === 5 ? (statement - 1) / 6 : 0)) / TOTAL + 1 / TOTAL / 2;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-8">
        {/* Progress: a thin ink line growing by scaleX, with "2 of 5" beside it */}
        <div className="flex items-center gap-4">
          <div className="h-[2px] flex-1 overflow-hidden bg-line" aria-hidden="true">
            <motion.div
              className="h-full origin-left bg-ink"
              animate={{ scaleX: progress }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            />
          </div>
          <span className="text-[14px] tabular text-muted">{t("shell.progress", { step, total: TOTAL })}</span>
        </div>

        {!online && (
          <p className="rounded-[12px] bg-surface p-4 text-[15px]" role="status">
            {t("shell.offline")}
          </p>
        )}

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step === 5 ? `5-${statement}` : step}
            custom={dir}
            initial={{ opacity: 0, x: 12 * dir }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="grid gap-8"
          >
            <h1 className="text-[28px] sm:text-[34px]">{t(`student.steps.${stepNames[step - 1]}`)}</h1>

            {step === 1 && (
              <>
                <label className="field">
                  <span className="text-[16px] font-medium">{t("student.firstName")}</span>
                  <input
                    className="input"
                    autoComplete="given-name"
                    value={data.about.firstName}
                    onChange={(e) => set("about", { firstName: e.target.value })}
                    aria-invalid={!!errors.firstName}
                  />
                  {err("firstName") && <span className="error" role="alert">{err("firstName")}</span>}
                </label>
                <label className="field">
                  <span className="text-[16px] font-medium">{t("student.surname")}</span>
                  <span className="hint">{t("student.surnameHint")}</span>
                  <input
                    className="input"
                    autoComplete="family-name"
                    value={data.about.surname}
                    onChange={(e) => set("about", { surname: e.target.value })}
                    aria-invalid={!!errors.surname}
                  />
                  {err("surname") && <span className="error" role="alert">{err("surname")}</span>}
                </label>
                <Q label={t("student.age")} error={err("age")}>
                  <Stepper value={data.about.age} onChange={(v) => set("about", { age: v })} min={8} max={25} />
                </Q>
                <Q label={t("student.gender")} error={err("gender")} as="fieldset">
                  <Chips
                    name={t("student.gender")}
                    value={data.about.gender}
                    onChange={(v) => set("about", { gender: v })}
                    options={(["female", "male", "prefer_not_to_say"] as const).map((g) => ({ value: g, label: t(`student.genders.${g}`) }))}
                  />
                </Q>
                <Q label={t("student.class")} error={err("classLevel")} as="fieldset">
                  <Chips
                    name={t("student.class")}
                    value={data.about.classLevel}
                    onChange={(v) => set("about", { classLevel: v })}
                    options={CLASS_LEVELS.map((c) => ({ value: c, label: c === "not_in_school" ? t("student.notInSchool") : c }))}
                  />
                </Q>
                <Q label={t("student.state")} error={err("stateId")} as="fieldset">
                  <Chips
                    name={t("student.state")}
                    value={activeStates.some((s) => s.id === data.about.stateId) ? data.about.stateId : data.about.stateId ? "other" : ""}
                    onChange={(v: string) =>
                      set("about", { stateId: v === "other" ? "" : v, lgaId: "", schoolId: "", schoolName: "" })
                    }
                    options={[...activeStates.map((s) => ({ value: s.id, label: s.name })), { value: "other", label: t("student.otherState") }]}
                  />
                  {!activeStates.some((s) => s.id === data.about.stateId) && (data.about.stateId !== "" || errors.stateId === undefined) && (
                    <OtherState options={options} value={data.about.stateId} onChange={(id) => set("about", { stateId: id, lgaId: "", schoolId: "" })} />
                  )}
                </Q>
                {stateLgas.length > 0 && (
                  <label className="field">
                    <span className="text-[16px] font-medium">{t("student.lga")}</span>
                    <select
                      className="input"
                      value={data.about.lgaId}
                      onChange={(e) => set("about", { lgaId: e.target.value })}
                      aria-invalid={!!errors.lgaId}
                    >
                      <option value="">{t("student.lgaPlaceholder")}</option>
                      {stateLgas.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    {err("lgaId") && <span className="error" role="alert">{err("lgaId")}</span>}
                  </label>
                )}
                {data.about.classLevel !== "not_in_school" && data.about.stateId && (
                  <SchoolPicker
                    stateId={data.about.stateId}
                    value={data.about}
                    error={err("schoolId")}
                    onPick={(s) => set("about", { schoolId: s.id, schoolName: s.name, notListed: false, schoolOther: "", lgaId: data.about.lgaId || s.lgaId })}
                    onNotListed={() => set("about", { schoolId: "", schoolName: "", notListed: true })}
                    onOther={(v) => set("about", { schoolOther: v })}
                    onClear={() => set("about", { schoolId: "", schoolName: "" })}
                  />
                )}
              </>
            )}

            {step === 2 && (
              <>
                <label className="field">
                  <span className="text-[16px] font-medium">{t("student.dream")}</span>
                  <input
                    className="input"
                    maxLength={60}
                    value={data.dreams.dreamCareer}
                    onChange={(e) => set("dreams", { dreamCareer: e.target.value })}
                    aria-invalid={!!errors.dreamCareer}
                  />
                  <span className="flex flex-wrap gap-2">
                    {t("student.dreamSuggestions")
                      .split("|")
                      .map((s) => (
                        <button key={s} type="button" className="rounded-[8px] bg-surface px-3 py-2 text-[14px]" onClick={() => set("dreams", { dreamCareer: s })}>
                          {s}
                        </button>
                      ))}
                  </span>
                  {err("dreamCareer") && <span className="error" role="alert">{err("dreamCareer")}</span>}
                </label>
                <Q label={t("student.interests")} error={err("interests")} as="fieldset">
                  <Chips
                    multiple
                    name={t("student.interests")}
                    value={data.dreams.interests}
                    onChange={(v) => set("dreams", { interests: v })}
                    options={INTERESTS.map((i) => ({ value: i, label: t(`student.interestOptions.${i}`) }))}
                  />
                </Q>
                <label className="field">
                  <span className="text-[16px] font-medium">
                    {t("student.communityDream")} <span className="font-normal text-muted">({tc("optional")})</span>
                  </span>
                  <textarea className="input" maxLength={200} value={data.dreams.communityDream} onChange={(e) => set("dreams", { communityDream: e.target.value })} />
                </label>
                <Q label={t("student.programme")} error={err("programmeIds")} as="fieldset">
                  <div className="grid gap-2">
                    {options.programmes.map((p) => {
                      const on = data.dreams.programmeIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() =>
                            set("dreams", {
                              programmeIds: on ? data.dreams.programmeIds.filter((x) => x !== p.id) : [...data.dreams.programmeIds, p.id],
                            })
                          }
                          className={`grid gap-1 rounded-[12px] border p-4 text-left transition-colors ${on ? "border-ink bg-ink text-bg" : "border-transparent bg-surface"}`}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className={`text-[14px] ${on ? "text-bg/80" : "text-muted"}`}>{p.summary}</span>
                        </button>
                      );
                    })}
                  </div>
                </Q>
              </>
            )}

            {step === 3 && (
              <>
                <Q label={t("student.needs")} error={err("needs")} as="fieldset">
                  <Chips
                    multiple
                    name={t("student.needs")}
                    value={data.help.needs}
                    onChange={(v) => set("help", { needs: v })}
                    options={NEEDS.map((n) => ({ value: n, label: t(`student.needOptions.${n}`) }))}
                  />
                </Q>
                {data.help.needs.includes("school_subject") && (
                  <label className="field">
                    <span className="text-[16px] font-medium">{t("student.subject")}</span>
                    <input className="input" value={data.help.schoolSubject} onChange={(e) => set("help", { schoolSubject: e.target.value })} />
                  </label>
                )}
                {data.help.needs.includes("other") && (
                  <label className="field">
                    <span className="text-[16px] font-medium">{t("student.needsOther")}</span>
                    <input className="input" value={data.help.needsOther} onChange={(e) => set("help", { needsOther: e.target.value })} />
                  </label>
                )}
                <Q label={t("student.device")} error={err("deviceAccess")} as="fieldset">
                  <Chips
                    name={t("student.device")}
                    value={data.help.deviceAccess}
                    onChange={(v) => set("help", { deviceAccess: v })}
                    options={DEVICES.map((d) => ({ value: d, label: t(`student.devices.${d}`) }))}
                  />
                </Q>
              </>
            )}

            {step === 4 && (
              <>
                <Q label={t("student.language")} as="fieldset">
                  <Chips
                    name={t("student.language")}
                    value={data.contact.language}
                    onChange={(v) => set("contact", { language: v })}
                    options={[
                      { value: "en", label: "English" },
                      { value: "yo", label: "Yorùbá" },
                    ]}
                  />
                </Q>
                {byEmail ? (
                  <label className="field">
                    <span className="text-[16px] font-medium">
                      {t("student.email")} {isMinor && <span className="font-normal text-muted">({tc("optional")})</span>}
                    </span>
                    <span className="hint">{t(isMinor ? "student.emailHint" : "student.emailHintAdult")}</span>
                    <input className="input" type="email" inputMode="email" autoComplete="email" value={data.contact.email ?? ""} onChange={(e) => set("contact", { email: e.target.value })} aria-invalid={!!errors.email} />
                    {err("email") && <span className="error" role="alert">{err("email")}</span>}
                  </label>
                ) : (
                  <label className="field">
                    <span className="text-[16px] font-medium">
                      {t("student.phone")} <span className="font-normal text-muted">({tc("optional")})</span>
                    </span>
                    <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={data.contact.phone} onChange={(e) => set("contact", { phone: e.target.value })} aria-invalid={!!errors.phone} />
                    {err("phone") && <span className="error" role="alert">{err("phone")}</span>}
                  </label>
                )}
                {isMinor && (
                  <>
                    <label className="field">
                      <span className="text-[16px] font-medium">{t("student.guardianName")}</span>
                      <input className="input" value={data.contact.guardianName} onChange={(e) => set("contact", { guardianName: e.target.value })} aria-invalid={!!errors.guardianName} />
                      {err("guardianName") && <span className="error" role="alert">{err("guardianName")}</span>}
                    </label>
                    <label className="field">
                      <span className="text-[16px] font-medium">{t("student.guardianRelationship")}</span>
                      <select className="input" value={data.contact.guardianRelationship} onChange={(e) => set("contact", { guardianRelationship: e.target.value })} aria-invalid={!!errors.guardianRelationship}>
                        <option value="" />
                        {RELATIONSHIPS.map((r) => (
                          <option key={r} value={r}>
                            {t(`student.relationships.${r}`)}
                          </option>
                        ))}
                      </select>
                      {err("guardianRelationship") && <span className="error" role="alert">{err("guardianRelationship")}</span>}
                    </label>
                    {byEmail ? (
                      <label className="field">
                        <span className="text-[16px] font-medium">{t("student.guardianEmail")}</span>
                        <span className="hint">{t("student.guardianEmailHint")}</span>
                        <input className="input" type="email" inputMode="email" value={data.contact.guardianEmail ?? ""} onChange={(e) => set("contact", { guardianEmail: e.target.value })} aria-invalid={!!errors.guardianEmail} />
                        {err("guardianEmail") && <span className="error" role="alert">{err("guardianEmail")}</span>}
                      </label>
                    ) : (
                    <>
                    <label className="field">
                      <span className="text-[16px] font-medium">{t("student.guardianPhone")}</span>
                      <span className="hint">{t("student.guardianPhoneHint")}</span>
                      <input className="input" type="tel" inputMode="tel" value={data.contact.guardianPhone} onChange={(e) => set("contact", { guardianPhone: e.target.value })} aria-invalid={!!errors.guardianPhone} />
                      {err("guardianPhone") && <span className="error" role="alert">{err("guardianPhone")}</span>}
                    </label>
                    <Q label={t("student.guardianChannel")} as="fieldset">
                      <Chips
                        name={t("student.guardianChannel")}
                        value={data.contact.guardianChannel}
                        onChange={(v) => set("contact", { guardianChannel: v })}
                        options={[
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "sms", label: "SMS" },
                        ]}
                      />
                    </Q>
                    </>
                    )}
                  </>
                )}
                <Q label={t("student.avatar")} as="fieldset">
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={t("student.avatar")}>
                    {AVATARS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        role="radio"
                        aria-checked={data.contact.avatarKey === a}
                        aria-label={a}
                        onClick={() => set("contact", { avatarKey: a })}
                        className={`grid aspect-square place-items-center rounded-full p-[3px] ${data.contact.avatarKey === a ? "ring-2 ring-ink" : ""}`}
                      >
                        <Avatar avatarKey={a} size={48} className="h-full w-full" />
                      </button>
                    ))}
                  </div>
                </Q>
              </>
            )}

            {step === 5 && statement <= 5 && (
              <div className="grid gap-10">
                <div className="grid gap-2">
                  <p className="text-[15px] text-muted">
                    {t("student.checkinLead")} · {t("student.statementOf", { n: statement })}
                  </p>
                  <p className="serif text-[22px] leading-snug">{t(`student.q${statement}` as never)}</p>
                </div>
                <CircleScale
                  label={t(`student.q${statement}` as never)}
                  low={t("student.scaleLow")}
                  high={t("student.scaleHigh")}
                  value={data.checkin[`q${statement}` as "q1"]}
                  onChange={(n) => {
                    set("checkin", { [`q${statement}`]: n } as Partial<Data["checkin"]>);
                    setTimeout(() => {
                      setDir(1);
                      setStatement((s) => s + 1);
                    }, 220);
                  }}
                />
              </div>
            )}

            {step === 5 && statement === 6 && (
              <div className="grid gap-6">
                <label className="flex min-h-12 items-start gap-3 text-[16px]">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-[#1A1712]"
                    checked={data.checkin.privacy}
                    onChange={(e) => set("checkin", { privacy: e.target.checked })}
                  />
                  <span>
                    {t("student.privacy")}.{" "}
                    <Link href="/privacy" className="uline font-medium" target="_blank">
                      {t("student.privacyLink")}
                    </Link>
                  </span>
                </label>
                {errors.privacy && (
                  <p className="error" role="alert">
                    {t("errors.privacy")}
                  </p>
                )}
                {formError && (
                  <p className="rounded-[12px] bg-surface p-4 text-[15px]" role="alert">
                    {formError}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Hidden honeypot for bots (spec/05 §7) */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" defaultValue="" />

        <p className="text-[14px] text-muted">{t("shell.saved")}</p>
      </div>

      {/* "Next" pinned at the foot; "Back" as a text link */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4">
          {step > 1 || statement > 1 ? (
            <button type="button" className="uline min-h-12 text-[16px] font-medium" onClick={() => go(-1)}>
              {tc("back")}
            </button>
          ) : (
            <span />
          )}
          {step === 5 && statement === 6 ? (
            <button type="button" className="btn btn--lg min-w-[200px]" onClick={submit} disabled={pending} aria-busy={pending}>
              {pending ? tc("sending") : t("student.submit")}
            </button>
          ) : step === 5 ? (
            <button type="button" className="btn btn--lg min-w-[160px]" onClick={() => go(1)} disabled={!data.checkin[`q${statement}` as "q1"]}>
              {tc("next")}
            </button>
          ) : (
            <button type="button" className="btn btn--lg min-w-[160px]" onClick={() => go(1)}>
              {tc("next")}
            </button>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}

function Stepper({ value, onChange, min, max }: { value: number | ""; onChange: (v: number) => void; min: number; max: number }) {
  const v = value === "" ? 13 : value;
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="h-12 w-12 rounded-[8px] bg-surface text-[22px]" aria-label="−1" onClick={() => onChange(Math.max(min, v - 1))}>
        −
      </button>
      <output className="serif w-16 text-center text-[28px] tabular" aria-live="polite">
        {value === "" ? "–" : value}
      </output>
      <button type="button" className="h-12 w-12 rounded-[8px] bg-surface text-[22px]" aria-label="+1" onClick={() => onChange(Math.min(max, value === "" ? 13 : v + 1))}>
        +
      </button>
    </div>
  );
}

function OtherState({ options, value, onChange }: { options: IntakeOptions; value: string; onChange: (id: string) => void }) {
  return (
    <select className="input mt-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" />
      {options.states
        .filter((s) => !s.isActive)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
    </select>
  );
}

type SchoolHit = { id: string; name: string; town: string | null; lga: string; lgaId: string };
function SchoolPicker({
  stateId,
  value,
  error,
  onPick,
  onNotListed,
  onOther,
  onClear,
}: {
  stateId: string;
  value: Data["about"];
  error?: string;
  onPick: (s: SchoolHit) => void;
  onNotListed: () => void;
  onOther: (v: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations("join.student");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SchoolHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const id = setTimeout(() => searchSchoolsAction(stateId, q).then(setHits), 200);
    return () => clearTimeout(id);
  }, [q, stateId]);

  const listId = useMemo(() => `schools-${stateId.slice(0, 6)}`, [stateId]);

  return (
    <div className="field">
      <span className="text-[16px] font-medium">{t("school")}</span>
      {value.schoolId ? (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-surface p-4">
          <span className="font-medium">{value.schoolName}</span>
          <button type="button" className="uline text-[15px]" onClick={onClear}>
            {t("schoolChange")}
          </button>
        </div>
      ) : value.notListed ? (
        <>
          <input className="input" placeholder={t("schoolOther")} value={value.schoolOther} onChange={(e) => onOther(e.target.value)} aria-invalid={!!error} />
        </>
      ) : (
        <>
          <input
            className="input"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            placeholder={t("schoolPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-invalid={!!error}
          />
          {(hits.length > 0 || q.trim().length >= 2) && (
            <ul id={listId} role="listbox" className="overflow-hidden rounded-[12px] border border-line">
              {hits.map((h) => (
                <li key={h.id} role="option" aria-selected={false}>
                  <button type="button" className="grid w-full gap-0.5 border-b border-line px-4 py-3 text-left hover:bg-surface" onClick={() => onPick(h)}>
                    <span className="font-medium">{h.name}</span>
                    <span className="text-[14px] text-muted">{[h.town, h.lga].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={false}>
                <button type="button" className="w-full px-4 py-3 text-left font-medium hover:bg-surface" onClick={onNotListed}>
                  {t("schoolNotListed")}
                </button>
              </li>
            </ul>
          )}
        </>
      )}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function DoneScreen({ done, avatarKey, locale }: { done: Done; avatarKey: string; locale: string }) {
  const t = useTranslations("join.student.done");
  const [reminded, setReminded] = useState(false);
  const [pending, startTransition] = useTransition();
  const steps = [
    done.isAdult ? t("step1Adult") : t("step1", { guardianName: done.guardianName ?? "" }),
    t("step2"),
    t("step3"),
  ];
  // Moment 1 (DESIGN.md §8.5): the ring draws (600ms), the name appears, the steps arrive 60ms apart.
  return (
    <MotionConfig reducedMotion="user">
      <div className="grid justify-items-start gap-8 pt-6">
        <div className="relative h-[120px] w-[120px]">
          <svg className="absolute inset-0" viewBox="0 0 120 120" aria-hidden="true">
            <motion.circle
              cx="60"
              cy="60"
              r="57"
              fill="none"
              stroke="#FFB800"
              strokeWidth="3"
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-[10px]">
            <Avatar avatarKey={avatarKey} size={100} />
          </div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.2 }} className="grid gap-2">
          <h1 className="text-[34px]" role="status">
            {t("title", { firstName: done.firstName })}
          </h1>
          <p className="text-muted">{t("lead")}</p>
        </motion.div>
        <ol className="steps grid gap-5">
          {steps.map((s, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.06, duration: 0.2, ease: "easeOut" }}>
              <p className="!text-ink">{s}</p>
            </motion.li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/" className="btn btn--lg">
            {t("home")}
          </Link>
          {!done.isAdult && done.handle && (
            <button
              type="button"
              className="uline text-[16px] font-medium"
              disabled={pending || reminded}
              onClick={() =>
                startTransition(async () => {
                  const r = await remindGuardianAction(locale, done.handle!);
                  if (r.ok) setReminded(true);
                })
              }
            >
              {reminded ? t("reminded") : t("remind")}
            </button>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
