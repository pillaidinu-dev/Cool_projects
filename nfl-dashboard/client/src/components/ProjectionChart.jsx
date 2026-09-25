import { useState } from 'react';

// The ring around the projection dot needs a solid color to separate it from
// the range band underneath -- an approximation of the card surface
// (bg-slate-800/60 over the page's near-black background) since neither is
// itself opaque.
const DOT_RING = '#0f172a';
const ROW_HEIGHT = 40;
const LABEL_COL = 108;

// Round the chart's ceiling up to a clean number (50/100/250/...) so the
// axis reads naturally instead of ending at whatever the highest projection
// happens to be.
function niceTicks(maxValue, targetCount = 4) {
  const rawStep = maxValue / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const residual = rawStep / magnitude;
  const step = residual <= 1 ? magnitude : residual <= 2 ? 2 * magnitude : residual <= 5 ? 5 * magnitude : 10 * magnitude;
  const ticks = [];
  for (let t = 0; t <= maxValue + step * 0.5; t += step) ticks.push(Math.round(t));
  return ticks;
}

// Centers a label under/over its point, except near either edge of the
// plot where centering would clip the text off the chart.
function edgeSafeLeft(pct) {
  if (pct < 6) return { left: `${pct}%`, transform: 'translateX(0)' };
  if (pct > 94) return { left: `${pct}%`, transform: 'translateX(-100%)' };
  return { left: `${pct}%`, transform: 'translateX(-50%)' };
}

function RowTooltip({ row, unit }) {
  return (
    <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100">
        {row.name} <span className="text-slate-500">{row.team}</span>
      </p>
      <p className="mt-0.5 text-slate-400">vs {row.opponent}</p>
      <p className="mt-1 text-slate-200">
        Projected <span className="font-semibold tabular-nums">{row.projection}</span> {unit}
      </p>
      <p className="tabular-nums text-slate-500">
        Range {row.low}&ndash;{row.high} {unit}
      </p>
    </div>
  );
}

// A hybrid range chart: a faint stem from zero to `low` keeps the familiar
// "longer = more" bar-chart read, a brighter band from `low` to `high` shows
// the projection's range, and the dot at `projection` is sized by how tight
// that range is (a tighter range reads as a more confident projection).
export default function ProjectionChart({ title, unit, accent, rows, emptyMessage = 'No projections yet.' }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const ticks = rows.length ? niceTicks(Math.max(...rows.map((r) => r.high))) : [];
  const domainMax = ticks[ticks.length - 1] || 1;
  const pct = (value) => (value / domainMax) * 100;

  const widths = rows.map((r) => r.high - r.low);
  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const dotSize = (width) => {
    if (maxWidth === minWidth) return 11;
    const t = (width - minWidth) / (maxWidth - minWidth);
    return 14 - t * 6; // tight range (confident) -> 14px, wide range -> 8px
  };

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="px-4 pt-5 pb-3">
          <div className="relative">
            <div
              className="pointer-events-none absolute top-0"
              style={{ left: LABEL_COL + 12, right: 0, height: rows.length * ROW_HEIGHT }}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-800" style={{ left: `${pct(t)}%` }} />
              ))}
            </div>

            {rows.map((r) => {
              const key = `${r.name}-${r.team}`;
              const lowPct = pct(r.low);
              const highPct = pct(r.high);
              const projPct = pct(r.projection);
              const size = dotSize(r.high - r.low);
              const flip = projPct > 78;

              return (
                <div
                  key={key}
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `${LABEL_COL}px 1fr`, height: ROW_HEIGHT }}
                >
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="truncate text-xs font-semibold text-slate-200">{r.name}</p>
                    <p className="truncate text-[10px] text-slate-500">
                      {r.position ? `${r.position} · ` : ''}
                      {r.team} vs {r.opponent}
                    </p>
                  </div>

                  <div
                    className="relative h-full rounded outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    tabIndex={0}
                    aria-label={`${r.name}, ${r.team}, vs ${r.opponent}, projected ${r.projection} ${unit}, range ${r.low} to ${r.high} ${unit}`}
                    onMouseEnter={() => setHoverIdx(key)}
                    onMouseLeave={() => setHoverIdx((v) => (v === key ? null : v))}
                    onFocus={() => setHoverIdx(key)}
                    onBlur={() => setHoverIdx((v) => (v === key ? null : v))}
                  >
                    <div
                      className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded bg-slate-500/40"
                      style={{ width: `${lowPct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded"
                      style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%`, background: accent, opacity: 0.32 }}
                    />
                    <div
                      className="absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-500/70"
                      style={{ left: `${lowPct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-500/70"
                      style={{ left: `${highPct}%` }}
                    />
                    <div
                      className="absolute top-1 whitespace-nowrap text-[9px] tabular-nums text-slate-500"
                      style={edgeSafeLeft(lowPct)}
                    >
                      {r.low}
                    </div>
                    <div
                      className="absolute top-1 whitespace-nowrap text-[9px] tabular-nums text-slate-500"
                      style={edgeSafeLeft(highPct)}
                    >
                      {r.high}
                    </div>
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${projPct}%`, width: size, height: size, background: accent, boxShadow: `0 0 0 3px ${DOT_RING}` }}
                    />
                    <div
                      className="absolute top-1/2 whitespace-nowrap text-xs font-bold tabular-nums text-slate-100"
                      style={{
                        left: `${projPct}%`,
                        transform: flip ? 'translate(calc(-100% - 12px), -50%)' : 'translate(12px, -50%)',
                      }}
                    >
                      {r.projection}
                    </div>

                    {hoverIdx === key && <RowTooltip row={r} unit={unit} />}
                  </div>
                </div>
              );
            })}

            <div
              className="mt-1 grid items-center gap-3 border-t border-slate-700 pt-2"
              style={{ gridTemplateColumns: `${LABEL_COL}px 1fr` }}
            >
              <div />
              <div className="relative h-3">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute tabular-nums text-[10px] text-slate-500"
                    style={edgeSafeLeft(pct(t))}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
