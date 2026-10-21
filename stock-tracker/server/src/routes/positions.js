import { Router } from 'express';
import db from '../db.js';
import { getQuote, normalizeSymbol, isValidSymbol } from '../prices.js';
import { portfolioSnapshot } from '../portfolio.js';

const router = Router();

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Validates a create/update body. Returns { value } or { error }.
function parsePosition(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.symbol !== undefined) {
    const symbol = normalizeSymbol(body.symbol);
    if (!isValidSymbol(symbol)) return { error: 'Enter a ticker symbol like AAPL or BRK-B.' };
    out.symbol = symbol;
  }
  if (!partial || body.shares !== undefined) {
    const shares = Number(body.shares);
    if (!Number.isFinite(shares) || shares <= 0) return { error: 'Shares must be a number above zero.' };
    out.shares = shares;
  }
  if (!partial || body.buyPrice !== undefined) {
    const buyPrice = Number(body.buyPrice);
    if (!Number.isFinite(buyPrice) || buyPrice < 0) return { error: 'Buy price must be zero or more.' };
    out.buyPrice = buyPrice;
  }
  if (!partial || body.buyDate !== undefined) {
    const buyDate = body.buyDate || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate) || Number.isNaN(Date.parse(buyDate))) {
      return { error: 'Buy date must be YYYY-MM-DD.' };
    }
    if (buyDate > today()) return { error: "Buy date can't be in the future." };
    out.buyDate = buyDate;
  }
  if (body.notes !== undefined) out.notes = body.notes ? String(body.notes).slice(0, 200) : null;
  return { value: out };
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await portfolioSnapshot());
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res) => {
  const { value, error } = parsePosition(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    // Look the ticker up before saving so a typo doesn't become a row that
    // can never be priced.
    await getQuote(value.symbol);
  } catch (err) {
    if (err.status === 404) return res.status(400).json({ error: `Couldn't find ticker ${value.symbol}.` });
    return res.status(502).json({ error: `Couldn't reach the price service to check ${value.symbol}. Try again shortly.` });
  }
  const result = db
    .prepare('INSERT INTO positions (symbol, shares, buy_price, buy_date, notes) VALUES (?, ?, ?, ?, ?)')
    .run(value.symbol, value.shares, value.buyPrice, value.buyDate, value.notes ?? null);
  res.status(201).json({ id: Number(result.lastInsertRowid), ...value });
});

router.put('/:id', (req, res) => {
  const { value, error } = parsePosition(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const columns = { symbol: 'symbol', shares: 'shares', buyPrice: 'buy_price', buyDate: 'buy_date', notes: 'notes' };
  const keys = Object.keys(value);
  if (keys.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
  const sql = `UPDATE positions SET ${keys.map((k) => `${columns[k]} = ?`).join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...keys.map((k) => value[k]), Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Position not found.' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM positions WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Position not found.' });
  res.json({ ok: true });
});

export default router;
