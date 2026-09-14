const POSITION_COLOR = {
  RB: '#f59e0b',
  WR: '#38bdf8',
  TE: '#a78bfa',
  QB: '#34d399',
};

export default function TouchdownProbability({ rows }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Anytime Touchdown Probability
        </h2>
        <span className="text-xs text-slate-500">this week</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No projections yet.</p>
      ) : (
        <ul className="divide-y divide-slate-700/40 max-h-[420px] overflow-y-auto">
          {rows.map((r) => (
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
              <div className="h-1.5 rounded-full bg-slate-900/80 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(r.probability, 100)}%`,
                    background: POSITION_COLOR[r.position] || '#94a3b8',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
