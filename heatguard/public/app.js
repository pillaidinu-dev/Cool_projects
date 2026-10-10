const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let S = null;
let selectedWorker = null;
let lastSpokenId = 0;

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

async function refresh() {
  try {
    S = await api('/api/state');
    render();
  } catch (err) {
    $('#site-name').textContent = `Can't reach server: ${err.message}`;
  }
}

function render() {
  $('#site-name').textContent = `${S.site.name} · supervisor: ${S.site.supervisor}`;
  const badge = $('#agent-badge');
  badge.className = `badge ${S.agent.mode}`;
  badge.textContent = S.agent.mode === 'claude'
    ? (S.agent.running ? 'Claude agent · thinking…' : 'Claude agent')
    : 'Rules engine only';
  badge.title = S.agent.lastError || '';

  const scen = [['live', 'Live'], ...Object.entries(S.meta.scenarios).map(([k, v]) => [k, v.label])];
  $('#scenarios').innerHTML = scen.map(([k, label]) =>
    `<button data-scenario="${k}" class="${S.settings.scenario === k ? 'active' : ''}">${esc(label)}</button>`).join('');
  $('#time-scale').value = String(S.settings.timeScale);

  renderConditions();
  renderCrews();
  renderFeeds();
  renderPhone();
}

function renderConditions() {
  const c = S.conditions;
  if (!c) return;
  const maxWbgt = Math.max(...S.crews.map((x) => x.wbgt ?? 0));
  $('#conditions').innerHTML = `
    <div class="stat"><div class="v">${c.tempC.toFixed(1)}°C</div><div class="k">Air temperature</div></div>
    <div class="stat"><div class="v">${Math.round(c.rh)}%</div><div class="k">Humidity</div></div>
    <div class="stat"><div class="v">${Math.round(c.solarWm2)}</div><div class="k">Sun (W/m²)</div></div>
    <div class="stat"><div class="v">${c.windMs.toFixed(1)}</div><div class="k">Wind (m/s)</div></div>
    <div class="stat ${maxWbgt >= 30 ? 'warn' : ''}"><div class="v">${maxWbgt.toFixed(1)}°C</div><div class="k">Est. WBGT (in sun)</div></div>
    <div class="stat"><div class="v">${S.middayBreak ? 'ON' : 'off'}</div><div class="k">UAE midday break</div></div>
    <div class="stat"><div class="k">Source</div><div class="small">${esc(c.source)}</div></div>`;
}

function renderCrews() {
  const L = S.meta.levels;
  $('#crews').innerHTML = S.crews.map((crew) => {
    const p = crew.plan;
    const planText = p.level >= 4
      ? 'Stop heavy outdoor work · shade & water'
      : `Water every ${p.water} min · work ${p.work} / rest ${p.rest} min${p.checkin ? ` · check-in every ${p.checkin} min` : ''}`;
    return `<div class="crew">
      <div class="crew-head">
        <span class="crew-name">${esc(crew.name)} <span class="muted small">· ${crew.intensity} work · WBGT ${crew.wbgt ?? '–'}°C</span></span>
        <span class="level lv${p.level}">${L[p.level]}</span>
      </div>
      <div class="plan">${planText} <span class="src ${p.source}">${p.source === 'claude' ? 'Claude' : 'rules'}</span>
        ${p.reason && p.source === 'claude' ? `<div class="muted small">${esc(p.reason)}</div>` : ''}</div>
      <ul class="workers">${crew.workers.map((w) => `
        <li>
          <span class="dot st-${w.status}" title="${w.status}"></span>
          <span class="grow">${esc(w.name)} <span class="muted small">${esc(S.meta.languages[w.lang].name)} · ${w.status}</span></span>
          ${w.status === 'unwell' || w.status === 'overdue' ? `<button class="btn" data-resolve="${w.id}">Checked</button>` : ''}
          <button class="btn ghost" data-view="${w.id}">Phone</button>
        </li>`).join('')}
      </ul>
    </div>`;
  }).join('');
}

function renderFeeds() {
  const alerts = S.messages.filter((m) => m.to === 'supervisor');
  $('#alerts').innerHTML = alerts.length
    ? alerts.map((m) => `<div class="item ${m.severity}"><time>${time(m.t)}</time><strong>${m.severity.toUpperCase()}</strong>
        ${m.aboutName ? `· ${esc(m.aboutName)}` : ''} — ${esc(m.text)} <span class="src ${m.source}">${m.source}</span></div>`).join('')
    : '<p class="empty">No alerts.</p>';
  $('#log').innerHTML = S.events.length
    ? S.events.map((e) => `<div class="item ${e.type === 'agent' ? 'agent' : ''}"><time>${time(e.t)}</time>
        <span class="src ${e.source}">${e.source}</span> ${esc(e.text)}</div>`).join('')
    : '<p class="empty">Nothing yet.</p>';
}

function renderPhone() {
  const workers = S.crews.flatMap((c) => c.workers);
  if (!selectedWorker || !workers.some((w) => w.id === selectedWorker)) selectedWorker = workers[0].id;
  const sel = $('#worker-select');
  const opts = workers.map((w) => `<option value="${w.id}">${esc(w.name)} (${esc(S.meta.languages[w.lang].name)})</option>`).join('');
  if (sel.dataset.opts !== opts) { sel.innerHTML = opts; sel.dataset.opts = opts; }
  sel.value = selectedWorker;

  const w = workers.find((x) => x.id === selectedWorker);
  $('#phone-head').textContent = `${w.name} · ${w.status}`;
  const thread = S.messages.filter((m) => m.to === w.id || m.from === w.id);
  $('#phone-body').innerHTML = thread.map((m) => m.direction === 'in'
    ? `<div class="bubble out">${esc(m.text)}<div class="meta">${time(m.t)}</div></div>`
    : `<div class="bubble in" dir="auto">${esc(m.text)}<div class="meta">${time(m.t)}
        <button title="Play voice" data-speak="${m.id}">🔊</button></div></div>`).join('')
    || '<p class="empty">No messages yet.</p>';

  const newest = thread.find((m) => m.direction === 'out');
  if (newest && newest.id > lastSpokenId) {
    if (lastSpokenId && $('#auto-voice').checked) speak(newest);
    lastSpokenId = newest.id;
  }
}

function speak(msg) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(msg.text.replace(/^HeatGuard[^:]*:\s*/, ''));
  u.lang = msg.voice;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(msg.voice.slice(0, 2)));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

async function reply(text) {
  if (!text) return;
  await api(`/api/workers/${selectedWorker}/reply`, { text });
  refresh();
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.scenario) await api('/api/settings', { scenario: t.dataset.scenario });
    else if (t.dataset.reply) await reply(t.dataset.reply);
    else if (t.dataset.resolve) await api(`/api/workers/${t.dataset.resolve}/resolve`, {});
    else if (t.dataset.view) { selectedWorker = t.dataset.view; lastSpokenId = 0; }
    else if (t.dataset.speak) speak(S.messages.find((m) => String(m.id) === t.dataset.speak));
    else if (t.id === 'review') await api('/api/agent/review', {});
    else if (t.id === 'reset') await api('/api/reset', {});
    else return;
    refresh();
  } catch (err) {
    alert(err.message);
  }
});

$('#worker-select').addEventListener('change', (e) => { selectedWorker = e.target.value; lastSpokenId = 0; render(); });
$('#time-scale').addEventListener('change', (e) => api('/api/settings', { timeScale: Number(e.target.value) }).then(refresh));
$('#reply-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#reply-text');
  const text = input.value.trim();
  input.value = '';
  await reply(text).catch((err) => alert(err.message));
});

refresh();
setInterval(refresh, 1500);
