"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deactivateStaffAction, inviteStaffAction } from "@/app/[locale]/console/admin/users/actions";

const ROLE_KEYS = ["programme_manager", "state_lead", "safeguarding_lead", "content_editor", "admin"] as const;

export function InviteStaffForm({ states }: { states: { id: string; name: string }[] }) {
  const t = useTranslations("console");
  const id = useId();
  const [roles, setRoles] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card grid gap-5 !p-5 sm:!p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMsg(null);
        start(async () => {
          const r = await inviteStaffAction({
            firstName: fd.get("firstName"),
            surname: fd.get("surname"),
            email: fd.get("email"),
            roles,
            stateId: fd.get("stateId") ?? "",
          }).catch(() => ({ ok: false as const, code: "error" }));
          if (r.ok) {
            form.reset();
            setRoles([]);
            setFields({});
            setMsg({ kind: "ok", text: t("invited") });
          } else {
            setFields("fields" in r && r.fields ? r.fields : {});
            setMsg({ kind: "err", text: r.code === "safeguarding_full" ? t("safeguardingFull") : r.code === "invalid" ? t("checkFields") : t("actionFailed") });
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(["firstName", "surname"] as const).map((f) => (
          <div className="field" key={f}>
            <label htmlFor={`${id}-${f}`}>{t(f)}</label>
            <input id={`${id}-${f}`} name={f} className="input" autoComplete="off" required maxLength={60} aria-invalid={!!fields[f] || undefined} />
            {fields[f] && <span className="error">{t("fieldInvalid")}</span>}
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>{t("email")}</label>
        <input id={`${id}-email`} name="email" type="email" className="input" autoComplete="off" required aria-invalid={!!fields.email || undefined} />
        {fields.email && <span className="error">{t("fieldInvalid")}</span>}
      </div>
      <fieldset className="grid gap-2" aria-invalid={!!fields.roles || undefined}>
        <legend className="mb-1">{t("rolesCol")}</legend>
        <div className="flex flex-wrap gap-2">
          {ROLE_KEYS.map((r) => (
            <label key={r} className="opt">
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))}
              />
              <span>{t(`role_${r}`)}</span>
            </label>
          ))}
        </div>
        {fields.roles && <span className="error">{t("pickRole")}</span>}
      </fieldset>
      {roles.includes("state_lead") && (
        <div className="field">
          <label htmlFor={`${id}-state`}>{t("state")}</label>
          <select id={`${id}-state`} name="stateId" className="input" required aria-invalid={!!fields.stateId || undefined}>
            <option value="">{t("choose")}</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {fields.stateId && <span className="error">{t("fieldInvalid")}</span>}
        </div>
      )}
      <p aria-live="polite" role={msg?.kind === "err" ? "alert" : undefined} className={msg?.kind === "err" ? "error" : "text-[15px]"}>
        {msg?.text ?? ""}
      </p>
      <button type="submit" className="btn justify-self-start" disabled={pending}>
        {pending ? t("sending") : t("sendInvite")}
      </button>
    </form>
  );
}

export function DeactivateButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("console");
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <button type="button" className="uline text-[15px]" onClick={() => setConfirming(true)} aria-label={t("deactivateWho", { name })}>
        {t("deactivate")}
      </button>
    );
  }
  return (
    <div className="grid min-w-[200px] gap-2 text-[15px]">
      <span>{t("deactivateConfirm")}</span>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn--plain"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deactivateStaffAction(userId).catch(() => ({ ok: false as const, code: "error" }));
              if (!r.ok) setErr(r.code === "last_admin" ? t("lastAdmin") : t("actionFailed"));
            })
          }
        >
          {t("deactivate")}
        </button>
        <button type="button" className="uline" onClick={() => setConfirming(false)}>
          {t("cancel")}
        </button>
      </div>
      {err && (
        <span className="error" role="alert">
          {err}
        </span>
      )}
    </div>
  );
}
