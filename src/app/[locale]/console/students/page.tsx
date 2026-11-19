import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Decision } from "@/components/console/Decision";
import { Pager, SearchBox, StatusTabs, one } from "@/components/console/ListParts";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { can } from "@/server/permissions/can";
import { STUDENT_STATUSES, listStudents } from "@/server/services/console-people";

type Search = Record<string, string | string[] | undefined>;

export const metadata = { title: "Students" };

/** `/console/students`: everyone who joined as a student, newest sign-ups waiting for review first. */
export default async function StudentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("intake.review", "/console/students");
  const t = await getTranslations("console");
  const sp = await searchParams;
  const status = (STUDENT_STATUSES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status) : undefined;
  const q = one(sp.q);
  const list = await listStudents(actor, { status, q, page: Number(one(sp.page) ?? 1) || 1 });
  const all = Object.values(list.counts).reduce((a, b) => a + b, 0);
  const seeMessages = can(actor, "user.manage");
  const st = (v: string) => t(`people.st_${v}` as "people.st_active");

  return (
    <>
      <div className="grid gap-2">
        <h1 className="t-h2">{t("students")}</h1>
        <p className="text-muted">{t("people.studentsLead")}</p>
      </div>
      <StatusTabs
        base="/console/students"
        current={status}
        q={q}
        label={t("people.filterStatus")}
        tabs={[{ value: "", label: t("people.all"), n: all }, ...STUDENT_STATUSES.map((v) => ({ value: v, label: st(v), n: list.counts[v] ?? 0 }))]}
      />
      <SearchBox status={status} q={q} label={t("people.search")} button={t("people.searchButton")} placeholder={t("people.searchFirstName")} />

      {list.rows.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{q || status ? t("people.emptyFiltered") : t("people.emptyStudents")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t("students")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("people.name")}</th>
                <th scope="col">{t("people.school")}</th>
                <th scope="col">{t("people.guardian")}</th>
                <th scope="col">{t("status")}</th>
                <th scope="col">{t("people.joined")}</th>
                <th scope="col">{t("people.decision")}</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-medium">
                      {r.firstName} {r.surname}
                    </span>
                    <div className="text-[13px] text-muted">{[r.age ? t("people.age", { n: r.age }) : null, r.classLevel].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    {r.school ?? "–"}
                    {r.state && <div className="text-[13px] text-muted">{r.state}</div>}
                  </td>
                  <td>
                    {r.guardian ?? (r.age && r.age >= 18 ? t("people.adult") : "–")}
                    <div className="text-[13px] text-muted">
                      {[r.participation ? t("people.permissionGiven") : r.status === "pending_consent" ? t("people.permissionWaiting") : null, r.aiPractice ? t("people.aiOn") : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {seeMessages && r.status === "pending_consent" && (
                      <Link href={`/console/messages?student=${r.id}`} className="uline text-[13px]">
                        {t("people.seePermissionLink")}
                      </Link>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge--${r.status}`}>{st(r.status)}</span>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(r.createdAt, locale)}</td>
                  <td>
                    {r.canDecide ? (
                      <Decision
                        kind="student"
                        id={r.id}
                        options={[
                          { decision: "approve", label: t("people.approve"), primary: true },
                          ...(r.status === "pending_review" ? [{ decision: "waitlist", label: t("people.waitlist") }] : []),
                          { decision: "decline", label: t("people.decline"), confirm: t("people.declineConfirm", { name: r.firstName }) },
                        ]}
                      />
                    ) : (
                      <span className="text-[14px] text-muted">{r.status === "pending_consent" ? t("people.afterPermission") : "–"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        base="/console/students"
        page={list.page}
        pages={list.pages}
        params={{ status, q }}
        labels={{ prev: t("prev"), next: t("next"), nav: t("pagination"), of: t("pageOf", { page: list.page, pages: list.pages }) }}
      />
    </>
  );
}
