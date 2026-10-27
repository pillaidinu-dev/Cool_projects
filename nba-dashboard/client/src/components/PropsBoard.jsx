import { useMemo, useState } from 'react';
import Card from './Card.jsx';
import LeanPill, { ResultBadge } from './LeanPill.jsx';
import ProjectionChart from './ProjectionChart.jsx';
import { STATS, STAT_BY_KEY, edge, fmtActual, fmtLine, fmtProj, fmtRecent, isYesNo, lean, pct } from '../stats.js';

const SORTS = [
  { key: 'edge', label: 'Edge' },
  { key: 'proj', label: 'Projection' },
  { key: 'gap', label: 'Proj − line' },
];

function ResultCell({ player, stat, prop, live }) {
  if (player.actual === null) return <span className="text-xs text-slate-500">DNP</span>;
  if (player.actual) {
    return (
      <span className="flex items-center justify-end gap-2">
        <span className="tabular-nums text-slate-200">{fmtActual(stat, player.actual[stat])}</span>
        <ResultBadge result={prop.result} compact />
      </span>
    );
  }
  const now = live?.[player.id];
  if (!now) return <span className="text-slate-600">–</span>;
  const value = now[stat] ?? 0;
  return (
    <span className="flex items-center justify-end gap-1.5 tabular-nums">
      <span className={value > prop.line ? 'text-emerald-300 font-semibold' : 'text-slate-200'}>{fmtActual(stat, value)}</span>
      <span className="text-xs text-slate-500">{now.gameState === 'in' ? `${now.min}m · live` : 'final'}</span>
    </span>
  );
}

// Every player's projection for one market: filterable, sortable, and —
// for a slate that's live or already graded — showing how it's going.
export default function PropsBoard({ slate, live, chart = true }) {
  const [stat, setStat] = useState('pts');
  const [team, setTeam] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('edge');

  const teams = useMemo(() => [...new Set(slate.players.map((p) => p.team))].sort(), [slate]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = slate.players
      .filter((p) => p.props[stat])
      .filter((p) => !team || p.team === team)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({ player: p, prop: p.props[stat] }));
    const score = {
      edge: (r) => edge(r.prop),
      proj: (r) => r.prop.proj,
      gap: (r) => Math.abs(r.prop.proj - r.prop.line),
    }[sort];
    return list.sort((a, b) => score(b) - score(a));
  }, [slate, stat, team, query, sort]);

  const chartRows = useMemo(
    () =>
      slate.players
        .filter((p) => p.props[stat])
        .map((p) => ({ ...p.props[stat], name: p.name, team: p.team, opp: p.opp, home: p.home }))
        .sort((a, b) => b.proj - a.proj)
        .slice(0, 15),
    [slate, stat],
  );

  const metric = slate.metrics?.[stat];
  // No projection chart for the yes/no double-double market, so its table
  // takes the full width.
  const showChart = chart && !isYesNo(stat);
  const meta = STAT_BY_KEY[stat];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        {STATS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStat(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              stat === s.key
                ? 'bg-slate-100 text-slate-900 border-slate-100'
                : 'border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {s.short}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 items-start ${showChart ? 'lg:grid-cols-5' : ''}`}>
        <Card
          className={showChart ? 'lg:col-span-3' : ''}
          title={`${meta.label} props`}
          aside={
            metric
              ? isYesNo(stat)
                ? `backtest Brier ${metric.brier} vs L10 rate ${metric.baselineBrier} (lower is better)`
                : `backtest MAE ${metric.mae} vs L10 avg ${metric.baselineMae}`
              : undefined
          }
        >
          <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-slate-700/60">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player"
              className="flex-1 min-w-[8rem] rounded-md bg-slate-900/70 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="rounded-md bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-md bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No players match.</p>
          ) : (
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-slate-500 text-xs uppercase">
                    <th className="text-left font-medium px-4 py-2">Player</th>
                    <th className="text-right font-medium px-2 py-2">Line</th>
                    <th className="text-right font-medium px-2 py-2">Proj</th>
                    <th className="text-right font-medium px-2 py-2" title="Model's probability of the over">Over</th>
                    <th className="text-right font-medium px-2 py-2" title="Over probability implied by the L10 average">Fair</th>
                    <th className="text-left font-medium px-2 py-2">Lean · edge</th>
                    <th className="text-right font-medium px-2 py-2">L5</th>
                    <th className="text-right font-medium px-2 py-2">L10</th>
                    <th className="text-right font-medium px-4 py-2">{slate.graded ? 'Actual' : 'Live'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ player, prop }) => (
                    <tr key={player.id} className="border-t border-slate-700/40 hover:bg-slate-700/30">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-medium text-slate-200">{player.name}</span>{' '}
                        <span className="text-xs text-slate-500">
                          {player.pos ? `${player.pos} · ` : ''}
                          {player.team} {player.home ? 'vs' : '@'} {player.opp}
                        </span>
                        {player.flags?.length > 0 && (
                          <span
                            className="ml-1.5 text-[10px] uppercase font-semibold text-sky-300 cursor-help"
                            title={`${player.flags.join('; ')}. Last game ${player.lastPlayed}. Kept out of the top 10 edges.`}
                          >
                            ⓘ {player.flags[0]}
                          </span>
                        )}
                        {player.status && (
                          <span className="ml-1.5 text-[10px] uppercase font-semibold text-amber-400">⚠ {player.status}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">{fmtLine(stat, prop)}</td>
                      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                        <span className="text-white font-semibold">{fmtProj(stat, prop)}</span>
                        <span className="text-xs text-slate-500">
                          {' '}
                          {isYesNo(stat) ? '' : `${prop.lo}–${prop.hi}`}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-200">{pct(prop.pOver)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-500">{pct(prop.pFair)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <LeanPill side={lean(prop)} yesNo={isYesNo(stat)} />
                        <span className="ml-1.5 text-xs tabular-nums text-slate-400">+{pct(edge(prop))}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-400">{fmtRecent(stat, prop.l5)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-400">{fmtRecent(stat, prop.l10)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <ResultCell player={player} stat={stat} prop={prop} live={live} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showChart && (
          <div className="lg:col-span-2">
            <ProjectionChart title={`Top ${meta.label} projections`} unit={meta.short.toLowerCase()} rows={chartRows} />
          </div>
        )}
      </div>
    </div>
  );
}
