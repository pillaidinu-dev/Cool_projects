// Daily heat-safety compliance report, built from the evidence in records.js.
// buildReport() returns the data (also served as JSON); renderReportHtml() makes the
// printable page. Every check is deterministic and shows the evidence behind it.

import { records } from './records.js';
import { state, allWorkers, findWorker, findCrew } from './store.js';
import { LEVELS } from './heat.js';
import { LANGUAGES } from './i18n.js';

const NOTIFY_LIMIT_MIN = 5; // workers must know about a risk change within 5 site minutes
const ESCALATE_LIMIT_MIN = 2; // unwell reports must reach the supervisor within 2 site minutes
const SAMPLE_GAP_LIMIT_MIN = 15; // heat must be re-assessed at least every 15 site minutes

const PASS = 'pass', FAIL = 'fail', ATTN = 'attention', NA = 'n/a';
const r1 = (x) => Math.round(x * 10) / 10;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function buildReport(now = Date.now()) {
  const samples = records.samples;
  const workerMsgs = state.messages.filter((m) => m.direction === 'out' && m.to && m.to !== 'supervisor');
  const scale = state.settings.timeScale;

  // Site-time duration of each sample = gap to the next sample (or to now), in site minutes.
  const spans = samples.map((s, i) => (((samples[i + 1]?.t ?? now) - s.t) * s.scale) / 60000);
  const siteMinutes = spans.reduce((a, b) => a + b, 0);

  const crewExposure = state.crews.map((c, ci) => {
    const minutesAt = [0, 0, 0, 0, 0];
    samples.forEach((s, i) => { minutesAt[s.crews[ci].level] += spans[i]; });
    return {
      id: c.id, name: c.name, workers: c.workers.length, intensity: c.intensity,
      peakWbgt: Math.max(0, ...samples.map((s) => s.crews[ci].wbgt ?? 0)),
      peakLevel: Math.max(0, ...samples.map((s) => s.crews[ci].level)),
      hoursAt: minutesAt.map((m) => r1(m / 60)),
      dangerHours: r1((minutesAt[3] + minutesAt[4]) / 60),
    };
  });

  const checkins = records.checkins;
  const answered = checkins.filter((c) => c.answeredAt);
  const missed = checkins.filter((c) => c.missedAt);
  const incidents = records.incidents;

  // ---- Controls ----
  const controls = [];
  const add = (id, title, status, evidence) => controls.push({ id, title, status, evidence });

  const maxGap = samples.length > 1
    ? Math.max(...samples.slice(1).map((s, i) => ((s.t - samples[i].t) * s.scale) / 60000))
    : 0;
  add('monitoring', 'Heat risk assessed continuously', !samples.length ? FAIL : maxGap <= SAMPLE_GAP_LIMIT_MIN ? PASS : FAIL,
    samples.length
      ? `${samples.length} assessments over ${r1(siteMinutes / 60)} site hours; longest gap ${r1(maxGap)} min (limit ${SAMPLE_GAP_LIMIT_MIN}).`
      : 'No heat assessments recorded.');

  const changes = records.riskChanges;
  const openRecent = changes.filter((c) => !c.notifiedAt && ((now - c.t) * scale) / 60000 <= NOTIFY_LIMIT_MIN);
  const late = changes.filter((c) => (c.notifiedAt && c.delayMin > NOTIFY_LIMIT_MIN) || (!c.notifiedAt && !openRecent.includes(c)));
  add('inform', 'Workers told about every change in heat risk', late.length ? FAIL : openRecent.length ? ATTN : PASS,
    `${changes.length} risk changes; ${changes.length - late.length - openRecent.length} fully communicated within ${NOTIFY_LIMIT_MIN} min` +
    (late.length ? `; ${late.length} late or not communicated` : '') + (openRecent.length ? `; ${openRecent.length} in progress` : '') +
    (changes.some((c) => c.delayMin !== null) ? `; slowest ${Math.max(...changes.filter((c) => c.delayMin !== null).map((c) => c.delayMin))} min.` : '.'));

  const belowFloor = samples.reduce((n, s) => n + s.crews.filter((c) => c.planLevel < c.level).length, 0);
  add('floor', 'Protective plan never below the safety floor', belowFloor ? FAIL : PASS,
    belowFloor ? `${belowFloor} assessments found a crew plan below its risk level.` : `Every assessment found each crew's plan at or above its risk level (${records.plans.length} plan changes).`);

  const missedNotEscalated = missed.filter((c) => !c.escalatedAt);
  add('missed', 'Every missed check-in escalated to the supervisor', missedNotEscalated.length ? FAIL : missed.length ? PASS : NA,
    missed.length ? `${missed.length - missedNotEscalated.length} of ${missed.length} missed check-ins escalated.` : 'No missed check-ins.');

  const slow = incidents.filter((i) => !i.escalatedAt || i.escalateMin > ESCALATE_LIMIT_MIN || !i.firstAidAt);
  add('unwell', 'Unwell workers escalated and given first-aid guidance', slow.length ? FAIL : incidents.length ? PASS : NA,
    incidents.length
      ? `${incidents.length - slow.length} of ${incidents.length} reports escalated within ${ESCALATE_LIMIT_MIN} min with first-aid guidance sent.`
      : 'No workers reported feeling unwell.');

  const open = incidents.filter((i) => !i.resolvedAt);
  add('closed', 'Every incident checked and closed by the supervisor', open.length ? ATTN : incidents.length ? PASS : NA,
    incidents.length ? `${incidents.length - open.length} of ${incidents.length} closed${open.length ? `; open: ${open.map((i) => findWorker(i.workerId)?.name).join(', ')}` : ''}.` : 'No incidents.');

  const middaySamples = samples.filter((s) => s.midday);
  add('midday', 'UAE midday break observed (12:30–15:00, 15 Jun–15 Sep)',
    !middaySamples.length ? NA : records.middayNotices.length ? PASS : FAIL,
    !middaySamples.length ? 'Not in effect during this period.' : records.middayNotices.length ? `All workers told to stop outdoor work at ${clock(records.middayNotices[0].t)}.` : 'Midday break was in effect but workers were not told.');

  const wrongLang = workerMsgs.filter((m) => m.lang !== findWorker(m.to)?.lang);
  const langs = [...new Set(workerMsgs.map((m) => m.lang))];
  add('language', "Instructions given in each worker's own language", wrongLang.length ? FAIL : workerMsgs.length ? PASS : NA,
    `${workerMsgs.length} messages in ${langs.length} languages (${langs.map((l) => LANGUAGES[l].name).join(', ') || 'none'}); ${wrongLang.length} in the wrong language.`);

  const pub = records.published.at(-1);
  add('plan', "Tomorrow's heat-aware schedule shared with crews", pub ? PASS : ATTN,
    pub ? `Schedule for ${pub.date} sent to ${pub.workers} workers at ${clock(pub.t)}.` : 'Not yet sent. Use Plan tomorrow → Send schedule to crews.');

  const status = controls.some((c) => c.status === FAIL) ? 'Non-compliant' : controls.some((c) => c.status === ATTN) ? 'Attention needed' : 'Compliant';

  return {
    id: `HG-${new Date(now + 4 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}`,
    site: state.site,
    generatedAt: now,
    periodStart: records.startedAt,
    siteHours: r1(siteMinutes / 60),
    timeScale: scale,
    agentMode: state.agent.mode ?? 'rules',
    status,
    controls,
    kpis: {
      peakTempC: samples.length ? Math.max(...samples.map((s) => s.tempC)) : null,
      peakWbgt: Math.max(0, ...crewExposure.map((c) => c.peakWbgt)),
      riskChanges: changes.length,
      messagesToWorkers: workerMsgs.length,
      languages: langs.length,
      checkinsSent: checkins.length,
      checkinsAnswered: answered.length,
      checkinsMissed: missed.length,
      medianResponseMin: median(answered.map((c) => c.responseMin)),
      incidents: incidents.length,
      medianEscalateMin: median(incidents.filter((i) => i.escalateMin !== null).map((i) => i.escalateMin)),
      dangerWorkerHours: r1(crewExposure.reduce((a, c) => a + c.dangerHours * c.workers, 0)),
    },
    crews: crewExposure,
    timeline: samples.map((s, i) => ({ t: s.t, minutes: spans[i], levels: s.crews.map((c) => c.level) })),
    incidents: incidents.map((i) => ({ ...i, worker: findWorker(i.workerId)?.name, crew: findCrew(i.crewId)?.name })),
    missedCheckins: missed.map((c) => ({ ...c, worker: findWorker(c.workerId)?.name, crew: findCrew(c.crewId)?.name })),
    workers: allWorkers().map((w) => {
      const mine = checkins.filter((c) => c.workerId === w.id);
      return {
        name: w.name, crew: findCrew(w.crewId).name, language: LANGUAGES[w.lang].name,
        messages: workerMsgs.filter((m) => m.to === w.id).length,
        checkinsSent: mine.length,
        answered: mine.filter((c) => c.answeredAt).length,
        missed: mine.filter((c) => c.missedAt).length,
        incidents: incidents.filter((i) => i.workerId === w.id).length,
      };
    }),
    trail: [...state.events].reverse(),
  };
}

const clock = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const day = (t) => new Date(t).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtMin = (m) => (m === null || m === undefined ? '—' : `${m} min`);
const BADGE = { pass: '✓ Pass', fail: '✗ Fail', attention: '! Attention', 'n/a': '– N/A' };

export function renderReportHtml(r) {
  const k = r.kpis;
  const statusClass = r.status === 'Compliant' ? 'pass' : r.status === 'Non-compliant' ? 'fail' : 'attention';
  const total = r.timeline.reduce((a, s) => a + s.minutes, 0) || 1;

  const timelineRows = r.crews.map((c, ci) => {
    let x = 0;
    const rects = r.timeline.map((s) => {
      const w = (s.minutes / total) * 100;
      const rect = `<rect x="${x}%" y="0" width="${w + 0.05}%" height="18" class="l${s.levels[ci]}"><title>${clock(s.t)} · ${LEVELS[s.levels[ci]]}</title></rect>`;
      x += w;
      return rect;
    }).join('');
    return `<div class="tl-row"><div class="tl-label">${esc(c.name)}</div><svg class="tl" preserveAspectRatio="none" role="img" aria-label="Heat risk over time for ${esc(c.name)}">${rects}</svg></div>`;
  }).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Compliance Report ${esc(r.id)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E☀%3C/text%3E%3C/svg%3E">
<style>
:root { --bg:#fff; --ink:#1d1b16; --muted:#6b665c; --line:#e4dfd4; --panel:#faf8f4;
  --l0:#2f9e44; --l1:#f08c00; --l2:#e8590c; --l3:#c92a2a; --l4:#862e9c; --pass:#2b8a3e; --fail:#c92a2a; --attn:#e67700; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#15140f; --ink:#f1ede4; --muted:#a39d90; --line:#34312a; --panel:#1f1d17; } }
@media print { :root { --bg:#fff; --ink:#000; --muted:#555; --line:#ccc; --panel:#fff; } .noprint { display:none !important; } details { display:block; } details > * { display:block; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0; } h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
.muted { color: var(--muted); }
.top { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:flex-start; }
.status { font-size: 18px; font-weight: 700; padding: 6px 14px; border-radius: 8px; color:#fff; }
.status.pass { background: var(--pass); } .status.fail { background: var(--fail); } .status.attention { background: var(--attn); }
.bar { display:flex; gap:8px; margin-bottom: 16px; }
.bar a, .bar button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; text-decoration: none; }
.kpis { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.kpi { border:1px solid var(--line); border-radius:8px; padding:8px 10px; background: var(--panel); }
.kpi .v { font-size: 18px; font-weight: 700; } .kpi .k { font-size: 11px; color: var(--muted); }
table { width:100%; border-collapse: collapse; } th, td { text-align:left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; }
.wrap { overflow-x: auto; }
.badge { font-weight: 700; white-space: nowrap; } .badge.pass { color: var(--pass); } .badge.fail { color: var(--fail); } .badge.attention { color: var(--attn); } .badge.n\\/a { color: var(--muted); }
.tl-row { display:grid; grid-template-columns: 150px 1fr; gap: 8px; align-items:center; margin: 4px 0; }
.tl { width:100%; height:18px; border-radius: 4px; display:block; }
.l0 { fill: var(--l0); } .l1 { fill: var(--l1); } .l2 { fill: var(--l2); } .l3 { fill: var(--l3); } .l4 { fill: var(--l4); }
.legend { display:flex; flex-wrap:wrap; gap: 12px; font-size: 12px; color: var(--muted); margin-top: 6px; }
.legend i { display:inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.sign { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-top: 32px; }
.sign div { border-top: 1px solid var(--ink); padding-top: 4px; font-size: 12px; color: var(--muted); }
details summary { cursor: pointer; color: var(--muted); margin: 8px 0; }
.trail td { font-size: 12px; }
@media (max-width: 600px) { .tl-row { grid-template-columns: 90px 1fr; } }
</style></head>
<body><main>
  <div class="bar noprint"><a href="/">← Dashboard</a><button onclick="window.print()">Print / Save as PDF</button><a href="/api/report">Download data (JSON)</a></div>
  <div class="top">
    <div>
      <h1>Daily heat-safety compliance report</h1>
      <div class="muted">${esc(r.site.name)} · Supervisor: ${esc(r.site.supervisor)}</div>
      <div class="muted">${day(r.generatedAt)} · Period ${clock(r.periodStart)}–${clock(r.generatedAt)} (Dubai time) · Report ${esc(r.id)}</div>
    </div>
    <div class="status ${statusClass}">${esc(r.status)}</div>
  </div>
  ${r.timeScale !== 1 ? `<p class="muted">Demo mode: the site clock runs ${r.timeScale}× real time. Durations are shown in site time (${r.siteHours} site hours covered).</p>` : ''}

  <h2>Summary</h2>
  <div class="kpis">
    <div class="kpi"><div class="v">${k.peakTempC ?? '—'}°C</div><div class="k">Peak air temperature</div></div>
    <div class="kpi"><div class="v">${k.peakWbgt}°C</div><div class="k">Peak est. WBGT</div></div>
    <div class="kpi"><div class="v">${k.dangerWorkerHours}</div><div class="k">Worker-hours at Danger+ risk</div></div>
    <div class="kpi"><div class="v">${k.messagesToWorkers}</div><div class="k">Instructions sent (${k.languages} languages)</div></div>
    <div class="kpi"><div class="v">${k.checkinsAnswered}/${k.checkinsSent}</div><div class="k">Check-ins answered · median ${fmtMin(k.medianResponseMin)}</div></div>
    <div class="kpi"><div class="v">${k.checkinsMissed}</div><div class="k">Missed check-ins</div></div>
    <div class="kpi"><div class="v">${k.incidents}</div><div class="k">Unwell reports · median escalation ${fmtMin(k.medianEscalateMin)}</div></div>
    <div class="kpi"><div class="v">${k.riskChanges}</div><div class="k">Risk-level changes</div></div>
  </div>

  <h2>Compliance checks</h2>
  <div class="wrap"><table>
    <thead><tr><th>Check</th><th>Result</th><th>Evidence</th></tr></thead>
    <tbody>${r.controls.map((c) => `<tr><td>${esc(c.title)}</td><td class="badge ${c.status}">${BADGE[c.status]}</td><td>${esc(c.evidence)}</td></tr>`).join('')}</tbody>
  </table></div>

  <h2>Heat exposure by crew</h2>
  ${r.timeline.length ? timelineRows : '<p class="muted">No data yet.</p>'}
  <div class="legend">${LEVELS.map((l, i) => `<span><i style="background:var(--l${i})"></i>${l}</span>`).join('')}</div>
  <div class="wrap"><table style="margin-top:8px">
    <thead><tr><th>Crew</th><th>Workers</th><th>Work</th><th>Peak WBGT</th><th>Peak risk</th><th>Hours at Danger+</th></tr></thead>
    <tbody>${r.crews.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.workers}</td><td>${c.intensity}</td><td>${c.peakWbgt}°C</td><td>${LEVELS[c.peakLevel]}</td><td>${c.dangerHours}</td></tr>`).join('')}</tbody>
  </table></div>

  <h2>Incidents</h2>
  ${r.incidents.length ? `<div class="wrap"><table>
    <thead><tr><th>Worker</th><th>Crew</th><th>Reported</th><th>How</th><th>Supervisor alerted</th><th>First-aid guidance</th><th>Closed</th></tr></thead>
    <tbody>${r.incidents.map((i) => `<tr><td>${esc(i.worker)}</td><td>${esc(i.crew)}</td><td>${clock(i.reportedAt)}</td><td>${esc(i.via)}</td>
      <td>${i.escalatedAt ? `${clock(i.escalatedAt)} (+${i.escalateMin} min)` : '<span class="badge fail">not alerted</span>'}</td>
      <td>${i.firstAidAt ? clock(i.firstAidAt) : '<span class="badge fail">not sent</span>'}</td>
      <td>${i.resolvedAt ? clock(i.resolvedAt) : '<span class="badge attention">open</span>'}</td></tr>`).join('')}</tbody>
  </table></div>` : '<p class="muted">No workers reported feeling unwell.</p>'}

  <h2>Missed check-ins</h2>
  ${r.missedCheckins.length ? `<div class="wrap"><table>
    <thead><tr><th>Worker</th><th>Crew</th><th>Check-in sent</th><th>Marked missed</th><th>Supervisor alerted</th><th>Worker replied</th></tr></thead>
    <tbody>${r.missedCheckins.map((c) => `<tr><td>${esc(c.worker)}</td><td>${esc(c.crew)}</td><td>${clock(c.sentAt)}</td><td>${clock(c.missedAt)}</td>
      <td>${c.escalatedAt ? clock(c.escalatedAt) : '<span class="badge fail">no</span>'}</td><td>${c.answeredAt ? `${clock(c.answeredAt)} (${c.responseMin} min)` : '—'}</td></tr>`).join('')}</tbody>
  </table></div>` : '<p class="muted">None.</p>'}

  <h2>Workers</h2>
  <div class="wrap"><table>
    <thead><tr><th>Name</th><th>Crew</th><th>Language</th><th>Instructions</th><th>Check-ins</th><th>Answered</th><th>Missed</th><th>Incidents</th></tr></thead>
    <tbody>${r.workers.map((w) => `<tr><td>${esc(w.name)}</td><td>${esc(w.crew)}</td><td>${esc(w.language)}</td><td>${w.messages}</td><td>${w.checkinsSent}</td><td>${w.answered}</td><td>${w.missed}</td><td>${w.incidents}</td></tr>`).join('')}</tbody>
  </table></div>

  <h2>Audit trail</h2>
  <details><summary>Show all ${r.trail.length} logged decisions and actions</summary>
    <div class="wrap"><table class="trail"><thead><tr><th>Time</th><th>By</th><th>Type</th><th>What happened</th></tr></thead>
    <tbody>${r.trail.map((e) => `<tr><td>${clock(e.t)}</td><td>${esc(e.source)}</td><td>${esc(e.type)}</td><td>${esc(e.text)}</td></tr>`).join('')}</tbody></table></div>
  </details>

  <p class="muted" style="margin-top:16px">Generated automatically by HeatGuard (${r.agentMode === 'claude' ? 'Claude agent + rules engine' : 'rules engine'}). Heat stress is estimated from weather data (WBGT); confirm with on-site measurements where required.</p>
  <div class="sign"><div>Site supervisor — name, signature, date</div><div>HSE officer — name, signature, date</div></div>
</main></body></html>`;
}
