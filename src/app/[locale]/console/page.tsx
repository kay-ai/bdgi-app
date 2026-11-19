import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CalendarDays, CircleCheck, School } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { fmt, naira, usd } from "@/lib/format";
import { requireStaff } from "@/server/auth/current";
import { consoleDashboard, type ConsoleDashboard } from "@/server/services/console-dashboard";

const LAGOS = "Africa/Lagos";
const intlLocale = (l: string) => (l === "yo" ? "yo-NG" : "en-GB");

/** Console home (spec/07 §1, DESIGN.md §10): what is waiting, what is coming, how sign-ups are moving. */
export default async function ConsoleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff("/console");
  const t = await getTranslations("console.dash");
  const d = await consoleDashboard(actor);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: LAGOS }).format(now));
  const greeting = hour < 12 ? t("morning", { name: actor.firstName }) : hour < 17 ? t("afternoon", { name: actor.firstName }) : t("evening", { name: actor.firstName });
  const today = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: LAGOS }).format(now);
  const waiting = (d.students?.pendingReview ?? 0) + (d.volunteers?.open ?? 0) + (d.schools?.newRequests ?? 0);

  const tiles: Tile[] = [];
  if (d.students)
    tiles.push({
      label: t("tileStudents"),
      value: fmt(d.students.pendingReview),
      note: t("tileStudentsNote", { n: d.students.pendingConsent }),
      href: "/console/students?status=pending_review",
      link: t("review"),
      hot: d.students.pendingReview > 0,
    });
  if (d.volunteers)
    tiles.push({
      label: t("tileVolunteers"),
      value: fmt(d.volunteers.open),
      note: t("tileVolunteersNote", { n: d.volunteers.active }),
      href: "/console/volunteers",
      link: t("review"),
      hot: d.volunteers.open > 0,
    });
  if (d.schools)
    tiles.push({
      label: t("tileSchools"),
      value: fmt(d.schools.newRequests),
      note: t("tileSchoolsNote", { n: d.schools.partners }),
      href: "/console/schools?status=new",
      link: t("open"),
      hot: d.schools.newRequests > 0,
    });
  if (d.donations)
    tiles.push({
      label: t("tileGiven"),
      value: naira(d.donations.ngnMinor),
      note: [t("tileGivenNote", { n: d.donations.gifts }), d.donations.usdMinor ? usd(d.donations.usdMinor) : null].filter(Boolean).join(" · "),
      href: "/console/donations",
      link: t("open"),
    });
  if (d.sessions)
    tiles.push({ label: t("tileSessions"), value: fmt(d.sessions.week), note: t("tileSessionsNote", { n: d.sessions.today }), href: null, link: null, hot: d.sessions.unmarked > 0 });
  if (d.messages)
    tiles.push({
      label: t("tileFailed"),
      value: fmt(d.messages.failed),
      note: t("tileFailedNote", { n: d.messages.sent }),
      href: "/console/messages",
      link: t("open"),
      hot: d.messages.failed > 0,
    });

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="text-[14px] text-muted">{today}</p>
        <h1 className="console-title">{greeting}</h1>
        <p className="text-muted">{waiting ? t("leadWaiting", { n: waiting }) : t("leadClear")}</p>
      </header>

      {tiles.length > 0 && (
        <ul className="console-tiles" role="list">
          {tiles.map((tile) => (
            <li key={tile.label} className="console-tile">
              <span className="flex items-center gap-2 text-[14px] text-muted">
                {tile.hot && <span className="console-dot" aria-hidden="true" />}
                {tile.label}
              </span>
              <span className="console-figure tabular">{tile.value}</span>
              <span className="text-[14px] text-muted">{tile.note}</span>
              {tile.href && tile.link && (
                <Link href={tile.href} className="console-tile__link">
                  {tile.link}
                  <ArrowRight size={14} aria-hidden="true" />
                  <span className="sr-only">: {tile.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-8">
          {(d.see.students || d.see.volunteers) && <SignupChart weekly={d.weekly} see={d.see} locale={locale} t={t} />}
          {d.sessions && <Sessions sessions={d.sessions} locale={locale} t={t} />}
        </div>
        <div className="grid content-start gap-8">
          <Queue queue={d.queue} locale={locale} t={t} />
          <Glance d={d} t={t} />
        </div>
      </div>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"console.dash">>>;
type Tile = { label: string; value: string; note: string; href: string | null; link: string | null; hot?: boolean };

/** Sign-ups per week, students in ink and volunteers in gold, stacked; figures sit on the bars. */
function SignupChart({ weekly, see, locale, t }: { weekly: ConsoleDashboard["weekly"]; see: ConsoleDashboard["see"]; locale: string; t: T }) {
  const totals = weekly.reduce((a, w) => ({ s: a.s + w.students, v: a.v + w.volunteers }), { s: 0, v: 0 });
  const max = Math.max(1, ...weekly.map((w) => (see.students ? w.students : 0) + (see.volunteers ? w.volunteers : 0)));
  const label = (d: Date) => new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: LAGOS }).format(d);
  return (
    <section aria-labelledby="chart-h" className="console-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="chart-h" className="console-h2">
          {t("chartTitle")}
        </h2>
        <p className="flex flex-wrap gap-4 text-[14px]">
          {see.students && (
            <span className="flex items-center gap-2">
              <span className="console-key console-key--ink" aria-hidden="true" />
              {t("chartStudents", { n: totals.s })}
            </span>
          )}
          {see.volunteers && (
            <span className="flex items-center gap-2">
              <span className="console-key console-key--gold" aria-hidden="true" />
              {t("chartVolunteers", { n: totals.v })}
            </span>
          )}
        </p>
      </div>
      <div className="console-chart" role="img" aria-label={t("chartAlt", { s: totals.s, v: totals.v })}>
        {weekly.map((w, i) => {
          const s = see.students ? w.students : 0;
          const v = see.volunteers ? w.volunteers : 0;
          const last = i === weekly.length - 1;
          return (
            <div key={w.start.toISOString()} className={`console-chart__col${last ? " is-now" : ""}`}>
              <span className="console-chart__n tabular">{s + v || ""}</span>
              <div className="console-chart__bar" style={{ height: `${((s + v) / max) * 100}%` }}>
                {v > 0 && <span className="console-chart__v" style={{ flexGrow: v }} />}
                {s > 0 && <span className="console-chart__s" style={{ flexGrow: s }} />}
              </div>
              <span className="console-chart__x">{i % 2 === (weekly.length - 1) % 2 ? (last ? t("thisWeek") : label(w.start)) : ""}</span>
            </div>
          );
        })}
      </div>
      {totals.s + totals.v === 0 && <p className="text-[14px] text-muted">{t("chartEmpty")}</p>}
    </section>
  );
}

/** Oldest first: whoever has waited longest is at the top. */
function Queue({ queue, locale, t }: { queue: ConsoleDashboard["queue"]; locale: string; t: T }) {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const ago = (d: Date) => {
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
    if (days > -1) {
      const hours = Math.round((d.getTime() - Date.now()) / 3_600_000);
      return hours > -1 ? t("justNow") : rtf.format(hours, "hour");
    }
    return Math.abs(days) < 14 ? rtf.format(days, "day") : rtf.format(Math.round(days / 7), "week");
  };
  const href = (q: (typeof queue)[number]) => (q.kind === "student" ? "/console/students?status=pending_review" : q.kind === "volunteer" ? "/console/volunteers" : "/console/schools?status=new");
  return (
    <section aria-labelledby="queue-h" className="console-panel">
      <h2 id="queue-h" className="console-h2">
        {t("queueTitle")}
      </h2>
      {queue.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <CircleCheck size={20} strokeWidth={1.75} className="mt-[2px] shrink-0 text-success" aria-hidden="true" />
          <div className="grid gap-1">
            <p className="font-medium">{t("queueClearTitle")}</p>
            <p className="text-[14px] text-muted">{t("queueClear")}</p>
          </div>
        </div>
      ) : (
        <ul className="console-list" role="list">
          {queue.map((q) => (
            <li key={`${q.kind}-${q.id}`}>
              <Link href={href(q)} className="console-list__row">
                {q.kind === "school" ? (
                  <span className="console-list__icon" aria-hidden="true">
                    <School size={18} strokeWidth={1.75} />
                  </span>
                ) : (
                  <Avatar avatarKey={q.avatarKey ?? "a01"} size={36} className="shrink-0" />
                )}
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{q.name}</span>
                  <span className="truncate text-[14px] text-muted">{[t(`kind_${q.kind}` as "kind_student"), q.detail].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-[13px] text-muted">{ago(q.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Sessions({ sessions, locale, t }: { sessions: NonNullable<ConsoleDashboard["sessions"]>; locale: string; t: T }) {
  const when = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: LAGOS });
  return (
    <section aria-labelledby="sessions-h" className="console-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="sessions-h" className="console-h2">
          {t("sessionsTitle")}
        </h2>
        {sessions.unmarked > 0 && <p className="text-[14px] text-danger">{t("unmarked", { n: sessions.unmarked })}</p>}
      </div>
      {sessions.next.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <CalendarDays size={20} strokeWidth={1.75} className="mt-[2px] shrink-0 text-muted" aria-hidden="true" />
          <p className="text-[14px] text-muted">{t("sessionsEmpty")}</p>
        </div>
      ) : (
        <table className="console-table">
          <caption className="sr-only">{t("sessionsTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("when")}</th>
              <th scope="col">{t("cohort")}</th>
              <th scope="col">{t("school")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.next.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap tabular">{when.format(s.startsAt)}</td>
                <td>{s.cohort}</td>
                <td className="text-muted">{s.school}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** The programme in three numbers, plus open safeguarding cases for those who may count them. */
function Glance({ d, t }: { d: ConsoleDashboard; t: T }) {
  const rows = [
    d.students && { label: t("glanceStudents"), n: d.students.active },
    d.volunteers && { label: t("glanceCoaches"), n: d.volunteers.active },
    d.schools && { label: t("glanceSchools"), n: d.schools.partners },
    d.tasks !== null && { label: t("glanceTasks"), n: d.tasks },
    d.cases && { label: t("glanceCases"), n: Object.values(d.cases).reduce((a, b) => a + b, 0), hot: (d.cases.high ?? 0) + (d.cases.emergency ?? 0) > 0 },
  ].filter(Boolean) as { label: string; n: number; hot?: boolean }[];
  if (!rows.length) return null;
  return (
    <section aria-labelledby="glance-h" className="console-panel">
      <h2 id="glance-h" className="console-h2">
        {t("glanceTitle")}
      </h2>
      <dl className="console-list">
        {rows.map((r) => (
          <div key={r.label} className="console-list__row !py-3">
            <dt className="flex flex-1 items-center gap-2">
              {r.hot && <span className="console-dot console-dot--danger" aria-hidden="true" />}
              {r.label}
            </dt>
            <dd className="console-figure--sm tabular">{fmt(r.n)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
