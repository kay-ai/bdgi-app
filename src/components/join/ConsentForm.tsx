"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { decideAction, withdrawAction } from "@/app/[locale]/(join)/consent/[token]/actions";

type Current = { participation: boolean; photo: boolean; ai_practice: boolean; stories: boolean };

export function ConsentForm({
  token,
  locale,
  name,
  initial,
  state,
  relationship,
  attemptsLeft,
  phone,
}: {
  token: string;
  locale: string;
  name: string;
  initial: Current;
  state: "open" | "given" | "declined";
  relationship: string;
  attemptsLeft: number;
  phone: string;
}) {
  const t = useTranslations("consent");
  const tr = useTranslations("join.student.relationships");
  const [view, setView] = useState<"form" | "given" | "declined" | "withdrawn">(
    state === "given" ? "given" : state === "declined" ? "declined" : "form",
  );
  const [editing, setEditing] = useState(state === "open");
  const [choices, setChoices] = useState({
    participation: initial.participation,
    photo: initial.photo,
    aiPractice: initial.ai_practice,
    stories: initial.stories,
  });
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  function explain(r: { ok: false; code: string; left?: number }) {
    if (r.code === "bad_code") return t("badCode", { left: r.left ?? attemptsLeft });
    if (r.code === "locked") return t("locked", { phone });
    if (r.code === "expired") return t("expired", { phone });
    if (r.code === "form") return t("needParticipation");
    return t("invalid");
  }

  function submit(give: boolean) {
    setError(null);
    if (give && !choices.participation) return setError(t("needParticipation"));
    start(async () => {
      const r = await decideAction(locale, { token, code: code.trim(), fullName, give, photo: choices.photo, aiPractice: choices.aiPractice, stories: choices.stories });
      if (r.ok) {
        setView(r.given ? "given" : "declined");
        setEditing(false);
        setCode("");
      } else setError(explain(r));
    });
  }

  function doWithdraw() {
    setError(null);
    start(async () => {
      const r = await withdrawAction(locale, { token, code: code.trim() });
      if (r.ok) setView("withdrawn");
      else setError(explain(r));
    });
  }

  if (view === "withdrawn") {
    return (
      <section className="grid gap-3" role="status">
        <h2 className="text-[24px]">{t("withdrawnTitle")}</h2>
        <p>{t("withdrawnLead", { name })}</p>
      </section>
    );
  }

  const Box = ({ k, label, optional }: { k: keyof typeof choices; label: string; optional?: boolean }) => (
    <label className="flex cursor-pointer items-start gap-4 rounded-[12px] bg-surface p-4">
      <input
        type="checkbox"
        className="mt-1 h-6 w-6 flex-none accent-[#1A1712]"
        checked={choices[k]}
        disabled={!editing}
        onChange={(e) => setChoices((c) => ({ ...c, [k]: e.target.checked }))}
      />
      <span>
        {label}
        {optional && <span className="block text-[15px] text-muted">{t("optional")}</span>}
      </span>
    </label>
  );

  const codeField = (
    <label className="field">
      <span className="text-[16px] font-medium">{t("code")}</span>
      <input
        className="input max-w-[200px] text-[22px] tracking-[0.3em] tabular"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );

  return (
    <section className="grid gap-6">
      {view === "given" && !editing && (
        <div className="grid gap-2" role="status">
          <h2 className="text-[24px]">{t("givenTitle")}</h2>
          <p>{t("givenLead", { name })}</p>
        </div>
      )}
      {view === "declined" && !editing && (
        <div className="grid gap-2" role="status">
          <h2 className="text-[24px]">{t("declinedTitle")}</h2>
          <p>{t("declinedLead", { name })}</p>
        </div>
      )}

      <h2 className="text-[24px]">{editing ? t("choicesTitle") : t("currentTitle", { name })}</h2>
      <div className="grid gap-3">
        <Box k="participation" label={t("participation", { name })} />
        <Box k="photo" label={t("photo", { name })} optional />
        <Box k="aiPractice" label={t("aiPractice", { name })} optional />
        <Box k="stories" label={t("stories", { name })} optional />
      </div>

      {editing ? (
        <>
          <label className="field">
            <span className="text-[16px] font-medium">{t("fullName")}</span>
            <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          {relationship && (
            <p className="text-[16px] text-muted">
              {t("relationship", { name })}: {tr(relationship as "mother")}
            </p>
          )}
          {codeField}
          {error && (
            <p className="error text-[16px]" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button type="button" className="btn btn--lg" disabled={pending || fullName.length < 2 || code.length !== 6} onClick={() => submit(true)}>
              {t("give")}
            </button>
            <button type="button" className="uline min-h-12 self-start text-[16px] font-medium sm:self-auto" disabled={pending || code.length !== 6 || fullName.length < 2} onClick={() => submit(false)}>
              {t("decline")}
            </button>
          </div>
        </>
      ) : (
        <div className="grid gap-4">
          {confirmWithdraw ? (
            <div className="grid gap-4 rounded-[12px] border border-line p-4">
              <p>{t("withdrawConfirm", { name })}</p>
              {codeField}
              {error && (
                <p className="error text-[16px]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-6">
                <button type="button" className="btn btn--plain" style={{ ["--btn-bg" as string]: "#B3261E" }} disabled={pending || code.length !== 6} onClick={doWithdraw}>
                  {t("withdraw")}
                </button>
                <button type="button" className="uline" onClick={() => setConfirmWithdraw(false)}>
                  {t("no")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                {t("change")}
              </button>
              {view === "given" && (
                <button type="button" className="uline font-medium" onClick={() => setConfirmWithdraw(true)}>
                  {t("withdraw")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
