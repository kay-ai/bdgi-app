"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";

/** A labelled question group with its error line. */
export function Q({
  label,
  hint,
  error,
  children,
  as = "div",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  /** "label" wraps a single input so it gets an accessible name; "fieldset" for chip groups. */
  as?: "div" | "fieldset" | "label";
}) {
  const id = useId();
  const Tag = as;
  return (
    <Tag className="field" aria-describedby={error ? `${id}-e` : undefined}>
      {as === "fieldset" ? (
        <legend className="mb-2 text-[16px] font-medium">{label}</legend>
      ) : (
        <span className="text-[16px] font-medium">{label}</span>
      )}
      {hint && <span className="hint">{hint}</span>}
      {children}
      {error && (
        <span id={`${id}-e`} className="error" role="alert">
          {error}
        </span>
      )}
    </Tag>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <motion.path
        d="M2.5 7.5 5.5 10.5 11.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      />
    </svg>
  );
}

/** Large chips: surface at rest, ink with cream label and a drawn tick when chosen (DESIGN.md §8.2). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  name,
}: {
  options: { value: T; label: string }[];
  value: T | T[] | "";
  onChange: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  multiple?: boolean;
  name: string;
}) {
  const selected = (v: T) => (multiple ? (value as T[]).includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2" role={multiple ? "group" : "radiogroup"} aria-label={name}>
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <motion.button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            onClick={() => {
              if (multiple) {
                const arr = value as T[];
                onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
              } else onChange(o.value);
            }}
            className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[16px] transition-colors duration-150 ${
              on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-[#e9e0cd]"
            }`}
          >
            {on && <Tick />}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Five circles growing in size, "Not at all" to "Very much". No faces, no emoji (DESIGN.md §8.2). */
export function CircleScale({
  value,
  onChange,
  low,
  high,
  label,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  low: string;
  high: string;
  label: string;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const size = 28 + n * 8;
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} / 5`}
              onClick={() => onChange(n)}
              className="grid h-[76px] flex-1 place-items-center"
            >
              <motion.span
                className="block rounded-full border-[1.5px] border-ink"
                style={{ width: size, height: size }}
                animate={{ backgroundColor: on ? "#1A1712" : "rgba(26,23,18,0)", scale: on ? 1.06 : 1 }}
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[14px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
