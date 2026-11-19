"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
 * the five check-in statements that give her baseline.
 */
export function StudentProfileForm({ initial, locale }: { initial: ProfileInitial; locale: string }) {
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
    <div className="grid gap-12">
      <section aria-labelledby="dreams-h" className="grid gap-8">
        <h2 id="dreams-h" className="t-h3">
          {t("student.steps.dreams")}
        </h2>
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
                <button key={s} type="button" className="rounded-[8px] bg-surface px-3 py-2 text-[14px]" onClick={() => setDreams({ dreamCareer: s })}>
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
      </section>

      <section aria-labelledby="help-h" className="grid gap-8">
        <h2 id="help-h" className="t-h3">
          {t("student.steps.help")}
        </h2>
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
      </section>

      <section aria-labelledby="checkin-h" className="grid gap-8">
        <div className="grid gap-2">
          <h2 id="checkin-h" className="t-h3">
            {t("student.steps.checkin")}
          </h2>
          <p className="text-muted">{t("student.checkinLead")}</p>
        </div>
        {(["q1", "q2", "q3", "q4", "q5"] as const).map((q) => (
          <div key={q} className="grid gap-4">
            <p className="serif text-[20px] leading-snug">{t(`student.${q}`)}</p>
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
      </section>

      <section aria-labelledby="avatar-h" className="grid gap-6">
        <h2 id="avatar-h" className="t-h3">
          {t("student.avatar")}
        </h2>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-labelledby="avatar-h">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={data.avatarKey === a}
              aria-label={a}
              onClick={() => setData((d) => ({ ...d, avatarKey: a }))}
              className={`grid aspect-square place-items-center rounded-full p-[3px] ${data.avatarKey === a ? "ring-2 ring-ink" : ""}`}
            >
              <Avatar avatarKey={a} size={48} className="h-full w-full" />
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-5">
        <button type="button" className="btn btn--lg min-w-[200px]" onClick={save} disabled={pending} aria-busy={pending}>
          {pending ? th("saving") : th("save")}
        </button>
        {status === "saved" && <p role="status">{th("saved")}</p>}
        {status === "error" && (
          <p className="error" role="alert">
            {th("error")}
          </p>
        )}
      </div>
    </div>
  );
}
