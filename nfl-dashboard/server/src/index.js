import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import gamesRoutes from './routes/games.js';
import leadersRoutes from './routes/leaders.js';
import predictionsRoutes from './routes/predictions.js';
import adminRoutes from './routes/admin.js';
import { startWeeklyRetraining } from './predictions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/games', gamesRoutes);
app.use('/api/leaders', leadersRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/admin', adminRoutes);

startWeeklyRetraining();

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
  res.status(502).json({ error: 'Failed to load NFL data', detail: err.message });
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`NFL dashboard API listening on http://localhost:${PORT}`);
});
