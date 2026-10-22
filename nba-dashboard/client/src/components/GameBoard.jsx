import { useState } from 'react';
import Card from './Card.jsx';
import { STATS, edge, lean, pct } from '../stats.js';

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
        {prop.proj}
        <span className="block text-xs">{prop.line}</span>
      </td>
    );
  }
  const side = lean(prop);
  const value = currentValue(player, stat, live);
  const title =
    `${STATS.find((s) => s.key === stat).label}: line ${prop.line}, projection ${prop.proj} (${prop.lo}–${prop.hi}). ` +
    `Over ${pct(prop.pOver)} vs fair ${pct(prop.pFair)} → ${side} by ${pct(edge(prop))}. L5 ${prop.l5}, L10 ${prop.l10}.`;
  return (
    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap" title={title}>
      <span className="font-semibold text-white">{prop.proj}</span>
      <span className={`ml-1 text-xs ${side === 'over' ? 'text-sky-300' : 'text-amber-300'}`}>{side === 'over' ? '▲' : '▼'}</span>
      <span className="block text-xs text-slate-500">
        {prop.line}
        {value != null && prop.result ? (
          <span className={`ml-1 font-semibold ${prop.result === 'hit' ? 'text-emerald-400' : 'text-rose-400'}`}>
            · {value} {prop.result === 'hit' ? '✓' : '✗'}
          </span>
        ) : (
          value != null && (
            <span className={`ml-1 font-semibold ${value > prop.line ? 'text-emerald-400' : 'text-slate-300'}`}>· {value}</span>
          )
        )}
      </span>
    </td>
  );
}

function TeamTable({ team, opponent, home, players, live }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs uppercase">
            <th className="text-left font-medium px-4 py-2 whitespace-nowrap">
              <span className="text-slate-200">{team}</span> {home ? 'vs' : '@'} {opponent}
            </th>
            {STATS.map((s) => (
              <th key={s.key} className="text-right font-medium px-2 py-2 whitespace-nowrap">
                {s.short}
              </th>
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
  const byMinutes = (a, b) => b.min - a.min;

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
        Hover a cell for the over %, fair %, edge and recent averages.
      </p>
      {games.map((g) => {
        const away = slate.players.filter((p) => p.team === g.away).sort(byMinutes);
        const home = slate.players.filter((p) => p.team === g.home).sort(byMinutes);
        return (
          <Card key={g.id} title={g.name} aside={tipTime(g.start)}>
            <div className="flex flex-col divide-y divide-slate-700/60">
              <TeamTable team={g.away} opponent={g.home} home={0} players={away} live={live} />
              <TeamTable team={g.home} opponent={g.away} home={1} players={home} live={live} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
