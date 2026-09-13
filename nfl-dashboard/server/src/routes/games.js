import { Router } from 'express';
import { getScoreboard } from '../espn.js';

const router = Router();

function summarizeGame(event) {
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
  };
}

router.get('/', async (req, res, next) => {
  try {
    const data = await getScoreboard(req.query.date);
    const games = (data.events || []).map(summarizeGame);
    res.json({ date: data.day?.date ?? null, games });
  } catch (err) {
    next(err);
  }
});

export default router;
