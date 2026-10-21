import Card from './Card.jsx';

const COLUMNS = [
  { key: 'min', label: 'Min' },
  { key: 'pts', label: 'Pts' },
  { key: 'reb', label: 'Reb' },
  { key: 'ast', label: 'Ast' },
  { key: 'fg3m', label: '3PM' },
  { key: 'stl', label: 'Stl' },
  { key: 'blk', label: 'Blk' },
];

// One leader board, ranked by `stat`, with the full stat line alongside so
// a big night in one category reads in context.
export default function LeadersTable({ title, stat, rows }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No stats yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left font-medium px-4 py-2">Player</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`text-right font-medium px-2 py-2 ${col.key === stat ? 'text-slate-200' : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-700/40 hover:bg-slate-700/30">
                  <td className="px-4 py-2 text-slate-200 whitespace-nowrap">
                    <span className="font-medium">{row.name}</span>{' '}
                    <span className="text-slate-500 text-xs">
                      {row.position ? `${row.position} · ` : ''}
                      {row.team}
                      {row.gameState === 'in' && <span className="text-emerald-400"> · live</span>}
                    </span>
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2 py-2 text-right tabular-nums ${
                        col.key === stat ? 'text-white font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
