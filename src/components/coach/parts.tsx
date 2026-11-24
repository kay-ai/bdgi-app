import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth/current";
import { hasRole } from "@/server/permissions/can";
import type { Eligibility } from "@/server/services/speech";

/** Coach pages are for students; anyone else goes to their own home. */
export async function requireStudent(path: string) {
  const actor = await requireActor(path);
  if (!hasRole(actor, "student")) redirect("/app");
  return actor;
}

export function Stars({ n, label, size = 28 }: { n: number; label: string; size?: number }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"
            fill={i <= n ? "#FFB800" : "none"}
            stroke={i <= n ? "#FFB800" : "currentColor"}
            strokeWidth="1.4"
            strokeLinejoin="round"
            opacity={i <= n ? 1 : 0.35}
          />
        </svg>
      ))}
    </span>
  );
}

/** A 1–5 bar. `value` may be fractional (skill ratings). */
export function Bar({ label, value, note, focus }: { label: string; value: number | null; note?: string; focus?: string }) {
  const pct = value === null ? 0 : Math.max(4, ((value - 0) / 5) * 100);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className="font-medium">
          {label}
          {focus && <span className="ml-2 rounded-full bg-[#FFB800] px-2 py-0.5 text-[12px] font-medium text-[#1A1712]">{focus}</span>}
        </span>
        <span className="tabular text-muted">{value === null ? "–" : `${value.toFixed(value % 1 ? 1 : 0)} / 5`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </div>
  );
}

export async function Blocked({ e }: { e: Exclude<Eligibility, { ok: true }> }) {
  const t = await getTranslations("coach.blocked");
  return (
    <div className="card grid gap-2 !p-6">
      <p className="font-medium">{t("title")}</p>
      <p className="text-muted">{t(e.reason, { cap: e.cap ?? 0 })}</p>
    </div>
  );
}

type TrendPoint = { stars: number | null; wpm: number | null; fillersPerMin: number | null; date: string };

/** One small line: the student's last speeches, oldest on the left; `band` shades the good range. */
function Spark({ label, values, min, max, band, unit, latest }: { label: string; values: (number | null)[]; min: number; max: number; band?: [number, number]; unit: string; latest: string }) {
  const W = 240;
  const H = 64;
  const pad = 6;
  const pts = values.map((v, i) => (v === null ? null : { x: values.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (values.length - 1), y: H - pad - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (H - 2 * pad) }));
  const yOf = (v: number) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  const path = pts
    .filter((p): p is { x: number; y: number } => !!p)
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const shown = values.filter((v): v is number => v !== null);
  return (
    <figure className="grid gap-1">
      <figcaption className="flex items-baseline justify-between gap-3 text-[15px]">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">{latest}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={`${label}: ${shown.join(", ")} ${unit}`} preserveAspectRatio="none">
        {band && <rect x={0} width={W} y={yOf(band[1])} height={yOf(band[0]) - yOf(band[1])} fill="currentColor" opacity={0.07} />}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (p ? <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 2.5} fill={i === pts.length - 1 ? "#FFB800" : "currentColor"} /> : null))}
      </svg>
    </figure>
  );
}

/** spec/12 §2 step 7: how stars, pace and fillers have moved across her recent speeches. */
export async function Trend({ points }: { points: TrendPoint[] }) {
  const t = await getTranslations("coach.trend");
  if (points.length < 2) return null;
  const last = points.at(-1)!;
  return (
    <section className="grid gap-4" aria-labelledby="trend">
      <div className="grid gap-1">
        <h2 id="trend" className="t-h3">
          {t("title")}
        </h2>
        <p className="text-[15px] text-muted">{t("lead", { n: points.length })}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <Spark label={t("stars")} values={points.map((p) => p.stars)} min={1} max={5} unit="★" latest={last.stars ? `${last.stars} / 5` : "–"} />
        <Spark label={t("pace")} values={points.map((p) => p.wpm)} min={60} max={220} band={[110, 160]} unit="wpm" latest={last.wpm !== null ? t("wpm", { n: last.wpm }) : "–"} />
        <Spark label={t("fillers")} values={points.map((p) => p.fillersPerMin)} min={0} max={10} band={[0, 2]} unit="/min" latest={last.fillersPerMin !== null ? t("perMin", { n: last.fillersPerMin }) : "–"} />
      </div>
      <p className="text-[13px] text-muted">{t("note")}</p>
    </section>
  );
}
