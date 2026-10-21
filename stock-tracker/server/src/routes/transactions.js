import { Router } from 'express';
import { db, listTransactions } from '../db.js';
import { HttpError } from '../errors.js';
import { replay } from '../portfolio.js';
import { getQuote, normalizeSymbol } from '../prices.js';
import { asyncRoute } from './util.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ transactions: listTransactions().reverse() });
});

function parseTransaction(body) {
  const symbol = normalizeSymbol(body.symbol);
  const side = body.side;
  if (side !== 'buy' && side !== 'sell') throw new HttpError(400, 'Side must be "buy" or "sell"');
  const shares = Number(body.shares);
  if (!(shares > 0)) throw new HttpError(400, 'Shares must be a positive number');
  const price = Number(body.price);
  if (!(price >= 0) || body.price === '' || body.price == null) {
    throw new HttpError(400, 'Price must be zero or more');
  }
  const fee = body.fee === '' || body.fee == null ? 0 : Number(body.fee);
  if (!(fee >= 0)) throw new HttpError(400, 'Fee must be zero or more');
  const date = String(body.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, 'Date must be YYYY-MM-DD');
  }
  if (date > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Date cannot be in the future');
  const note = String(body.note ?? '').slice(0, 200);
  return { symbol, side, shares, price, fee, date, note };
}

// Re-plays the whole ledger with a change applied, so a sell can never
// exceed the shares held at that date — including after an earlier buy is
// deleted.
function assertConsistent(transactions) {
  try {
    replay(transactions);
  } catch (err) {
    throw new HttpError(409, err.message);
  }
}

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const tx = parseTransaction(req.body ?? {});
    assertConsistent([...listTransactions(), { ...tx, id: Number.MAX_SAFE_INTEGER }]);
    // Check the ticker exists before recording it (only needed for a symbol
    // that is new to the ledger).
    const known = db.prepare('SELECT 1 FROM transactions WHERE symbol = ? LIMIT 1').get(tx.symbol);
    if (!known) await getQuote(tx.symbol);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO transactions (symbol, side, shares, price, fee, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(tx.symbol, tx.side, tx.shares, tx.price, tx.fee, tx.date, tx.note);
    res.status(201).json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(lastInsertRowid));
  }),
);

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const all = listTransactions();
  if (!all.some((t) => t.id === id)) throw new HttpError(404, 'Transaction not found');
  assertConsistent(all.filter((t) => t.id !== id));
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
