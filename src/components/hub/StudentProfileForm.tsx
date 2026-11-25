"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Heart, LifeBuoy, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Chips, CircleScale, Q } from "@/components/join/fields";
import { AVATARS, DEVICES, INTERESTS, NEEDS, studentProfile } from "@/server/validation/join";
import { saveProfileAction } from "@/app/[locale]/app/profile/actions";

type Answers = { q1?: number; q2?: number; q3?: number; q4?: number; q5?: number };
export type ProfileInitial = {
  avatarKey: string;
  dreams: { dreamCareer: string; interests: string[]; communityDream: string };
  help: { needs: string[]; schoolSubject: string; needsOther: string; deviceAccess: string };
  checkin: Answers;
};

/**
 * The questions sign-up no longer asks (D-019): dreams, where she'd like help, her picture and
 * the five check-in statements that give her baseline. Laid out like the rest of her Hub (D-024):
 * her picture up top with how many parts are done, each part a card, and a save bar that stays
 * in reach.
 */
const GOLD = "#FFB800";

function Part({ id, icon, title, done, lead, children }: { id: string; icon: React.ReactNode; title: string; done: boolean; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-24 gap-7 rounded-[24px] border border-line bg-[#fffdf8] p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: done ? GOLD : "#f1eadc" }} aria-hidden="true">
          {done ? <Check size={20} strokeWidth={2.5} /> : icon}
        </span>
        <div className="grid">
          <h2 id={`${id}-h`} className="t-h3">
            {title}
          </h2>
          {lead && <p className="text-[14px] text-muted">{lead}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function StudentProfileForm({ initial, locale, firstName }: { initial: ProfileInitial; locale: string; firstName: string }) {
  const t = useTranslations("join");
  const th = useTranslations("hub.profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const err = (k: string) => (errors[k] ? t(`errors.${errors[k]}` as never) : undefined);
  const setDreams = (p: Partial<ProfileInitial["dreams"]>) => setData((d) => ({ ...d, dreams: { ...d.dreams, ...p } }));
  const setHelp = (p: Partial<ProfileInitial["help"]>) => setData((d) => ({ ...d, help: { ...d.help, ...p } }));

  const done = {
    dreams: !!data.dreams.dreamCareer.trim() && data.dreams.interests.length > 0,
    help: data.help.needs.length > 0 && !!data.help.deviceAccess,
    checkin: (["q1", "q2", "q3", "q4", "q5"] as const).every((q) => data.checkin[q] !== undefined),
  };
  const parts = [
    { id: "dreams", label: t("student.steps.dreams"), done: done.dreams },
    { id: "help", label: t("student.steps.help"), done: done.help },
    { id: "checkin", label: t("student.steps.checkin"), done: done.checkin },
  ];
  const doneCount = parts.filter((p) => p.done).length;

  function save() {
    setStatus("idle");
    const r = studentProfile.safeParse(data);
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=alert]")?.scrollIntoView({ block: "center" }));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveProfileAction(locale, r.data).catch(() => ({ ok: false as const }));
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-6 pb-24">
      <section className="grid gap-6 rounded-[28px] p-6 sm:p-8" style={{ background: "#1a1712", color: "#fbf7ef" }} aria-labelledby="avatar-h">
        <div className="flex items-center gap-4">
          <span className="rounded-full p-1" style={{ background: GOLD }}>
            <Avatar avatarKey={data.avatarKey} size={80} />
          </span>
          <div className="grid gap-1">
            <h1 className="t-h2" style={{ color: "inherit" }}>
              {firstName}
            </h1>
            <p className="text-[15px]" style={{ color: "#b9b3a8" }}>
              {th("partsDone", { n: doneCount, of: parts.length })}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2" role="list">
          {parts.map((p) => (
            <li key={p.id}>
              <a
                href={`#${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium"
                style={p.done ? { background: GOLD, color: "#1a1712" } : { background: "#2e2922", color: "#fbf7ef" }}
              >
                {p.done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                {p.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="grid gap-3">
          <h2 id="avatar-h" className="text-[13px] font-medium uppercase tracking-wide" style={{ color: GOLD }}>
            {t("student.avatar")}
          </h2>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12" role="radiogroup" aria-labelledby="avatar-h">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={data.avatarKey === a}
                aria-label={a}
                onClick={() => setData((d) => ({ ...d, avatarKey: a }))}
                className="grid aspect-square place-items-center rounded-full p-[3px] transition-transform active:scale-95"
                style={data.avatarKey === a ? { boxShadow: `0 0 0 3px ${GOLD}` } : undefined}
              >
                <Avatar avatarKey={a} size={48} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <Part id="dreams" icon={<Sparkles size={20} />} title={t("student.steps.dreams")} done={done.dreams}>
        <label className="field">
          <span className="text-[16px] font-medium">{t("student.dream")}</span>
          <input
            className="input"
            maxLength={60}
            value={data.dreams.dreamCareer}
            onChange={(e) => setDreams({ dreamCareer: e.target.value })}
            aria-invalid={!!errors["dreams.dreamCareer"]}
          />
          <span className="flex flex-wrap gap-2">
            {t("student.dreamSuggestions")
              .split("|")
              .map((s) => (
                <button key={s} type="button" className={`rounded-full px-3 py-1.5 text-[14px] ${data.dreams.dreamCareer === s ? "bg-[#1a1712] text-[#fbf7ef]" : "bg-surface"}`} onClick={() => setDreams({ dreamCareer: s })}>
                  {s}
                </button>
              ))}
          </span>
          {err("dreams.dreamCareer") && (
            <span className="error" role="alert">
              {err("dreams.dreamCareer")}
            </span>
          )}
        </label>
        <Q label={t("student.interests")} error={err("dreams.interests")} as="fieldset">
          <Chips
            multiple
            name={t("student.interests")}
            value={data.dreams.interests}
            onChange={(v) => setDreams({ interests: v })}
            options={INTERESTS.map((i) => ({ value: i, label: t(`student.interestOptions.${i}`) }))}
          />
        </Q>
        <label className="field">
          <span className="text-[16px] font-medium">
            {t("student.communityDream")} <span className="font-normal text-muted">({tc("optional")})</span>
          </span>
          <textarea className="input" maxLength={200} value={data.dreams.communityDream} onChange={(e) => setDreams({ communityDream: e.target.value })} />
        </label>
      </Part>

      <Part id="help" icon={<LifeBuoy size={20} />} title={t("student.steps.help")} done={done.help}>
        <Q label={t("student.needs")} error={err("help.needs")} as="fieldset">
          <Chips
            multiple
            name={t("student.needs")}
            value={data.help.needs}
            onChange={(v) => setHelp({ needs: v })}
            options={NEEDS.map((n) => ({ value: n, label: t(`student.needOptions.${n}`) }))}
          />
        </Q>
        {data.help.needs.includes("school_subject") && (
          <label className="field">
            <span className="text-[16px] font-medium">{t("student.subject")}</span>
            <input className="input" value={data.help.schoolSubject} onChange={(e) => setHelp({ schoolSubject: e.target.value })} />
          </label>
        )}
        {data.help.needs.includes("other") && (
          <label className="field">
            <span className="text-[16px] font-medium">{t("student.needsOther")}</span>
            <input className="input" value={data.help.needsOther} onChange={(e) => setHelp({ needsOther: e.target.value })} />
          </label>
        )}
        <Q label={t("student.device")} error={err("help.deviceAccess")} as="fieldset">
          <Chips
            name={t("student.device")}
            value={data.help.deviceAccess}
            onChange={(v) => setHelp({ deviceAccess: v })}
            options={DEVICES.map((d) => ({ value: d, label: t(`student.devices.${d}`) }))}
          />
        </Q>
      </Part>

      <Part id="checkin" icon={<Heart size={20} />} title={t("student.steps.checkin")} done={done.checkin} lead={t("student.checkinLead")}>
        {(["q1", "q2", "q3", "q4", "q5"] as const).map((q, i) => (
          <div key={q} className={`grid gap-4 ${i > 0 ? "border-t border-line pt-5" : ""}`}>
            <p className="serif flex gap-3 text-[20px] leading-snug">
              <span className="tabular text-muted">{i + 1}.</span>
              {t(`student.${q}`)}
            </p>
            <CircleScale
              label={t(`student.${q}`)}
              low={t("student.scaleLow")}
              high={t("student.scaleHigh")}
              value={data.checkin[q]}
              onChange={(n) => setData((d) => ({ ...d, checkin: { ...d.checkin, [q]: n } }))}
            />
            {errors[`checkin.${q}`] && (
              <span className="error" role="alert">
                {th("answerAll")}
              </span>
            )}
          </div>
        ))}
      </Part>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-4 rounded-full p-2 pl-5 shadow-lg" style={{ background: "#1a1712", color: "#fbf7ef" }}>
        <span className="flex-1 text-[14px]" role={status === "idle" ? undefined : status === "saved" ? "status" : "alert"}>
          {status === "saved" ? th("saved") : status === "error" ? th("error") : th("partsDone", { n: doneCount, of: parts.length })}
        </span>
        <button type="button" className="btn btn--gold" onClick={save} disabled={pending} aria-busy={pending}>
          {pending ? th("saving") : th("save")}
        </button>
      </div>
    </div>
  );
}
