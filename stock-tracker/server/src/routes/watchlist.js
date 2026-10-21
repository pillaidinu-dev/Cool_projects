import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { getHistory, getQuote, normalizeSymbol } from '../prices.js';
import { rangeStart } from '../portfolio.js';
import { asyncRoute } from './util.js';

const router = Router();

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const rows = db.prepare('SELECT symbol, added_at FROM watchlist ORDER BY symbol').all();
    const from = rangeStart('1M');
    const items = await Promise.all(
      rows.map(async ({ symbol, added_at }) => {
        const [quote, history] = await Promise.allSettled([getQuote(symbol), getHistory(symbol, from)]);
        return {
          symbol,
          addedAt: added_at,
          quote: quote.status === 'fulfilled' ? quote.value : null,
          error: quote.status === 'rejected' ? quote.reason.message : null,
          sparkline: history.status === 'fulfilled' ? history.value : [],
        };
      }),
    );
    res.json({ items });
  }),
);

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const symbol = normalizeSymbol(req.body?.symbol);
    await getQuote(symbol);
    db.prepare('INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)').run(symbol);
    res.status(201).json({ symbol });
  }),
);

router.delete('/:symbol', (req, res) => {
  const { changes } = db.prepare('DELETE FROM watchlist WHERE symbol = ?').run(normalizeSymbol(req.params.symbol));
  if (!changes) throw new HttpError(404, 'Not on the watchlist');
  res.status(204).end();
});

export default router;
