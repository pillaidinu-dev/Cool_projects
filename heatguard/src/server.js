import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, reset, log } from './store.js';
import { tick, handleReply, resolveWorker, queueEvent } from './monitor.js';
import { claudeAvailable } from './agent.js';
import { SCENARIOS } from './weather.js';
import { LEVELS, isMiddayBreak } from './heat.js';
import { LANGUAGES } from './i18n.js';
import { planTomorrow, publishPlan } from './planner-agent.js';
import { FORECASTS } from './weather.js';
import { buildReport, renderReportHtml } from './report.js';
import { tickPortfolio, portfolioSnapshot, resetPortfolio } from './portfolio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4200;
const TICK_MS = 2000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(here, '..', 'public')));
app.use('/vendor/leaflet', express.static(path.join(here, '..', 'node_modules', 'leaflet', 'dist')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/state', (_req, res) => {
  res.json({
    ...state,
    agent: { ...state.agent, mode: claudeAvailable() ? 'claude' : 'rules' },
    middayBreak: isMiddayBreak(),
    meta: { levels: LEVELS, scenarios: SCENARIOS, languages: LANGUAGES },
    events: state.events.slice(0, 80),
    messages: state.messages.slice(0, 200),
  });
});

app.post('/api/settings', (req, res) => {
  const { scenario, timeScale } = req.body ?? {};
  if (scenario !== undefined) {
    if (scenario !== 'live' && !SCENARIOS[scenario]) return res.status(400).json({ error: 'Unknown scenario' });
    state.settings.scenario = scenario;
    log('system', `Weather source set to ${scenario === 'live' ? 'live' : SCENARIOS[scenario].label}.`, 'supervisor');
  }
  if (timeScale !== undefined) {
    const n = Number(timeScale);
    if (!Number.isFinite(n) || n < 1 || n > 120) return res.status(400).json({ error: 'timeScale must be 1–120' });
    state.settings.timeScale = n;
  }
  runTick();
  res.json(state.settings);
});

app.post('/api/workers/:id/reply', async (req, res) => {
  try {
    await handleReply(req.params.id, req.body?.text);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workers/:id/resolve', (req, res) => {
  try {
    resolveWorker(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/agent/review', (_req, res) => {
  queueEvent({ type: 'supervisor_requested_review' });
  runTick();
  res.json({ ok: true });
});

app.get('/api/planner', (_req, res) => {
  res.json({ ...state.planner, crews: state.crews.map((c) => ({ id: c.id, name: c.name, workers: c.workers.length })), forecasts: FORECASTS, agentMode: claudeAvailable() ? 'claude' : 'rules' });
});

app.post('/api/planner/run', (req, res) => {
  const mode = req.body?.forecast ?? state.planner.forecastMode;
  if (!FORECASTS[mode]) return res.status(400).json({ error: 'Unknown forecast' });
  if (state.planner.running) return res.status(409).json({ error: 'Already planning' });
  planTomorrow(mode).catch((err) => {
    state.planner.error = err.message;
    log('system', `Planning failed: ${err.message}`);
  });
  res.status(202).json({ ok: true });
});

app.post('/api/planner/publish', (_req, res) => {
  try {
    res.json({ sent: publishPlan() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/portfolio', (_req, res) => res.json(portfolioSnapshot()));

app.get('/api/report', (_req, res) => res.json(buildReport()));
app.get('/report', (_req, res) => res.type('html').send(renderReportHtml(buildReport())));

app.post('/api/reset', (_req, res) => {
  reset();
  resetPortfolio();
  runTick();
  res.json({ ok: true });
});

function runTick() {
  tick().catch((err) => log('system', `Tick failed: ${err.message}`));
}

setInterval(runTick, TICK_MS);
const runPortfolio = () => tickPortfolio().catch((err) => log('system', `Portfolio update failed: ${err.message}`));
setInterval(runPortfolio, 3000);
runPortfolio();
runTick();

app.listen(PORT, () => {
  console.log(`HeatGuard on http://localhost:${PORT} — agent: ${claudeAvailable() ? 'Claude' : 'rules only (set ANTHROPIC_API_KEY to enable Claude)'}`);
});
