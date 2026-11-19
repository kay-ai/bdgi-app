import { getTranslations, setRequestLocale } from "next-intl/server";
import { Decision } from "@/components/console/Decision";
import { Pager, SearchBox, StatusTabs, one } from "@/components/console/ListParts";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { can } from "@/server/permissions/can";
import { VOLUNTEER_STAGES, listVolunteers } from "@/server/services/console-people";

type Search = Record<string, string | string[] | undefined>;

export const metadata = { title: "Volunteers" };

/** `/console/volunteers`: applications first, then everyone else, with approve / decline. */
export default async function VolunteersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("volunteer.view_applications", "/console/volunteers");
  const t = await getTranslations("console");
  const sp = await searchParams;
  const status = (VOLUNTEER_STAGES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status) : undefined;
  const q = one(sp.q);
  const list = await listVolunteers(actor, { status, q, page: Number(one(sp.page) ?? 1) || 1 });
  const all = Object.values(list.counts).reduce((a, b) => a + b, 0);
  const mayDecide = can(actor, "volunteer.advance_stage");
  const st = (v: string) => t(`people.vs_${v}` as "people.vs_active");

  return (
    <>
      <div className="grid gap-2">
        <h1 className="t-h2">{t("volunteers")}</h1>
        <p className="text-muted">{t("people.volunteersLead")}</p>
      </div>
      <StatusTabs
        base="/console/volunteers"
        current={status}
        q={q}
        label={t("people.filterStatus")}
        tabs={[{ value: "", label: t("people.all"), n: all }, ...VOLUNTEER_STAGES.map((v) => ({ value: v, label: st(v), n: list.counts[v] ?? 0 }))]}
      />
      <SearchBox status={status} q={q} label={t("people.search")} button={t("people.searchButton")} placeholder={t("people.searchFirstName")} />

      {list.rows.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{q || status ? t("people.emptyFiltered") : t("people.emptyVolunteers")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t("volunteers")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("people.name")}</th>
                <th scope="col">{t("people.work")}</th>
                <th scope="col">{t("people.why")}</th>
                <th scope="col">{t("people.references")}</th>
                <th scope="col">{t("status")}</th>
                <th scope="col">{t("people.applied")}</th>
                {mayDecide && <th scope="col">{t("people.decision")}</th>}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-medium">
                      {r.firstName} {r.surname}
                    </span>
                    <div className="text-[13px] text-muted">{[r.state, r.isNysc ? t("people.nysc") : null, r.isAlumna ? t("people.alumna") : null].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    {[r.occupation, r.organisation].filter(Boolean).join(", ") || "–"}
                    {r.skills.length > 0 && <div className="text-[13px] text-muted">{r.skills.join(", ")}</div>}
                  </td>
                  <td className="max-w-[320px]">
                    <p className="line-clamp-3 text-[14px]" title={r.motivation}>
                      {r.motivation}
                    </p>
                  </td>
                  <td className="whitespace-nowrap">{t("people.refsOk", { ok: r.refsOk, n: r.refs })}</td>
                  <td>
                    <span className={`badge badge--${r.stage}`}>{st(r.stage)}</span>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(r.createdAt, locale)}</td>
                  {mayDecide && (
                    <td>
                      {r.canDecide ? (
                        <Decision
                          kind="volunteer"
                          id={r.id}
                          options={[
                            { decision: "approve", label: t("people.approve"), primary: true },
                            { decision: "decline", label: t("people.decline"), confirm: t("people.declineConfirm", { name: r.firstName }) },
                          ]}
                        />
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        base="/console/volunteers"
        page={list.page}
        pages={list.pages}
        params={{ status, q }}
        labels={{ prev: t("prev"), next: t("next"), nav: t("pagination"), of: t("pageOf", { page: list.page, pages: list.pages }) }}
      />
    </>
  );
}
