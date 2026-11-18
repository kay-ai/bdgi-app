"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import {
  finishSetupAction,
  forgotPasswordAction,
  setPasswordAction,
  staffSignInAction,
  staffTwoFactorAction,
  type FormState,
} from "@/app/[locale]/staff/actions";

function ErrorLine({ id, code }: { id: string; code?: string }) {
  const t = useTranslations("staffAuth");
  if (!code) return null;
  const known = ["invalid", "locked", "rate_limited", "expired", "mismatch", "too_short", "too_long", "common"];
  return (
    <p id={id} className="error" role="alert">
      {t(`err_${known.includes(code) ? code : "invalid"}`)}
    </p>
  );
}

export function StaffSignInForm({ next, done }: { next?: string; done?: boolean }) {
  const t = useTranslations("staffAuth");
  const id = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(staffSignInAction, null);
  return (
    <form action={action} className="card grid gap-5 !p-5 sm:!p-8" aria-describedby={state?.error ? `${id}-e` : undefined}>
      {done && <p role="status">{t("passwordSet")}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="field">
        <label htmlFor={`${id}-email`}>{t("email")}</label>
        <input id={`${id}-email`} name="email" className="input" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor={`${id}-pw`}>{t("password")}</label>
        <input id={`${id}-pw`} name="password" className="input" type="password" autoComplete="current-password" required />
      </div>
      <ErrorLine id={`${id}-e`} code={state?.error} />
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? t("checking") : t("continue")}
      </button>
      <Link href="/staff/forgot-password" className="uline justify-self-start text-[15px]">
        {t("forgot")}
      </Link>
    </form>
  );
}

export function TwoFactorForm({ next }: { next?: string }) {
  const t = useTranslations("staffAuth");
  const id = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(staffTwoFactorAction, null);
  return (
    <form action={action} className="card grid gap-5 !p-5 sm:!p-8">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="field">
        <label htmlFor={`${id}-c`}>{t("codeLabel")}</label>
        <input
          id={`${id}-c`}
          name="code"
          className="input tabular"
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={20}
          aria-describedby={`${id}-h`}
        />
        <span id={`${id}-h`} className="hint">
          {t("codeHint")}
        </span>
      </div>
      <ErrorLine id={`${id}-e`} code={state?.error} />
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? t("checking") : t("continue")}
      </button>
    </form>
  );
}

export function SetupForm({ next }: { next?: string }) {
  const t = useTranslations("staffAuth");
  const id = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(finishSetupAction, null);
  if (state?.codes) {
    return (
      <div className="card grid gap-5 !p-5 sm:!p-8">
        <h2 className="t-h3">{t("backupTitle")}</h2>
        <p className="text-muted">{t("backupLead")}</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-[17px] tabular" role="list" aria-label={t("backupTitle")}>
          {state.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {/* `next` may already carry a locale prefix, so it is a plain link, not the locale-aware one. */}
        <NextLink href={next ?? "/console"} className="btn btn--lg btn--block">
          {t("savedCodes")}
        </NextLink>
      </div>
    );
  }
  return (
    <form action={action} className="card grid gap-5 !p-5 sm:!p-8">
      <div className="field">
        <label htmlFor={`${id}-c`}>{t("setupCodeLabel")}</label>
        <input id={`${id}-c`} name="code" className="input tabular" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} />
      </div>
      <ErrorLine id={`${id}-e`} code={state?.error} />
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? t("checking") : t("turnOn")}
      </button>
    </form>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("staffAuth");
  const id = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(setPasswordAction, null);
  return (
    <form action={action} className="card grid gap-5 !p-5 sm:!p-8">
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor={`${id}-pw`}>{t("newPassword")}</label>
        <input
          id={`${id}-pw`}
          name="password"
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          aria-describedby={`${id}-h`}
        />
        <span id={`${id}-h`} className="hint">
          {t("passwordHint")}
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-c`}>{t("confirmPassword")}</label>
        <input id={`${id}-c`} name="confirm" className="input" type="password" autoComplete="new-password" required />
      </div>
      <ErrorLine id={`${id}-e`} code={state?.error} />
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? t("saving") : t("savePassword")}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("staffAuth");
  const id = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, null);
  if (state?.sent) {
    return (
      <div className="card grid gap-4 !p-5 sm:!p-8" role="status">
        <p>{t("resetSent")}</p>
        <Link href="/staff/sign-in" className="uline justify-self-start">
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="card grid gap-5 !p-5 sm:!p-8">
      <div className="field">
        <label htmlFor={`${id}-email`}>{t("email")}</label>
        <input id={`${id}-email`} name="email" className="input" type="email" autoComplete="username" required />
      </div>
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? t("sending") : t("sendLink")}
      </button>
    </form>
  );
}
