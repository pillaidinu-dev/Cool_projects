import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getGoldPrice, SUPPORTED_CURRENCIES } from './price.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Today's spot price of pure (24K) gold, per gram, in the requested currency.
// Holdings live in the browser; the server only proxies (and caches) prices so
// the client doesn't depend on third-party CORS or rate limits.
app.get('/api/price', async (req, res) => {
  const currency = String(req.query.currency || 'INR').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: `Unsupported currency ${currency}` });
  }
  try {
    res.json(await getGoldPrice(currency));
  } catch (err) {
    console.error('Gold price lookup failed:', err.message);
    res.status(502).json({ error: 'Could not fetch the gold price right now' });
  }
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
  console.log(`Gold Tracker server listening on http://localhost:${PORT}`);
});
