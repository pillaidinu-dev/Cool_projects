import { Router } from 'express';
import { getWeekScoreboard, getEventSummary, getSeasonEvents } from '../espn.js';
import { buildLeaders, buildSeasonLeaders } from '../stats.js';

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

router.get('/season', async (req, res, next) => {
  try {
    const { year, currentWeek, events } = await getSeasonEvents();
    const leaders = await buildSeasonLeaders(events, getEventSummary);
    res.json({ ...leaders, season: year, throughWeek: currentWeek });
  } catch (err) {
    next(err);
  }
});

export default router;
