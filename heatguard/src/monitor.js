// The monitoring loop: perceive → detect events → reason (Claude) → enforce safety floor.
//
// Routine work (check-in reminders, overdue detection) is deterministic and runs every
// tick. Claude is only called when an event needs judgement, which keeps cost and latency
// low. After every agent run, or when the agent is unavailable, the safety floor makes sure
// the minimum protective actions have happened.

import { state, allWorkers, findWorker, sendToWorker, recordReply, escalate, markUnwell, log, minutes } from './store.js';
import { estimateWbgt, riskLevel, floorPlan, isAtLeastAsStrict, isMiddayBreak, LEVELS } from './heat.js';
import { getConditions } from './weather.js';
import { claudeAvailable, runClaude } from './agent.js';

const CHECKIN_TIMEOUT_MIN = 10; // site minutes before a missing reply is escalated
const AGENT_GRACE_MS = 20_000; // floor waits this long for a running agent before acting itself

let queued = [];
let agentStartedAt = null;

export function queueEvent(event) {
  queued.push({ ...event, at: new Date().toISOString() });
}

export async function tick() {
  const now = Date.now();
  state.conditions = await getConditions(state.site, state.settings.scenario);
  const c = state.conditions;

  // 1. Perceive: assess every crew.
  for (const crew of state.crews) {
    crew.wbgt = estimateWbgt({ tempC: c.tempC, rh: c.rh, solarWm2: c.solarWm2, windMs: c.windMs });
    const level = riskLevel(crew.wbgt, crew.intensity);
    if (level !== crew.assessedLevel || crew.plan.reason === 'initial') {
      queueEvent({ type: 'risk_change', crew_id: crew.id, crew: crew.name, from: LEVELS[crew.assessedLevel], to: LEVELS[level], wbgt_c: crew.wbgt });
      crew.assessedLevel = level;
      if (crew.plan.reason === 'initial') crew.plan.reason = 'awaiting first assessment';
    }
  }

  // 2. Detect: overdue check-ins and the midday break.
  for (const w of allWorkers()) {
    if (w.status === 'awaiting' && now - w.pending.sentAt > minutes(CHECKIN_TIMEOUT_MIN)) {
      w.status = 'overdue';
      queueEvent({ type: 'missed_checkin', worker_id: w.id, worker: w.name, minutes_waiting: CHECKIN_TIMEOUT_MIN });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  if (isMiddayBreak() && state.middayNotifiedOn !== today) {
    queueEvent({ type: 'midday_break_started' });
  }

  // 3. Reason: hand new events to Claude (one run at a time).
  if (state.agent.running) {
    if (now - agentStartedAt > AGENT_GRACE_MS) applySafetyFloor({ crews: new Set() });
  } else if (queued.length) {
    const events = queued;
    queued = [];
    await handleEvents(events);
  } else {
    applySafetyFloor({ crews: new Set() }); // idempotent; catches anything left unfinished
  }

  // 4. Routine check-ins.
  sendDueCheckins(now);
}

async function handleEvents(events) {
  let handled = { crews: new Set() };
  state.agent.mode = claudeAvailable() ? 'claude' : 'rules';
  if (state.agent.mode === 'claude') {
    state.agent.running = true;
    agentStartedAt = Date.now();
    try {
      handled = await runClaude(events);
      state.agent.lastError = null;
    } catch (err) {
      state.agent.lastError = err.message;
      log('system', `Agent unavailable (${err.message}). Rules engine is handling it.`, 'system');
    } finally {
      state.agent.running = false;
      state.agent.lastRunAt = Date.now();
    }
  }
  applySafetyFloor(handled, events);
}

/**
 * The minimum the system guarantees, whatever the agent did:
 * - every crew's plan is at least the floor plan for its risk level
 * - risk changes the agent didn't handle get the standard plan
 * - every worker knows their crew's current level
 * - every missed check-in and every unwell report reaches the supervisor
 * - unwell workers are told help is coming
 */
export function applySafetyFloor(handled, events = []) {
  const changed = new Set(events.filter((e) => e.type === 'risk_change').map((e) => e.crew_id));

  for (const crew of state.crews) {
    const needsFloor = !isAtLeastAsStrict(crew.plan, crew.assessedLevel);
    const unhandledChange = changed.has(crew.id) && !handled.crews.has(crew.id) && crew.plan.level !== crew.assessedLevel;
    if (needsFloor || unhandledChange) {
      crew.plan = { ...floorPlan(crew.assessedLevel), source: 'rules', reason: needsFloor ? 'safety floor' : 'standard plan' };
      const p = crew.plan;
      log('plan', `${crew.name}: ${LEVELS[p.level]} — water every ${p.water} min, work ${p.work}/rest ${p.rest}.`, 'rules');
    }
    const stale = crew.workers.filter((w) => w.notifiedLevel !== crew.plan.level);
    if (stale.length) {
      stale.forEach((w) => sendToWorker(w, 'risk_update', 'rules'));
      log('alert', `Sent "risk_update" (${LEVELS[crew.plan.level]}) to ${crew.name}: ${stale.map((w) => w.name).join(', ')}`, 'rules');
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (isMiddayBreak() && state.middayNotifiedOn !== today) {
    state.middayNotifiedOn = today;
    allWorkers().forEach((w) => sendToWorker(w, 'midday_break', 'rules'));
    log('alert', 'Midday break (12:30–15:00): outdoor work paused for all crews.', 'rules');
  }

  for (const w of allWorkers()) {
    if (w.status === 'overdue' && !w.pending?.escalated) {
      escalate(w, 'high', `No reply to heat check-in for ${CHECKIN_TIMEOUT_MIN}+ min. Send someone to check on them now.`, 'rules');
    }
    if (w.unwell && !w.unwell.escalated) {
      escalate(w, 'critical', 'Worker reports feeling unwell. Possible heat illness: move to shade, cool down, give water, call first aid. Call 998 if confused or collapsed.', 'rules');
    }
    if (w.unwell && !w.unwell.firstAidSent) sendToWorker(w, 'first_aid_coming', 'rules');
  }
}

function sendDueCheckins(now) {
  for (const crew of state.crews) {
    const every = crew.plan.checkin;
    if (!every) continue;
    const due = crew.workers.filter((w) => w.status === 'ok' && now - w.lastCheckinAt > minutes(every));
    if (!due.length) continue;
    due.forEach((w) => sendToWorker(w, 'checkin', 'rules'));
    log('checkin', `Check-in sent to ${crew.name}: ${due.map((w) => w.name).join(', ')}`, 'rules');
  }
}

/** A worker replied from their phone. "1" = OK, "2" = unwell, anything else goes to the agent. */
export async function handleReply(workerId, raw) {
  const w = findWorker(workerId);
  if (!w) throw new Error('Unknown worker');
  const text = String(raw ?? '').trim().slice(0, 500);
  if (!text) throw new Error('Empty reply');
  recordReply(w, text);

  if (text === '1') {
    const wasOverdue = w.status === 'overdue';
    if (w.status === 'awaiting' || wasOverdue) {
      w.status = 'ok';
      w.pending = null;
      w.lastCheckinAt = Date.now();
      sendToWorker(w, 'checkin_thanks', 'rules');
      log('checkin', `${w.name} checked in OK.`, 'rules');
      if (wasOverdue) escalate(w, 'info', 'Worker has now replied OK to the missed check-in.', 'rules');
    }
    return;
  }
  if (text === '2') {
    markUnwell(w);
    queueEvent({ type: 'worker_unwell', worker_id: w.id, worker: w.name, reply: text });
  } else if (claudeAvailable()) {
    queueEvent({ type: 'worker_message', worker_id: w.id, worker: w.name, language: w.lang, status: w.status, message: text });
  } else {
    // Without the agent we can't interpret free text, so a human looks at it.
    escalate(w, 'info', `Unrecognised reply: "${text}". Please check with the worker.`, 'rules');
  }
  tick().catch((err) => log('system', `Tick failed: ${err.message}`));
}

/** Supervisor confirms a worker has been looked after. */
export function resolveWorker(workerId) {
  const w = findWorker(workerId);
  if (!w) throw new Error('Unknown worker');
  w.status = 'ok';
  w.pending = null;
  w.unwell = null;
  w.lastCheckinAt = Date.now();
  log('system', `Supervisor marked ${w.name} as checked and OK.`, 'supervisor');
}
