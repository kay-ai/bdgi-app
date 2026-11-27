"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

const EVERY_MS = 30_000;

/**
 * Keeps the Hub honest about live sessions (D-025): every 30 seconds while a Hub page is open and
 * visible (and when she comes back to the tab), it asks whether her group is live and refreshes
 * the page when that changed, so the Join banner appears when a coach starts and goes when it ends.
 */
export function LiveWatch({ liveId }: { liveId: string | null }) {
  const router = useRouter();
  const current = useRef(liveId);
  current.current = liveId;

  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        // A plain request with a time limit: a dropped connection can't leave the watcher stuck.
        const res = await fetch("/api/app/live", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        const now = ((await res.json()) as { id: string | null }).id;
        if (now !== current.current) {
          current.current = now;
          router.refresh();
        }
      } catch {
        /* offline: try again next time */
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  return null;
}
