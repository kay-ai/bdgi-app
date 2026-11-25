"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Timer } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { queueSpeech, uploadSpeech } from "./offline-queue";

type Props = {
  kind: "placement" | "lesson" | "free";
  lessonKey?: string;
  motionId?: string | null;
  side?: "for" | "against" | "open";
  targetSeconds: number;
  maxSeconds: number;
  minSeconds: number;
  /** Disable the record button until the parent has what it needs (e.g. a motion picked). */
  ready?: boolean;
  /** Shown in the offline queue ("Waiting to send: …"). */
  title?: string;
};

type Phase = "idle" | "prep" | "recording" | "review" | "sending" | "queued";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** spec/12 §2 steps 2–4: get ready, record (timer, level meter, hard stop), listen back, send. */
export function Recorder({ kind, lessonKey, motionId, side, targetSeconds, maxSeconds, minSeconds, ready = true, title = "" }: Props) {
  const t = useTranslations("coach.rec");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [prepLeft, setPrepLeft] = useState(30);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clip, setClip] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const stopTracks = useCallback(() => {
    if (tick.current) window.clearInterval(tick.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    tick.current = raf.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    stopTracks();
    if (clip) URL.revokeObjectURL(clip.url);
  }, [stopTracks, clip]);

  // The 30-second plan countdown is optional; it starts recording when it runs out.
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      void start();
      return;
    }
    const id = window.setTimeout(() => setPrepLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prepLeft]);

  function stop(reason?: "max") {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    if (reason === "max") setNotice(t("maxReached", { time: fmt(maxSeconds) }));
  }

  async function start() {
    setError(null);
    setNotice(null);
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      setError(t("noMic"));
      setPhase("idle");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const r = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const seconds = (Date.now() - startedAt.current) / 1000;
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" });
        stopTracks();
        setClip({ blob, url: URL.createObjectURL(blob), seconds });
        setPhase("review");
      };
      rec.current = r;
      // Level meter from an analyser on the same stream.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      }
      startedAt.current = Date.now();
      setElapsed(0);
      r.start(1000);
      setPhase("recording");
      tick.current = window.setInterval(() => {
        const sec = (Date.now() - startedAt.current) / 1000;
        setElapsed(sec);
        if (sec >= maxSeconds) stop("max");
      }, 250);
    } catch {
      stopTracks();
      setError(t("micDenied"));
      setPhase("idle");
    }
  }

  function again() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setNotice(null);
    setPhase("idle");
  }

  /** No connection: keep the speech on the phone and send it later (spec/12 §2, max 3 waiting). */
  async function keepForLater() {
    if (!clip) return;
    const ok = await queueSpeech({ blob: clip.blob, kind, lessonKey, motionId, side, seconds: clip.seconds, title });
    if (ok) {
      URL.revokeObjectURL(clip.url);
      setClip(null);
      setPhase("queued");
    } else {
      setError(t("queueFull"));
      setPhase("review");
    }
  }

  async function send() {
    if (!clip) return;
    setError(null);
    if (!navigator.onLine) return keepForLater();
    setPhase("sending");
    const r = await uploadSpeech({ blob: clip.blob, kind, lessonKey, motionId, side, seconds: clip.seconds });
    if (r.ok) {
      router.push(`/app/coach/attempt/${r.id}`);
      return;
    }
    if (r.error === "offline") return keepForLater();
    const known = ["busy", "cap", "too_large", "rate_limited"];
    setError(t(`error.${known.includes(r.error) ? r.error : "default"}` as never));
    setPhase("review");
  }

  const tooShort = clip ? clip.seconds < minSeconds : false;
  const pct = Math.min(100, (elapsed / targetSeconds) * 100);

  return (
    <div className="card grid gap-6 !p-5 sm:!p-8">
      {phase === "idle" && (
        <>
          <div className="grid gap-3">
            <p className="text-[13px] font-medium uppercase tracking-wide text-muted">{t("tipsTitle")}</p>
            <ol className="grid gap-2 sm:grid-cols-3" role="list">
              {(["tip1", "tip2", "tip3"] as const).map((k, i) => (
                <li key={k} className="flex items-center gap-3 rounded-[14px] bg-bg p-3 text-[15px]">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFB800] text-[14px] font-semibold text-[#1a1712]" aria-hidden="true">
                    {i + 1}
                  </span>
                  {t(k)}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" className="btn btn--lg btn--gold btn--plain" onClick={start} disabled={!ready}>
              <Mic size={20} aria-hidden="true" />
              {t("start")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 uline text-[16px] font-medium"
              disabled={!ready}
              onClick={() => {
                setPrepLeft(30);
                setPhase("prep");
              }}
            >
              <Timer size={18} aria-hidden="true" />
              {t("prep")}
            </button>
          </div>
        </>
      )}

      {phase === "prep" && (
        <div className="grid justify-items-start gap-4">
          <p className="serif text-[56px] leading-none tabular" aria-live="polite">
            0:{String(prepLeft).padStart(2, "0")}
          </p>
          <p className="text-muted">{t("prep")}</p>
          <button type="button" className="btn btn--lg" onClick={() => start()}>
            {t("prepSkip")}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[#C2410C]" aria-hidden="true" />
            <span className="font-medium">{t("recording")}</span>
            <span className="serif ml-auto text-[40px] leading-none tabular" aria-live="off">
              {fmt(elapsed)}
            </span>
          </div>
          {/* Level meter: a bar that moves with the voice */}
          <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-ink transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          {/* Progress toward the target length */}
          <div className="grid gap-1">
            <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full bg-[#FFB800]" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[14px] text-muted">{t("aim", { time: fmt(targetSeconds) })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" className="btn btn--lg btn--plain" onClick={() => stop()}>
              {t("stop")}
            </button>
            <button
              type="button"
              className="uline text-[16px] font-medium"
              onClick={() => {
                if (rec.current) rec.current.onstop = null;
                if (rec.current && rec.current.state !== "inactive") rec.current.stop();
                stopTracks();
                void start();
              }}
            >
              {t("again")}
            </button>
          </div>
        </div>
      )}

      {(phase === "review" || phase === "sending") && clip && (
        <div className="grid gap-5">
          {notice && <p className="text-[15px]">{notice}</p>}
          <p className="text-muted">{t("review")}</p>
          <audio controls src={clip.url} className="w-full" />
          <p className="text-[15px] tabular">{fmt(clip.seconds)}</p>
          {tooShort && (
            <p className="error text-[15px]" role="alert">
              {t("tooShort", { seconds: minSeconds })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" className="btn btn--lg" onClick={send} disabled={tooShort || phase === "sending"} aria-busy={phase === "sending"}>
              {phase === "sending" ? t("sending") : t("send")}
            </button>
            <button type="button" className="uline text-[16px] font-medium" onClick={again} disabled={phase === "sending"}>
              {t("again")}
            </button>
          </div>
        </div>
      )}

      {phase === "queued" && (
        <div className="grid gap-3" role="status">
          <p className="t-h3">{t("queuedTitle")}</p>
          <p className="text-muted">{t("queuedLead")}</p>
          <Link href="/app/coach" className="btn btn--lg justify-self-start">
            {t("queuedBack")}
          </Link>
        </div>
      )}

      {error && (
        <p className="rounded-[12px] bg-bg p-4 text-[15px]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
