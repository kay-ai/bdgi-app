type Lga = { id: string; name: string; stateCode: string; stateName: string; schools: number };

const shade = (n: number) =>
  n <= 0 ? "var(--tile-empty)" : n === 1 ? "var(--ramp-2)" : n === 2 ? "var(--ramp-3)" : n <= 4 ? "var(--ramp-4)" : "var(--ramp-5)";

/**
 * The reach map as a still, drawn on the server with no script: one tile per local government
 * area of Oyo and Osun, shaded in the gold ramp by schools BGDI works with. The geographic version
 * replaces this once the geoBoundaries LGA file is added to public/geo/ (DECISIONS.md D-004).
 */
export function ReachTiles({
  lgas,
  label,
  low,
  high,
}: {
  lgas: Lga[];
  label: string;
  low: string;
  high: string;
}) {
  const groups = ["OY", "OS"].map((code) => lgas.filter((l) => l.stateCode === code));
  return (
    <figure className="reach" aria-label={label} style={{ ["--tile-empty" as string]: "#e6dcc6" }}>
      <div className="grid gap-8">
        {groups.map((g) => (
          <div key={g[0]?.stateCode ?? "x"} className="grid gap-3">
            <p className="t-label">{g[0]?.stateName}</p>
            <ul className="reach__tiles" role="list">
              {g.map((l) => (
                <li key={l.id} title={`${l.name}: ${l.schools}`} style={{ background: shade(l.schools) }}>
                  <span className="sr-only">
                    {l.name}: {l.schools}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="mt-6 flex items-center gap-3 text-[13px] text-muted">
        <span>{low}</span>
        <span className="flex" aria-hidden="true">
          {["var(--tile-empty)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"].map((c) => (
            <span key={c} className="block h-3 w-6" style={{ background: c }} />
          ))}
        </span>
        <span>{high}</span>
      </figcaption>
    </figure>
  );
}
