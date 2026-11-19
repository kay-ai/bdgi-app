"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Recorder } from "./Recorder";

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
      className="uline text-[15px] font-medium"
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
        <button type="button" className="uline justify-self-start text-[15px] font-medium" onClick={() => setMotionId(motions[Math.floor(Math.random() * motions.length)]?.id ?? "")}>
          {t("surprise")}
        </button>
      </div>
      <fieldset className="field">
        <legend>{t("side")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("side")}>
          {(["for", "against", "open"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={side === v}
              onClick={() => setSide(v)}
              className={`min-h-12 rounded-[12px] border px-5 text-[16px] ${side === v ? "border-ink bg-ink text-bg" : "border-line bg-bg"}`}
            >
              {t(v)}
            </button>
          ))}
        </div>
      </fieldset>
      {motion && <p className="serif text-[22px] leading-snug">{motion.text}</p>}
      <Recorder kind="free" motionId={motionId || null} side={side} targetSeconds={120} maxSeconds={maxSeconds} minSeconds={minSeconds} ready={!!motionId} />
    </div>
  );
}
