import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ChatThread } from "@/components/hub/Chat";
import { requireActor, requestMeta } from "@/server/auth/current";
import { readThread } from "@/server/services/chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat" };

/** One chat in the Hub. Staff read chats from the console instead. */
export default async function ChatPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireActor(`/app/chat/${id}`);
  const th = await readThread(actor, id, null, (await requestMeta()).ip);
  if (!th || th.as !== "member") notFound();
  const t = await getTranslations("chat");
  return (
    <>
      <div className="grid gap-1">
        <Link href="/app/chat" className="uline inline-flex w-fit items-center gap-2 text-[15px]">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>
        <h1 className="t-h2">{th.title}</h1>
        {th.kind === "direct" && <p className="text-muted">{th.cohortName}</p>}
      </div>
      <ChatThread threadId={th.id} initial={th.messages} kind={th.kind} />
    </>
  );
}
