import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { SupervisionGroup } from "@/server/services/coach-supervision";

/**
 * The volunteer's home for the speech coach (D-015): the AI coaches each student on her own path;
 * here her coach sees who is practising, who needs a look and why, and opens a student to check
 * the AI's scorecards.
 */
export async function CoachSupervision({ groups }: { groups: SupervisionGroup[] }) {
  const t = await getTranslations("hub.supervise");
  const format = await getFormatter();
  if (!groups.length) return null;
  return (
    <section className="grid gap-8" aria-labelledby="supervise-h">
      <div className="grid gap-1">
        <h2 id="supervise-h" className="t-h3">
          {t("title")}
        </h2>
        <p className="text-[15px] text-muted">{t("lead")}</p>
      </div>
      {groups.map((g) => (
        <div key={g.cohortId} className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">
              {g.name} <span className="font-normal text-muted">· {g.school}</span>
            </h3>
            <span className="text-[14px] text-muted">
              {t("groupLine", { practising: g.practisingThisMonth, all: g.students.length, look: g.needsLook })}
            </span>
          </div>
          {g.students.length === 0 ? (
            <p className="text-muted">{t("noStudents")}</p>
          ) : (
            <ul className="grid gap-2">
              {g.students.map((st) => (
                <li key={st.id}>
                  <Link href={`/app/volunteer/student/${st.id}`} className="card grid gap-2 !p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <span className="grid gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{st.firstName}</span>
                        {st.rank && <span className="text-[14px] text-muted">{t(`rank.${st.rank}`)}</span>}
                        {st.attention.map((a) => (
                          <span key={a} className="rounded-full bg-[#fff1c7] px-2 py-0.5 text-[12px] font-medium text-[#5c4600]">
                            {t(`attention.${a}`)}
                          </span>
                        ))}
                      </span>
                      <span className="text-[14px] text-muted">
                        {st.lastAt
                          ? t("line", {
                              passed: st.lessonsPassed,
                              total: st.lessonsTotal,
                              month: st.thisMonth,
                              last: format.dateTime(st.lastAt, { day: "numeric", month: "short" }),
                            })
                          : t("lineNone")}
                      </span>
                    </span>
                    <span className="grid justify-items-start gap-0.5 text-[14px] sm:justify-items-end">
                      {st.recentStars !== null && (
                        <span className="tabular">
                          {t("stars", { n: st.recentStars })}
                          {st.starsChange !== null && st.starsChange !== 0 && (
                            <span className={st.starsChange > 0 ? "ml-1" : "ml-1 text-muted"}>
                              {st.starsChange > 0 ? `▲ ${st.starsChange}` : `▼ ${Math.abs(st.starsChange)}`}
                            </span>
                          )}
                        </span>
                      )}
                      {st.unreviewed > 0 && <span className="text-muted">{t("toCheck", { n: st.unreviewed })}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
