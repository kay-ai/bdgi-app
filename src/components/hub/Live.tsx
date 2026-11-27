"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Radio, Square } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { attendanceAction, endSessionAction, startSessionAction } from "@/app/[locale]/app/session/actions";

/** "Start session": opens the room, emails the students, then takes the coach in (D-025). */
export function StartSession({ sessionId, disabled }: { sessionId: string; disabled?: boolean }) {
  const t = useTranslations("live");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="btn btn--gold btn--plain"
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await startSessionAction(sessionId);
            if (r.ok) router.push(`/app/session/${sessionId}`);
            else setErr(t(`err.${["too_early", "too_late", "not_planned", "denied"].includes(r.code) ? r.code : "error"}` as never));
          })
        }
      >
        <Radio size={18} aria-hidden="true" />
        {pending ? t("starting") : t("start")}
      </button>
      {err && (
        <p className="error text-[14px]" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

export function EndSession({ sessionId }: { sessionId: string }) {
  const t = useTranslations("live");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  if (!ask)
    return (
      <button type="button" className="btn btn--plain" onClick={() => setAsk(true)}>
        <Square size={16} aria-hidden="true" />
        {t("end")}
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[15px]">{t("endAsk")}</span>
      <button
        type="button"
        className="btn btn--plain"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await endSessionAction(sessionId);
            router.push("/app/volunteer");
          })
        }
      >
        {t("endConfirm")}
      </button>
      <button type="button" className="uline text-[15px]" onClick={() => setAsk(false)}>
        {t("cancel")}
      </button>
    </div>
  );
}

type Mark = "present" | "absent" | "excused";

/** The coach's attendance list: tap to change; saved together. */
export function Attendance({ sessionId, roster }: { sessionId: string; roster: { personId: string; firstName: string; status: Mark | null }[] }) {
  const t = useTranslations("live");
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries(roster.map((r) => [r.personId, r.status ?? "absent"])));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  if (!roster.length) return <p className="text-muted">{t("noStudents")}</p>;
  const present = Object.values(marks).filter((m) => m === "present").length;
  return (
    <div className="grid gap-3">
      <p className="text-[15px] text-muted tabular">{t("presentCount", { n: present, of: roster.length })}</p>
      <ul className="grid gap-2" role="list">
        {roster.map((r) => (
          <li key={r.personId} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-bg p-3">
            <span className="font-medium">{r.firstName}</span>
            <span className="flex gap-1" role="radiogroup" aria-label={r.firstName}>
              {(["present", "absent", "excused"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={marks[r.personId] === m}
                  onClick={() => {
                    setState("idle");
                    setMarks((x) => ({ ...x, [r.personId]: m }));
                  }}
                  className={`min-h-10 rounded-full px-3 text-[14px] font-medium ${marks[r.personId] === m ? (m === "present" ? "bg-[#FFB800] text-[#1a1712]" : "bg-[#1a1712] text-[#fbf7ef]") : "bg-surface"}`}
                >
                  {t(`mark.${m}`)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await attendanceAction(sessionId, { marks: Object.entries(marks).map(([personId, status]) => ({ personId, status })) });
              setState(r.ok ? "saved" : "error");
            })
          }
        >
          {pending ? t("saving") : t("saveAttendance")}
        </button>
        {state !== "idle" && (
          <span role={state === "error" ? "alert" : "status"} className={state === "error" ? "error" : "text-[15px]"}>
            {state === "saved" ? t("saved") : t("err.error")}
          </span>
        )}
      </div>
    </div>
  );
}
