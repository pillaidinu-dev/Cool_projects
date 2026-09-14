export default function TouchdownFeed({ touchdowns }) {
  const feed = [...touchdowns].reverse();

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300 border-b border-slate-700/60">
        Touchdown Feed
      </h2>
      {feed.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No touchdowns yet.</p>
      ) : (
        <ul className="divide-y divide-slate-700/40 max-h-96 overflow-y-auto">
          {feed.map((td, i) => (
            <li key={i} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{td.game}</span>
                <span>
                  {td.team} · Q{td.period} {td.clock}
                </span>
              </div>
              <p className="text-slate-200">{td.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
