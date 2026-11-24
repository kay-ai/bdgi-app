"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { reviewScorecardAction } from "@/app/[locale]/app/volunteer/actions";

const REASONS = ["score_wrong", "feedback_wrong", "feedback_unhelpful", "tone", "other"] as const;

/** "Looks right" or "Needs a look" on one AI scorecard; a concern goes to BGDI staff. */
export function ReviewScorecard({ attemptId, current, resolved }: { attemptId: string; current: { verdict: "ok" | "concern"; reason: string | null } | null; resolved: boolean }) {
  const t = useTranslations("hub.supervise.review");
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (verdict: "ok" | "concern") =>
    start(async () => {
      setMsg(null);
      const r = await reviewScorecardAction({ attemptId, verdict, reason: verdict === "concern" ? reason : null, note: verdict === "concern" ? note : null }).catch(() => ({ ok: false as const, code: "error" }));
      if (r.ok) {
        setOpen(false);
        setMsg(verdict === "ok" ? t("thanksOk") : t("thanksConcern"));
        router.refresh();
      } else setMsg(t("failed"));
    });

  return (
    <div className="grid gap-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[14px] font-medium">{t("question")}</span>
        <button type="button" className={`opt !min-h-10 !px-4 text-[14px]`} aria-pressed={current?.verdict === "ok"} disabled={pending} onClick={() => send("ok")}>
          {t("ok")}
        </button>
        <button type="button" className={`opt !min-h-10 !px-4 text-[14px]`} aria-pressed={current?.verdict === "concern" || open} aria-expanded={open} disabled={pending} onClick={() => setOpen((o) => !o)}>
          {t("concern")}
        </button>
        {current?.verdict === "concern" && <span className="text-[13px] text-muted">{resolved ? t("resolved") : t("withStaff")}</span>}
      </div>
      {open && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setMsg(t("pickReason"));
            send("concern");
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[14px]">{t("whatsWrong")}</legend>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <label key={r} className="opt !min-h-10 text-[14px]">
                  <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} />
                  <span>{t(`reason.${r}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor={`${id}-note`} className="text-[14px]">
              {t("note")}
            </label>
            <textarea id={`${id}-note`} className="input min-h-20" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
          </div>
          <button className="btn justify-self-start" disabled={pending} aria-busy={pending}>
            {t("send")}
          </button>
        </form>
      )}
      {msg && (
        <p className="text-[14px]" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
