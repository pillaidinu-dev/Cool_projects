// Command centre: every site on one map, with portfolio KPIs, a site table, drill-down and alerts.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LEVELS = ['Normal', 'Caution', 'High', 'Danger', 'Extreme'];
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const pct = (x) => (x === null || x === undefined ? '—' : `${x}%`);
  const shortComp = (c) => (c === 'Attention needed' ? 'Attention' : c);
  const compClass = (c) => (c === 'Compliant' ? 'comp-ok' : c === 'Non-compliant' ? 'comp-fail' : 'comp-attn');

  let D = null;
  let selected = 'site-1';
  let map = null;
  const markers = new Map();
  let fitted = false;
  let userMoved = false;

  function fitAll() {
    if (!map || !D) return;
    map.invalidateSize();
    map.fitBounds(L.latLngBounds(D.sites.map((s) => [s.lat, s.lon])).pad(0.12), { padding: [30, 30] });
  }

  function initMap() {
    if (map || !window.L) return;
    map = L.map('cc-map', { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);
    map.setView([24.9, 55.3], 8);
    map.on('dragstart', () => { userMoved = true; });
  }

  async function load() {
    try {
      D = await (await fetch('/api/portfolio')).json();
      render();
    } catch {
      /* the live view shows connection errors */
    }
  }

  function render() {
    const k = D.kpis;
    $('#cc-sub').textContent = `${k.sites} sites · ${k.workers} outdoor workers · weather: ${D.scenarioLabel}. `
      + 'The Al Quoz site is live and interactive; the other sites run a simulated demo workload.';

    $('#cc-kpis').innerHTML = [
      tile('Workers on site', k.workers, `${k.sites} sites`),
      tile('Workers in Danger+ heat now', k.workersAtDanger, k.workers ? `${Math.round((k.workersAtDanger / k.workers) * 100)}% of workforce` : ''),
      tile('Open heat incidents', k.openIncidents, k.openIncidents ? 'needs attention' : 'none open'),
      tile('Check-in response rate', pct(k.checkinRate), 'across all sites'),
      tile('Sites compliant', `${k.sitesCompliant}/${k.sites}`, 'from each site\'s checks'),
      tile('Worst heat risk', LEVELS[k.worstLevel], ''),
    ].join('');

    $('#cc-legend').innerHTML = LEVELS.map((l, i) => `<span><i class="c${i}"></i>${l}</span>`).join('')
      + '<span>Circle size = workers · ring = open incident</span>';

    const sites = [...D.sites].sort((a, b) => b.level - a.level || b.openIncidents - a.openIncidents || b.workersAtDanger - a.workersAtDanger);
    $('#cc-sites').innerHTML = `
      <thead><tr><th>Site</th><th>Risk</th><th class="num">Workers</th><th class="num">In Danger+</th><th class="num">Incidents</th><th class="num">Check-ins</th><th>Compliance</th></tr></thead>
      <tbody>${sites.map((s) => `
        <tr data-site="${s.id}" class="${s.id === selected ? 'sel' : ''}">
          <td><div class="site">${esc(s.name)} ${s.live ? '<span class="tag live">LIVE</span>' : ''}</div><div class="muted small">${esc(s.area)}</div></td>
          <td><span class="level lv${s.level}">${LEVELS[s.level]}</span></td>
          <td class="num">${s.workers}</td>
          <td class="num">${s.workersAtDanger}</td>
          <td class="num">${s.openIncidents ? `<strong style="color:var(--l4)">${s.openIncidents}</strong>` : 0}</td>
          <td class="num">${pct(s.checkinRate)}</td>
          <td class="${compClass(s.compliance)}">${esc(shortComp(s.compliance))}</td>
        </tr>`).join('')}</tbody>`;

    renderMap();
    renderDetail();

    $('#cc-alerts').innerHTML = D.alerts.length
      ? D.alerts.map((a) => `<div class="item ${a.severity}"><time>${time(a.t)}</time><strong>${esc(a.site)}</strong>
          ${a.simulated ? '<span class="tag sim">SIM</span>' : '<span class="tag live">LIVE</span>'}<br>${esc(a.text)}</div>`).join('')
      : '<p class="empty">No alerts. Try the Heat spike weather to see the portfolio react.</p>';
  }

  function tile(label, value, sub) {
    return `<div class="tile"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div><div class="delta muted">${esc(sub)}</div></div>`;
  }

  function renderMap() {
    initMap();
    if (!map) return;
    for (const s of D.sites) {
      const size = Math.round(22 + Math.min(20, s.workers / 2));
      const html = `<div class="pin lv${s.level} ${s.openIncidents ? 'alarm' : ''} ${s.id === selected ? 'sel' : ''}" style="width:${size}px;height:${size}px">${s.workers}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const tip = `<strong>${esc(s.name)}</strong> · ${esc(s.area)}<br>${LEVELS[s.level]} · WBGT ${s.peakWbgt ? s.peakWbgt.toFixed(1) : '—'}°C<br>${s.workers} workers · ${s.workersAtDanger} in Danger+ · ${s.openIncidents} incidents`;
      let m = markers.get(s.id);
      if (!m) {
        m = L.marker([s.lat, s.lon], { icon, keyboard: true, title: s.name }).addTo(map);
        m.bindTooltip(tip, { direction: 'top', offset: [0, -size / 2], className: 'cc-tip' });
        m.on('click', () => select(s.id));
        markers.set(s.id, m);
      } else {
        m.setIcon(icon);
        m.setTooltipContent(tip);
      }
    }
    if (!fitted) {
      fitted = true;
      fitAll();
      // The panel can still be settling its height; fit again once layout is final, and on resize.
      setTimeout(fitAll, 300);
      new ResizeObserver(() => { map.invalidateSize(); if (!userMoved) fitAll(); }).observe($('#cc-map'));
    }
  }

  function renderDetail() {
    const s = D.sites.find((x) => x.id === selected) ?? D.sites[0];
    const c = s.conditions;
    $('#cc-detail').innerHTML = `
      <div class="cc-detail-head">
        <div><h3>${esc(s.name)} ${s.live ? '<span class="tag live">LIVE</span>' : '<span class="tag sim">SIMULATED</span>'}</h3>
          <div class="muted small">${esc(s.area)}</div></div>
        <div class="${compClass(s.compliance)}">${esc(s.compliance)}</div>
      </div>
      ${c ? `<div class="cc-cond"><span><b>${c.tempC.toFixed(1)}°C</b> air</span><span><b>${Math.round(c.rh)}%</b> humidity</span>
        <span><b>${s.peakWbgt.toFixed(1)}°C</b> WBGT (sun)</span><span class="muted small">${esc(c.source)}</span></div>` : ''}
      <div class="wrap"><table class="cc-table">
        <thead><tr><th>Crew</th><th>Work</th><th class="num">Workers</th><th class="num">WBGT</th><th>Risk</th></tr></thead>
        <tbody>${s.crews.map((cr) => `<tr style="cursor:default"><td>${esc(cr.name)}</td><td>${cr.intensity}</td><td class="num">${cr.workers}</td>
          <td class="num">${cr.wbgt ? cr.wbgt.toFixed(1) + '°' : '—'}</td><td><span class="level lv${cr.level}">${LEVELS[cr.level]}</span></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small" style="margin-top:8px">Check-ins answered: ${s.checkinsAnswered}/${s.checkinsSent} (${pct(s.checkinRate)}) · Open incidents: ${s.openIncidents}${s.overdue ? ` · Overdue check-ins: ${s.overdue}` : ''}</p>
      ${s.live
        ? '<div class="controls" style="margin-top:8px"><button class="btn primary" id="cc-open-live">Open live site</button><a class="btn" href="/report" target="_blank" rel="noopener">Compliance report</a></div>'
        : '<p class="muted small">Demo site: heat risk is computed from this location\'s weather and microclimate; check-ins and incidents are simulated.</p>'}`;
    const open = $('#cc-open-live');
    if (open) open.onclick = () => document.querySelector('[data-tab="live"]').click();
  }

  function select(id) {
    selected = id;
    render();
    const s = D.sites.find((x) => x.id === id);
    if (map && s) map.panTo([s.lat, s.lon]);
  }

  $('#cc-sites').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-site]');
    if (row) select(row.dataset.site);
  });

  document.addEventListener('tabchange', (e) => {
    if (e.detail === 'command') {
      load();
      setTimeout(() => map && map.invalidateSize(), 50);
    }
  });

  load();
  setInterval(() => { if (!$('#view-command').hidden) load(); }, 2000);
})();
