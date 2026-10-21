import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.PRICE_SOURCE;
const { getHistory, getQuote, normalizeSymbol } = await import('../src/prices.js');

// A trimmed Yahoo chart response: two US trading days, one with a null bar.
const chart = {
  chart: {
    result: [
      {
        meta: {
          currency: 'USD',
          longName: 'Apple Inc.',
          regularMarketPrice: 231.5,
          previousClose: 228,
          regularMarketTime: 1760990400,
          gmtoffset: -14400,
        },
        timestamp: [1760967000, 1761053400, 1761139800],
        indicators: { quote: [{ close: [228, null, 231.5] }] },
      },
    ],
    error: null,
  },
};

function stubFetch(body, status = 200) {
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
}

test('parses a Yahoo quote', async () => {
  stubFetch(chart);
  const q = await getQuote('AAPL');
  assert.equal(q.name, 'Apple Inc.');
  assert.equal(q.price, 231.5);
  assert.equal(q.change, 3.5);
  assert.ok(Math.abs(q.changePercent - 1.535) < 0.01);
});

test('parses Yahoo history in exchange-local dates, skipping null closes', async () => {
  stubFetch(chart);
  const bars = await getHistory('AAPL', '2025-10-01');
  assert.deepEqual(bars, [
    { date: '2025-10-20', close: 228 },
    { date: '2025-10-22', close: 231.5 },
  ]);
});

test('unknown ticker is a 404', async () => {
  stubFetch({ chart: { result: null, error: { code: 'Not Found', description: 'No data found' } } }, 404);
  await assert.rejects(getQuote('NOPE'), (err) => err.status === 404);
});

test('symbol validation', () => {
  assert.equal(normalizeSymbol(' brk-b '), 'BRK-B');
  assert.equal(normalizeSymbol('^gspc'), '^GSPC');
  assert.throws(() => normalizeSymbol('bad symbol'), (err) => err.status === 400);
});
