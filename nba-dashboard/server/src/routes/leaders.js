import { Router } from 'express';
import { getScoreboard, getEventSummary, normalizeYmd } from '../espn.js';
import { buildLeaders } from '../stats.js';
import { summarizeGame } from './games.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const date = normalizeYmd(req.query.date);
    const data = await getScoreboard(date);
    const games = (data.events || []).map(summarizeGame);
    res.json({ date, ...(await buildLeaders(games, getEventSummary)) });
  } catch (err) {
    next(err);
  }
});

export default router;
