// End-to-end checks of the rules engine / safety floor, with the Claude agent switched off.
process.env.HEATGUARD_AGENT = 'rules';

import test from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, allWorkers, findWorker, findCrew } from '../src/store.js';
import { tick, handleReply } from '../src/monitor.js';
import { runTool } from '../src/agent.js';
import { floorPlan } from '../src/heat.js';

const supervisorAlerts = (workerId) => state.messages.filter((m) => m.to === 'supervisor' && m.about === workerId);
const lastTo = (workerId) => state.messages.find((m) => m.to === workerId);

test.beforeEach(() => {
  reset();
  state.settings.scenario = 'spike';
});

test('heat spike: every crew gets at least the floor plan and every worker is told', async () => {
  await tick();
  for (const crew of state.crews) {
    assert.ok(crew.assessedLevel >= 3, `${crew.name} level ${crew.assessedLevel}`);
    assert.equal(crew.plan.level, crew.assessedLevel);
    for (const w of crew.workers) assert.equal(w.notifiedLevel, crew.plan.level);
  }
  // Worker messages are in their own language.
  assert.match(lastTo('c1-w1').text, /गर्मी/);
  assert.match(lastTo('c2-w2').text, /حرارة/);
  assert.match(lastTo('c3-w2').text, /வெப்ப/); // Tamil
});

test('cooling down relaxes the plan and tells workers', async () => {
  await tick();
  state.settings.scenario = 'morning';
  await tick();
  const security = findCrew('c4');
  assert.equal(security.plan.level, 0);
  assert.equal(security.workers[0].notifiedLevel, 0);
});

test('check-ins are sent when due, and a missed check-in is escalated', async () => {
  await tick();
  const w = findWorker('c1-w1');
  w.lastCheckinAt = Date.now() - 24 * 3600 * 1000;
  await tick();
  assert.equal(w.status, 'awaiting');
  assert.equal(lastTo(w.id).template, 'checkin');

  w.pending.sentAt = Date.now() - 24 * 3600 * 1000;
  await tick();
  assert.equal(w.status, 'overdue');
  assert.equal(supervisorAlerts(w.id).at(0).severity, 'high');

  await tick(); // no duplicate escalation
  assert.equal(supervisorAlerts(w.id).length, 1);

  await handleReply(w.id, '1');
  assert.equal(w.status, 'ok');
  assert.equal(supervisorAlerts(w.id).at(0).severity, 'info');
});

test('a worker replying "2" triggers a critical alert and first-aid guidance', async () => {
  await tick();
  const w = findWorker('c2-w1');
  await handleReply(w.id, '2');
  await tick();
  assert.equal(w.status, 'unwell');
  assert.equal(supervisorAlerts(w.id).at(0).severity, 'critical');
  assert.ok(state.messages.some((m) => m.to === w.id && m.template === 'first_aid_coming'));
});

test('without the agent, free-text replies go to the supervisor', async () => {
  await tick();
  await handleReply('c3-w1', 'head spinning');
  assert.match(supervisorAlerts('c3-w1').at(0).text, /head spinning/);
});

test('agent tools cannot weaken the safety floor', async () => {
  await tick();
  const crew = findCrew('c1');
  const weak = floorPlan(crew.assessedLevel - 1);
  assert.throws(() => runTool('set_crew_plan', {
    crew_id: 'c1', level: weak.level, water_minutes: weak.water, work_minutes: weak.work, rest_minutes: weak.rest, reason: 'test',
  }, { crews: new Set() }), /less strict/);

  const strict = floorPlan(4);
  runTool('set_crew_plan', {
    crew_id: 'c1', level: 4, water_minutes: 10, work_minutes: 0, rest_minutes: strict.rest, reason: 'worker unwell in crew',
  }, { crews: new Set() });
  assert.equal(crew.plan.source, 'claude');
});

test('a critical escalation from the agent marks the worker unwell and the floor sends first aid', async () => {
  await tick();
  runTool('escalate_to_supervisor', { worker_id: 'c1-w2', severity: 'critical', message: 'Reports dizziness' }, { crews: new Set() });
  const w = findWorker('c1-w2');
  assert.equal(w.status, 'unwell');
  await tick();
  assert.ok(state.messages.some((m) => m.to === w.id && m.template === 'first_aid_coming'));
  assert.equal(supervisorAlerts(w.id).length, 1);
});

test('all workers exist and are reachable', () => {
  assert.equal(allWorkers().length, 11);
});
