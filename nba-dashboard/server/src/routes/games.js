import { Router } from 'express';
import { getScoreboard, normalizeYmd } from '../espn.js';

const router = Router();

export function summarizeGame(event) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
  const status = event.status || {};

  const side = (team) => ({
    id: team?.team?.id,
    abbreviation: team?.team?.abbreviation,
    name: team?.team?.shortDisplayName,
    logo: team?.team?.logo,
    score: team?.score,
    record: team?.records?.find((r) => r.type === 'total')?.summary,
  });

  return {
    id: event.id,
    name: event.shortName,
    date: event.date,
    state: status.type?.state, // 'pre' | 'in' | 'post'
    statusText: status.type?.shortDetail,
    period: status.period,
    clock: status.displayClock,
    home: side(home),
    away: side(away),
    venue: competition?.venue?.fullName,
    broadcast: competition?.broadcasts?.[0]?.names?.[0],
  };
}

router.get('/', async (req, res, next) => {
  try {
    const date = normalizeYmd(req.query.date);
    const data = await getScoreboard(date);
    res.json({ date, games: (data.events || []).map(summarizeGame) });
  } catch (err) {
    next(err);
  }
});

export default router;
