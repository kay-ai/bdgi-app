import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Decision } from "@/components/console/Decision";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current";
import { studentDetail } from "@/server/services/console-student";

export const metadata = { title: "Student" };
export const dynamic = "force-dynamic";

const stars = (n: number) => `${"★".repeat(n)}${"☆".repeat(5 - n)}`;

/** `/console/students/[id]`: everything staff need about one student, on one page (D-022). */
export default async function StudentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("intake.review", `/console/students/${id}`);
  const t = await getTranslations("console.student");
  const tp = await getTranslations("console.people");
  const tj = await getTranslations("join.student");
  const tr = await getTranslations("coach.rank");
  const tb = await getTranslations("hub.badges");
  const tg = await getTranslations("console.groups");
  const d = await studentDetail(actor, id).catch(() => null);
  if (!d) notFound();
  const p = d.person;
  const pr = d.progress;
  const earned = pr.badges.filter((b) => b.earned);

  const facts = [
    { label: t("age"), value: p.age ? t("years", { n: p.age }) : "–" },
    { label: t("class"), value: p.classLevel ?? "–" },
    { label: t("school"), value: p.school ?? "–" },
    { label: t("where"), value: [p.lga, p.state].filter(Boolean).join(", ") || "–" },
    { label: t("joined"), value: formatDate(p.createdAt, locale) },
  ];

  return (
    <>
      <div className="grid gap-2">
        <Link href="/console/students" className="uline w-fit text-[15px]">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h2">
            {p.firstName} {p.surname}
          </h1>
          <span className={`badge badge--${p.status}`}>{tp(`st_${p.status}` as "st_active")}</span>
        </div>
        {p.preferredName && <p className="text-muted">{t("prefers", { name: p.preferredName })}</p>}
        {d.canDecide && (
          <Decision
            kind="student"
            id={p.id}
            options={[
              { decision: "approve", label: tp("approve"), primary: true },
              ...(p.status === "pending_review" ? [{ decision: "waitlist", label: tp("waitlist") }] : []),
              { decision: "decline", label: tp("decline"), confirm: tp("declineConfirm", { name: p.firstName }) },
            ]}
          />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted">{f.label}</dt>
            <dd className="font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid content-start gap-3 !p-5" aria-labelledby="family">
          <h2 id="family" className="t-h3">
            {t("familyTitle")}
          </h2>
          {d.guardians.length === 0 ? (
            <p className="text-muted">{(p.age ?? 0) >= 18 ? t("adult") : t("noGuardian")}</p>
          ) : (
            <ul className="grid gap-1" role="list">
              {d.guardians.map((g, i) => (
                <li key={i}>
                  <span className="font-medium">{g.firstName}</span> <span className="text-muted">· {g.relationship}</span>
                </li>
              ))}
            </ul>
          )}
          <ul className="grid gap-1 text-[15px]" role="list">
            {d.permission.map((c) => (
              <li key={c.type} className="flex justify-between gap-3 border-b border-line py-1">
                <span>{t(`consent.${c.type}`)}</span>
                <span className={c.state === "given" ? "" : "text-muted"}>
                  {t(`cstate.${c.state}`)}
                  {c.at ? ` · ${formatDate(c.at, locale)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card grid content-start gap-3 !p-5" aria-labelledby="about">
          <h2 id="about" className="t-h3">
            {t("aboutTitle")}
          </h2>
          {!d.profile?.completedAt && <p className="text-[14px] text-muted">{t("profileNotDone")}</p>}
          {d.profile?.dreamCareer && (
            <p>
              <span className="text-muted">{t("dream")} </span>
              {d.profile.dreamCareer}
            </p>
          )}
          {d.profile?.communityDream && (
            <p>
              <span className="text-muted">{t("communityDream")} </span>
              {d.profile.communityDream}
            </p>
          )}
          {!!d.profile?.interests.length && (
            <p>
              <span className="text-muted">{t("interests")} </span>
              {d.profile.interests.map((i) => tj(`interestOptions.${i}` as never)).join(", ")}
            </p>
          )}
          {!!d.profile?.needs.length && (
            <p>
              <span className="text-muted">{t("needs")} </span>
              {d.profile.needs.map((n) => tj(`needOptions.${n}` as never)).join(", ")}
            </p>
          )}
        </section>
      </div>

      <section className="grid gap-3" aria-labelledby="groups">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="groups" className="t-h3">
            {t("groupsTitle")}
          </h2>
          {d.canManageGroups && (
            <Link href="/console/groups" className="uline text-[15px]">
              {t("manageGroups")}
            </Link>
          )}
        </div>
        {d.groups.length === 0 ? (
          <p className="text-muted">{t("noGroup")}</p>
        ) : (
          <ul className="grid gap-2" role="list">
            {d.groups.map((g) => (
              <li key={g.id} className="card grid gap-1 !p-4">
                <span>
                  {d.canManageGroups ? (
                    <Link href={`/console/groups/${g.id}`} className="uline font-medium">
                      {g.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{g.name}</span>
                  )}
                  <span className="text-muted"> · {g.school}</span>
                  {!g.current && <span className="text-muted"> · {t("past")}</span>}
                </span>
                <span className="text-[14px] text-muted">
                  {tg(`st.${g.status}` as "st.open")} ·{" "}
                  {g.coaches.length ? g.coaches.map((c) => `${c.firstName}${c.initial ? ` ${c.initial}.` : ""} (${tg(c.role as "lead_coach")})`).join(", ") : tg("noCoachYet")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="progress">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="progress" className="t-h3">
            {t("progressTitle")}
          </h2>
          {d.canSeeSpeech && (
            <Link href={`/console/ai/student/${p.id}`} className="uline text-[15px]">
              {t("allSpeeches")}
            </Link>
          )}
        </div>
        {!pr.placed ? (
          <p className="text-muted">{pr.speeches ? t("notPlacedYet") : t("noSpeeches")}</p>
        ) : (
          <>
            <ul className="console-tiles" role="list">
              {[
                { label: t("rank"), value: tr(pr.rank!), note: t("mean", { n: pr.mean!.toFixed(1) }) },
                { label: t("lessons"), value: `${pr.lessonsPassed} / ${pr.lessonsTotal}`, note: pr.next ? t("next", { title: pr.next.title }) : t("allDone") },
                { label: t("speeches"), value: String(pr.speeches), note: t("thisMonth", { n: pr.thisMonth, weeks: pr.streak }) },
                {
                  label: t("stars"),
                  value: pr.recentStars !== null ? `${pr.recentStars} / 5` : "–",
                  note: pr.starsChange === null ? t("lastAt", { date: pr.lastAt ? formatDate(pr.lastAt, locale) : "–" }) : t("change", { n: pr.starsChange > 0 ? `+${pr.starsChange}` : String(pr.starsChange) }),
                },
              ].map((x) => (
                <li key={x.label} className="console-tile">
                  <span className="text-[14px] text-muted">{x.label}</span>
                  <span className="console-figure tabular">{x.value}</span>
                  <span className="text-[14px] text-muted">{x.note}</span>
                </li>
              ))}
            </ul>
            <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("skills")}>
              {pr.skills.map((k) => (
                <li key={k.key} className="grid gap-1">
                  <span className="flex justify-between text-[14px]">
                    <span>{k.name}</span>
                    <span className="tabular text-muted">{k.rating !== null ? `${k.rating.toFixed(1)} / 5` : "–"}</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[#FFB800]" style={{ width: `${((k.rating ?? 0) / 5) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[15px]">
          <span className="text-muted">{t("badges", { n: earned.length, of: pr.badges.length })} </span>
          {earned.length ? earned.map((b) => tb(`${b.key}.name` as never)).join(", ") : t("noBadges")}
        </p>
        {d.openConcerns > 0 && <p className="rounded-[12px] bg-[#fff1c7] p-3 text-[15px] text-[#5c4600]">{t("concerns", { n: d.openConcerns })}</p>}
      </section>

      {d.speeches.length > 0 && (
        <section className="grid gap-3" aria-labelledby="recent">
          <h2 id="recent" className="t-h3">
            {t("recentTitle")}
          </h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("recentTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("speech")}</th>
                  <th scope="col">{t("result")}</th>
                  <th scope="col">{t("when")}</th>
                </tr>
              </thead>
              <tbody>
                {d.speeches.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.title}
                      {a.channel === "whatsapp" && <span className="ml-2 text-[13px] text-muted">WhatsApp</span>}
                    </td>
                    <td className="tabular">{a.status === "done" && a.stars ? stars(a.stars) : t(`sst.${a.status}` as "sst.done")}</td>
                    <td className="whitespace-nowrap tabular text-muted">{formatDate(a.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
