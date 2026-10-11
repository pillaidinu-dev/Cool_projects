process.env.HEATGUARD_AGENT = 'rules';

import test from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, findWorker } from '../src/store.js';
import { tick, handleReply, resolveWorker } from '../src/monitor.js';
import { records } from '../src/records.js';
import { buildReport, renderReportHtml } from '../src/report.js';
import { planTomorrow, publishPlan } from '../src/planner-agent.js';

const control = (r, id) => r.controls.find((c) => c.id === id);
const ago = (min) => Date.now() - (min * 60000) / state.settings.timeScale; // site minutes ago

test('a clean shift: risk changes communicated, no incidents → attention only for the missing schedule', async () => {
  reset();
  state.settings.scenario = 'spike';
  await tick();
  const r = buildReport();
  assert.equal(control(r, 'monitoring').status, 'pass');
  assert.equal(control(r, 'inform').status, 'pass');
  assert.equal(control(r, 'floor').status, 'pass');
  assert.equal(control(r, 'language').status, 'pass');
  assert.equal(control(r, 'unwell').status, 'n/a');
  assert.equal(control(r, 'plan').status, 'attention');
  assert.equal(r.status, 'Attention needed');
  assert.ok(r.kpis.languages >= 5);
});

test('incidents and missed check-ins are recorded with their timelines', async () => {
  reset();
  state.settings.scenario = 'spike';
  await tick();

  // A missed check-in that gets escalated, then answered.
  const w = findWorker('c1-w1');
  w.lastCheckinAt = ago(24 * 60);
  await tick();
  w.pending.sentAt = ago(60);
  await tick();
  await handleReply(w.id, '1');
  const missed = records.checkins.find((c) => c.workerId === w.id);
  assert.ok(missed.missedAt && missed.escalatedAt && missed.answeredAt);

  // An unwell report, escalated with first aid, then closed.
  await handleReply('c2-w1', '2');
  await tick();
  const inc = records.incidents[0];
  assert.equal(inc.workerId, 'c2-w1');
  assert.ok(inc.escalatedAt && inc.firstAidAt);
  assert.ok(inc.escalateMin <= 2);
  let r = buildReport();
  assert.equal(control(r, 'missed').status, 'pass');
  assert.equal(control(r, 'unwell').status, 'pass');
  assert.equal(control(r, 'closed').status, 'attention');

  resolveWorker('c2-w1');
  await planTomorrow('heatwave');
  publishPlan();
  r = buildReport();
  assert.equal(control(r, 'closed').status, 'pass');
  assert.equal(control(r, 'plan').status, 'pass');
  assert.equal(r.status, 'Compliant');

  const html = renderReportHtml(r);
  assert.match(html, /Daily heat-safety compliance report/);
  assert.match(html, /Joel Santos/);
  assert.match(html, /replied &quot;2&quot;/);
});

test('a missed check-in that nobody escalated fails the report', async () => {
  reset();
  state.settings.scenario = 'spike';
  await tick();
  records.checkins.push({ id: 999, workerId: 'c1-w2', crewId: 'c1', sentAt: Date.now(), missedAt: Date.now(), escalatedAt: null, answeredAt: null });
  const r = buildReport();
  assert.equal(control(r, 'missed').status, 'fail');
  assert.equal(r.status, 'Non-compliant');
});

test('report HTML escapes worker text', async () => {
  reset();
  await tick();
  await handleReply('c3-w1', '<script>alert(1)</script>');
  const html = renderReportHtml(buildReport());
  assert.ok(!html.includes('<script>alert(1)</script>'));
});
