import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate, money } from "@/lib/format";
import { designatedProgrammes, donationTotals, listDonations } from "@/server/services/console-donations";
import { requirePermission } from "@/server/auth/current";
import { donationFilters } from "@/server/validation/donation";

type Search = Record<string, string | string[] | undefined>;

const pairs = (m: Partial<Record<string, number>>) => (["NGN", "USD"] as const).filter((c) => m[c]).map((c) => money(m[c]!, c));

/** `/console/donations` (spec/11 §3, spec/07 §12): totals, filters in the URL, list, CSV export. */
export default async function DonationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("donation.view", "/console/donations");
  const t = await getTranslations("console");
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const filters = donationFilters.parse(flat);
  const [list, totals, programmes] = await Promise.all([listDonations(actor, filters), donationTotals(actor), designatedProgrammes()]);

  const qs = (over: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...flat, ...over })) if (v !== undefined && v !== "") q.set(k, String(v));
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const { page: _p, ...exportFilters } = flat;
  const exportHref = `/api/console/donations/export${qs({ ...exportFilters, page: undefined })}`;
  const none = t("none");

  const tiles: [string, string[]][] = [
    [t("thisMonth"), pairs(totals.month)],
    [t("thisYear"), pairs(totals.year)],
    [t("oneOff"), pairs(totals.oneOff)],
    [t("monthly"), pairs(totals.monthly)],
    [t("averageGift"), pairs(totals.average)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-h2">{t("donations")}</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/console/donations/new" className="btn">
            {t("recordOffline")}
          </Link>
          <a href={exportHref} className="btn btn--plain !bg-surface !text-ink" download>
            {t("exportCsv")}
          </a>
        </div>
      </div>

      <section aria-labelledby="totals-h" className="grid gap-4">
        <h2 id="totals-h" className="sr-only">
          {t("totals")}
        </h2>
        <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6" role="list">
          {tiles.map(([label, values]) => (
            <li key={label} className="card grid content-start gap-1 !p-5">
              <span className="text-[14px] text-muted">{label}</span>
              {values.length ? (
                values.map((v) => (
                  <span key={v} className="text-[22px] font-medium tabular">
                    {v}
                  </span>
                ))
              ) : (
                <span className="text-[22px] font-medium text-muted">{none}</span>
              )}
            </li>
          ))}
          <li className="card grid content-start gap-1 !p-5">
            <span className="text-[14px] text-muted">{t("supportersThisYear")}</span>
            <span className="text-[22px] font-medium tabular">
              {t("newReturning", { n: totals.supporters.newThisYear, r: totals.supporters.returningThisYear })}
            </span>
          </li>
        </ul>
        {totals.byDesignation.length > 0 && (
          <details className="card !p-5">
            <summary className="cursor-pointer font-medium">{t("byDesignation")}</summary>
            <ul className="mt-3 grid gap-2" role="list">
              {totals.byDesignation.map((d) => (
                <li key={`${d.designation}-${d.currency}`} className="flex justify-between gap-4 border-t border-line pt-2">
                  <span>{d.designation ?? t("whereNeeded")}</span>
                  <span className="tabular">{money(d.total, d.currency)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <form method="get" className="card grid grid-cols-1 gap-3 !p-5 min-[480px]:grid-cols-2 md:grid-cols-4 md:items-end xl:grid-cols-7" aria-label={t("filters")}>
        <Select name="status" label={t("status")} value={filters.status} options={["paid", "initiated", "failed", "refunded"].map((v) => [v, t(`st_${v}`)])} any={t("any")} />
        <Select name="frequency" label={t("frequency")} value={filters.frequency} options={[["one_off", t("oneOff")], ["monthly", t("monthly")]]} any={t("any")} />
        <Select name="currency" label={t("currency")} value={filters.currency} options={[["NGN", "NGN"], ["USD", "USD"]]} any={t("any")} />
        <Select
          name="designation"
          label={t("designation")}
          value={filters.designation}
          options={[["general", t("whereNeeded")], ...programmes.map((p) => [p.id, p.name] as [string, string])]}
          any={t("any")}
        />
        <label className="field">
          <span className="text-[14px] font-medium">{t("from")}</span>
          <input type="date" name="from" defaultValue={filters.from} className="input" />
        </label>
        <label className="field">
          <span className="text-[14px] font-medium">{t("to")}</span>
          <input type="date" name="to" defaultValue={filters.to} className="input" />
        </label>
        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn--plain flex-1">
            {t("apply")}
          </button>
          <Link href="/console/donations" className="link link--bare self-center">
            {t("clear")}
          </Link>
        </div>
      </form>

      <section aria-labelledby="list-h" className="grid gap-4">
        <h2 id="list-h" className="t-h3">
          {t("gifts", { n: list.total })}
        </h2>
        {list.rows.length === 0 ? (
          <div className="card grid gap-2 !p-6">
            <p className="font-medium">{Object.keys(exportFilters).length ? t("emptyFiltered") : t("empty")}</p>
            <p className="text-muted">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t("donations")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("date")}</th>
                  <th scope="col">{t("supporter")}</th>
                  <th scope="col" className="num">
                    {t("amount")}
                  </th>
                  <th scope="col">{t("frequency")}</th>
                  <th scope="col">{t("designation")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("campaign")}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {formatDate(r.paidAt ?? r.createdAt, locale)}
                      <div className="text-[13px] text-muted tabular">{r.reference}</div>
                    </td>
                    <td>
                      <Link href={`/console/donations/supporters/${r.supporterId}`} className="uline font-medium">
                        {r.supporterName}
                      </Link>
                    </td>
                    <td className="num">{money(r.amountMinor, r.currency)}</td>
                    <td>{r.frequency === "monthly" ? t("monthly") : t("oneOff")}</td>
                    <td>{r.designation ?? t("whereNeeded")}</td>
                    <td>
                      <span className={`badge badge--${r.status}`}>{t(`st_${r.status}`)}</span>
                      {r.provider !== "paystack" && <div className="mt-1 text-[13px] text-muted">{t(`pv_${r.provider}` as "pv_console")}</div>}
                    </td>
                    <td>{r.campaign ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.pages > 1 && (
          <nav aria-label={t("pagination")} className="flex items-center justify-between gap-4">
            {list.page > 1 ? (
              <Link href={`/console/donations${qs({ page: list.page - 1 })}`} className="link link--bare" rel="prev">
                {t("prev")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted tabular">{t("pageOf", { page: list.page, pages: list.pages })}</span>
            {list.page < list.pages ? (
              <Link href={`/console/donations${qs({ page: list.page + 1 })}`} className="link" rel="next">
                {t("next")}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}

function Select({ name, label, value, options, any }: { name: string; label: string; value?: string; options: [string, string][]; any: string }) {
  return (
    <label className="field">
      <span className="text-[14px] font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
