"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { contactAction } from "@/app/actions/forms";

const TOPICS = ["general", "partnership", "media", "volunteering", "school", "other"] as const;
type Topic = (typeof TOPICS)[number];

/** Contact and partner enquiries share one form; the partner page fixes the topic and asks for an organisation. */
export function ContactForm({ topic: fixed, sentText, submitText }: { topic?: Topic; sentText?: string; submitText?: string }) {
  const t = useTranslations("contact");
  const tp = useTranslations("partner");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [reach, setReach] = useState("");
  const [topic, setTopic] = useState<Topic>(fixed ?? "general");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "limited">("idle");
  const [pending, start] = useTransition();

  if (status === "sent") {
    return (
      <div className="notice notice--ok" role="status">
        <p className="t-lead">{sentText ?? t("sent")}</p>
      </div>
    );
  }

  return (
    <form
      className="card grid gap-6 !p-6 sm:!p-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setStatus("idle");
        start(async () => {
          const body = fixed === "partnership" && org ? `${tp("organisation")}: ${org}\n\n${message}` : message;
          const r = await contactAction(locale, { name, reach, topic, message: body, website });
          if (r.ok) setStatus("sent");
          else {
            setErrors(r.fields ?? {});
            setStatus(r.code === "rate_limited" ? "limited" : "error");
          }
        });
      }}
    >
      <label className="field">
        <span>{t("name")}</span>
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} required />
      </label>
      {fixed === "partnership" && (
        <label className="field">
          <span>{tp("organisation")}</span>
          <input className="input" autoComplete="organization" value={org} onChange={(e) => setOrg(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>{t("email")}</span>
        <input className="input" autoComplete="email" value={reach} onChange={(e) => setReach(e.target.value)} aria-invalid={!!errors.reach} required />
      </label>
      {!fixed && (
        <label className="field">
          <span>{t("topic")}</span>
          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
            {TOPICS.map((k) => (
              <option key={k} value={k}>
                {t(`topics.${k}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>{t("message")}</span>
        <textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.message} required />
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <label className="sr-only" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {status === "error" && (
        <p className="error" role="alert">
          {t("error")}
        </p>
      )}
      {status === "limited" && (
        <p className="error" role="alert">
          {tf("rateLimited")}
        </p>
      )}
      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? tf("sending") : (submitText ?? t("submit"))}
      </button>
    </form>
  );
}
