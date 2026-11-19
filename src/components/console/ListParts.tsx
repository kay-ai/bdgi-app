import { Link } from "@/i18n/navigation";

/** Status tabs with counts; the active one is marked for screen readers. Server component. */
export function StatusTabs({
  base,
  current,
  tabs,
  q,
  label,
}: {
  base: string;
  current?: string;
  tabs: { value: string; label: string; n?: number }[];
  q?: string;
  label: string;
}) {
  const href = (v: string) => {
    const p = new URLSearchParams();
    if (v) p.set("status", v);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const on = (current ?? "") === tab.value;
        return (
          <Link
            key={tab.value || "all"}
            href={href(tab.value)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-[var(--r-btn)] border px-4 text-[14px] ${on ? "border-[var(--p-ink)] bg-[var(--p-ink)] text-[var(--p-bg)]" : "border-line"}`}
          >
            {tab.label}
            {tab.n !== undefined && <span className="tabular opacity-80">{tab.n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** A GET search box that keeps the chosen status. */
export function SearchBox({ status, q, label, button, placeholder }: { status?: string; q?: string; label: string; button: string; placeholder: string }) {
  return (
    <form method="get" role="search" className="flex w-full max-w-[520px] gap-3">
      {status && <input type="hidden" name="status" value={status} />}
      <label className="sr-only" htmlFor="people-q">
        {label}
      </label>
      <input id="people-q" name="q" defaultValue={q} className="input flex-1" placeholder={placeholder} maxLength={80} />
      <button type="submit" className="btn btn--plain">
        {button}
      </button>
    </form>
  );
}

export function Pager({ base, page, pages, params, labels }: { base: string; page: number; pages: number; params: Record<string, string | undefined>; labels: { prev: string; next: string; of: string; nav: string } }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${base}?${q.toString()}`;
  };
  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className="link link--bare" rel="prev">
          {labels.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted tabular">{labels.of}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className="link" rel="next">
          {labels.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
