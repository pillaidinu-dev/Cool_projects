// Appends an alpha channel to a 6-digit hex color (e.g. "#34d399" -> "#34d399bf").
function withAlpha(hex, alpha) {
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `${hex}${Math.round(clamped * 255).toString(16).padStart(2, '0')}`;
}

// Anytime-TD probabilities rarely clear ~35-40% even for the best red-zone
// threats, so mapping the ramp across the full 0-100% domain packs every
// realistic value (and nearly all of a typical week's list) into a sliver
// near the dim end -- the ramp is technically correct but reads as flat.
// Saturating at a realistic ceiling instead spreads that same real-world
// range across the full ramp, so the "who's actually more likely" read
// stays honest (it's still one fixed, week-over-week-comparable scale --
// this doesn't renormalize to whoever happens to be in the list) while
// staying visible with real data, not just wide synthetic spreads.
const RAMP_CEILING = 40;

// The meter's fill is the same hue throughout (a single-series sequential
// ramp), growing more opaque -- so more vivid -- as the probability rises;
// the unfilled track is a faint step of that same hue rather than flat
// slate, so the row's overall "temperature" reads even before the fill ends.
export default function TouchdownProbability({ rows, accent = '#34d399', emptyMessage = 'No projections yet.' }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Anytime Touchdown Probability
        </h2>
        <span className="text-xs text-slate-500">this week</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-700/40 max-h-[420px] overflow-y-auto">
          {rows.map((r) => {
            const clamped = Math.min(Math.max(r.probability, 0), 100);
            const ramped = Math.min(clamped, RAMP_CEILING) / RAMP_CEILING;
            return (
              <li key={`${r.name}-${r.team}`} className="px-4 py-2.5">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-200">
                    <span className="font-medium">{r.name}</span>{' '}
                    <span className="text-xs text-slate-500">
                      {r.position} · {r.team} vs {r.opponent}
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-slate-100">{r.probability}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: withAlpha(accent, 0.14) }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${clamped}%`, background: withAlpha(accent, 0.35 + ramped * 0.65) }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
