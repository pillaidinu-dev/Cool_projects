import { Router } from 'express';
import { runEvaluate } from '../evaluate.js';

const router = Router();

function requireAdminToken(req, res, next) {
  // Disabled by default: with no ADMIN_TOKEN configured, every request is
  // rejected rather than the route being left open to the public internet.
  const configured = process.env.ADMIN_TOKEN;
  if (!configured || req.get('x-admin-token') !== configured) {
    res.status(404).end();
    return;
  }
  next();
}

router.post('/evaluate', requireAdminToken, async (req, res) => {
  const year = Number.parseInt(req.query.year, 10);
  const week = Number.parseInt(req.query.week, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: 'year must be an integer, e.g. ?year=2026' });
    return;
  }
  if (!Number.isInteger(week) || week < 1 || week > 22) {
    res.status(400).json({ error: 'week must be an integer between 1 and 22, e.g. &week=5' });
    return;
  }

  try {
    const report = await runEvaluate(year, week);
    res.json(report);
  } catch (err) {
    res.status(502).json({ error: 'evaluate.py failed', detail: err.message });
  }
});

export default router;
