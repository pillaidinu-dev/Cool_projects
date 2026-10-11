process.env.HEATGUARD_AGENT = 'rules';

import test from 'node:test';
import assert from 'node:assert/strict';
import { state, reset } from '../src/store.js';
import { tick, handleReply } from '../src/monitor.js';
import { portfolio, resetPortfolio, tickPortfolio, portfolioSnapshot } from '../src/portfolio.js';

const site = (snap, id) => snap.sites.find((s) => s.id === id);

test('every site gets its own heat risk; inland is hotter than the coast', async () => {
  reset();
  resetPortfolio();
  state.settings.scenario = 'afternoon';
  await tick();
  await tickPortfolio();
  const snap = portfolioSnapshot();
  assert.equal(snap.sites.length, 8);
  const alAin = site(snap, 'site-7'), creek = site(snap, 'site-3');
  assert.ok(alAin.conditions.tempC > creek.conditions.tempC);
  for (const s of snap.sites) assert.ok(s.peakWbgt > 20, `${s.name} WBGT ${s.peakWbgt}`);
  assert.equal(snap.kpis.workers, snap.sites.reduce((a, s) => a + s.workers, 0));
});

test('a heat spike raises risk across the whole portfolio', async () => {
  reset();
  resetPortfolio();
  state.settings.scenario = 'morning';
  await tickPortfolio();
  const before = portfolioSnapshot().kpis.workersAtDanger;
  state.settings.scenario = 'spike';
  await tick();
  await tickPortfolio();
  const after = portfolioSnapshot().kpis;
  assert.ok(after.workersAtDanger > before);
  assert.equal(after.worstLevel, 4);
});

test('simulated sites raise and close incidents over time in extreme heat', async () => {
  reset();
  resetPortfolio(7);
  state.settings.scenario = 'spike';
  let t = Date.now();
  await tickPortfolio(t);
  for (let i = 0; i < 400; i++) { t += 3000; await tickPortfolio(t); } // ~6.7 site hours at 20×
  const incidents = portfolio.sites.flatMap((s) => s.ops.incidents);
  assert.ok(incidents.length > 0, 'expected some simulated incidents');
  assert.ok(incidents.some((i) => i.resolvedAt), 'expected some to be closed');
  assert.ok(portfolio.alerts.some((a) => a.severity === 'critical'));
  const snap = portfolioSnapshot();
  assert.ok(snap.kpis.checkinRate > 50 && snap.kpis.checkinRate <= 100);
});

test('the live site reflects the real engine', async () => {
  reset();
  resetPortfolio();
  state.settings.scenario = 'spike';
  await tick();
  await handleReply('c2-w1', '2');
  await tick();
  const live = site(portfolioSnapshot(), 'site-1');
  assert.equal(live.live, true);
  assert.equal(live.workers, 11);
  assert.equal(live.openIncidents, 1);
  assert.equal(live.compliance, 'Attention needed');
  assert.ok(portfolioSnapshot().alerts.some((a) => a.siteId === 'site-1' && a.severity === 'critical'));
});
