"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addSessionAction, cancelSessionAction, generateSessionsAction, type SessionResult } from "@/app/[locale]/app/session/actions";

function useFail() {
  const t = useTranslations("console.groups.sessions");
  return (r: SessionResult) => (r.ok ? "" : ["denied", "invalid", "closed", "no_schedule", "not_planned"].includes(r.code) ? t(`err.${r.code}` as "err.denied") : t("err.failed"));
}

/** "Create the weekly sessions" from the group's day, time and dates; safe to press twice. */
export function GenerateSessions({ cohortId }: { cohortId: string }) {
  const t = useTranslations("console.groups.sessions");
  const fail = useFail();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn--plain"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await generateSessionsAction(cohortId);
            setMsg(r.ok ? { ok: true, text: t("created", { n: r.created ?? 0 }) } : { ok: false, text: fail(r) });
            if (r.ok) router.refresh();
          })
        }
      >
        {t("generate")}
      </button>
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[15px]" : "error"}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

/** Add one extra session (a make-up or a special date). */
export function AddSession({ cohortId, defaultTime, defaultVenue }: { cohortId: string; defaultTime: string; defaultVenue: string }) {
  const t = useTranslations("console.groups.sessions");
  const fail = useFail();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <details>
      <summary className="cursor-pointer font-medium">{t("addTitle")}</summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await addSessionAction(cohortId, { date: f.get("date"), time: f.get("time"), durationMinutes: Number(f.get("duration")), venue: f.get("venue") || undefined });
            setErr(fail(r));
            if (r.ok) router.refresh();
          });
        }}
      >
        <div className="field">
          <label htmlFor={`${cohortId}-date`}>{t("date")}</label>
          <input id={`${cohortId}-date`} className="input" type="date" name="date" required />
        </div>
        <div className="field">
          <label htmlFor={`${cohortId}-time`}>{t("time")}</label>
          <input id={`${cohortId}-time`} className="input" type="time" name="time" required defaultValue={defaultTime} />
        </div>
        <div className="field">
          <label htmlFor={`${cohortId}-duration`}>{t("duration")}</label>
          <input id={`${cohortId}-duration`} className="input" type="number" name="duration" min={15} max={240} step={15} defaultValue={60} required />
        </div>
        <div className="field">
          <label htmlFor={`${cohortId}-venue`}>{t("venue")}</label>
          <input id={`${cohortId}-venue`} className="input" name="venue" defaultValue={defaultVenue} maxLength={120} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
          <button type="submit" className="btn btn--plain" disabled={pending}>
            {t("add")}
          </button>
          {err && (
            <span className="error" role="alert">
              {err}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}

/** Cancel a planned session (holidays, exams), with a reason. */
export function CancelSession({ sessionId }: { sessionId: string }) {
  const t = useTranslations("console.groups.sessions");
  const fail = useFail();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  if (!open)
    return (
      <button type="button" className="uline text-[14px]" onClick={() => setOpen(true)}>
        {t("cancel")}
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await cancelSessionAction(sessionId, reason);
          setErr(fail(r));
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="sr-only" htmlFor={`reason-${sessionId}`}>
        {t("reason")}
      </label>
      <input id={`reason-${sessionId}`} className="input !min-h-10 max-w-[220px]" placeholder={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200} />
      <button type="submit" className="btn btn--plain !min-h-10" disabled={pending || !reason.trim()}>
        {t("cancelConfirm")}
      </button>
      <button type="button" className="uline text-[14px]" onClick={() => setOpen(false)}>
        {t("keep")}
      </button>
      {err && (
        <span className="error text-[14px]" role="alert">
          {err}
        </span>
      )}
    </form>
  );
}
