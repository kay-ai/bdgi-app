"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Radio, Square } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addSessionAction, attendanceAction, endSessionAction, rosterAction, startSessionAction } from "@/app/[locale]/app/session/actions";

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

/** Today's date and a time in Lagos, as the form fields want them; the time rounded to the quarter hour. */
function lagosNow(roundUp: boolean) {
  const d = new Date(Date.now() + (roundUp ? 15 * 60_000 : 0));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const m = Number(parts.minute);
  const q = roundUp ? Math.floor(m / 15) * 15 : m;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${String(q).padStart(2, "0")}` };
}

/**
 * A coach's quick way to plan a session for her group (D-025): "Start one now" adds a session for
 * this minute and starts it; "Schedule" opens a short form already set to today, next quarter hour.
 */
export function QuickAddSession({ cohortId }: { cohortId: string }) {
  const t = useTranslations("live");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ ...lagosNow(true), duration: 60 }));
  const fail = (code: string) => t(`err.${["past", "closed", "invalid", "denied", "too_early", "too_late"].includes(code) ? code : "error"}` as never);

  const startNow = () =>
    start(async () => {
      setErr(null);
      const n = lagosNow(false);
      const r = await addSessionAction(cohortId, { date: n.date, time: n.time, durationMinutes: 60 });
      if (!r.ok || !r.id) return setErr(fail(r.ok ? "error" : r.code));
      const s = await startSessionAction(r.id);
      if (!s.ok) return setErr(fail(s.code));
      router.push(`/app/session/${r.id}`);
    });

  const schedule = () =>
    start(async () => {
      setErr(null);
      const r = await addSessionAction(cohortId, { date: form.date, time: form.time, durationMinutes: form.duration });
      if (!r.ok) return setErr(fail(r.code));
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn--plain !min-h-11" disabled={pending} onClick={startNow}>
          <Radio size={18} aria-hidden="true" />
          {t("startNow")}
        </button>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#fbf7ef] px-4 text-[15px] font-medium" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <CalendarPlus size={18} aria-hidden="true" />
          {t("schedule")}
        </button>
      </div>
      {open && (
        <form
          className="grid gap-3 rounded-[16px] bg-[#fbf7ef] p-4 sm:grid-cols-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            schedule();
          }}
        >
          <div className="field">
            <label htmlFor={`${cohortId}-qd`}>{t("date")}</label>
            <input id={`${cohortId}-qd`} className="input" type="date" required value={form.date} min={lagosNow(false).date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor={`${cohortId}-qt`}>{t("time")}</label>
            <input id={`${cohortId}-qt`} className="input" type="time" required step={300} value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor={`${cohortId}-ql`}>{t("length")}</label>
            <select id={`${cohortId}-ql`} className="input" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}>
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {t("minutes", { n: m })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <button type="submit" className="btn btn--plain" disabled={pending}>
              {pending ? t("saving") : t("addSession")}
            </button>
            <button type="button" className="uline text-[15px]" onClick={() => setOpen(false)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
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

/**
 * The coach's attendance list: tap to change; saved together. While the session is live it re-reads
 * the list every 15 seconds, so students who join show as here; marks she changed are kept.
 */
export function Attendance({ sessionId, roster, live }: { sessionId: string; roster: { personId: string; firstName: string; status: Mark | null }[]; live?: boolean }) {
  const t = useTranslations("live");
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries(roster.map((r) => [r.personId, r.status ?? "absent"])));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const touched = useRef(new Set<string>());
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const fresh = await rosterAction(sessionId).catch(() => null);
      if (!fresh) return;
      setMarks((m) => {
        const next = { ...m };
        for (const f of fresh) if (f.status && !touched.current.has(f.personId)) next[f.personId] = f.status;
        return next;
      });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [live, sessionId]);
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
                    touched.current.add(r.personId);
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
