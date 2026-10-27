import Card from './Card.jsx';
import LeanPill, { ResultBadge } from './LeanPill.jsx';
import { STAT_BY_KEY, edge, fmtActual, fmtProj, fmtRecent, isYesNo, lean, pct, sideProb } from '../stats.js';

// The slate's biggest disagreements with the L10-average price, across
// every market — the same daily top-10 the tracker scores.
export default function BestPicks({ slate, limit = 10 }) {
  // Players with a history flag (missed games, new team) stay on the board
  // but not here — their edges come from games that may not describe tonight.
  const picks = slate.players
    .filter((player) => !player.flags?.length)
    .flatMap((player) => Object.entries(player.props).map(([stat, prop]) => ({ player, stat, prop })))
    .sort((a, b) => edge(b.prop) - edge(a.prop))
    .slice(0, limit);

  return (
    <Card title="Top 10 edges" aside="model vs L10 price · flagged players excluded">
      {picks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No projections yet.</p>
      ) : (
        <ol className="divide-y divide-slate-700/40">
          {picks.map(({ player, stat, prop }, i) => (
            <li key={`${player.id}-${stat}`} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="w-5 text-right text-xs text-slate-500 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 truncate">
                  <span className="font-medium">{player.name}</span>{' '}
                  <span className="text-xs text-slate-500">
                    {player.team} {player.home ? 'vs' : '@'} {player.opp}
                  </span>
                </p>
                <p className="text-xs text-slate-400 tabular-nums">
                  {STAT_BY_KEY[stat].label} {isYesNo(stat) ? '' : prop.line} · proj {fmtProj(stat, prop)} · L10 {fmtRecent(stat, prop.l10)}
                  {player.actual && <> · actual {fmtActual(stat, player.actual[stat])}</>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <LeanPill side={lean(prop)} prob={sideProb(prop)} yesNo={isYesNo(stat)} />
                <span className="text-xs tabular-nums text-slate-500">
                  edge +{pct(edge(prop))}
                  {player.actual && <> · <ResultBadge result={prop.result} /></>}
                  {slate.graded && player.actual === null && <> · <span className="text-slate-400">void (did not play)</span></>}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
