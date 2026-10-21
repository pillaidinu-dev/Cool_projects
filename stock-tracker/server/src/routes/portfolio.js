import { Router } from 'express';
import { listTransactions } from '../db.js';
import { HttpError } from '../errors.js';
import { buildHistory, RANGES, rangeStart, replay, summarize } from '../portfolio.js';
import { getHistory, getQuote } from '../prices.js';
import { asyncRoute } from './util.js';

const router = Router();

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const positions = replay(listTransactions());
    const symbols = [...positions.keys()];
    const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
    const quotes = {};
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') quotes[symbols[i]] = r.value;
      else errors.push(`${symbols[i]}: ${r.reason.message}`);
    });
    res.json({ ...summarize(positions, quotes), errors, asOf: new Date().toISOString() });
  }),
);

router.get(
  '/history',
  asyncRoute(async (req, res) => {
    const range = String(req.query.range || '1Y').toUpperCase();
    if (!RANGES.includes(range)) throw new HttpError(400, `Range must be one of ${RANGES.join(', ')}`);
    const transactions = listTransactions();
    const positions = replay(transactions);
    // Each symbol's history starts at its own first transaction, so the
    // cached series stays the same whichever range is being viewed.
    const closes = {};
    await Promise.all(
      [...positions.values()].map(async (p) => {
        closes[p.symbol] = await getHistory(p.symbol, p.firstDate);
      }),
    );
    const full = buildHistory(transactions, closes);
    const start = rangeStart(range);
    const series = start ? full.filter((p) => p.date >= start) : full;
    res.json({ range, series });
  }),
);

export default router;
