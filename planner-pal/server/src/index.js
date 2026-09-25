import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Planner Pal keeps all of its data in the browser (localStorage) — this
// server just hosts the built client as static files.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
  console.log(`Planner Pal server listening on http://localhost:${PORT}`);
});
