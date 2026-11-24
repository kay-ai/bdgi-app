"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { importMotionsAction, resolveReviewAction, saveAiSettingsAction, saveMotionAction, setMotionActiveAction, setPilotAction, type AiResult } from "@/app/[locale]/console/ai/actions";

type Msg = { kind: "ok" | "err"; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`text-[15px] ${msg.kind === "err" ? "error" : ""}`} role={msg.kind === "err" ? "alert" : "status"}>
      {msg.text}
    </p>
  );
}

function useFail() {
  const t = useTranslations("console.ai");
  return (r: AiResult) => (r.ok ? "" : r.code === "denied" ? t("denied") : r.code === "duplicate" ? t("duplicate") : r.code === "invalid" ? t("invalid") : t("failed"));
}

export type SettingsValue = { enabled: boolean; cap: number; maxSeconds: number; minSeconds: number; anchors: string };

/** Kill switch, limits and the rubric guidance (spec/12 §5). */
export function AiSettingsForm({ initial }: { initial: SettingsValue }) {
  const t = useTranslations("console.ai");
  const fail = useFail();
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SettingsValue>(k: K, x: SettingsValue[K]) => setV((o) => ({ ...o, [k]: x }));

  return (
    <form
      className="card grid gap-6 !p-5 sm:!p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveAiSettingsAction(v).catch(() => ({ ok: false as const, code: "error" }));
          setMsg(r.ok ? { kind: "ok", text: t("saved") } : { kind: "err", text: fail(r) });
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="opt items-start !p-4">
        <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        <span className="grid gap-1">
          <span className="font-medium">{t("enabled")}</span>
          <span className="text-[14px] text-muted">{t("enabledHelp")}</span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="field">
          <label htmlFor={`${id}-cap`}>{t("cap")}</label>
          <input id={`${id}-cap`} className="input" type="number" min={1} max={100} value={v.cap} onChange={(e) => set("cap", Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-max`}>{t("maxSeconds")}</label>
          <input id={`${id}-max`} className="input" type="number" min={60} max={300} value={v.maxSeconds} onChange={(e) => set("maxSeconds", Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-min`}>{t("minSeconds")}</label>
          <input id={`${id}-min`} className="input" type="number" min={5} max={60} value={v.minSeconds} onChange={(e) => set("minSeconds", Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-anchors`}>{t("anchors")}</label>
        <textarea id={`${id}-anchors`} className="input min-h-32" maxLength={2000} value={v.anchors} onChange={(e) => set("anchors", e.target.value)} />
        <span className="text-[14px] text-muted">{t("anchorsHelp")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending} aria-busy={pending}>
          {pending ? t("saving") : t("save")}
        </button>
        <Note msg={msg} />
      </div>
    </form>
  );
}

/** The pilot-group flag (spec/12 §9). The coach is never switched per group (D-015). */
export function PilotSwitch({ cohortId, value, label }: { cohortId: string; value: boolean; label: string }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        aria-label={label}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setPilotAction(cohortId, next).catch(() => ({ ok: false as const, code: "error" }));
            if (!r.ok) setOn(!next);
            else router.refresh();
          });
        }}
      />
    </label>
  );
}

type Motion = { id: string; textEn: string; textYo: string | null; difficulty: "starter" | "intermediate" | "advanced"; sdg: number | null; isActive: boolean };
const LEVELS = ["starter", "intermediate", "advanced"] as const;

/** Add or edit one motion. */
export function MotionForm({ motion, onDone }: { motion?: Motion; onDone?: () => void }) {
  const t = useTranslations("console.ai");
  const fail = useFail();
  const id = useId();
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMsg(null);
        start(async () => {
          const r = await saveMotionAction({
            id: motion?.id ?? null,
            textEn: String(fd.get("textEn") ?? ""),
            textYo: String(fd.get("textYo") ?? ""),
            difficulty: String(fd.get("difficulty") ?? "starter"),
            sdg: fd.get("sdg") ? Number(fd.get("sdg")) : null,
            isActive: motion?.isActive ?? true,
          }).catch(() => ({ ok: false as const, code: "error" }));
          if (r.ok) {
            if (!motion) form.reset();
            setMsg({ kind: "ok", text: t("motionSaved") });
            router.refresh();
            onDone?.();
          } else setMsg({ kind: "err", text: fail(r) });
        });
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-en`}>{t("motionText")}</label>
        <textarea id={`${id}-en`} name="textEn" className="input min-h-20" required minLength={10} maxLength={300} defaultValue={motion?.textEn} placeholder={t("motionPlaceholder")} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-yo`}>{t("motionTextYo")}</label>
        <textarea id={`${id}-yo`} name="textYo" className="input min-h-16" maxLength={300} defaultValue={motion?.textYo ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={`${id}-lvl`}>{t("level")}</label>
          <select id={`${id}-lvl`} name="difficulty" className="input" defaultValue={motion?.difficulty ?? "starter"}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`lvl_${l}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-sdg`}>{t("sdg")}</label>
          <input id={`${id}-sdg`} name="sdg" className="input" type="number" min={1} max={17} defaultValue={motion?.sdg ?? ""} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending} aria-busy={pending}>
          {motion ? t("saveMotion") : t("addMotion")}
        </button>
        {motion && onDone && (
          <button type="button" className="uline text-[15px]" onClick={onDone}>
            {t("cancel")}
          </button>
        )}
        <Note msg={msg} />
      </div>
    </form>
  );
}

/** One row of the motions table with edit and switch off/on. */
export function MotionRowActions({ motion }: { motion: Motion }) {
  const t = useTranslations("console.ai");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing)
    return (
      <div className="min-w-[min(80vw,420px)]">
        <MotionForm motion={motion} onDone={() => setEditing(false)} />
      </div>
    );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <button type="button" className="uline text-[14px]" onClick={() => setEditing(true)}>
        {t("edit")}
      </button>
      <button
        type="button"
        className="uline text-[14px]"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setMotionActiveAction(motion.id, !motion.isActive).catch(() => null);
            router.refresh();
          })
        }
      >
        {motion.isActive ? t("retire") : t("restore")}
      </button>
    </div>
  );
}

/** "Import list": paste one motion per line (spec/12 §5). */
export function MotionImport() {
  const t = useTranslations("console.ai");
  const fail = useFail();
  const id = useId();
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMsg(null);
        start(async () => {
          const r = await importMotionsAction(String(fd.get("list") ?? ""), String(fd.get("level") ?? "starter")).catch(() => ({ ok: false as const, code: "error" }));
          if (r.ok) {
            form.reset();
            setMsg({ kind: "ok", text: t("imported", { added: r.added ?? 0, skipped: r.skipped ?? 0 }) });
            router.refresh();
          } else setMsg({ kind: "err", text: fail(r) });
        });
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-list`}>{t("importLabel")}</label>
        <textarea id={`${id}-list`} name="list" className="input min-h-32 font-mono text-[14px]" required placeholder={t("importPlaceholder")} />
        <span className="text-[14px] text-muted">{t("importHelp")}</span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="field">
          <label htmlFor={`${id}-lvl`}>{t("importLevel")}</label>
          <select id={`${id}-lvl`} name="level" className="input" defaultValue="starter">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`lvl_${l}`)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn--plain" disabled={pending} aria-busy={pending}>
          {t("import")}
        </button>
      </div>
      <Note msg={msg} />
    </form>
  );
}

/** Staff close a coach's concern about a scorecard, with an optional note of what was done. */
export function ResolveReview({ reviewId }: { reviewId: string }) {
  const t = useTranslations("console.ai");
  const fail = useFail();
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="uline text-[14px]" onClick={() => setOpen(true)}>
        {t("resolve")}
      </button>
    );
  return (
    <form
      className="grid min-w-[min(80vw,320px)] gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await resolveReviewAction(reviewId, text).catch(() => ({ ok: false as const, code: "error" }));
          if (r.ok) router.refresh();
          else setMsg({ kind: "err", text: fail(r) });
        });
      }}
    >
      <label htmlFor={`${id}-res`} className="text-[14px]">
        {t("resolution")}
      </label>
      <textarea id={`${id}-res`} className="input min-h-16 text-[14px]" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("resolutionPlaceholder")} />
      <div className="flex gap-3">
        <button className="btn !min-h-10 text-[14px]" disabled={pending} aria-busy={pending}>
          {t("markResolved")}
        </button>
        <button type="button" className="uline text-[14px]" onClick={() => setOpen(false)}>
          {t("cancel")}
        </button>
      </div>
      <Note msg={msg} />
    </form>
  );
}
