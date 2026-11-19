"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

export type ChangeResult = { ok: true; data: { sentTo: string | null } } | { ok: false; error: { code: string; message: string } };

const ERRORS: Record<string, "errRateLimited" | "errNotPending" | "errEmail" | "errExpired"> = {
  rate_limited: "errRateLimited",
  not_pending: "errNotPending",
  email_required: "errEmail",
  expired: "errExpired",
};

/**
 * One email with "Change" to correct it (D-019): on the sign-up thank-you screen and the Hub
 * profile. A new guardian email sends a fresh permission request.
 */
export function EmailRow({
  label,
  value,
  required,
  guardian = false,
  submit,
  onSaved,
}: {
  label: string;
  value: string;
  required: boolean;
  guardian?: boolean;
  submit: (email: string) => Promise<ChangeResult>;
  onSaved?: (email: string) => void;
}) {
  const t = useTranslations("join.student.done");
  const [shown, setShown] = useState(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `edit-${guardian ? "guardian" : "own"}-email`;

  function save() {
    const v = draft.trim().toLowerCase();
    if (v === shown) return setEditing(false);
    if ((!v && required) || (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return setError(t("errEmail"));
    setError(null);
    startTransition(async () => {
      const r = await submit(v).catch(() => ({ ok: false as const, error: { code: "server", message: "server" } }));
      if (!r.ok) {
        const key = r.error.code === "invalid" ? (r.error.message === "expired" ? "errExpired" : "errEmail") : ERRORS[r.error.code];
        return setError(t(key ?? "errServer"));
      }
      setShown(v);
      onSaved?.(v);
      setEditing(false);
      setNote(guardian && r.data.sentTo ? t("resent", { email: v }) : t("saved"));
    });
  }

  return (
    <div className="grid gap-2">
      {editing ? (
        <>
          <label htmlFor={id} className="text-[15px] font-medium">
            {label}
          </label>
          <input
            id={id}
            className="input"
            type="email"
            inputMode="email"
            autoComplete={guardian ? "off" : "email"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            autoFocus
          />
          {error && (
            <span className="error" role="alert">
              {error}
            </span>
          )}
          <div className="flex items-center gap-5">
            <button type="button" className="btn" onClick={save} disabled={pending} aria-busy={pending}>
              {pending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className="uline text-[15px]"
              onClick={() => {
                setDraft(shown);
                setError(null);
                setEditing(false);
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="grid gap-0.5">
            <span className="text-[14px] text-muted">{label}</span>
            <span className="break-all font-medium">{shown || t("notGiven")}</span>
          </span>
          <button
            type="button"
            className="uline text-[15px] font-medium"
            onClick={() => {
              setNote(null);
              setDraft(shown);
              setEditing(true);
            }}
          >
            {shown ? t("change") : t("add")}
          </button>
        </div>
      )}
      {note && (
        <p className="text-[15px]" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
