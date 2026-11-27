"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Flag, SendHorizontal, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { openDirectAction, pollAction, reportAction, sendAction, type ChatMessage } from "@/app/[locale]/app/chat/actions";

const POLL_MS = 4000;

/**
 * One chat (D-025). New messages arrive by asking the server every few seconds while the page is
 * open and visible: no extra service to run. Staff see it read-only.
 */
export function ChatThread({ threadId, initial, readOnly, kind }: { threadId: string; initial: ChatMessage[]; readOnly?: boolean; kind: "group" | "direct" }) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.createdAt ?? null;
  const lastRef = useRef(last);
  lastRef.current = last;

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const fresh = await pollAction(threadId, lastRef.current).catch(() => null);
    if (fresh?.length) setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
  }, [threadId]);

  // Opening the chat marks it read; refresh so the header's new-message count drops.
  useEffect(() => {
    if (!readOnly) router.refresh();
  }, [readOnly, router]);
  useEffect(() => {
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      setErr(null);
      const r = await sendAction(threadId, body);
      if (!r.ok) {
        setErr(t(`err.${["blocked_phone", "blocked_email", "blocked_link", "not_allowed"].includes(r.code) ? r.code : "error"}` as never));
        return;
      }
      setText("");
      await poll();
    });
  }

  async function report(id: string) {
    if (!window.confirm(t("reportAsk"))) return;
    const r = await reportAction(id);
    if (r.ok) setMessages((m) => m.map((x) => (x.id === id ? { ...x, reported: true, body: readOnly ? x.body : null } : x)));
  }

  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 rounded-[14px] bg-surface p-3 text-[14px]">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        {kind === "direct" ? t("noticeDirect") : t("notice")}
      </p>
      <ol className="grid gap-3" aria-live="polite" aria-label={t("messages")}>
        {messages.length === 0 && <li className="py-8 text-center text-muted">{readOnly ? t("emptyStaff") : t("empty")}</li>}
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`group grid max-w-[85%] gap-1 rounded-[18px] px-4 py-2.5 ${m.mine ? "rounded-br-[6px] bg-[#1a1712] text-[#fbf7ef]" : "rounded-bl-[6px] bg-surface"} ${m.reported ? "opacity-70" : ""}`}>
              {!m.mine && (
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  {m.sender}
                  {m.isCoach && <span className="rounded-full bg-[#FFB800] px-2 text-[11px] text-[#1a1712]">{t("coach")}</span>}
                </span>
              )}
              {m.body === null ? <span className="italic text-muted">{t("hidden")}</span> : <span className="whitespace-pre-wrap break-words text-[15px]">{m.body}</span>}
              <span className={`flex items-center gap-3 text-[11px] ${m.mine ? "text-[#b9b3a8]" : "text-muted"}`}>
                {format.dateTime(new Date(m.createdAt), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
                {m.reported && readOnly && <span className="font-semibold text-[#b3261e]">{t("reported")}</span>}
                {!m.mine && !m.reported && !readOnly && (
                  <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => void report(m.id)}>
                    <Flag size={11} aria-hidden="true" />
                    {t("report")}
                  </button>
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div ref={end} />
      {!readOnly && (
        <form
          className="sticky bottom-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {err && (
            <p className="error rounded-[12px] bg-bg p-2 text-[14px]" role="alert">
              {err}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-[24px] p-2 shadow-lg" style={{ background: "#1a1712" }}>
            <label className="sr-only" htmlFor="chat-box">
              {t("placeholder")}
            </label>
            <textarea
              id="chat-box"
              rows={1}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("placeholder")}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[18px] bg-[#fbf7ef] px-4 py-2.5 text-[16px] text-[#1a1712] outline-none"
            />
            <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFB800] text-[#1a1712]" disabled={pending || !text.trim()} aria-label={t("send")}>
              <SendHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** A "Message {name}" button: opens (or finds) the private chat and goes to it. */
export function StartDirect({ cohortId, personId, label }: { cohortId: string; personId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="rounded-full bg-surface px-4 py-2 text-[15px] font-medium"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openDirectAction(cohortId, personId);
          if (r.ok) router.push(`/app/chat/${r.id}`);
        })
      }
    >
      {label}
    </button>
  );
}
