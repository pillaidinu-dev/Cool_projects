function aggregateScorers(touchdowns) {
  const byPlayer = new Map();
  for (const td of touchdowns) {
    const name = td.scorer || 'Unknown player';
    const key = `${name}|${td.team || ''}`;
    const existing = byPlayer.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byPlayer.set(key, { name, team: td.team, count: 1 });
    }
  }
  return [...byPlayer.values()].sort((a, b) => b.count - a.count);
}

export default function TouchdownScorers({ touchdowns }) {
  const scorers = aggregateScorers(touchdowns);

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300 border-b border-slate-700/60">
        Touchdown Scorers
      </h2>
      {scorers.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No touchdowns yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase">
              <th className="text-left font-medium px-4 py-2">Player</th>
              <th className="text-right font-medium px-4 py-2">TDs</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s) => (
              <tr key={`${s.name}-${s.team}`} className="border-t border-slate-700/40">
                <td className="px-4 py-2 text-slate-200">
                  <span className="font-medium">{s.name}</span>{' '}
                  {s.team && <span className="text-slate-500 text-xs">{s.team}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-200 font-semibold">
                  {s.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
