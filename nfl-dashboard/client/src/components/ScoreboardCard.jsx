function TeamRow({ team, winning }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {team.logo && (
          <img src={team.logo} alt="" className="h-6 w-6 shrink-0" loading="lazy" />
        )}
        <span className={`truncate ${winning ? 'text-white font-semibold' : 'text-slate-300'}`}>
          {team.name || team.abbreviation || 'TBD'}
        </span>
        {team.record && <span className="text-xs text-slate-500 shrink-0">{team.record}</span>}
      </div>
      <span className={`tabular-nums text-lg ${winning ? 'text-white font-bold' : 'text-slate-400'}`}>
        {team.score ?? '-'}
      </span>
    </div>
  );
}

export default function ScoreboardCard({ game }) {
  const homeScore = Number(game.home?.score);
  const awayScore = Number(game.away?.score);
  const isLive = game.state === 'in';
  const isFinal = game.state === 'post';

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold uppercase tracking-wide ${
            isLive ? 'text-emerald-400' : isFinal ? 'text-slate-500' : 'text-amber-400'
          }`}
        >
          {isLive ? `● Live – Q${game.period ?? ''} ${game.clock ?? ''}` : game.statusText}
        </span>
      </div>
      <TeamRow team={game.away} winning={isFinal && awayScore > homeScore} />
      <TeamRow team={game.home} winning={isFinal && homeScore > awayScore} />
      {game.venue && <div className="text-xs text-slate-500 truncate">{game.venue}</div>}
    </div>
  );
}
