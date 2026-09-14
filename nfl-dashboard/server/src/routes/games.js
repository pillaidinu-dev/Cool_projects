import { Router } from 'express';
import { getWeekScoreboard } from '../espn.js';

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
    const data = await getWeekScoreboard(req.query.date);
    const days = data.days
      .map((day) => ({ date: day.date, games: day.events.map(summarizeGame) }))
      .filter((day) => day.games.length > 0);
    res.json({
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      days,
      errors: data.errors,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
