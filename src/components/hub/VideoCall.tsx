"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Video } from "lucide-react";

const WIDE = "(min-width: 768px)";
const subscribe = (fn: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/**
 * The video call (D-025). On a laptop or tablet it sits in the page. On a phone the box was too
 * small for the call's own controls, and phone browsers are strict about sound inside an embedded
 * frame (people could be heard but couldn't hear the others), so there the call opens full screen
 * in its own tab, with Daily's mobile layout; the Hub page stays open behind it.
 * Nothing renders until the screen width is known, so a phone never loads the embedded call.
 */
export function VideoCall({ joinUrl, title }: { joinUrl: string; title: string }) {
  const t = useTranslations("live");
  const box = useRef<HTMLDivElement>(null);
  const [noFull, setNoFull] = useState(false);
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => null);
  if (wide === null) return <div className="rounded-[24px] bg-[#1a1712]" style={{ minHeight: 220 }} aria-hidden="true" />;
  if (!wide)
    return (
      <div className="on-dark grid gap-4 rounded-[24px] p-6" style={{ background: "#1a1712", color: "#fbf7ef" }}>
        <p className="text-[17px] font-medium">{t("phoneTitle")}</p>
        <p className="text-[15px] text-[#d8d1c4]">{t("phoneLead")}</p>
        <a href={joinUrl} target="_blank" rel="noopener" className="btn btn--gold btn--plain btn--lg btn--block live-pulse">
          <Video size={20} aria-hidden="true" />
          {t("phoneJoin")}
        </a>
      </div>
    );
  return (
    <div className="grid gap-2">
      <div ref={box} className="overflow-hidden rounded-[24px] bg-[#1a1712]" style={{ aspectRatio: "16 / 10", minHeight: 420 }}>
        <iframe
          src={joinUrl}
          title={title}
          allow="camera; microphone; speaker-selection; fullscreen; display-capture; autoplay; screen-wake-lock; compute-pressure"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
      {!noFull && (
        <button
          type="button"
          className="uline inline-flex w-fit items-center gap-2 justify-self-end text-[15px]"
          onClick={() => {
            // The call itself fills the screen; Esc (or the browser's own control) brings it back.
            const el = box.current;
            // Browsers without it (older iPads) lose the button; a one-off refusal keeps it.
            if (!el?.requestFullscreen) return setNoFull(true);
            el.requestFullscreen().catch(() => undefined);
          }}
        >
          <Maximize2 size={16} aria-hidden="true" />
          {t("fullScreen")}
        </button>
      )}
    </div>
  );
}
