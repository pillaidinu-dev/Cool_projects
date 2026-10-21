import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { RANGES, rangeStart } from '../portfolio.js';
import { getHistory, getQuote, normalizeSymbol } from '../prices.js';
import { asyncRoute } from './util.js';

const router = Router();

router.get(
  '/quote/:symbol',
  asyncRoute(async (req, res) => {
    res.json(await getQuote(normalizeSymbol(req.params.symbol)));
  }),
);

// Price history for one ticker plus that ticker's own trades, so the chart
// can mark where each buy and sell happened.
router.get(
  '/history/:symbol',
  asyncRoute(async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    const range = String(req.query.range || '1Y').toUpperCase();
    if (!RANGES.includes(range)) throw new HttpError(400, `Range must be one of ${RANGES.join(', ')}`);
    const trades = db.prepare('SELECT * FROM transactions WHERE symbol = ? ORDER BY date, id').all(symbol);
    const from = rangeStart(range) ?? trades[0]?.date ?? rangeStart('5Y');
    const [quote, closes] = await Promise.all([getQuote(symbol), getHistory(symbol, from)]);
    res.json({ symbol, range, quote, closes, trades: trades.filter((t) => t.date >= from) });
  }),
);

export default router;
