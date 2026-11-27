"use client";

import { useTranslations } from "next-intl";
import { Video } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * While her group's session is live, a slim bar under the Hub header on every page, so a student
 * or coach who wandered off (to chat, her profile, the speech coach) can always get back in (D-025).
 * Not shown on the student home, which has the big Join banner, or on the session page itself.
 */
export function LiveBar({ live }: { live: { id: string; cohortName: string } }) {
  const t = useTranslations("live");
  const path = usePathname();
  if (path === "/app" || path.startsWith("/app/session/")) return null;
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pt-4">
      <Link
        href={`/app/session/${live.id}`}
        className="on-dark flex items-center justify-between gap-3 rounded-[18px] px-4 py-3"
        style={{ background: "#1a1712", color: "#fbf7ef" }}
      >
        <span className="flex min-w-0 items-center gap-2 text-[15px]">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff5a4e] opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a4e]" />
          </span>
          <span className="truncate">{t("barTitle", { name: live.cohortName })}</span>
        </span>
        <span className="live-pulse inline-flex shrink-0 items-center gap-2 rounded-full bg-[#FFB800] px-4 py-2 text-[15px] font-semibold text-[#1a1712]">
          <Video size={18} aria-hidden="true" />
          {t("barJoin")}
        </span>
      </Link>
    </div>
  );
}
