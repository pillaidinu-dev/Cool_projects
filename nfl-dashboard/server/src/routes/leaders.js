import { Router } from 'express';
import { getWeekScoreboard, getEventSummary } from '../espn.js';
import { buildLeaders } from '../stats.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await getWeekScoreboard(req.query.date);
    const games = data.days.flatMap((day) => day.events.map((e) => ({ id: e.id, name: e.shortName })));
    const leaders = await buildLeaders(games, getEventSummary);
    res.json(leaders);
  } catch (err) {
    next(err);
  }
});

export default router;
