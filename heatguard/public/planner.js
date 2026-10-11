// "Plan tomorrow" view: runs the Planner agent and compares its plan with the usual 07:00 start.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LEVELS = ['Normal', 'Caution', 'High', 'Danger', 'Extreme'];
  const START_H = 3, END_H = 24, SLOTS = (END_H - START_H) * 4;
  const toSlot = (t) => { const [h, m] = t.split(':').map(Number); return h * 4 + Math.round(m / 15); };

  let P = null;
  let lastRendered = null;

  async function load() {
    const res = await fetch('/api/planner');
    P = await res.json();
    render();
  }

  function render() {
    const sel = $('#plan-forecast');
    if (!sel.options.length) {
      sel.innerHTML = Object.entries(P.forecasts).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
      sel.value = P.forecastMode;
    }
    const run = $('#plan-run');
    run.disabled = P.running;
    run.innerHTML = P.running
      ? `<span class="spinner"></span>${P.agentMode === 'claude' ? 'Claude is planning…' : 'Planning…'}`
      : 'Plan tomorrow';
    $('#plan-publish').disabled = !P.result || P.running;
    $('#plan-publish').textContent = P.result?.published ? 'Schedule sent ✓' : 'Send schedule to crews';
    $('#plan-sub').textContent = P.agentMode === 'claude'
      ? 'The Claude Planner agent schedules tomorrow\'s work around tomorrow\'s heat. Every plan is checked against the safety rules.'
      : 'Rules-based planner (set ANTHROPIC_API_KEY to let the Claude Planner agent improve the plan and write the briefing).';

    const key = P.result ? P.result.generatedAt + String(P.result.published) : null;
    if (!P.result || key === lastRendered) return;
    lastRendered = key;
    const r = P.result;
    const u = r.usual.metrics, p = r.plan.metrics;

    $('#plan-body').innerHTML = `
      ${P.error ? `<p class="warn-list">Planner agent error: ${esc(P.error)} — showing the rules-based plan.</p>` : ''}
      <div class="tiles">
        ${tile('Time in Danger-level heat', u.danger_worker_hours, p.danger_worker_hours, 'worker-hours')}
        ${tile('Work stopped by extreme heat', u.stopped_worker_hours, p.stopped_worker_hours, 'worker-hours')}
        ${tile('Tasks not finished', u.tasks_unfinished.length, p.tasks_unfinished.length, '')}
        ${tile('Mandatory heat rest', u.rest_worker_hours, p.rest_worker_hours, 'worker-hours')}
        ${tile('Water needed', u.water_litres, p.water_litres, 'litres')}
        ${tile('Night work (needs lighting)', u.night_crew_hours, p.night_crew_hours, 'crew-hours', true)}
      </div>

      <div class="cols">
        <div class="card">
          <h3>Briefing for the supervisor <span class="src ${r.plan.source}">${r.plan.source === 'claude' ? 'Claude' : 'rules'}</span></h3>
          <p>${esc(r.plan.briefing)}</p>
          <p class="muted small" style="margin-top:6px">${esc(r.date)} · ${esc(r.forecastSource)}${r.summerRules ? ' · UAE midday break applies' : ''}</p>
        </div>
        <div class="card">
          <h3>Logistics</h3>
          <ul>${r.plan.logistics.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        </div>
      </div>

      ${gantt('The usual plan — everyone starts at 07:00', r.usual, r)}
      ${gantt('HeatGuard plan', r.plan, r)}
    `;
  }

  function tile(label, before, after, unit, costMetric = false) {
    const better = after < before, same = after === before;
    const color = same ? 'var(--muted)' : (better !== costMetric ? 'var(--l0)' : 'var(--l2)');
    const delta = same ? 'no change' : `${better ? '−' : '+'}${Math.round(Math.abs(before - after) * 10) / 10} ${unit}`;
    return `<div class="tile"><div class="k">${esc(label)}</div>
      <div class="v">${after} <span class="from">from ${before}</span></div>
      <div class="delta" style="color:${color}">${delta}</div></div>`;
  }

  function heatStrip(hourly) {
    return `<div class="heat-strip" title="Heat risk for heavy work in the sun">${hourly
      .filter((h) => h.hour >= START_H)
      .map((h) => `<span class="c${h.level_sun.heavy}" title="${String(h.hour).padStart(2, '0')}:00 · ${Math.round(h.temp_c)} °C · WBGT ${h.wbgt_sun} °C · ${LEVELS[h.level_sun.heavy]}">${Math.round(h.temp_c)}°</span>`)
      .join('')}</div>`;
  }

  function axis() {
    let out = '';
    for (let h = START_H; h <= END_H; h += 3) out += `<span style="left:${((h - START_H) / (END_H - START_H)) * 100}%">${String(h % 24).padStart(2, '0')}:00</span>`;
    return `<div class="g-axis">${out}</div>`;
  }

  function gantt(title, plan, r) {
    const rows = P.crews.map((crew) => {
      const runs = plan.runs.filter((x) => x.crew_id === crew.id);
      if (!runs.length) return '';
      return `<div class="g-crew">${esc(crew.name)} · ${crew.workers} workers</div>` + runs.map((run) => {
        const segs = run.segments.map((s) => {
          const left = ((toSlot(s.start) - START_H * 4) / SLOTS) * 100;
          const width = (s.levels.length / SLOTS) * 100;
          const tip = `${run.name}: ${s.start}–${s.end} · peak ${LEVELS[s.max_level]}${s.stopped_hours ? ` · ${s.stopped_hours} h stopped by heat` : ''}`;
          return `<div class="g-seg" style="left:${left}%;width:${width}%" title="${esc(tip)}">${s.levels.map((l) => `<span class="${l < 0 ? 'cs' : 'c' + l}"></span>`).join('')}</div>`;
        }).join('');
        const times = run.segments.map((s) => `${s.start}–${s.end}`).join(', ') || 'not finished';
        const unfinished = run.productive_hours !== null && plan.metrics.tasks_unfinished.includes(run.name);
        return `<div class="g-label" title="${esc(run.name)}">${esc(run.name)}<br><span class="muted">${run.fixed ? 'fixed · ' : ''}${esc(times)}${unfinished ? ' · <strong style="color:var(--l3)">not finished</strong>' : ''}</span></div>
          <div class="g-track">${segs}</div>`;
      }).join('');
    }).join('');

    return `<div class="gantt">
      <h3>${esc(title)} <span class="muted small">· finishes ${plan.metrics.latest_finish}</span></h3>
      <div class="g-grid">
        <div class="g-label muted">Heat (heavy work, sun)</div>${heatStrip(r.hourly)}
        <div></div>${axis()}
        ${rows}
      </div>
      <div class="legend">
        ${LEVELS.map((l, i) => `<span><i class="c${i}"></i>${l}</span>`).join('')}
        <span><i class="cs"></i>Work stopped (extreme heat or no daylight)</span>
      </div>
    </div>`;
  }

  // Tabs: each [data-tab] button shows #view-<tab> and hides the others.
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => {
      x.setAttribute('aria-selected', String(x === b));
      $(`#view-${x.dataset.tab}`).hidden = x !== b;
    });
    document.dispatchEvent(new CustomEvent('tabchange', { detail: b.dataset.tab }));
    if (b.dataset.tab === 'plan') load();
  }));

  $('#plan-run').addEventListener('click', async () => {
    const res = await fetch('/api/planner/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forecast: $('#plan-forecast').value }),
    });
    if (!res.ok) alert((await res.json()).error);
    load();
  });

  $('#plan-publish').addEventListener('click', async () => {
    const res = await fetch('/api/planner/publish', { method: 'POST' });
    const body = await res.json();
    if (!res.ok) return alert(body.error);
    load();
  });

  setInterval(() => { if (!$('#view-plan').hidden || P?.running) load(); }, 1500);
})();
