"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { resendCodeAction, sendCodeAction, verifyCodeAction } from "@/app/[locale]/(site)/sign-in/actions";

/** Step 1 (spec/03 §1.1): phone number, or email for volunteers and champions. */
export function SendCodeForm({ initialKind = "phone", next }: { initialKind?: "phone" | "email"; next?: string }) {
  const t = useTranslations("signIn");
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState<"phone" | "email">(initialKind);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card grid gap-5 !p-5 sm:!p-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await sendCodeAction(kind, value).catch(() => ({ ok: false as const, code: "network" as const }));
          if (r.ok) router.push(next ? `/sign-in/verify?next=${encodeURIComponent(next)}` : "/sign-in/verify");
          else setError(r.code === "rate_limited" ? t("errRateLimited") : r.code === "network" ? t("errNetwork") : r.code === "email" ? t("errEmail") : t("errPhone"));
        });
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-v`}>{kind === "phone" ? t("phoneLabel") : t("emailLabel")}</label>
        <input
          id={`${id}-v`}
          className="input"
          type={kind === "phone" ? "tel" : "email"}
          inputMode={kind === "phone" ? "tel" : "email"}
          autoComplete={kind === "phone" ? "tel" : "email"}
          placeholder={kind === "phone" ? "0803 123 4567" : ""}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
        />
        <span id={`${id}-hint`} className="hint">
          {kind === "phone" ? t("phoneHint") : t("emailHint")}
        </span>
        {error && (
          <span id={`${id}-err`} className="error" role="alert">
            {error}
          </span>
        )}
      </div>
      <button type="submit" className="btn btn--lg btn--block" disabled={pending || !value.trim()}>
        {pending ? t("sending") : t("sendCode")}
      </button>
      <button
        type="button"
        className="uline justify-self-start text-[15px]"
        onClick={() => {
          setKind(kind === "phone" ? "email" : "phone");
          setValue("");
          setError(null);
        }}
      >
        {kind === "phone" ? t("useEmail") : t("usePhone")}
      </button>
    </form>
  );
}

/** Step 2: six boxes, submits by itself when full; "Send again" after 60 seconds. */
export function VerifyCodeForm({ masked, next }: { masked: string; next?: string }) {
  const t = useTranslations("signIn");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(60);
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const lastSubmitted = useRef("");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = (code: string) => {
    if (code.length !== 6 || pending || code === lastSubmitted.current) return;
    lastSubmitted.current = code;
    setError(null);
    setInfo(null);
    start(async () => {
      const r = await verifyCodeAction(code, next).catch((e: unknown) => {
        // A successful sign-in redirects, which surfaces here as a navigation; let it through.
        if (e && typeof e === "object" && "digest" in e) throw e;
        return { ok: false as const, code: "network" as const };
      });
      if (!r || r.ok !== false) return;
      const msg: Record<string, string> = {
        invalid: t("errCode"),
        expired: t("errExpired"),
        too_many: t("errTooMany"),
        rate_limited: t("errRateLimited"),
        deactivated: t("errDeactivated"),
        no_pending: t("errExpired"),
        network: t("errNetwork"),
      };
      setError(msg[r.code] ?? t("errCode"));
      setDigits(Array(6).fill(""));
      lastSubmitted.current = "";
      refs.current[0]?.focus();
    });
  };

  const setAt = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, "");
    const nextDigits = [...digits];
    if (only.length > 1) {
      // Pasted or autofilled: spread across the boxes.
      only.slice(0, 6 - i).split("").forEach((d, k) => (nextDigits[i + k] = d));
      setDigits(nextDigits);
      refs.current[Math.min(5, i + only.length)]?.focus();
      submit(nextDigits.join(""));
      return;
    }
    nextDigits[i] = only;
    setDigits(nextDigits);
    if (only && i < 5) refs.current[i + 1]?.focus();
    submit(nextDigits.join(""));
  };

  return (
    <form
      className="card grid gap-5 !p-5 sm:!p-8"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        submit(digits.join(""));
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-2">{t("codeSentTo", { to: masked })}</legend>
        <div className="flex gap-2" role="group" aria-label={t("codeLabel")}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="input !h-14 !min-h-14 !w-full !max-w-14 !px-0 text-center text-[22px] tabular"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={i === 0 ? 6 : 1}
              aria-label={t("digit", { n: i + 1 })}
              aria-invalid={!!error || undefined}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              }}
            />
          ))}
        </div>
      </fieldset>
      <p aria-live="polite" className={error ? "error" : "text-[15px] text-muted"} role={error ? "alert" : undefined}>
        {error ?? info ?? (pending ? t("checking") : "")}
      </p>
      <button type="submit" className="btn btn--lg btn--block" disabled={pending || digits.join("").length !== 6}>
        {pending ? t("checking") : t("signIn")}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[15px]">
        <button
          type="button"
          className="uline disabled:text-muted disabled:no-underline"
          disabled={wait > 0 || pending}
          onClick={() =>
            start(async () => {
              const r = await resendCodeAction();
              if (r.ok) {
                setInfo(t("resent"));
                setWait(60);
              } else setError(r.code === "rate_limited" ? t("errRateLimited") : t("errExpired"));
            })
          }
        >
          {wait > 0 ? t("resendIn", { s: wait }) : t("resend")}
        </button>
        <Link href={next ? `/sign-in?via=email&next=${encodeURIComponent(next)}` : "/sign-in?via=email"} className="uline">
          {t("useEmail")}
        </Link>
      </div>
    </form>
  );
}
