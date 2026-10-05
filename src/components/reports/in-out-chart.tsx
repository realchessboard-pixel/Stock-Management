import { formatQty } from "@/lib/format";

/**
 * 7-day stock in vs stock out, as grouped bars (server-rendered SVG).
 * Colours: In = brand blue, Out = orange (validated pair, CVD-safe).
 * Identity is never colour-alone: legend with +/− signs, per-bar hover
 * tooltip (<title>), and a screen-reader table.
 */
const IN = "#1f63e0";
const OUT = "#b45309";

export function InOutChart({ series }: { series: { day: string; in: number; out: number }[] }) {
  const max = Math.max(1, ...series.flatMap((d) => [d.in, d.out]));
  const W = 700;
  const H = 180;
  const padB = 24;
  const plotH = H - padB - 8;
  const groupW = W / series.length;
  const barW = Math.min(28, groupW / 3);
  const label = (key: string) =>
    new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
  const totalIn = series.reduce((s, d) => s + d.in, 0);
  const totalOut = series.reduce((s, d) => s + d.out, 0);

  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: IN }} aria-hidden /> Stock in (+{formatQty(totalIn)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: OUT }} aria-hidden /> Stock out (−{formatQty(totalOut)})
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Units in and out per day, last 7 days">
        <line x1="0" x2={W} y1={plotH + 8} y2={plotH + 8} stroke="#e2e8f0" strokeWidth="1" />
        {series.map((d, i) => {
          const cx = i * groupW + groupW / 2;
          const hIn = (d.in / max) * plotH;
          const hOut = (d.out / max) * plotH;
          const isToday = i === series.length - 1;
          return (
            <g key={d.day}>
              {/* Generous invisible hit target for the hover tooltip */}
              <rect x={i * groupW} y={0} width={groupW} height={H} fill="transparent">
                <title>{`${label(d.day)}: +${formatQty(d.in)} in, −${formatQty(d.out)} out`}</title>
              </rect>
              {d.in > 0 ? <rect x={cx - barW - 1} y={plotH + 8 - hIn} width={barW} height={hIn} rx="4" fill={IN} pointerEvents="none" /> : null}
              {d.out > 0 ? <rect x={cx + 1} y={plotH + 8 - hOut} width={barW} height={hOut} rx="4" fill={OUT} pointerEvents="none" /> : null}
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="13" fill={isToday ? "#0f172a" : "#475569"} fontWeight={isToday ? 700 : 400}>
                {isToday ? "Today" : label(d.day)}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Units in and out per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>In</th>
            <th>Out</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.in}</td>
              <td>{d.out}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
