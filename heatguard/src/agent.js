// The reasoning layer. When something happens on site (risk changes, a missed check-in,
// a worker reports feeling unwell or sends a free-text message), Claude looks at the
// situation through tools and decides what to do. The rules engine in monitor.js then
// checks the result against a fixed safety floor, so a model mistake or outage can only
// ever make the response stricter than the rules, never weaker.

import { claudeAvailable, runToolLoop } from './claude.js';
import { state, findCrew, findWorker, sendToWorker, escalate, markUnwell, log } from './store.js';
import { floorPlan, isAtLeastAsStrict, isMiddayBreak, LEVELS } from './heat.js';
import { TEMPLATES } from './i18n.js';
import { recordPlan } from './records.js';

export { claudeAvailable };

const SYSTEM = `You are HeatGuard, a safety agent protecting outdoor workers on a construction site in Dubai from heat stress.

You are called when something changes on site. Inspect the situation with get_site_status, then act with your tools:
- set_crew_plan: set a crew's hydration and work/rest schedule. It can never be less strict than the floor plan shown for that crew's risk level; you may make it stricter when there is a reason (for example a worker in that crew reported feeling unwell, or heavy work in direct sun near a level threshold).
- send_worker_message: send a pre-translated message to workers in their own language. After changing a crew's plan, send that crew "risk_update" so they know the new schedule.
- escalate_to_supervisor: tell the site supervisor, in English, what is happening and what they should do. Escalate every missed check-in and every worker who feels unwell. Use "critical" when a worker may be suffering heat illness (unwell, confused, dizzy, vomiting, stopped sweating, collapsed, or not answering during Danger/Extreme heat).

Workers write short replies, often in their own language or broken English. Interpret them generously and err on the side of safety: anything that might mean feeling ill is treated as feeling ill. When a worker feels unwell, send them "first_aid_coming" and escalate as critical.

Be decisive and efficient: act on every event, avoid duplicate messages, and don't re-send a risk_update to workers who already have the current level. When you're done, reply with a one or two sentence summary of what you decided and why, for the supervisor's log.`;

const tools = [
  {
    name: 'get_site_status',
    description: 'Current weather, estimated WBGT, UAE midday-break status, and every crew with its assessed risk level, floor plan, current plan and workers (status, minutes since last OK check-in, last risk level they were told).',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'set_crew_plan',
    description: "Set a crew's protective plan. Rejected if it is less strict than the floor plan for the crew's assessed risk level. Minutes are site minutes.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        crew_id: { type: 'string' },
        level: { type: 'integer', description: '0 Normal, 1 Caution, 2 High, 3 Danger, 4 Extreme (stop heavy work)' },
        water_minutes: { type: 'integer', description: 'Drink water at least every N minutes' },
        work_minutes: { type: 'integer', description: 'Work period before each rest (0 = no heavy outdoor work)' },
        rest_minutes: { type: 'integer', description: 'Shade rest per cycle' },
        reason: { type: 'string', description: 'Short reason for the supervisor log' },
      },
      required: ['crew_id', 'level', 'water_minutes', 'work_minutes', 'rest_minutes', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_worker_message',
    description: `Send a pre-translated message to workers in their own language (with voice). Templates: risk_update (current level + schedule of their crew), take_break, hydrate, stop_work, midday_break, checkin (asks them to reply 1 OK / 2 unwell), checkin_thanks, first_aid_coming.`,
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        worker_ids: { type: 'array', items: { type: 'string' } },
        template: { type: 'string', enum: TEMPLATES },
      },
      required: ['worker_ids', 'template'],
      additionalProperties: false,
    },
  },
  {
    name: 'escalate_to_supervisor',
    description: 'Alert the site supervisor (English). Use worker_id "" for site-wide alerts.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        worker_id: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'high', 'critical'] },
        message: { type: 'string', description: 'What is happening and what the supervisor should do now' },
      },
      required: ['worker_id', 'severity', 'message'],
      additionalProperties: false,
    },
  },
];

export function siteStatus() {
  const now = Date.now();
  const scale = state.settings.timeScale;
  return {
    site: state.site.name,
    conditions: state.conditions,
    midday_break_active: isMiddayBreak(),
    crews: state.crews.map((c) => ({
      id: c.id,
      name: c.name,
      work_intensity: c.intensity,
      wbgt_c: c.wbgt,
      assessed_level: `${c.assessedLevel} ${LEVELS[c.assessedLevel]}`,
      floor_plan: floorPlan(c.assessedLevel),
      current_plan: c.plan,
      workers: c.workers.map((w) => ({
        id: w.id,
        name: w.name,
        language: w.lang,
        status: w.status,
        minutes_since_ok_checkin: Math.round(((now - w.lastCheckinAt) * scale) / 60000),
        told_level: w.notifiedLevel,
      })),
    })),
  };
}

export function runTool(name, input, handled) {
  switch (name) {
    case 'get_site_status':
      return siteStatus();
    case 'set_crew_plan': {
      const crew = findCrew(input.crew_id);
      if (!crew) throw new Error(`No crew ${input.crew_id}`);
      const plan = {
        level: input.level, water: input.water_minutes, work: input.work_minutes, rest: input.rest_minutes,
        checkin: floorPlan(input.level).checkin,
      };
      if (!isAtLeastAsStrict(plan, crew.assessedLevel)) {
        throw new Error(`Plan is less strict than the floor for level ${crew.assessedLevel}: ${JSON.stringify(floorPlan(crew.assessedLevel))}`);
      }
      crew.plan = { ...plan, source: 'claude', reason: input.reason };
      recordPlan(crew.id, crew.plan);
      handled.crews.add(crew.id);
      log('plan', `${crew.name}: ${LEVELS[plan.level]} — water every ${plan.water} min, work ${plan.work}/rest ${plan.rest}. ${input.reason}`, 'claude');
      return { ok: true, plan: crew.plan };
    }
    case 'send_worker_message': {
      const sent = [];
      for (const id of input.worker_ids) {
        const w = findWorker(id);
        if (!w) throw new Error(`No worker ${id}`);
        sendToWorker(w, input.template, 'claude');
        sent.push(w.name);
      }
      log('alert', `Sent "${input.template}" to ${sent.join(', ')}`, 'claude');
      return { ok: true, sent: sent.length };
    }
    case 'escalate_to_supervisor': {
      const w = input.worker_id ? findWorker(input.worker_id) : null;
      if (input.worker_id && !w) throw new Error(`No worker ${input.worker_id}`);
      // A critical alert about a worker means possible heat illness: track them as unwell so
      // the dashboard shows it and the safety floor makes sure first-aid guidance goes out.
      if (w && input.severity === 'critical' && !w.unwell) markUnwell(w, `agent: ${input.message}`);
      escalate(w, input.severity, input.message, 'claude');
      return { ok: true };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

/**
 * Let Claude handle a batch of site events. Returns the set of crews whose plan it set,
 * so the safety floor knows which risk changes were already handled.
 */
export async function runClaude(events) {
  const handled = { crews: new Set() };
  const summary = await runToolLoop({
    system: SYSTEM,
    tools,
    prompt: `New site events (site time scale ${state.settings.timeScale}x):\n${JSON.stringify(events, null, 2)}`,
    runTool: (name, input) => runTool(name, input, handled),
  });
  if (summary === null) log('agent', 'Stopped after too many steps; safety floor will complete any missing actions.', 'claude');
  else if (summary) log('agent', summary, 'claude');
  return handled;
}
