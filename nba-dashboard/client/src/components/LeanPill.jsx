// Over/under is a direction, not good/bad, so it's shown with an arrow and
// a neutral pair of hues rather than the status colors used for hit/miss.
export default function LeanPill({ side, prob, yesNo = false }) {
  const over = side === 'over';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        over ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {over ? (yesNo ? '▲ Yes' : '▲ Over') : yesNo ? '▼ No' : '▼ Under'}
      {prob != null && <span className="font-normal text-slate-300 tabular-nums">{Math.round(prob * 100)}%</span>}
    </span>
  );
}

export function ResultBadge({ result, compact = false }) {
  if (!result) return null;
  const hit = result === 'hit';
  const label = hit ? 'Hit' : 'Miss';
  return (
    <span className={`text-xs font-semibold ${hit ? 'text-emerald-400' : 'text-rose-400'}`} title={label}>
      {hit ? '✓' : '✗'}
      {!compact && ` ${label}`}
    </span>
  );
}
