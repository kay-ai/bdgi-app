import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChatThread } from "@/components/hub/Chat";
import { requestMeta, requireStaff } from "@/server/auth/current";
import { readThread } from "@/server/services/chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat" };

/**
 * A group or private chat, read-only for staff who look after the group or safeguarding (D-025).
 * Opening it is recorded in the audit log.
 */
export default async function ConsoleChat({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff(`/console/chat/${id}`);
  const th = await readThread(actor, id, null, (await requestMeta()).ip);
  if (!th || th.as !== "staff") notFound();
  const t = await getTranslations("console.groups.chats");
  return (
    <>
      <div className="grid gap-2">
        <Link href={`/console/groups/${th.cohortId}`} className="uline w-fit text-[15px]">
          {t("back", { name: th.cohortName })}
        </Link>
        <h1 className="t-h2">{th.kind === "group" ? t("groupTitle", { name: th.cohortName }) : t("directTitle", { coach: th.coach, student: th.student })}</h1>
        <p className="text-muted">{t("audited")}</p>
      </div>
      <ChatThread threadId={th.id} initial={th.messages} kind={th.kind} readOnly />
    </>
  );
}
