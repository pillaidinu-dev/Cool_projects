import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import positionsRoutes from './routes/positions.js';
import historyRoutes from './routes/history.js';
import quoteRoutes from './routes/quote.js';
import { priceSource } from './prices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, priceSource: priceSource() }));
app.use('/api/positions', positionsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/quote', quoteRoutes);

// When the client has been built alongside this server (e.g. in the
// production Docker image), serve it directly.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(502).json({ error: 'Failed to load price data', detail: err.message });
});

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
  console.log(`Stock tracker API listening on http://localhost:${PORT} (prices: ${priceSource()})`);
});
