import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate, money } from "@/lib/format";
import { getSupporter } from "@/server/services/console-donations";
import { requirePermission } from "@/server/auth/current";
import { GiftActions, SupporterNotes } from "@/components/console/DonationActions";

/** Supporter page (spec/11 §3): contact, gifts, totals, notes, "wants updates". */
export default async function SupporterPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("console");
  const actor = await requirePermission("donation.view", `/console/donations/supporters/${id}`);
  const sup = await getSupporter(actor, id);
  if (!sup) notFound();
  const totals = (["NGN", "USD"] as const).filter((c) => sup.totals[c]).map((c) => money(sup.totals[c]!, c));

  return (
    <>
      <div className="grid gap-2">
        <Link href="/console/donations" className="link link--bare justify-self-start text-[14px] text-muted">
          ← {t("donations")}
        </Link>
        <h1 className="t-h2">{sup.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <dl className="card grid gap-3 !p-5">
            <Row label={t("email")} value={<a className="uline break-all" href={`mailto:${sup.email}`}>{sup.email}</a>} />
            <Row label={t("phone")} value={sup.phone ?? "–"} />
            <Row label={t("wantsUpdates")} value={sup.wantsUpdates ? t("yes") : t("no")} />
            <Row label={t("totalGiven")} value={totals.length ? totals.join(" · ") : "–"} />
            <Row label={t("supporterSince")} value={formatDate(sup.createdAt, locale)} />
          </dl>
          <div className="card !p-5">
            <SupporterNotes supporterId={sup.id} initial={sup.notes} />
          </div>
        </div>
        <section aria-labelledby="gifts-h" className="grid content-start gap-4">
          <h2 id="gifts-h" className="t-h3">
            {t("gifts", { n: sup.gifts.length })}
          </h2>
          {sup.gifts.length === 0 ? (
            <p className="text-muted">{t("empty")}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t("date")}</th>
                    <th scope="col" className="num">
                      {t("amount")}
                    </th>
                    <th scope="col">{t("designation")}</th>
                    <th scope="col">{t("status")}</th>
                    <th scope="col">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sup.gifts.map((g) => (
                    <tr key={g.id}>
                      <td className="whitespace-nowrap">
                        {formatDate(g.paidAt ?? g.createdAt, locale)}
                        <div className="text-[13px] text-muted tabular">{g.reference}</div>
                      </td>
                      <td className="num">
                        {money(g.amountMinor, g.currency)}
                        <div className="text-[13px] text-muted">{g.frequency === "monthly" ? t("monthly") : t("oneOff")}</div>
                      </td>
                      <td>{g.designation ?? t("whereNeeded")}</td>
                      <td>
                        <span className={`badge badge--${g.status}`}>{t(`st_${g.status}`)}</span>
                      </td>
                      <td>
                        <GiftActions donationId={g.id} status={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
