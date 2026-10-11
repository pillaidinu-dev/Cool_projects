process.env.HEATGUARD_AGENT = 'rules';

import test from 'node:test';
import assert from 'node:assert/strict';
import { state, reset } from '../src/store.js';
import { getHourlyForecast } from '../src/weather.js';
import { demoTasks, evaluate, evaluateUsual, buildRulesPlan } from '../src/planner.js';
import { planTomorrow, publishPlan } from '../src/planner-agent.js';
import { render, LANGUAGES } from '../src/i18n.js';

const DATE = '2026-10-12';
const heatwave = () => getHourlyForecast(state.site, 'heatwave', DATE);
const typical = () => getHourlyForecast(state.site, 'typical', DATE);

test('heatwave: the usual 07:00 plan stalls, the rules plan is valid and safer', async () => {
  reset();
  const f = await heatwave();
  const tasks = demoTasks();
  const usual = evaluateUsual(tasks, state.crews, f);
  assert.ok(usual.metrics.stopped_worker_hours > 0);
  assert.ok(usual.metrics.tasks_unfinished.length > 0);

  const rules = buildRulesPlan(tasks, state.crews, f);
  assert.deepEqual(rules.unscheduled, []);
  const ev = evaluate(tasks, state.crews, f, rules.assignments);
  assert.ok(ev.valid, ev.violations.join('; '));
  assert.equal(ev.metrics.stopped_worker_hours, 0);
  assert.deepEqual(ev.metrics.tasks_unfinished, []);
  assert.ok(ev.metrics.danger_worker_hours < usual.metrics.danger_worker_hours);
  for (const r of ev.runs) for (const s of r.segments) assert.ok(r.fixed || s.max_level < 4, `${r.name} at Extreme`);
  const pour = ev.runs.find((r) => r.task_id === 't1');
  assert.ok(pour.segments[0].start < '07:00', `pour starts ${pour.segments[0].start}`);
});

test('typical day: no needless night work', async () => {
  reset();
  const f = await typical();
  const ev = evaluate(demoTasks(), state.crews, f, buildRulesPlan(demoTasks(), state.crews, f).assignments);
  assert.ok(ev.valid, ev.violations.join('; '));
  assert.ok(ev.metrics.night_crew_hours <= 1, `night hours ${ev.metrics.night_crew_hours}`);
});

test('evaluate rejects unsafe or impossible plans', async () => {
  reset();
  const f = await heatwave();
  const tasks = demoTasks();
  const base = buildRulesPlan(tasks, state.crews, f).assignments;
  const withTask = (id, segments) => base.map((a) => (a.task_id === id ? { task_id: id, segments } : a));
  const errs = (assignments) => evaluate(tasks, state.crews, f, assignments).violations.join(' | ');

  assert.match(errs(withTask('t1', [{ start: '10:00', hours: 0 }])), /Extreme heat/);
  assert.match(errs(withTask('t1', [{ start: '03:00', hours: 2 }, { start: '20:00', hours: 0 }])), /cannot be split/);
  assert.match(errs(withTask('t4', [{ start: '03:00', hours: 0 }])), /needs daylight/);
  assert.match(errs(withTask('t2', [{ start: '03:00', hours: 0 }])), /overlaps/);
  assert.match(errs(base.filter((a) => a.task_id !== 't6')), /not scheduled/);
  assert.match(errs(withTask('t6', [{ start: '22:30', hours: 0 }])), /on duty|runs past/);
});

test('planTomorrow (rules mode) produces a plan, briefing and logistics; publish tells every worker', async () => {
  reset();
  const r = await planTomorrow('heatwave');
  assert.equal(r.plan.source, 'rules');
  assert.match(r.plan.briefing, /peaks at 45/);
  assert.ok(r.plan.logistics.some((l) => /Water/.test(l)));
  assert.ok(r.plan.logistics.some((l) => /lighting/.test(l)));
  assert.ok(r.comparison.stopped_worker_hours_avoided > 0);

  const sent = publishPlan();
  assert.equal(sent, 11);
  const msg = state.messages.find((m) => m.to === 'c1-w1');
  assert.equal(msg.template, 'shift_tomorrow');
  assert.match(msg.text, /03:00/);
});

test('shift_tomorrow renders in every language with the times', () => {
  for (const lang of Object.keys(LANGUAGES)) {
    const text = render('shift_tomorrow', lang, { level: 0, start: '04:15', end: '13:30' });
    assert.ok(text.includes('04:15') && text.includes('13:30'), `${lang}: ${text}`);
  }
});
