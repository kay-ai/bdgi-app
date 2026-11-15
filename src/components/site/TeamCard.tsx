/** A person with no photograph yet: initials on a gold disc, name, title (spec/04 §6.3). */
export function TeamCard({ name, title }: { name: string; title: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className="grid gap-4">
      <div className="grid aspect-square w-full place-items-center rounded-[var(--r-lg)] bg-surface" aria-hidden="true">
        <span className="grid h-24 w-24 place-items-center rounded-full bg-accent font-display text-[34px] text-accent-ink">{initials}</span>
      </div>
      <div className="grid gap-1">
        <span className="font-medium">{name}</span>
        <span className="text-[15px] text-muted">{title}</span>
      </div>
    </div>
  );
}

/** Compact row for long lists: small disc, name, title. */
export function TeamRow({ name, title }: { name: string; title: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-[16px] font-medium text-accent-ink" aria-hidden="true">
        {initials}
      </span>
      <span className="grid">
        <span className="font-medium">{name}</span>
        <span className="text-[15px] text-muted">{title}</span>
      </span>
    </div>
  );
}
