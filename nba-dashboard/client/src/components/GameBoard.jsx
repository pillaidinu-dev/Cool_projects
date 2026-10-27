import { useState } from 'react';
import Card from './Card.jsx';
import SortHeader from './SortHeader.jsx';
import { compareBy, nextSort } from '../sorting.js';
import { STATS, edge, fmtActual, fmtProj, fmtRecent, isYesNo, lean, pct } from '../stats.js';

function tipTime(start) {
  if (!start) return '';
  return new Date(start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

// The stat a player has right now: the graded actual once the slate is
// graded, otherwise his live (or final) box score line, if his game has started.
function currentValue(player, stat, live) {
  if (player.actual) return player.actual[stat];
  const now = live?.[player.id];
  return now ? (now[stat] ?? 0) : null;
}

function PropCell({ player, stat, live }) {
  const prop = player.props[stat];
  if (!prop) return <td className="px-2 py-2 text-center text-slate-600">–</td>;
  if (player.actual === null) {
    return (
      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-slate-600" title="Did not play: void">
        {fmtProj(stat, prop)}
        <span className="block text-xs">{isYesNo(stat) ? '' : prop.line}</span>
      </td>
    );
  }
  const side = lean(prop);
  const value = currentValue(player, stat, live);
  const title =
    (isYesNo(stat)
      ? `Double-double: model ${pct(prop.pOver)} vs fair ${pct(prop.pFair)} → ${side === 'over' ? 'yes' : 'no'} by ${pct(edge(prop))}. `
      : `${STATS.find((s) => s.key === stat).label}: line ${prop.line}, projection ${prop.proj} (${prop.lo}–${prop.hi}). ` +
        `Over ${pct(prop.pOver)} vs fair ${pct(prop.pFair)} → ${side} by ${pct(edge(prop))}. `) +
    `L5 ${fmtRecent(stat, prop.l5)}, L10 ${fmtRecent(stat, prop.l10)}.`;
  return (
    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap" title={title}>
      <span className="font-semibold text-white">{fmtProj(stat, prop)}</span>
      <span className={`ml-1 text-xs ${side === 'over' ? 'text-sky-300' : 'text-amber-300'}`}>{side === 'over' ? '▲' : '▼'}</span>
      <span className="block text-xs text-slate-500">
        {isYesNo(stat) ? '' : prop.line}
        {value != null && prop.result ? (
          <span className={`ml-1 font-semibold ${prop.result === 'hit' ? 'text-emerald-400' : 'text-rose-400'}`}>
            · {fmtActual(stat, value)} {prop.result === 'hit' ? '✓' : '✗'}
          </span>
        ) : (
          value != null && (
            <span className={`ml-1 font-semibold ${value > prop.line ? 'text-emerald-400' : 'text-slate-300'}`}>· {fmtActual(stat, value)}</span>
          )
        )}
      </span>
    </td>
  );
}

function TeamTable({ team, opponent, home, players, live, sort, onSort }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs uppercase">
            <th
              className="text-left font-medium px-4 py-2 whitespace-nowrap"
              aria-sort={sort.key === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                onClick={() => onSort('name')}
                className="uppercase hover:text-slate-200"
                aria-label={`${team} ${home ? 'vs' : 'at'} ${opponent}: sort players by name`}
              >
                <span className="text-slate-200">{team}</span> {home ? 'vs' : '@'} {opponent}
                <span className={sort.key === 'name' ? 'ml-1' : 'ml-1 opacity-0'} aria-hidden="true">
                  {sort.dir === 'asc' ? '▲' : '▼'}
                </span>
              </button>
            </th>
            {STATS.map((s) => (
              <SortHeader
                key={s.key}
                label={s.short}
                title={`Sort by ${s.label.toLowerCase()} projection`}
                active={sort.key === s.key}
                dir={sort.dir}
                onSort={() => onSort(s.key)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-t border-slate-700/40 hover:bg-slate-700/30 align-top">
              <td className="px-4 py-2 whitespace-nowrap">
                <span className="font-medium text-slate-200">{p.name}</span>{' '}
                <span className="text-xs text-slate-500">
                  {p.pos ? `${p.pos} · ` : ''}
                  {p.min} min
                </span>
                {p.flags?.length > 0 && (
                  <span className="block text-[10px] uppercase font-semibold text-sky-300" title={`${p.flags.join('; ')}. Last game ${p.lastPlayed}.`}>
                    ⓘ {p.flags[0]}
                  </span>
                )}
                {p.status && <span className="block text-[10px] uppercase font-semibold text-amber-400">⚠ {p.status}</span>}
                {p.actual === null && (
                  <span className="block text-[10px] uppercase font-semibold text-slate-400">Did not play · props void</span>
                )}
              </td>
              {STATS.map((s) => (
                <PropCell key={s.key} player={p} stat={s.key} live={live} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Every prop for every player, one game at a time: a row per player with a
// column per market, so a whole matchup reads at a glance.
export default function GameBoard({ slate, live }) {
  const [gameId, setGameId] = useState('all');
  const games = slate.games.filter((g) => gameId === 'all' || g.id === gameId);
  // Default order is minutes (starters first); clicking a market sorts every
  // team by that projection, clicking the team header sorts by name.
  const [sort, setSort] = useState({ key: 'min', dir: 'desc' });
  const onSort = (key) => setSort((s) => nextSort(s, key));
  const value = (p) => (sort.key === 'min' ? p.min : sort.key === 'name' ? p.name : p.props[sort.key]?.proj);
  const order = compareBy(value, sort.dir);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {[{ id: 'all', name: 'All games' }, ...slate.games].map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGameId(g.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              gameId === g.id ? 'bg-slate-100 text-slate-900 border-slate-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Each cell: projection with the lean (▲ over, ▼ under), then the line
        {slate.graded
          ? ' and the actual stat: ✓ green when the lean hit, ✗ red when it missed. Players who sat out are void and greyed.'
          : ' and, once the game starts, his current stat (green when it’s over the line).'}{' '}
        Hover a cell for the over %, fair %, edge and recent averages. Click a column header to sort.
      </p>
      {games.map((g) => {
        const away = slate.players.filter((p) => p.team === g.away).sort(order);
        const home = slate.players.filter((p) => p.team === g.home).sort(order);
        return (
          <Card key={g.id} title={g.name} aside={tipTime(g.start)}>
            <div className="flex flex-col divide-y divide-slate-700/60">
              <TeamTable team={g.away} opponent={g.home} home={0} players={away} live={live} sort={sort} onSort={onSort} />
              <TeamTable team={g.home} opponent={g.away} home={1} players={home} live={live} sort={sort} onSort={onSort} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
