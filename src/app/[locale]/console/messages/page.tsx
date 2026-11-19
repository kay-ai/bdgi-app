import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StatusTabs, one } from "@/components/console/ListParts";
import { formatDate } from "@/lib/format";
import { requestMeta, requirePermission } from "@/server/auth/current";
import { OUTBOX_KINDS, listOutbox, messagingLive, type OutboxKind } from "@/server/services/console-outbox";

type Search = Record<string, string | string[] | undefined>;

export const metadata = { title: "Messages" };

const time = (d: Date, locale: string) => new Intl.DateTimeFormat(locale === "yo" ? "yo-NG" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(d);

/**
 * `/console/messages` (admins only): what the app sent in the last 7 days, in full, so staff can
 * pass on sign-in codes and permission links by hand until WhatsApp and SMS are connected.
 */
export default async function MessagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("user.manage", "/console/messages");
  const t = await getTranslations("console");
  const sp = await searchParams;
  const kind = (OUTBOX_KINDS as readonly string[]).includes(one(sp.status) ?? "") ? (one(sp.status) as OutboxKind) : undefined;
  const to = one(sp.q);
  const student = one(sp.student);
  const rows = await listOutbox(actor, { kind, to, student }, (await requestMeta()).ip);

  return (
    <>
      <div className="grid gap-2">
        <h1 className="t-h2">{t("messages")}</h1>
        <p className="text-muted">{t("outbox.lead")}</p>
      </div>
      {!messagingLive() && (
        <div className="card grid gap-1 !p-5" role="note">
          <p className="font-medium">{t("outbox.notLiveTitle")}</p>
          <p className="text-muted">{t("outbox.notLive")}</p>
        </div>
      )}
      <StatusTabs
        base="/console/messages"
        current={kind}
        q={to}
        label={t("outbox.filter")}
        tabs={[
          { value: "", label: t("outbox.all") },
          { value: "codes", label: t("outbox.codes") },
          { value: "permission", label: t("outbox.permission") },
        ]}
      />
      <form method="get" role="search" className="flex w-full max-w-[520px] gap-3">
        {kind && <input type="hidden" name="status" value={kind} />}
        <label className="sr-only" htmlFor="outbox-to">
          {t("outbox.searchLabel")}
        </label>
        <input id="outbox-to" name="q" defaultValue={to} className="input flex-1" placeholder={t("outbox.searchPlaceholder")} inputMode="tel" maxLength={80} />
        <button type="submit" className="btn btn--plain">
          {t("people.searchButton")}
        </button>
      </form>
      {student && (
        <p className="text-[15px]">
          {t("outbox.forStudent")}{" "}
          <Link href="/console/messages" className="uline">
            {t("outbox.showAll")}
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card !p-6">
          <p className="font-medium">{t("outbox.empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-3" role="list">
          {rows.map((m) => (
            <li key={m.id} className="card grid gap-2 !p-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
                <span className="font-medium tabular">{m.to || "–"}</span>
                <span className="text-muted">
                  {t(`outbox.ch_${m.channel}` as "outbox.ch_sms")}
                  {m.personName ? ` · ${m.personName}` : ""}
                </span>
                <span className="text-muted">{m.templateKey ? t.has(`outbox.tk.${m.templateKey.replace(/\./g, "_")}` as "outbox.tk.auth_otp") ? t(`outbox.tk.${m.templateKey.replace(/\./g, "_")}` as "outbox.tk.auth_otp") : m.templateKey : ""}</span>
                <span className="ml-auto whitespace-nowrap text-muted tabular">
                  {formatDate(m.createdAt, locale)} {time(m.createdAt, locale)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[15px]">{m.body || t("outbox.unreadable")}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
