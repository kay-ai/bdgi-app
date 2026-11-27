import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle, ShieldCheck, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StartDirect } from "@/components/hub/Chat";
import { GOLD } from "@/components/coach/parts";
import { requireActor } from "@/server/auth/current";
import { myChats } from "@/server/services/chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

/** Her chats (D-025): each group's chat first, then private chats with a coach or student. */
export default async function ChatList({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/chat");
  const t = await getTranslations("chat");
  const format = await getFormatter();
  const { threads, startable } = await myChats(actor);

  return (
    <>
      <h1 className="t-h2">{t("title")}</h1>
      {threads.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{t("noneTitle")}</p>
          <p className="text-muted">{t("noneLead")}</p>
        </div>
      ) : (
        <ul className="grid gap-2" role="list">
          {threads.map((th) => (
            <li key={th.id}>
              <Link href={`/app/chat/${th.id}`} className="card flex items-center gap-4 !p-4">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold"
                  style={th.kind === "group" ? { background: "#1a1712", color: GOLD } : { background: th.otherIsCoach ? GOLD : "#fbf7ef", color: "#1a1712" }}
                  aria-hidden="true"
                >
                  {th.kind === "group" ? <Users size={20} /> : th.title.slice(0, 1)}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{th.title}</span>
                  <span className="truncate text-[14px] text-muted">
                    {th.kind === "group" ? t("groupChat") : t("privateWith", { group: th.cohortName })}
                    {th.lastMessageAt && ` · ${format.relativeTime(th.lastMessageAt)}`}
                  </span>
                </span>
                {th.unread > 0 && (
                  <span className="grid h-7 min-w-7 place-items-center rounded-full px-2 text-[13px] font-semibold tabular" style={{ background: GOLD, color: "#1a1712" }}>
                    <span className="sr-only">{t("unread", { n: th.unread })}</span>
                    <span aria-hidden="true">{th.unread}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {startable.length > 0 && (
        <section className="grid gap-3" aria-labelledby="start-private">
          <h2 id="start-private" className="t-h3 flex items-center gap-2">
            <MessageCircle size={20} aria-hidden="true" />
            {t("startTitle")}
          </h2>
          <ul className="flex flex-wrap gap-2" role="list">
            {startable.map((p) => (
              <li key={`${p.cohortId}:${p.personId}`}>
                <StartDirect cohortId={p.cohortId} personId={p.personId} label={p.isCoach ? t("messageCoach", { name: p.firstName }) : t("messageName", { name: p.firstName })} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-[14px] bg-surface p-4 text-[15px]">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        {t("rules")}
      </p>
    </>
  );
}
