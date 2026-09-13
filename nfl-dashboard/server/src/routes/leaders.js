import { Router } from 'express';
import { getScoreboard, getEventSummary } from '../espn.js';
import { buildLeaders } from '../stats.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await getScoreboard(req.query.date);
    const games = (data.events || []).map((e) => ({ id: e.id, name: e.shortName }));
    const leaders = await buildLeaders(games, getEventSummary);
    res.json(leaders);
  } catch (err) {
    next(err);
  }
});

export default router;
