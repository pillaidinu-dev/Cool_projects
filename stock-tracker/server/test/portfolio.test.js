import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, rangeStart, replay, summarize } from '../src/portfolio.js';

const tx = (id, symbol, side, shares, price, date, fee = 0) => ({ id, symbol, side, shares, price, fee, date });

test('average cost basis and realized profit', () => {
  const positions = replay([
    tx(1, 'AAPL', 'buy', 10, 100, '2024-01-02', 5),
    tx(2, 'AAPL', 'buy', 10, 200, '2024-02-01'),
    tx(3, 'AAPL', 'sell', 5, 250, '2024-03-01', 5),
  ]);
  const p = positions.get('AAPL');
  // Avg cost after buys: (1000 + 5 + 2000) / 20 = 150.25
  assert.equal(p.shares, 15);
  assert.ok(Math.abs(p.cost - 15 * 150.25) < 1e-9);
  // Sold 5 @ 250 minus fee 5, cost 5 * 150.25
  assert.ok(Math.abs(p.realized - (1250 - 5 - 751.25)) < 1e-9);
});

test('rejects selling more than held at that date', () => {
  assert.throws(
    () => replay([tx(1, 'X', 'sell', 1, 10, '2024-01-01'), tx(2, 'X', 'buy', 5, 10, '2024-02-01')]),
    /only 0 held/,
  );
});

test('a full exit leaves zero shares and keeps realized profit', () => {
  const p = replay([tx(1, 'X', 'buy', 3, 10, '2024-01-01'), tx(2, 'X', 'sell', 3, 12, '2024-01-05')]).get('X');
  assert.equal(p.shares, 0);
  assert.equal(p.cost, 0);
  assert.equal(p.realized, 6);
});

test('summarize computes unrealized and day change from quotes', () => {
  const positions = replay([tx(1, 'A', 'buy', 2, 50, '2024-01-01'), tx(2, 'B', 'buy', 1, 10, '2024-01-01')]);
  const { holdings, totals } = summarize(positions, {
    A: { price: 60, change: 2, changePercent: 3.45 },
  });
  const b = holdings.find((h) => h.symbol === 'B');
  assert.equal(b.stale, true);
  assert.equal(b.marketValue, 10);
  assert.equal(totals.marketValue, 130);
  assert.equal(totals.unrealized, 20);
  assert.equal(totals.dayChange, 4);
});

test('history carries prices forward and applies weekend trades on the next bar', () => {
  const series = buildHistory(
    [tx(1, 'A', 'buy', 1, 10, '2024-01-06'), tx(2, 'B', 'buy', 2, 5, '2024-01-08')],
    {
      A: [
        { date: '2024-01-05', close: 9 },
        { date: '2024-01-08', close: 11 },
        { date: '2024-01-09', close: 12 },
      ],
      B: [
        { date: '2024-01-08', close: 5 },
        { date: '2024-01-10', close: 6 },
      ],
    },
  );
  assert.deepEqual(series, [
    { date: '2024-01-08', value: 21, cost: 20, pnl: 1 },
    { date: '2024-01-09', value: 22, cost: 20, pnl: 2 },
    { date: '2024-01-10', value: 24, cost: 20, pnl: 4 },
  ]);
});

test('range start dates', () => {
  const today = new Date('2026-10-21T15:00:00Z');
  assert.equal(rangeStart('1M', today), '2026-09-21');
  assert.equal(rangeStart('YTD', today), '2026-01-01');
  assert.equal(rangeStart('1Y', today), '2025-10-21');
  assert.equal(rangeStart('ALL', today), null);
});
