"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Shuffle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { listQueued, removeQueued, uploadSpeech, type QueuedSpeech } from "./offline-queue";
import { Recorder } from "./Recorder";

function speakWithPhone(text: string, onEnd: () => void) {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  const voice = synth.getVoices().find((v) => v.lang === "en-GB") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  synth.cancel();
  synth.speak(u);
}

/**
 * "Listen to feedback" (spec/12 §6): Amazon Polly's voice from /api/speech/[id]/audio, or the
 * phone's own voice when no voice service is set up or the request fails.
 */
export function ListenFeedback({ id, text }: { id: string; text: string }) {
  const t = useTranslations("coach.card");
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }, []);
  useEffect(
    () => () => {
      stop();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [stop],
  );

  async function play() {
    if (state !== "idle") return stop();
    setState("loading");
    try {
      if (!url.current) {
        const r = await fetch(`/api/speech/${id}/audio`);
        if (!r.ok) throw new Error(String(r.status));
        url.current = URL.createObjectURL(await r.blob());
      }
      const a = (audio.current ??= new Audio());
      a.src = url.current;
      a.onended = () => setState("idle");
      await a.play();
      setState("playing");
    } catch {
      if ("speechSynthesis" in window) {
        speakWithPhone(text, () => setState("idle"));
        setState("playing");
      } else setState("idle");
    }
  }

  return (
    <button type="button" className="btn btn--plain justify-self-start" aria-pressed={state === "playing"} aria-busy={state === "loading"} onClick={play}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        {state === "playing" ? <path d="M7 5h3v14H7zM14 5h3v14h-3z" /> : <path d="M4 9v6h4l5 4V5L8 9H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
      {state === "playing" ? t("listenStop") : state === "loading" ? t("listenLoading") : t("listen")}
    </button>
  );
}

/**
 * Speeches recorded offline (spec/12 §2 step 4). They are sent one at a time as soon as the phone
 * is online; anything the server refuses for good is dropped with a note.
 */
export function QueuedSpeeches() {
  const t = useTranslations("coach.queue");
  const router = useRouter();
  const [items, setItems] = useState<QueuedSpeech[]>([]);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => setItems(await listQueued()), []);

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    setSending(true);
    let sent = 0;
    try {
      for (const q of await listQueued()) {
        const r = await uploadSpeech(q);
        if (r.ok) {
          await removeQueued(q.id);
          sent++;
        } else if (!r.retry) {
          await removeQueued(q.id);
          setNote(t(r.error === "cap" ? "droppedCap" : "dropped"));
        } else break; // offline again or the coach is busy: try on the next "online"
      }
    } finally {
      busy.current = false;
      setSending(false);
      await refresh();
      if (sent) {
        setNote(t("sent", { n: sent }));
        router.refresh();
      }
    }
  }, [refresh, router, t]);

  useEffect(() => {
    void refresh().then(() => flush());
    const on = () => void flush();
    const changed = () => void refresh();
    window.addEventListener("online", on);
    window.addEventListener("bgdi-coach-queue", changed);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("bgdi-coach-queue", changed);
    };
  }, [refresh, flush]);

  if (!items.length && !note) return null;
  return (
    <section className="card grid gap-3 !p-5" aria-live="polite">
      {items.length > 0 && (
        <>
          <p className="font-medium">{t("title", { n: items.length })}</p>
          <ul className="grid gap-1 text-[15px] text-muted">
            {items.map((q) => (
              <li key={q.id}>
                {q.title || t("untitled")} · {Math.round(q.seconds)}s
              </li>
            ))}
          </ul>
          <p className="text-[15px] text-muted">{sending ? t("sending") : t("lead")}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button type="button" className="uline text-[15px] font-medium" onClick={() => void flush()} disabled={sending}>
              {t("sendNow")}
            </button>
            <button
              type="button"
              className="uline text-[15px] text-muted"
              onClick={async () => {
                for (const q of items) await removeQueued(q.id);
                await refresh();
              }}
              disabled={sending}
            >
              {t("discard")}
            </button>
          </div>
        </>
      )}
      {note && <p className="text-[15px]">{note}</p>}
    </section>
  );
}

/** Reads text aloud with the phone's own voice (spec/12 §6 asks for Polly; the browser voice costs nothing). */
export function SpeakButton({ text }: { text: string }) {
  const t = useTranslations("coach.lesson");
  const [on, setOn] = useState(false);
  const [can, setCan] = useState(false);
  useEffect(() => setCan(typeof window !== "undefined" && "speechSynthesis" in window), []);
  useEffect(() => () => {
    if (on) window.speechSynthesis.cancel();
  }, [on]);
  if (!can) return null;
  return (
    <button
      type="button"
      className="uline justify-self-start text-[15px] font-medium"
      aria-pressed={on}
      onClick={() => {
        const synth = window.speechSynthesis;
        if (on) {
          synth.cancel();
          setOn(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-GB";
        u.rate = 0.95;
        const voice = synth.getVoices().find((v) => v.lang === "en-GB") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
        if (voice) u.voice = voice;
        u.onend = () => setOn(false);
        synth.cancel();
        synth.speak(u);
        setOn(true);
      }}
    >
      {on ? t("stop") : t("listen")}
    </button>
  );
}

/** spec/12 §2 step 5: poll every 3 s until the scorecard is ready, then show it. */
export function AttemptWaiting({ id }: { id: string }) {
  const t = useTranslations("coach.wait");
  const router = useRouter();
  const [step, setStep] = useState(0);
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/speech/${id}`, { cache: "no-store" });
        const j = (await r.json()) as { status?: string };
        if (j.status === "scoring") setStep(2);
        else if (j.status === "transcribing") setStep(1);
        if (j.status && ["done", "rejected", "failed"].includes(j.status)) {
          stopped = true;
          router.refresh();
        }
      } catch {
        /* keep waiting; the network may come back */
      }
    };
    void poll();
    const iv = window.setInterval(() => !stopped && poll(), 3000);
    return () => window.clearInterval(iv);
  }, [id, router]);
  const steps = [t("s1"), t("s2"), t("s3")];
  return (
    <div className="card grid gap-5 !p-6 sm:!p-8" role="status" aria-live="polite">
      <h1 className="t-h3">{t("title")}</h1>
      <p className="text-muted">{t("lead")}</p>
      <ol className="grid gap-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full border text-[13px] ${i < step ? "border-ink bg-ink text-bg" : i === step ? "animate-pulse border-ink" : "border-line text-muted"}`}
              aria-hidden="true"
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i <= step ? "" : "text-muted"}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Motion = { id: string; text: string };

/** Free practice: pick a motion (or "Surprise me") and a side, then record. */
export function PracticePicker({ motions, initialMotion, initialSide, maxSeconds, minSeconds }: { motions: Motion[]; initialMotion?: string; initialSide?: "for" | "against" | "open"; maxSeconds: number; minSeconds: number }) {
  const t = useTranslations("coach.practice");
  const [motionId, setMotionId] = useState(initialMotion && motions.some((m) => m.id === initialMotion) ? initialMotion : "");
  const [side, setSide] = useState<"for" | "against" | "open">(initialSide ?? "for");
  const motion = useMemo(() => motions.find((m) => m.id === motionId), [motions, motionId]);
  return (
    <div className="grid gap-6">
      <div className="field">
        <label htmlFor="motion">{t("motion")}</label>
        <select id="motion" className="input" value={motionId} onChange={(e) => setMotionId(e.target.value)}>
          <option value="" />
          {motions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.text}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full bg-[#FFB800] px-5 text-[15px] font-semibold text-[#1a1712]"
          onClick={() => setMotionId(motions[Math.floor(Math.random() * motions.length)]?.id ?? "")}
        >
          <Shuffle size={18} aria-hidden="true" />
          {t("surprise")}
        </button>
      </div>
      <fieldset className="field">
        <legend>{t("side")}</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("side")}>
          {(["for", "against", "open"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={side === v}
              onClick={() => setSide(v)}
              className={`min-h-14 rounded-full border-2 px-3 text-[16px] font-medium leading-tight ${side === v ? "border-[#1a1712] bg-[#1a1712] text-[#fbf7ef]" : "border-line bg-bg"}`}
            >
              {t(v)}
            </button>
          ))}
        </div>
      </fieldset>
      {motion && (
        <div className="grid gap-2 rounded-[24px] p-6" style={{ background: "#1a1712", color: "#fbf7ef" }}>
          <span className="text-[13px] font-medium uppercase tracking-wide text-[#FFB800]">{t(side)}</span>
          <p className="serif text-[24px] leading-snug">{motion.text}</p>
        </div>
      )}
      <Recorder kind="free" motionId={motionId || null} side={side} targetSeconds={120} maxSeconds={maxSeconds} minSeconds={minSeconds} ready={!!motionId} title={motion?.text ?? ""} />
    </div>
  );
}
