import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchBox, StatusTabs, one } from "@/components/console/ListParts";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { GROUP_STATUSES, listGroups } from "@/server/services/console-groups";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

/** `/console/groups`: every group the actor may manage, with its students and coaches. */
export default async function GroupsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("cohort.manage", "/console/groups");
  const t = await getTranslations("console.groups");
  const sp = await searchParams;
  const status = (GROUP_STATUSES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status) : undefined;
  const q = one(sp.q);
  const { rows, counts } = await listGroups(actor, { status, q });
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="t-h2">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <Link href="/console/groups/new" className="btn">
          {t("new")}
        </Link>
      </div>
      <StatusTabs
        base="/console/groups"
        current={status}
        q={q}
        label={t("filter")}
        tabs={[{ value: "", label: t("all"), n: all }, ...GROUP_STATUSES.map((v) => ({ value: v, label: t(`st.${v}`), n: counts[v] ?? 0 }))]}
      />
      <SearchBox status={status} q={q} label={t("search")} button={t("searchButton")} placeholder={t("searchGroups")} />
      {rows.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{q || status ? t("emptyFiltered") : t("empty")}</p>
          {!q && !status && <p className="text-muted">{t("emptyLead")}</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("group")}</th>
                <th scope="col">{t("school")}</th>
                <th scope="col">{t("studentsCol")}</th>
                <th scope="col">{t("coachesCol")}</th>
                <th scope="col">{t("dates")}</th>
                <th scope="col">{t("statusCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/console/groups/${r.id}`} className="uline font-medium">
                      {r.name}
                    </Link>
                    <div className="text-[13px] text-muted">
                      {r.programme} · {r.term}
                    </div>
                  </td>
                  <td>
                    {r.school}
                    {r.state && <div className="text-[13px] text-muted">{r.state}</div>}
                  </td>
                  <td className="tabular">{t("ofCapacity", { n: r.students, cap: r.capacity })}</td>
                  <td>{r.coaches ?? <span className="text-muted">{t("noCoachYet")}</span>}</td>
                  <td className="whitespace-nowrap tabular text-[14px]">
                    {formatDate(new Date(`${r.startsOn}T00:00:00Z`), locale)} – {formatDate(new Date(`${r.endsOn}T00:00:00Z`), locale)}
                  </td>
                  <td>
                    <span className={`badge badge--${r.status === "running" ? "active" : r.status === "open" ? "pending_review" : r.status === "draft" ? "paused" : "left"}`}>{t(`st.${r.status}`)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
