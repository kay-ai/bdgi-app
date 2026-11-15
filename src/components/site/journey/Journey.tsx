"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import type { JourneyApi } from "./scene";

/**
 * Pages where a paper plane would be out of place or in the way: safeguarding reports, policy
 * text, payment and contact forms.
 */
const QUIET = ["/report-a-concern", "/privacy", "/safeguarding", "/terms", "/cookies", "/donate", "/contact", "/sign-in"];

/** True when the device and the visitor's settings can take a WebGL scene. */
function allowed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return false;
  return true;
}

/**
 * The 3D journey layer: one fixed, see-through canvas over the page that never takes a click.
 * three.js is fetched only after the page is idle, so it costs the first paint nothing, and the
 * page is complete without it.
 */
export function Journey() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<JourneyApi | null>(null);
  const pathname = usePathname();
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (quiet || !canvas.current || !allowed()) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let timer = 0;
    const el = canvas.current;

    const relayout = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => api.current?.layout(), 160);
    };

    const start = async () => {
      try {
        const { createJourney } = await import("./scene");
        if (cancelled) return;
        api.current = createJourney(el);
        el.dataset.ready = "true";
        // Photographs loading and fonts swapping change section heights; follow them.
        observer = new ResizeObserver(relayout);
        observer.observe(document.body);
        window.addEventListener("resize", relayout);
      } catch {
        // No WebGL: the page simply stays as it is.
      }
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 400);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", relayout);
      api.current?.dispose();
      api.current = null;
      delete el.dataset.ready;
    };
  }, [quiet]);

  // A new page: measure it and take off again.
  useEffect(() => {
    api.current?.restart();
  }, [pathname]);

  if (quiet) return null;
  return <canvas ref={canvas} className="journey" aria-hidden="true" />;
}
