import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { legal } from "@/content/legal";
import { formatDate } from "@/lib/format";

type Key = keyof typeof legal;

export function legalMetadata(key: Key): Metadata {
  return { title: legal[key].title, description: legal[key].lead };
}

/** A reading page: one narrow column, numbered headings in the margin on wide screens. */
export async function LegalPage({ docKey, locale }: { docKey: Key; locale: string }) {
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const d = legal[docKey];
  return (
    <article className="wrap py-16 lg:py-24">
      <header className="grid max-w-[760px] gap-6 border-b border-line pb-10">
        <h1 className="t-h1">{d.title}</h1>
        <p className="t-lead text-muted">{d.lead}</p>
        <p className="t-small text-muted">
          {t("updated", { date: formatDate(d.updated, locale) })} · <span className="whitespace-nowrap">{t("version", { version: d.version })}</span>
        </p>
        <p className="t-small rounded-[8px] bg-surface px-4 py-3">{t("draft")}</p>
      </header>
      <div className="prose-legal mt-12 grid max-w-[760px] gap-12">
        {d.blocks.map((b, i) => (
          <section key={b.h} aria-labelledby={`s${i}`} className="grid gap-4">
            <h2 id={`s${i}`} className="t-h3">
              <span className="tabular mr-3 text-muted">{String(i + 1).padStart(2, "0")}</span>
              {b.h}
            </h2>
            {b.p?.map((p) => <p key={p}>{p}</p>)}
            {b.ul && (
              <ul className="grid list-disc gap-2 pl-6">
                {b.ul.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {b.ol && (
              <ol className="grid list-decimal gap-2 pl-6">
                {b.ol.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            )}
            {b.table && (
              <table className="w-full text-left text-[16px]">
                <tbody>
                  {b.table.map(([a, c]) => (
                    <tr key={a} className="border-b border-line align-top">
                      <th scope="row" className="w-1/2 py-3 pr-4 font-medium">
                        {a}
                      </th>
                      <td className="py-3">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
