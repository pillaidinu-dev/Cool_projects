// The Planner agent: plans tomorrow's work around tomorrow's heat.
//
// 1. Fetch tomorrow's hourly forecast.
// 2. Evaluate "the usual plan" (start 07:00, work down the list) to show what would happen.
// 3. Build a rules-based heat-aware plan (always valid; the fallback).
// 4. If Claude is available, it reviews the forecast and tasks, tries alternatives with
//    evaluate_plan, and submits a plan plus a supervisor briefing and logistics notes.
//    A submitted plan with any hard violation is rejected by the server.

import { state, findCrew, allWorkers, sendToWorker, log } from './store.js';
import { claudeAvailable, runToolLoop } from './claude.js';
import { getHourlyForecast, FORECASTS } from './weather.js';
import { LEVELS } from './heat.js';
import {
  evaluate, evaluateUsual, buildRulesPlan, forecastTable, compare,
  WINDOW, DAYLIGHT, MAX_DUTY_HOURS, SLOT_MIN,
} from './planner.js';

const SYSTEM = `You are HeatGuard's Planner, an agent that plans tomorrow's work on a construction site in Dubai so that nobody works in dangerous heat and the work still gets done.

Start with get_planning_context. It gives tomorrow's hourly forecast with heat-risk levels (0 Normal … 4 Extreme) for each work intensity in sun and shade, the site rules, the crews and tasks, what happens with the usual 07:00 start, and a rules-based draft plan.

How the site works:
- Task "hours" are productive hours. Mandatory rest at each risk level stretches the clock time (level 2 = 45/15 work/rest, level 3 = 30/30), so cooler hours are also more productive.
- Level 4 (Extreme) means no outdoor work. Some tasks need daylight. In summer the UAE midday break bans outdoor work in the sun 12:30–15:00.
- Splittable tasks may use two segments (a split shift: an early block, a long rest, an evening block). Others must run in one go (a concrete pour can't stop halfway).
- Night work (before 06:00 or after 18:30) is allowed but needs lighting and supervision, so use it when it clearly protects workers.
- Fixed tasks can't move. Plan protections for them instead (rotation, shade, cooling).

Use evaluate_plan to try improvements on the draft: less time at Danger level or above, fewer night hours, compact shifts, all tasks finished, and every crew within the duty limit. Two or three evaluations are usually enough. Then call submit_plan once with:
- assignments: every non-fixed task with its segment start times ("HH:MM", on 15-minute steps). For a split task, give the first segment's productive "hours"; use 0 for the last segment (it takes the remainder).
- briefing: 3–5 sentences for the site supervisor in plain English: what tomorrow's heat looks like, what you changed and why, and the numbers that matter.
- logistics: short, specific action items (water, cooling stations, lighting, guard rotation, first aid cover, transport for early starts).

After submitting, reply with one sentence summarising the plan.`;

const tools = [
  {
    name: 'get_planning_context',
    description: "Tomorrow's forecast with risk levels, site rules, crews, tasks, the usual plan with its outcome, and a rules-based draft plan.",
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'evaluate_plan',
    description: 'Check a candidate schedule: returns violations, each task segment with times and peak risk level, and metrics compared with the usual plan.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { assignments: assignmentsSchema() },
      required: ['assignments'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_plan',
    description: 'Submit the final plan. Rejected if it has any violation.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        assignments: assignmentsSchema(),
        briefing: { type: 'string' },
        logistics: { type: 'array', items: { type: 'string' } },
      },
      required: ['assignments', 'briefing', 'logistics'],
      additionalProperties: false,
    },
  },
];

function assignmentsSchema() {
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'HH:MM, 15-minute steps' },
              hours: { type: 'number', description: 'Productive hours in this segment; 0 for the last segment' },
            },
            required: ['start', 'hours'],
            additionalProperties: false,
          },
        },
      },
      required: ['task_id', 'segments'],
      additionalProperties: false,
    },
  };
}

// Strip per-slot detail before sending results to the model or the browser summary.
const brief = (ev) => ({
  valid: ev.valid,
  violations: ev.violations,
  tasks: ev.runs.map((r) => ({ ...r, segments: r.segments.map(({ levels, ...s }) => s) })),
  metrics: ev.metrics,
});

export async function planTomorrow(forecastMode = state.planner.forecastMode) {
  const p = state.planner;
  if (p.running) throw new Error('Already planning');
  p.running = true;
  p.error = null;
  p.forecastMode = forecastMode;
  try {
    const forecast = await getHourlyForecast(state.site, forecastMode);
    const tasks = p.tasks;
    const crews = state.crews;
    const usual = evaluateUsual(tasks, crews, forecast);
    const rules = buildRulesPlan(tasks, crews, forecast);
    const rulesEval = evaluate(tasks, crews, forecast, rules.assignments);

    let chosen = { source: 'rules', assignments: rules.assignments, evaluation: rulesEval, briefing: null, logistics: null };

    if (claudeAvailable()) {
      try {
        let submitted = null;
        const context = {
          date: forecast.date,
          forecast_source: forecast.source,
          summer_midday_break_applies: forecast.summerRules,
          rules: {
            work_window: `0${WINDOW.start}:00–24:00`,
            daylight: `0${DAYLIGHT.start}:00–18:30`,
            max_duty_hours_per_crew: MAX_DUTY_HOURS,
            time_step_minutes: SLOT_MIN,
          },
          hourly: forecastTable(forecast).filter((h) => h.hour >= WINDOW.start),
          crews: crews.map((c) => ({ id: c.id, name: c.name, workers: c.workers.length })),
          tasks,
          usual_plan: brief(usual),
          rules_based_draft: { assignments: rules.assignments, unscheduled: rules.unscheduled, ...brief(rulesEval) },
        };
        const summary = await runToolLoop({
          system: SYSTEM,
          tools,
          prompt: `Plan tomorrow (${forecast.date}) for ${state.site.name}.`,
          maxTurns: 10,
          runTool: (name, input) => {
            if (name === 'get_planning_context') return context;
            if (name === 'evaluate_plan') {
              const ev = evaluate(tasks, crews, forecast, input.assignments);
              return { ...brief(ev), compared_with_usual: compare(usual.metrics, ev.metrics) };
            }
            if (name === 'submit_plan') {
              const ev = evaluate(tasks, crews, forecast, input.assignments);
              if (!ev.valid) throw new Error(`Plan rejected: ${ev.violations.join('; ')}`);
              submitted = { source: 'claude', assignments: input.assignments, evaluation: ev, briefing: input.briefing, logistics: input.logistics };
              return { accepted: true, compared_with_usual: compare(usual.metrics, ev.metrics) };
            }
            throw new Error(`Unknown tool ${name}`);
          },
        });
        if (submitted) {
          chosen = submitted;
          log('plan', `Planner: ${summary || 'tomorrow\'s plan is ready.'}`, 'claude');
        } else {
          log('system', 'Planner agent did not submit a valid plan; using the rules-based plan.', 'system');
        }
      } catch (err) {
        p.error = err.message;
        log('system', `Planner agent unavailable (${err.message}); using the rules-based plan.`, 'system');
      }
    }

    chosen.briefing ??= rulesBriefing(forecast, usual.metrics, chosen.evaluation.metrics);
    chosen.logistics ??= rulesLogistics(chosen.evaluation, forecast);
    p.result = {
      date: forecast.date,
      forecastSource: forecast.source,
      summerRules: forecast.summerRules,
      generatedAt: Date.now(),
      hourly: forecastTable(forecast),
      usual: { runs: usual.runs, metrics: usual.metrics, violations: usual.violations },
      plan: {
        source: chosen.source,
        assignments: chosen.assignments,
        runs: chosen.evaluation.runs,
        metrics: chosen.evaluation.metrics,
        briefing: chosen.briefing,
        logistics: chosen.logistics,
      },
      comparison: compare(usual.metrics, chosen.evaluation.metrics),
      published: false,
    };
    if (chosen.source === 'rules') log('plan', `Tomorrow's plan ready (rules engine). ${chosen.briefing}`, 'rules');
    return p.result;
  } finally {
    p.running = false;
  }
}

function rulesBriefing(forecast, usual, plan) {
  const peak = Math.max(...forecast.hours.map((h) => h.tempC));
  const parts = [`Tomorrow peaks at ${Math.round(peak)} °C (${forecast.source}).`];
  if (usual.stopped_worker_hours > 0) parts.push(`With the usual 07:00 start, heat would stop work for ${usual.stopped_worker_hours} worker-hours.`);
  parts.push(`The heat-aware plan cuts time at Danger level or above from ${usual.danger_worker_hours} to ${plan.danger_worker_hours} worker-hours and finishes by ${plan.latest_finish}.`);
  if (usual.tasks_unfinished.length && !plan.tasks_unfinished.length) parts.push(`All tasks finish, including ${usual.tasks_unfinished.join(', ')}.`);
  return parts.join(' ');
}

function rulesLogistics(evaluation, forecast) {
  const items = [];
  const m = evaluation.metrics;
  items.push(`Water: have at least ${Math.ceil(m.water_litres * 1.2)} L of cool drinking water on site (planned need ${m.water_litres} L + 20%).`);
  for (const c of m.crews) {
    if (c.nightHours > 0) items.push(`${c.name}: ${c.nightHours} h of work outside daylight (on duty ${c.start}–${c.end}). Arrange lighting, a supervisor on shift and transport.`);
  }
  const hot = evaluation.runs.filter((r) => r.segments.some((s) => s.max_level >= 2)).map((r) => findCrew(r.crew_id)?.name);
  if (hot.length) items.push(`Cooling station with shade, water and seating for: ${[...new Set(hot)].join(', ')}.`);
  for (const r of evaluation.runs.filter((x) => x.fixed && x.segments.some((s) => s.max_level >= 3))) {
    items.push(`${r.name}: rotate staff every 30 min into a shaded, cooled booth during Danger hours.`);
  }
  if (forecast.summerRules) items.push('UAE midday break 12:30–15:00: no outdoor work in the sun.');
  items.push('First-aid cover with heat-illness kit (ice packs, electrolytes) for all working hours.');
  return items;
}

/** Tell every worker their crew's hours for tomorrow, in their own language. */
export function publishPlan() {
  const r = state.planner.result;
  if (!r) throw new Error('No plan yet');
  let sent = 0;
  for (const c of r.plan.metrics.crews) {
    if (!c.dutyHours) continue;
    for (const w of allWorkers().filter((x) => x.crewId === c.id)) {
      sendToWorker(w, 'shift_tomorrow', 'rules', { start: c.start, end: c.end });
      sent++;
    }
  }
  r.published = true;
  log('alert', `Tomorrow's schedule sent to ${sent} workers in their own languages.`, 'rules');
  return sent;
}

export const PLANNER_META = { forecasts: FORECASTS, levels: LEVELS };
