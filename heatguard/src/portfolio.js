// Multi-site portfolio for the command centre.
//
// Site 1 is the live, fully interactive demo site (store.js / monitor.js). The other sites
// are a demo portfolio: their heat risk is computed with the same model from their own
// location and microclimate, but their day-to-day operations (check-ins, incidents) are
// simulated so the command centre has something realistic to show. A pilot would run the
// full engine per site instead.

import { state, allWorkers } from './store.js';
import { estimateWbgt, riskLevel, floorPlan, LEVELS } from './heat.js';
import { getConditions, SCENARIOS } from './weather.js';
import { records } from './records.js';
import { buildReport } from './report.js';

const LIVE_ID = 'site-1';

// Microclimate offsets are relative to inland Dubai: coasts are more humid, inland is hotter and drier.
const DEMO_SITES = [
  {
    id: 'site-2', name: 'Logistics Warehouse', area: 'Dubai South', lat: 24.9, lon: 55.16,
    climate: { tempC: 1.5, rh: -8, windMs: 0 }, responsiveness: 0.95,
    crews: [['Steel erection', 'heavy', 12], ['Paving', 'moderate', 8], ['Yard logistics', 'light', 6]],
  },
  {
    id: 'site-3', name: 'Residential Tower B', area: 'Dubai Creek', lat: 25.2, lon: 55.35,
    climate: { tempC: -1, rh: 12, windMs: 0.5 }, responsiveness: 0.93,
    crews: [['Formwork', 'heavy', 14], ['Facade', 'moderate', 10], ['MEP rough-in', 'light', 9]],
  },
  {
    id: 'site-4', name: 'Port Yard 3', area: 'Jebel Ali', lat: 25.01, lon: 55.06,
    climate: { tempC: -0.5, rh: 10, windMs: 1.5 }, responsiveness: 0.9,
    crews: [['Crane & rigging', 'moderate', 8], ['Container handling', 'heavy', 10], ['Gate & security', 'light', 4]],
  },
  {
    id: 'site-5', name: 'Cultural District Villas', area: 'Abu Dhabi', lat: 24.54, lon: 54.43,
    climate: { tempC: -0.5, rh: 8, windMs: 0.5 }, responsiveness: 0.96,
    crews: [['Blockwork', 'heavy', 10], ['Landscaping', 'moderate', 7], ['Finishing', 'light', 8]],
  },
  {
    id: 'site-6', name: 'Community Infrastructure', area: 'Sharjah', lat: 25.3, lon: 55.46,
    climate: { tempC: 0.5, rh: 2, windMs: 0 }, responsiveness: 0.8,
    crews: [['Trenching & utilities', 'heavy', 11], ['Road base', 'heavy', 9], ['Survey', 'light', 3]],
  },
  {
    id: 'site-7', name: 'Highway Package 2', area: 'Al Ain', lat: 24.21, lon: 55.74,
    climate: { tempC: 3, rh: -15, windMs: -0.5 }, responsiveness: 0.94,
    crews: [['Asphalt', 'heavy', 12], ['Barriers & signs', 'moderate', 6], ['Traffic control', 'light', 5]],
  },
  {
    id: 'site-8', name: 'Beach Resort', area: 'Ras Al Khaimah', lat: 25.79, lon: 55.94,
    climate: { tempC: -1, rh: 10, windMs: 1 }, responsiveness: 0.97,
    crews: [['Structure', 'heavy', 9], ['Pool & hardscape', 'moderate', 7], ['Interiors', 'light', 10]],
  },
];

// Heat-illness reports per worker per site hour, by risk level (simulation only).
const INCIDENT_RATE = [0, 0, 0.002, 0.006, 0.012];
const INCIDENT_RESOLVE_MIN = 20;
const MAX_ALERTS = 200;

export const portfolio = { sites: [], alerts: [], lastTick: null };

let rand = mulberry32(42);

export function resetPortfolio(seed = 42) {
  rand = mulberry32(seed);
  portfolio.lastTick = null;
  portfolio.alerts = [];
  portfolio.sites = DEMO_SITES.map((s) => ({
    ...s,
    live: false,
    conditions: null,
    crews: s.crews.map(([name, intensity, workers]) => ({ name, intensity, workers, wbgt: null, level: 0 })),
    ops: { checkinsDue: 0, checkinsSent: 0, checkinsAnswered: 0, incidents: [], nextIncidentId: 1 },
  }));
}

/** Advance the demo portfolio: weather and risk for every site, simulated operations for demo sites. */
export async function tickPortfolio(now = Date.now()) {
  const scale = state.settings.timeScale;
  const dtMin = portfolio.lastTick ? ((now - portfolio.lastTick) * scale) / 60000 : 0;
  portfolio.lastTick = now;

  for (const site of portfolio.sites) {
    site.conditions = await siteConditions(site, state.settings.scenario, now);
    for (const crew of site.crews) {
      crew.wbgt = estimateWbgt({ ...site.conditions });
      crew.level = riskLevel(crew.wbgt, crew.intensity);
    }
    simulateOps(site, dtMin, now);
  }
}

async function siteConditions(site, scenario, now) {
  const base = await getConditions(site, scenario, new Date(now));
  // Live readings are already local; scenarios and offline fallbacks get the site's microclimate.
  if (base.source.startsWith('Open-Meteo')) return base;
  const { tempC, rh, windMs } = site.climate;
  return {
    ...base,
    tempC: Math.round((base.tempC + tempC) * 10) / 10,
    rh: Math.max(5, Math.min(95, base.rh + rh)),
    windMs: Math.max(0.5, base.windMs + windMs),
    source: `${base.source} + local microclimate`,
  };
}

function simulateOps(site, dtMin, now) {
  if (dtMin <= 0) return;
  const ops = site.ops;
  for (const crew of site.crews) {
    const every = floorPlan(crew.level).checkin;
    if (every) {
      ops.checkinsDue += (crew.workers * dtMin) / every;
      const whole = Math.floor(ops.checkinsDue);
      ops.checkinsDue -= whole;
      ops.checkinsSent += whole;
      const p = Math.max(0.5, site.responsiveness - 0.02 * crew.level);
      for (let i = 0; i < whole; i++) if (rand() < p) ops.checkinsAnswered++;
    }
    const expected = INCIDENT_RATE[crew.level] * crew.workers * (dtMin / 60);
    if (expected > 0 && rand() < expected) {
      const inc = { id: ops.nextIncidentId++, crew: crew.name, at: now, resolveAt: now + (INCIDENT_RESOLVE_MIN * 60000) / state.settings.timeScale };
      ops.incidents.push(inc);
      alert(site, 'critical', `${crew.name}: worker reports feeling unwell (${LEVELS[crew.level]} heat). Supervisor alerted, first-aid guidance sent.`, now);
    }
  }
  for (const inc of ops.incidents) {
    if (!inc.resolvedAt && now >= inc.resolveAt) {
      inc.resolvedAt = now;
      alert(site, 'info', `${inc.crew}: unwell worker checked by supervisor and resting.`, now);
    }
  }
}

function alert(site, severity, text, t = Date.now()) {
  portfolio.alerts.unshift({ t, siteId: site.id, site: `${site.name} · ${site.area}`, severity, text, simulated: true });
  portfolio.alerts.length = Math.min(portfolio.alerts.length, MAX_ALERTS);
}

/** Everything the command centre needs, with the live site built from the real engine. */
export function portfolioSnapshot() {
  const live = liveSiteSummary();
  const demo = portfolio.sites.map(demoSiteSummary);
  const sites = [live, ...demo];
  const workers = sites.reduce((a, s) => a + s.workers, 0);
  const sent = sites.reduce((a, s) => a + s.checkinsSent, 0);
  const answered = sites.reduce((a, s) => a + s.checkinsAnswered, 0);

  const liveAlerts = state.messages
    .filter((m) => m.to === 'supervisor' && m.severity !== 'info')
    .slice(0, 50)
    .map((m) => ({ t: m.t, siteId: LIVE_ID, site: `${live.name} · ${live.area}`, severity: m.severity, text: `${m.aboutName ? m.aboutName + ': ' : ''}${m.text}`, simulated: false }));
  const alerts = [...liveAlerts, ...portfolio.alerts].sort((a, b) => b.t - a.t).slice(0, 60);

  return {
    scenario: state.settings.scenario,
    scenarioLabel: SCENARIOS[state.settings.scenario]?.label ?? 'Live weather',
    timeScale: state.settings.timeScale,
    kpis: {
      sites: sites.length,
      workers,
      workersAtDanger: sites.reduce((a, s) => a + s.workersAtDanger, 0),
      openIncidents: sites.reduce((a, s) => a + s.openIncidents, 0),
      checkinRate: sent ? Math.round((answered / sent) * 100) : null,
      sitesCompliant: sites.filter((s) => s.compliance === 'Compliant').length,
      worstLevel: Math.max(...sites.map((s) => s.level)),
    },
    sites,
    alerts,
  };
}

function liveSiteSummary() {
  const c = state.conditions;
  const workers = allWorkers();
  const level = Math.max(0, ...state.crews.map((cr) => cr.assessedLevel));
  const report = buildReport();
  return {
    id: LIVE_ID,
    name: 'Mixed-use Block 4',
    area: 'Al Quoz, Dubai',
    lat: state.site.lat,
    lon: state.site.lon,
    live: true,
    conditions: c,
    peakWbgt: Math.max(0, ...state.crews.map((cr) => cr.wbgt ?? 0)),
    level,
    workers: workers.length,
    workersAtDanger: state.crews.filter((cr) => cr.assessedLevel >= 3).reduce((a, cr) => a + cr.workers.length, 0),
    openIncidents: workers.filter((w) => w.status === 'unwell').length,
    overdue: workers.filter((w) => w.status === 'overdue').length,
    checkinsSent: records.checkins.length,
    checkinsAnswered: records.checkins.filter((x) => x.answeredAt).length,
    checkinRate: rate(records.checkins.filter((x) => x.answeredAt).length, records.checkins.length),
    compliance: report.status,
    crews: state.crews.map((cr) => ({
      name: cr.name, intensity: cr.intensity, workers: cr.workers.length, wbgt: cr.wbgt, level: cr.assessedLevel, planLevel: cr.plan.level,
    })),
  };
}

function demoSiteSummary(site) {
  const ops = site.ops;
  const openIncidents = ops.incidents.filter((i) => !i.resolvedAt).length;
  const checkinRate = rate(ops.checkinsAnswered, ops.checkinsSent);
  return {
    id: site.id,
    name: site.name,
    area: site.area,
    lat: site.lat,
    lon: site.lon,
    live: false,
    conditions: site.conditions,
    peakWbgt: Math.max(0, ...site.crews.map((c) => c.wbgt ?? 0)),
    level: Math.max(0, ...site.crews.map((c) => c.level)),
    workers: site.crews.reduce((a, c) => a + c.workers, 0),
    workersAtDanger: site.crews.filter((c) => c.level >= 3).reduce((a, c) => a + c.workers, 0),
    openIncidents,
    overdue: 0,
    checkinsSent: ops.checkinsSent,
    checkinsAnswered: ops.checkinsAnswered,
    checkinRate,
    // Simulated sites: the system escalates automatically, so attention comes from open
    // incidents or crews that are slow to answer check-ins.
    compliance: openIncidents || (checkinRate !== null && ops.checkinsSent >= 20 && checkinRate < 85) ? 'Attention needed' : 'Compliant',
    crews: site.crews.map((c) => ({ name: c.name, intensity: c.intensity, workers: c.workers, wbgt: c.wbgt, level: c.level, planLevel: c.level })),
  };
}

const rate = (a, b) => (b ? Math.round((a / b) * 100) : null);

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

resetPortfolio();
