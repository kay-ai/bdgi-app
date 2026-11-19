"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setAiPracticeAction } from "@/app/[locale]/app/guardian/actions";

/** A guardian's on/off for one child's AI speech practice. Saves straight away and says so. */
export function AiPracticeSwitch({ studentId, name, initial }: { studentId: string; name: string; initial: boolean }) {
  const t = useTranslations("hub");
  const id = useId();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[var(--p-ink)]"
          checked={on}
          disabled={pending}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setMsg(null);
            start(async () => {
              const r = await setAiPracticeAction(studentId, next);
              if (r.ok) setMsg({ kind: "ok", text: next ? t("aiOnSaved", { name }) : t("aiOffSaved", { name }) });
              else {
                setOn(!next);
                setMsg({ kind: "err", text: t("aiFailed") });
              }
            });
          }}
        />
        <span className="grid gap-1">
          <span className="font-medium">{t("aiLabel", { name })}</span>
          <span id={`${id}-help`} className="text-[14px] text-muted">
            {t("aiHelp")}
          </span>
        </span>
      </label>
      <p role="status" aria-live="polite" className={`text-[14px] ${msg?.kind === "err" ? "text-[var(--p-danger)]" : "text-muted"}`}>
        {pending ? t("saving") : (msg?.text ?? "")}
      </p>
    </div>
  );
}
