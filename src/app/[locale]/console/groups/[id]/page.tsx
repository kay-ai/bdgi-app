import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AddStudents, AssignCoach, GroupForm, RemoveMember } from "@/components/console/GroupForms";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { coachCandidates, groupDetail, groupFormOptions } from "@/server/services/console-groups";

export const metadata = { title: "Group" };
export const dynamic = "force-dynamic";

const d = (iso: string, locale: string) => formatDate(new Date(`${iso}T00:00:00Z`), locale);

/** One group: details, coaches and students, with the actions to change them. */
export default async function GroupPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("cohort.manage", `/console/groups/${id}`);
  const t = await getTranslations("console.groups");
  const g = await groupDetail(actor, id);
  if (!g) notFound();
  const [options, candidates] = await Promise.all([groupFormOptions(actor), g.canManage ? coachCandidates(actor, id) : Promise.resolve([])]);
  const c = g.group;
  const open = c.status !== "completed" && c.status !== "cancelled";
  const free = Math.max(0, c.capacity - g.students.length);
  const when = [c.meetingDay !== null ? t(`day.${c.meetingDay}` as "day.1") : null, c.meetingTime?.slice(0, 5), c.venue].filter(Boolean).join(" · ");

  return (
    <>
      <div className="grid gap-2">
        <Link href="/console/groups" className="uline w-fit text-[15px]">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h2">{c.name}</h1>
          <span className="badge">{t(`st.${c.status}`)}</span>
        </div>
        <p className="text-muted">
          {c.school} · {c.programme} · {c.term} · {d(c.startsOn, locale)} – {d(c.endsOn, locale)}
        </p>
        {when && <p className="text-[15px]">{t("meets", { when })}</p>}
      </div>

      <section className="grid gap-3" aria-labelledby="coaches">
        <h2 id="coaches" className="t-h3">
          {t("coachesTitle", { n: g.coaches.length })}
        </h2>
        {g.coaches.length === 0 ? (
          <p className="text-muted">{t("noCoachLead")}</p>
        ) : (
          <ul className="grid gap-2" role="list">
            {g.coaches.map((m) => (
              <li key={m.personId} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
                <span>
                  <span className="font-medium">
                    {m.firstName} {m.surname}
                  </span>
                  <span className="text-muted"> · {t(m.role as "lead_coach")}</span>
                  <span className="block text-[13px] text-muted">{t("since", { date: d(m.joinedOn, locale) })}</span>
                </span>
                {g.canManage && <RemoveMember cohortId={c.id} personId={m.personId} name={m.firstName} />}
              </li>
            ))}
          </ul>
        )}
        {g.canManage && open && <AssignCoach cohortId={c.id} candidates={candidates} newCoachHref={`/console/volunteers/new?group=${c.id}`} />}
      </section>

      <section className="grid gap-3" aria-labelledby="students">
        <h2 id="students" className="t-h3">
          {t("studentsTitle", { n: g.students.length, cap: c.capacity })}
        </h2>
        {g.students.length === 0 ? (
          <p className="text-muted">{t("noStudents")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("studentsTitle", { n: g.students.length, cap: c.capacity })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("student")}</th>
                  <th scope="col">{t("joined")}</th>
                  <th scope="col">{t("speeches")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.students.map((m) => (
                  <tr key={m.personId}>
                    <td>
                      <Link href={`/console/students/${m.personId}`} className="uline font-medium">
                        {m.firstName} {m.surname}
                      </Link>
                      <div className="text-[13px] text-muted">{[m.classLevel, m.age ? t("age", { n: m.age }) : null].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="whitespace-nowrap tabular">{d(m.joinedOn, locale)}</td>
                    <td className="tabular">
                      {m.speeches}
                      {m.lastSpeech && <div className="text-[13px] text-muted">{t("lastOn", { date: formatDate(m.lastSpeech, locale) })}</div>}
                    </td>
                    <td>{g.canManage && <RemoveMember cohortId={c.id} personId={m.personId} name={m.firstName} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {g.canManage && open && (free > 0 ? <AddStudents cohortId={c.id} free={free} /> : <p className="text-muted">{t("fullLead")}</p>)}
      </section>

      {g.former.length > 0 && (
        <section className="grid gap-2" aria-labelledby="former">
          <h2 id="former" className="t-h3">
            {t("formerTitle")}
          </h2>
          <ul className="grid gap-1 text-[15px]" role="list">
            {g.former.map((m) => (
              <li key={m.personId} className="text-muted">
                {m.firstName} {m.surname} · {m.role === "student" ? t("student") : t(m.role as "lead_coach")} · {t("leftOn", { date: d(m.leftOn!, locale) })}
                {m.leftReason ? ` · ${m.leftReason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {g.canManage && (
        <details className="grid gap-3">
          <summary className="cursor-pointer t-h3">{t("editTitle")}</summary>
          <div className="mt-3">
            <GroupForm
              id={c.id}
              programmes={options.programmes}
              schools={options.schools}
              initial={{
                name: c.name,
                programmeId: c.programmeId,
                schoolId: c.schoolId,
                term: c.term,
                startsOn: c.startsOn,
                endsOn: c.endsOn,
                meetingDay: c.meetingDay,
                meetingTime: c.meetingTime?.slice(0, 5) ?? "",
                venue: c.venue ?? "",
                capacity: c.capacity,
                status: c.status,
              }}
            />
          </div>
        </details>
      )}
    </>
  );
}
