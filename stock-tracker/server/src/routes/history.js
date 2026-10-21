import { Router } from 'express';
import { profitHistory, RANGES } from '../portfolio.js';

const router = Router();

router.get('/', async (req, res, next) => {
  const range = String(req.query.range || '6m').toLowerCase();
  if (!RANGES.includes(range)) return res.status(400).json({ error: `range must be one of ${RANGES.join(', ')}` });
  try {
    res.json(await profitHistory(range));
  } catch (err) {
    next(err);
  }
});

export default router;
