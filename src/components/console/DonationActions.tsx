"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markRefundedAction, resendReceiptAction, saveNotesAction } from "@/app/[locale]/console/donations/actions";

/** Per-gift actions on the supporter page: receipt download, resend, mark refunded (with confirmation). */
export function GiftActions({ donationId, status }: { donationId: string; status: string }) {
  const t = useTranslations("console");
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");

  if (status !== "paid") return <span className="text-muted">–</span>;

  return (
    <div className="grid min-w-[240px] gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
        <a href={`/api/console/donations/${donationId}/receipt`} className="uline" target="_blank" rel="noopener">
          {t("viewReceipt")}
        </a>
        <button
          type="button"
          className="uline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendReceiptAction(donationId);
              setMsg(r.ok ? { kind: "ok", text: t("receiptResent") } : { kind: "err", text: t("actionFailed") });
            })
          }
        >
          {pending && !confirming ? t("sending") : t("resendReceipt")}
        </button>
        {!confirming && (
          <button type="button" className="uline" onClick={() => setConfirming(true)}>
            {t("markRefunded")}
          </button>
        )}
      </div>
      {confirming && (
        <div className="grid gap-2 rounded-[var(--r-sm)] border border-line p-3" role="group" aria-labelledby={`${id}-rf`}>
          <p id={`${id}-rf`} className="text-[14px]">
            {t("refundConfirm")}
          </p>
          <label className="sr-only" htmlFor={`${id}-note`}>
            {t("refundNote")}
          </label>
          <input id={`${id}-note`} className="input !min-h-10" placeholder={t("refundNote")} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn--plain !min-h-10 !px-4 !text-[14px]"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await markRefundedAction(donationId, note);
                  if (r.ok) {
                    setConfirming(false);
                    setMsg({ kind: "ok", text: t("refunded") });
                    router.refresh();
                  } else setMsg({ kind: "err", text: t("actionFailed") });
                })
              }
            >
              {pending ? t("saving") : t("confirmRefund")}
            </button>
            <button type="button" className="uline text-[14px]" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      <p aria-live="polite" className={`text-[14px] ${msg?.kind === "err" ? "text-[var(--p-danger)]" : "text-muted"}`}>
        {msg?.text}
      </p>
    </div>
  );
}

export function SupporterNotes({ supporterId, initial }: { supporterId: string; initial: string }) {
  const t = useTranslations("console");
  const id = useId();
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveNotesAction(supporterId, notes);
          setMsg(r.ok ? t("saved") : t("actionFailed"));
        });
      }}
    >
      <label htmlFor={`${id}-notes`} className="font-medium">
        {t("notes")}
      </label>
      <textarea id={`${id}-notes`} className="input" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn--plain" disabled={pending}>
          {pending ? t("saving") : t("saveNotes")}
        </button>
        <span aria-live="polite" className="text-[14px] text-muted">
          {msg}
        </span>
      </div>
    </form>
  );
}
