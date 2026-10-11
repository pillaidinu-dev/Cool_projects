// In-memory state for one demo site. Fine for a prototype; swap for a database in a pilot.

import { render, LANGUAGES } from './i18n.js';
import { floorPlan } from './heat.js';
import { demoTasks } from './planner.js';

const MAX_LOG = 300;
let nextId = 1;

export const state = {};

export function reset() {
  Object.assign(state, {
    site: { id: 'site-1', name: 'Demo Site — Al Quoz Block 4', lat: 25.14, lon: 55.23, supervisor: 'Site Supervisor' },
    settings: { scenario: 'afternoon', timeScale: 20 }, // demo default: 1 real second = 20 site seconds
    conditions: null,
    crews: [
      crew('c1', 'Concrete crew', 'heavy', [
        ['Ramesh Kumar', 'hi'], ['Imran Ali', 'ur'], ['Suresh Nair', 'ml'], ['Rafiqul Islam', 'bn'],
      ]),
      crew('c2', 'Facade crew', 'moderate', [
        ['Joel Santos', 'tl'], ['Ahmed Saleh', 'ar'], ['Vijay Menon', 'ml'],
      ]),
      crew('c3', 'Landscaping crew', 'moderate', [['Mohammed Hossain', 'bn'], ['Arjun Singh', 'hi']]),
      crew('c4', 'Security team', 'light', [['Bilal Khan', 'ur'], ['Mark Reyes', 'tl']]),
    ],
    events: [],
    messages: [],
    middayNotifiedOn: null,
    planner: { forecastMode: 'heatwave', tasks: demoTasks(), result: null, running: false, error: null },
    agent: { mode: null, running: false, lastRunAt: null, lastError: null },
  });
}

function crew(id, name, intensity, people) {
  return {
    id, name, intensity,
    assessedLevel: 0,
    plan: { ...floorPlan(0), source: 'rules', reason: 'initial' },
    workers: people.map(([wname, lang], i) => ({
      id: `${id}-w${i + 1}`, name: wname, lang, crewId: id,
      status: 'ok', // ok | awaiting | overdue | unwell
      notifiedLevel: null,
      lastCheckinAt: Date.now(),
      pending: null, // { sentAt, escalated }
      unwell: null, // { at, escalated, firstAidSent }
    })),
  };
}

export const allWorkers = () => state.crews.flatMap((c) => c.workers);
export const findWorker = (id) => allWorkers().find((w) => w.id === id);
export const findCrew = (id) => state.crews.find((c) => c.id === id);

export function log(type, text, source = 'system') {
  state.events.unshift({ id: nextId++, t: Date.now(), type, text, source });
  state.events.length = Math.min(state.events.length, MAX_LOG);
}

/** Send a templated message to a worker. `params` fill extra placeholders (e.g. shift times). */
export function sendToWorker(worker, template, source, params = {}) {
  const crewPlan = findCrew(worker.crewId).plan;
  const text = render(template, worker.lang, { ...crewPlan, ...params });
  const msg = {
    id: nextId++, t: Date.now(), to: worker.id, toName: worker.name,
    lang: worker.lang, voice: LANGUAGES[worker.lang].voice, template, text, source, direction: 'out',
  };
  state.messages.unshift(msg);
  state.messages.length = Math.min(state.messages.length, MAX_LOG);
  if (template === 'risk_update') worker.notifiedLevel = crewPlan.level;
  if (template === 'checkin') {
    worker.pending = { sentAt: Date.now(), escalated: false };
    worker.status = 'awaiting';
  }
  if (template === 'first_aid_coming' && worker.unwell) worker.unwell.firstAidSent = true;
  return msg;
}

export function recordReply(worker, text) {
  state.messages.unshift({
    id: nextId++, t: Date.now(), from: worker.id, fromName: worker.name, lang: worker.lang, text, direction: 'in',
  });
}

export function markUnwell(w) {
  w.status = 'unwell';
  w.pending = null;
  w.unwell = { at: Date.now(), escalated: false, firstAidSent: false };
}

export function escalate(worker, severity, message, source) {
  const msg = {
    id: nextId++, t: Date.now(), to: 'supervisor', about: worker?.id, aboutName: worker?.name,
    severity, text: message, source, direction: 'out',
  };
  state.messages.unshift(msg);
  if (worker?.pending && worker.status === 'overdue') worker.pending.escalated = true;
  if (worker?.unwell) worker.unwell.escalated = true;
  log('escalation', `[${severity}] ${worker ? worker.name + ': ' : ''}${message}`, source);
  return msg;
}

/** Scale a duration given in site minutes into real milliseconds. */
export const minutes = (m) => (m * 60 * 1000) / state.settings.timeScale;

reset();
