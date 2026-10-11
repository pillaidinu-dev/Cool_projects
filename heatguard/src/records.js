// Evidence for the compliance report. The live system calls these as things happen;
// report.js turns them into the daily report. Durations are stored in *site* minutes
// (real time × demo time scale) so a 20× demo reads like a real day.

const MAX = 5000;
const SAMPLE_EVERY_SITE_MIN = 5; // at least one heat sample per 5 site minutes…
const SAMPLE_EVERY_MAX_MS = 15_000; // …and at least every 15 real seconds

export const records = {};

export function resetRecords() {
  Object.assign(records, {
    startedAt: Date.now(),
    samples: [], // { t, scale, tempC, rh, solarWm2, windMs, source, crews: [{ id, wbgt, level, planLevel }] }
    riskChanges: [], // { t, crewId, from, to, notified: [workerIds], notifiedAt, delayMin }
    checkins: [], // { id, workerId, crewId, sentAt, answeredAt, responseMin, missedAt, escalatedAt }
    incidents: [], // { id, workerId, crewId, reportedAt, via, escalatedAt, escalateMin, firstAidAt, resolvedAt }
    plans: [], // { t, crewId, level, source, reason }
    published: [], // { t, date, workers }
    middayNotices: [], // { t, workers }
  });
}

let nextId = 1;
const push = (list, item) => {
  list.push(item);
  if (list.length > MAX) list.shift();
  return item;
};
const siteMin = (ms, scale) => Math.round(((ms * scale) / 60000) * 10) / 10;

export function recordSample(sample, force = false) {
  const last = records.samples.at(-1);
  const changed = !last || last.crews.some((c, i) => c.level !== sample.crews[i]?.level || c.planLevel !== sample.crews[i]?.planLevel);
  const every = Math.min(SAMPLE_EVERY_MAX_MS, (SAMPLE_EVERY_SITE_MIN * 60000) / sample.scale);
  if (force || changed || sample.t - last.t >= every) push(records.samples, sample);
}

export function recordRiskChange(crewId, from, to) {
  push(records.riskChanges, { t: Date.now(), crewId, from, to, notified: [], notifiedAt: null, delayMin: null });
}

/** A worker was told their crew's level. Closes the latest open risk change once the whole crew knows. */
export function recordRiskNotice(workerId, crewId, crewSize, scale) {
  const rc = records.riskChanges.findLast((r) => r.crewId === crewId);
  if (!rc || rc.notifiedAt) return;
  if (!rc.notified.includes(workerId)) rc.notified.push(workerId);
  if (rc.notified.length >= crewSize) {
    rc.notifiedAt = Date.now();
    rc.delayMin = siteMin(rc.notifiedAt - rc.t, scale);
  }
}

export function recordCheckinSent(workerId, crewId) {
  return push(records.checkins, { id: nextId++, workerId, crewId, sentAt: Date.now(), answeredAt: null, responseMin: null, missedAt: null, escalatedAt: null }).id;
}

export function recordCheckinAnswered(id, scale) {
  const c = records.checkins.find((x) => x.id === id);
  if (!c || c.answeredAt) return;
  c.answeredAt = Date.now();
  c.responseMin = siteMin(c.answeredAt - c.sentAt, scale);
}

export function recordCheckinMissed(id) {
  const c = records.checkins.find((x) => x.id === id);
  if (c && !c.missedAt) c.missedAt = Date.now();
}

export function recordCheckinEscalated(id) {
  const c = records.checkins.find((x) => x.id === id);
  if (c && !c.escalatedAt) c.escalatedAt = Date.now();
}

export function recordIncident(workerId, crewId, via) {
  return push(records.incidents, { id: nextId++, workerId, crewId, reportedAt: Date.now(), via, escalatedAt: null, escalateMin: null, firstAidAt: null, resolvedAt: null }).id;
}

export function updateIncident(id, field, scale) {
  const i = records.incidents.find((x) => x.id === id);
  if (!i || i[field]) return;
  i[field] = Date.now();
  if (field === 'escalatedAt') i.escalateMin = siteMin(i.escalatedAt - i.reportedAt, scale);
}

export function recordPlan(crewId, plan) {
  push(records.plans, { t: Date.now(), crewId, level: plan.level, source: plan.source, reason: plan.reason });
}

export function recordMiddayNotice(workers) {
  push(records.middayNotices, { t: Date.now(), workers });
}

export function recordPublished(date, workers) {
  push(records.published, { t: Date.now(), date, workers });
}

resetRecords();
