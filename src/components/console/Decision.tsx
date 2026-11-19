"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { decideAction, type DecisionKind } from "@/app/[locale]/console/people/actions";

type Option = { decision: string; label: string; primary?: boolean; confirm?: string };

/**
 * Approve / decline buttons for one row. A declining choice asks once ("Decline Ada? Yes / No")
 * before it is sent; approving goes straight through. The list refreshes afterwards.
 */
export function Decision({ kind, id, options }: { kind: DecisionKind; id: string; options: Option[] }) {
  const t = useTranslations("console");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<Option | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = (o: Option) =>
    start(async () => {
      setErr(null);
      const r = await decideAction({ kind, id, decision: o.decision });
      setAsking(null);
      if (r.ok) router.refresh();
      else setErr(r.code === "denied" ? t("people.denied") : r.code === "wrong_status" ? t("people.alreadyDecided") : t("actionFailed"));
    });

  if (asking) {
    return (
      <div className="grid min-w-[200px] gap-2" role="group" aria-label={asking.label}>
        <p className="text-[14px]">{asking.confirm}</p>
        <div className="flex gap-3">
          <button type="button" className="btn btn--plain !min-h-10 !px-4 !text-[14px]" disabled={pending} onClick={() => send(asking)}>
            {pending ? t("people.saving") : t("people.yes")}
          </button>
          <button type="button" className="uline text-[14px]" disabled={pending} onClick={() => setAsking(null)}>
            {t("people.no")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-[160px] gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {options.map((o) =>
          o.primary ? (
            <button key={o.decision} type="button" className="btn !min-h-10 !px-4 !text-[14px]" disabled={pending} onClick={() => (o.confirm ? setAsking(o) : send(o))}>
              {pending ? t("people.saving") : o.label}
            </button>
          ) : (
            <button key={o.decision} type="button" className="uline text-[14px]" disabled={pending} onClick={() => (o.confirm ? setAsking(o) : send(o))}>
              {o.label}
            </button>
          ),
        )}
      </div>
      {err && (
        <p role="alert" className="text-[14px] text-[var(--p-danger)]">
          {err}
        </p>
      )}
    </div>
  );
}
