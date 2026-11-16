"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Item = { slug: string; name: string; line: string; who: string };

/**
 * Four rows on the left; one photograph on the right that changes when a row is hovered,
 * focused or tapped (DESIGN.md §6.1 screen 2). The change is the visitor's, never timed.
 */
export function ProgrammeList({ items, pictures }: { items: Item[]; pictures: Record<string, ReactNode> }) {
  const [active, setActive] = useState(items[0]?.slug ?? "");
  return (
    <div className="grid12 items-start">
      <ol className="rows rows--tight col-span-6 lg:col-span-5" role="list">
        {items.map((it, i) => (
          <li key={it.slug} onMouseEnter={() => setActive(it.slug)} onFocus={() => setActive(it.slug)}>
            <Link
              href={`/programmes/${it.slug}`}
              className="peek-row group grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-1 no-underline"
              data-active={active === it.slug}
            >
              <span
                className={`step-num row-span-3 mt-1 transition-colors duration-200 ${active === it.slug ? "" : "!bg-surface"}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="serif text-[26px] leading-tight">
                <span className="uline peek-row__name group-hover:[background-size:100%_1px]">{it.name}</span>
              </span>
              <span className="text-[16px] leading-normal">{it.line}</span>
              <span className="t-label">{it.who}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="col-span-6 lg:col-span-6 lg:col-start-7 max-sm:hidden">
        <div className="frame fit-short aspect-[4/3] w-full">
          {items.map((it) => (
            <div
              key={it.slug}
              className="fill absolute inset-0 transition-opacity duration-200"
              style={{ opacity: active === it.slug ? 1 : 0 }}
              aria-hidden={active !== it.slug}
            >
              {pictures[it.slug]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
