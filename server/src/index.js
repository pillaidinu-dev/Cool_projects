import express from 'express';
import cors from 'cors';
import './db.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plans.js';
import matchRoutes from './routes/matches.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/matches', matchRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PlanSync API listening on http://localhost:${PORT}`);
});
