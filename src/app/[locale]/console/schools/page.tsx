import { getTranslations, setRequestLocale } from "next-intl/server";
import { Decision } from "@/components/console/Decision";
import { SearchBox, StatusTabs, one } from "@/components/console/ListParts";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { REQUEST_STATUSES, listSchools } from "@/server/services/console-people";

type Search = Record<string, string | string[] | undefined>;

export const metadata = { title: "Schools" };

/** `/console/schools`: "bring BGDI to my school" requests to decide on, then partner schools. */
export default async function SchoolsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("school.view", "/console/schools");
  const t = await getTranslations("console");
  const sp = await searchParams;
  const status = (REQUEST_STATUSES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status) : undefined;
  const q = one(sp.q);
  const data = await listSchools(actor, { status, q });
  const all = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const rs = (v: string) => t(`people.rs_${v}` as "people.rs_new");

  return (
    <>
      <div className="grid gap-2">
        <h1 className="t-h2">{t("schools")}</h1>
        <p className="text-muted">{t("people.schoolsLead")}</p>
      </div>
      <SearchBox status={status} q={q} label={t("people.search")} button={t("people.searchButton")} placeholder={t("people.searchSchool")} />

      <section aria-labelledby="req-h" className="grid gap-4">
        <h2 id="req-h" className="t-h3">
          {t("people.requests")}
        </h2>
        <StatusTabs
          base="/console/schools"
          current={status}
          q={q}
          label={t("people.filterStatus")}
          tabs={[{ value: "", label: t("people.all"), n: all }, ...REQUEST_STATUSES.map((v) => ({ value: v, label: rs(v), n: data.counts[v] ?? 0 }))]}
        />
        {data.requests.length === 0 ? (
          <div className="card !p-6">
            <p className="font-medium">{q || status ? t("people.emptyFiltered") : t("people.emptyRequests")}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("people.requests")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("people.school")}</th>
                  <th scope="col">{t("people.requester")}</th>
                  <th scope="col">{t("people.details")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("people.received")}</th>
                  {data.canEdit && <th scope="col">{t("people.decision")}</th>}
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-medium">{r.school}</span>
                      <div className="text-[13px] text-muted">{[r.lga, r.state].filter(Boolean).join(", ")}</div>
                    </td>
                    <td>
                      {r.requesterName}
                      <div className="text-[13px] text-muted">{t(`people.role_${r.requesterRole}` as "people.role_principal")}</div>
                    </td>
                    <td className="max-w-[320px] text-[14px]">
                      {[r.approxStudents ? t("people.aboutStudents", { n: r.approxStudents }) : null, r.preferredTerm].filter(Boolean).join(" · ") || "–"}
                      {r.message && (
                        <p className="mt-1 line-clamp-3 text-muted" title={r.message}>
                          {r.message}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge--${r.status}`}>{rs(r.status)}</span>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(r.createdAt, locale)}</td>
                    {data.canEdit && (
                      <td>
                        {r.canDecide ? (
                          <Decision
                            kind="school"
                            id={r.id}
                            options={[
                              { decision: "accept", label: t("people.accept"), primary: true },
                              ...(r.status === "new" ? [{ decision: "contacted", label: t("people.markContacted") }] : []),
                              { decision: "decline", label: t("people.decline"), confirm: t("people.declineConfirm", { name: r.school }) },
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
      </section>

      <section aria-labelledby="partners-h" className="grid gap-4">
        <h2 id="partners-h" className="t-h3">
          {t("people.partners")}
        </h2>
        {data.partners.length === 0 ? (
          <div className="card !p-6">
            <p className="text-muted">{t("people.emptyPartners")}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("people.partners")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("people.school")}</th>
                  <th scope="col">{t("people.partnership")}</th>
                  <th scope="col" className="num">
                    {t("students")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.partners.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-medium">{p.name}</span>
                      <div className="text-[13px] text-muted">{[p.lga, p.state].filter(Boolean).join(", ")}</div>
                    </td>
                    <td>{t(`people.ps_${p.partnershipStatus}` as "people.ps_active")}</td>
                    <td className="num">{p.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
