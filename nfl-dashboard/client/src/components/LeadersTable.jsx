export default function LeadersTable({ title, columns, rows }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300 border-b border-slate-700/60">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No stats yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left font-medium px-4 py-2">Player</th>
                {columns.map((col) => (
                  <th key={col.key} className="text-right font-medium px-3 py-2 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.name}-${row.team}-${i}`}
                  className="border-t border-slate-700/40 hover:bg-slate-700/30"
                >
                  <td className="px-4 py-2 text-slate-200">
                    <span className="font-medium">{row.name}</span>{' '}
                    <span className="text-slate-500 text-xs">
                      {row.position ? `${row.position} · ` : ''}
                      {row.team}
                    </span>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
