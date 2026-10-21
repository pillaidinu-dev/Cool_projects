import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import gamesRoutes from './routes/games.js';
import leadersRoutes from './routes/leaders.js';
import propsRoutes from './routes/props.js';
import { startDailyRefresh } from './refresh.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/games', gamesRoutes);
app.use('/api/leaders', leadersRoutes);
app.use('/api/props', propsRoutes);

startDailyRefresh();

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
  res.status(502).json({ error: 'Failed to load NBA data', detail: err.message });
});

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
  console.log(`NBA dashboard API listening on http://localhost:${PORT}`);
});
