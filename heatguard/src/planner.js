// Shift planning: schedule tomorrow's tasks around tomorrow's heat.
//
// Everything here is deterministic and testable. The Claude planner agent (planner-agent.js)
// uses these functions as tools: it reads the forecast, tries schedules with evaluate(),
// and submits one. validate() is the safety floor for plans: a schedule with any hard
// violation is rejected, and buildRulesPlan() always provides a valid fallback.

import { estimateWbgt, riskLevel, floorPlan, LEVELS } from './heat.js';

export const SLOT_MIN = 15;
const SLOT_H = SLOT_MIN / 60;
export const WINDOW = { start: 3, end: 24 }; // site can work 03:00–24:00 (night work needs lighting)
export const DAYLIGHT = { start: 6, end: 18.5 };
export const MAX_DUTY_HOURS = 10; // per crew, including mandatory rest
export const BASELINE_START = 7; // the usual way: start at 07:00 and work through the list

const WATER_L_PER_HOUR = [0.5, 0.75, 1, 1, 1]; // per worker, by risk level
const RISK_PENALTY = [0, 0.05, 0.15, 0.5]; // per slot, on top of its clock time
const NIGHT_PENALTY = 0.35; // lighting, supervision, noise permits
const GAP_PENALTY = 0.08; // per hour between this task and the crew's other work (prefer compact shifts)
const SPLIT_PENALTY = 0.75;

export function demoTasks() {
  return [
    { id: 't1', crewId: 'c1', name: 'Concrete pour — L5 slab', intensity: 'heavy', hours: 4, exposure: 'sun', splittable: false },
    { id: 't2', crewId: 'c1', name: 'Rebar fixing — L6', intensity: 'heavy', hours: 2.5, exposure: 'sun', splittable: true },
    { id: 't3', crewId: 'c2', name: 'West facade panels', intensity: 'moderate', hours: 4, exposure: 'sun', shadedHours: [5, 12], splittable: true, note: 'West face is shaded until about noon' },
    { id: 't4', crewId: 'c2', name: 'Scaffold inspection', intensity: 'light', hours: 1, exposure: 'sun', splittable: false, daylightOnly: true },
    { id: 't5', crewId: 'c3', name: 'Irrigation trenching', intensity: 'heavy', hours: 3, exposure: 'sun', splittable: true },
    { id: 't6', crewId: 'c3', name: 'Planting & mulching', intensity: 'moderate', hours: 2, exposure: 'sun', splittable: true },
    { id: 't7', crewId: 'c3', name: 'Material prep (workshop)', intensity: 'light', hours: 1.5, exposure: 'shade', splittable: false },
    { id: 't8', crewId: 'c4', name: 'Gate security', intensity: 'light', exposure: 'sun', fixed: { start: 7, end: 17 }, note: 'Must be staffed 07:00–17:00' },
  ];
}

// ---- Heat grid -----------------------------------------------------------------------

/** Per-slot risk for a task: { level, shaded, wbgt, productivity, forbidden, reason }. */
export function slotRisk(task, slot, forecast) {
  const hourF = slot * SLOT_H;
  const h = forecast.hours[Math.min(23, Math.floor(hourF))];
  const shaded = task.exposure === 'shade' || (task.shadedHours && hourF >= task.shadedHours[0] && hourF < task.shadedHours[1]);
  const wbgt = estimateWbgt({ tempC: h.tempC, rh: h.rh, solarWm2: h.solarWm2, windMs: h.windMs, inShade: shaded });
  const level = riskLevel(wbgt, task.intensity);
  const p = floorPlan(level);
  const productivity = p.work / (p.work + p.rest);
  let reason = null;
  if (level >= 4) reason = `${LEVELS[4]} heat — no outdoor work`;
  else if (task.daylightOnly && (hourF < DAYLIGHT.start || hourF >= DAYLIGHT.end)) reason = 'needs daylight';
  else if (forecast.summerRules && !shaded && hourF >= 12.5 && hourF < 15) reason = 'UAE midday break';
  return { level, shaded, wbgt, productivity, forbidden: Boolean(reason), reason };
}

export function forecastTable(forecast) {
  return forecast.hours.map((h) => {
    const sun = estimateWbgt({ ...h });
    const shade = estimateWbgt({ ...h, inShade: true });
    return {
      hour: h.hour, temp_c: h.tempC, rh: h.rh, wbgt_sun: sun, wbgt_shade: shade,
      level_sun: { heavy: riskLevel(sun, 'heavy'), moderate: riskLevel(sun, 'moderate'), light: riskLevel(sun, 'light') },
      level_shade: { heavy: riskLevel(shade, 'heavy'), moderate: riskLevel(shade, 'moderate'), light: riskLevel(shade, 'light') },
    };
  });
}

// ---- Expanding a start time into a run of slots ---------------------------------------

/**
 * Walk forward from `startSlot` until the task's productive hours are done.
 * Mandatory rest at each risk level stretches clock time. If `allowStoppage`, forbidden
 * slots are waited out (the usual plan); otherwise they make the placement invalid.
 */
function walk(task, startSlot, forecast, { need = task.hours, allowStoppage = false, busy = new Set() } = {}) {
  const slots = [];
  let done = 0;
  for (let s = startSlot; s < WINDOW.end / SLOT_H; s++) {
    if (busy.has(s)) {
      if (allowStoppage) continue;
      return null;
    }
    const r = slotRisk(task, s, forecast);
    if (r.forbidden && !allowStoppage) return null;
    slots.push({ slot: s, ...r, stopped: r.forbidden });
    if (!r.forbidden) done += r.productivity * SLOT_H;
    if (done >= need - 1e-9) return { slots, done };
  }
  return allowStoppage ? { slots, done, unfinished: true } : null;
}

function fixedSlots(task, forecast) {
  const slots = [];
  for (let s = task.fixed.start / SLOT_H; s < task.fixed.end / SLOT_H; s++) slots.push({ slot: s, ...slotRisk(task, s, forecast), stopped: false });
  return slots;
}

const toSlot = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return Math.round((h * 60 + (m || 0)) / SLOT_MIN);
};
export const slotToTime = (s) => `${String(Math.floor((s * SLOT_MIN) / 60)).padStart(2, '0')}:${String((s * SLOT_MIN) % 60).padStart(2, '0')}`;

// ---- Evaluating a schedule ------------------------------------------------------------

/**
 * Turn assignments into concrete slot runs and compute metrics + violations.
 * assignments: [{ task_id, segments: [{ start: "HH:MM", hours?: productive hours }] }]
 * Fixed tasks are added automatically. `mode: 'usual'` waits out forbidden heat instead
 * of rejecting it, to show what happens without planning.
 */
export function evaluate(tasks, crews, forecast, assignments, { mode = 'plan' } = {}) {
  const violations = [];
  const runs = [];
  const busyByCrew = new Map(crews.map((c) => [c.id, new Set()]));
  const byId = new Map(tasks.map((t) => [t.id, t]));

  for (const t of tasks.filter((x) => x.fixed)) {
    const slots = fixedSlots(t, forecast);
    slots.forEach((s) => busyByCrew.get(t.crewId).add(s.slot));
    runs.push({ task: t, segments: [slots], productive: null });
  }

  for (const a of assignments) {
    const t = byId.get(a.task_id);
    if (!t) { violations.push(`Unknown task ${a.task_id}`); continue; }
    if (t.fixed) continue;
    const segs = a.segments ?? [];
    if (!segs.length) { violations.push(`${t.name}: no start time`); continue; }
    if (segs.length > 1 && !t.splittable) violations.push(`${t.name}: cannot be split`);
    if (segs.length > 2) violations.push(`${t.name}: at most 2 segments`);
    const busy = busyByCrew.get(t.crewId);
    let remaining = t.hours;
    const segRuns = [];
    segs.forEach((seg, i) => {
      const last = i === segs.length - 1;
      const need = last ? remaining : Math.min(remaining, Number(seg.hours) || 0);
      if (!last && !(need > 0)) { violations.push(`${t.name}: segment ${i + 1} needs "hours"`); return; }
      const start = toSlot(seg.start);
      if (start < WINDOW.start / SLOT_H) violations.push(`${t.name}: starts before ${slotToTime(WINDOW.start / SLOT_H)}`);
      const r = walk(t, start, forecast, { need, allowStoppage: mode === 'usual', busy: mode === 'usual' ? busy : new Set() });
      if (!r) {
        const why = firstBlock(t, start, forecast, need);
        violations.push(`${t.name}: can't run from ${seg.start} — ${why}`);
        return;
      }
      if (r.unfinished) violations.push(`${t.name}: not finished by ${slotToTime(WINDOW.end / SLOT_H)}`);
      for (const s of r.slots) {
        if (busy.has(s.slot) && mode !== 'usual') { violations.push(`${t.name}: overlaps other work of the same crew at ${slotToTime(s.slot)}`); break; }
      }
      r.slots.forEach((s) => busy.add(s.slot));
      remaining -= r.done;
      segRuns.push(r.slots);
    });
    runs.push({ task: t, segments: segRuns, productive: t.hours - Math.max(0, remaining) });
  }

  for (const t of tasks) {
    if (!t.fixed && !assignments.some((a) => a.task_id === t.id)) violations.push(`${t.name}: not scheduled`);
  }

  const metrics = computeMetrics(runs, crews);
  for (const c of metrics.crews) {
    if (c.dutyHours > MAX_DUTY_HOURS + 1e-9) violations.push(`${c.name}: ${c.dutyHours} h on duty (max ${MAX_DUTY_HOURS})`);
  }
  return { valid: violations.length === 0, violations: [...new Set(violations)], runs: runs.map(describeRun), metrics };
}

function firstBlock(t, start, forecast, need) {
  let done = 0;
  for (let s = start; s < WINDOW.end / SLOT_H; s++) {
    const r = slotRisk(t, s, forecast);
    if (r.forbidden) return `${r.reason} at ${slotToTime(s)}`;
    done += r.productivity * SLOT_H;
    if (done >= need) break;
  }
  return `runs past ${slotToTime(WINDOW.end / SLOT_H)}`;
}

function describeRun({ task, segments, productive }) {
  return {
    task_id: task.id,
    crew_id: task.crewId,
    name: task.name,
    intensity: task.intensity,
    fixed: Boolean(task.fixed),
    productive_hours: productive,
    segments: segments.filter((s) => s.length).map((slots) => ({
      start: slotToTime(slots[0].slot),
      end: slotToTime(slots.at(-1).slot + 1),
      max_level: Math.max(...slots.map((s) => s.level)),
      stopped_hours: slots.filter((s) => s.stopped).length * SLOT_H,
      levels: slots.map((s) => (s.stopped ? -1 : s.level)), // per 15-min slot, -1 = work stopped
    })),
  };
}

function computeMetrics(runs, crews) {
  const crewStats = crews.map((c) => ({ id: c.id, name: c.name, workers: c.workers.length, slots: new Map() }));
  const byCrew = new Map(crewStats.map((c) => [c.id, c]));
  let productive = 0, rest = 0;
  for (const r of runs) {
    const workers = byCrew.get(r.task.crewId).workers;
    if (r.productive) productive += r.productive * workers;
    for (const seg of r.segments) {
      for (const s of seg) {
        byCrew.get(r.task.crewId).slots.set(s.slot, s);
        if (!r.task.fixed && !s.stopped) rest += (1 - s.productivity) * SLOT_H * workers;
      }
    }
  }
  let dangerWH = 0, stoppedWH = 0, dutyWH = 0, water = 0, nightH = 0, latest = 0;
  const out = crewStats.map((c) => {
    const slots = [...c.slots.values()];
    const duty = slots.length * SLOT_H;
    const danger = slots.filter((s) => !s.stopped && s.level >= 3).length * SLOT_H;
    const stopped = slots.filter((s) => s.stopped).length * SLOT_H;
    const night = slots.filter((s) => s.slot * SLOT_H < DAYLIGHT.start || s.slot * SLOT_H >= DAYLIGHT.end).length * SLOT_H;
    const end = slots.length ? Math.max(...slots.map((s) => s.slot)) + 1 : 0;
    const start = slots.length ? Math.min(...slots.map((s) => s.slot)) : 0;
    dangerWH += danger * c.workers;
    stoppedWH += stopped * c.workers;
    dutyWH += duty * c.workers;
    nightH += night;
    water += slots.reduce((sum, s) => sum + WATER_L_PER_HOUR[s.level] * SLOT_H, 0) * c.workers;
    latest = Math.max(latest, end);
    return { id: c.id, name: c.name, workers: c.workers, start: slotToTime(start), end: slotToTime(end), dutyHours: duty, dangerHours: danger, stoppedHours: stopped, nightHours: night };
  });
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    danger_worker_hours: r1(dangerWH),
    stopped_worker_hours: r1(stoppedWH),
    rest_worker_hours: r1(rest),
    duty_worker_hours: r1(dutyWH),
    productive_worker_hours: r1(productive),
    water_litres: Math.round(water),
    night_crew_hours: r1(nightH),
    latest_finish: slotToTime(latest),
    tasks_unfinished: runs.filter((r) => r.productive !== null && r.productive < r.task.hours - 1e-6).map((r) => r.task.name),
    crews: out,
  };
}

// ---- The usual plan and the rules-based plan -------------------------------------------

/** Evaluate the usual plan sequentially so tasks queue behind each other and wait out stoppages. */
export function evaluateUsual(tasks, crews, forecast) {
  const assignments = [];
  const ends = new Map();
  for (const t of tasks.filter((x) => !x.fixed)) {
    const start = ends.get(t.crewId) ?? BASELINE_START / SLOT_H;
    const r = walk(t, start, forecast, { allowStoppage: true });
    assignments.push({ task_id: t.id, segments: [{ start: slotToTime(start) }] });
    ends.set(t.crewId, r.slots.length ? r.slots.at(-1).slot + 1 : start);
  }
  return { assignments, ...evaluate(tasks, crews, forecast, assignments, { mode: 'usual' }) };
}

/**
 * Greedy heat-aware scheduler. For each crew: fixed work first, then heaviest/longest tasks
 * get the coolest feasible window. Splittable tasks may use two segments (a split shift).
 */
export function buildRulesPlan(tasks, crews, forecast) {
  const assignments = [];
  const unscheduled = [];
  for (const crew of crews) {
    const busy = new Set();
    let duty = 0;
    for (const t of tasks.filter((x) => x.crewId === crew.id && x.fixed)) {
      fixedSlots(t, forecast).forEach((s) => busy.add(s.slot));
      duty += t.fixed.end - t.fixed.start;
    }
    const order = { heavy: 0, moderate: 1, light: 2 };
    const mine = tasks.filter((x) => x.crewId === crew.id && !x.fixed)
      .sort((a, b) => order[a.intensity] - order[b.intensity] || b.hours - a.hours);
    for (const t of mine) {
      const best = bestPlacement(t, forecast, busy, MAX_DUTY_HOURS - duty);
      if (!best) { unscheduled.push(t.name); continue; }
      best.runs.forEach((r) => r.slots.forEach((s) => busy.add(s.slot)));
      duty += best.runs.reduce((sum, r) => sum + r.slots.length * SLOT_H, 0);
      assignments.push({ task_id: t.id, segments: best.segments });
    }
  }
  return { assignments, unscheduled };
}

function cost(slots) {
  return slots.reduce((sum, s) => sum + SLOT_H * (1 + RISK_PENALTY[s.level] +
    (s.slot * SLOT_H < DAYLIGHT.start || s.slot * SLOT_H >= DAYLIGHT.end ? NIGHT_PENALTY : 0)), 0);
}

function bestPlacement(task, forecast, busy, dutyLeft) {
  const first = WINDOW.start / SLOT_H, last = WINDOW.end / SLOT_H;
  let best = null;
  const busyList = [...busy];
  const gapHours = (slots) => {
    if (!busyList.length) return 0;
    let g = Infinity;
    for (const s of [slots[0].slot, slots.at(-1).slot]) for (const b of busyList) g = Math.min(g, Math.abs(s - b));
    return Math.max(0, g - 1) * SLOT_H;
  };
  const consider = (runs, segments, extra = 0) => {
    const clock = runs.reduce((s, r) => s + r.slots.length * SLOT_H, 0);
    if (clock > dutyLeft + 1e-9) return;
    const c = runs.reduce((s, r) => s + cost(r.slots) + GAP_PENALTY * gapHours(r.slots), 0) + extra;
    if (!best || c < best.cost) best = { cost: c, runs, segments };
  };
  for (let s = first; s < last; s++) {
    const r = walk(task, s, forecast, { busy });
    if (r) consider([r], [{ start: slotToTime(s) }]);
  }
  if (task.splittable) {
    // Split shift: a first block of whole hours, then the rest later in the day.
    for (let part = 1; part < task.hours; part += 0.5) {
      for (let s1 = first; s1 < last; s1++) {
        const r1 = walk(task, s1, forecast, { need: part, busy });
        if (!r1) continue;
        const end1 = r1.slots.at(-1).slot + 1;
        const busy2 = new Set([...busy, ...r1.slots.map((x) => x.slot)]);
        for (let s2 = end1 + 4; s2 < last; s2++) { // at least 1 h apart
          const r2 = walk(task, s2, forecast, { need: task.hours - r1.done, busy: busy2 });
          if (r2) { consider([r1, r2], [{ start: slotToTime(s1), hours: part }, { start: slotToTime(s2) }], SPLIT_PENALTY); break; }
        }
      }
    }
  }
  return best;
}

/** Compare two metric sets for the headline numbers. */
export function compare(usual, plan) {
  const d = (a, b) => Math.round((a - b) * 10) / 10;
  return {
    danger_worker_hours_avoided: d(usual.danger_worker_hours, plan.danger_worker_hours),
    stopped_worker_hours_avoided: d(usual.stopped_worker_hours, plan.stopped_worker_hours),
    duty_worker_hours_saved: d(usual.duty_worker_hours, plan.duty_worker_hours),
    tasks_rescued: usual.tasks_unfinished.filter((t) => !plan.tasks_unfinished.includes(t)),
  };
}
