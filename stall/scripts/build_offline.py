"""Build the offline, single-file ledger from the online artifact source.

Usage: python3 stall/scripts/build_offline.py
Reads  stall/src/snack-stall-ledger.html
Writes stall/Snack_Stall_Ledger_Offline.html
"""
import re
from pathlib import Path
STALL = Path(__file__).resolve().parent.parent
src = (STALL / 'src' / 'snack-stall-ledger.html').read_text()
OUT = STALL / 'Snack_Stall_Ledger_Offline.html'

def rep(s, a, b, required=True):
    if required: assert a in s, a
    return s.replace(a, b)

s = src
# no web fonts offline: drop the Google Fonts links (fallback stacks already set)
s = re.sub(r'<link rel="preconnect"[^>]*>\n', '', s)
s = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n', '', s)
s = rep(s, '<title>Snack Stall Ledger</title>', '<title>Snack Stall Ledger (Offline)</title>')
s = rep(s, '<h1>Snack Stall Ledger</h1>', '<h1>Snack Stall Ledger <small class="offtag">Offline</small></h1>')
s = rep(s, '<span class="status" id="status">Connecting…</span>', '<span class="status" id="status">Loading…</span>')
s = rep(s, 'setStatus("Live · syncs between phones");', 'setStatus("Offline · saved on this Mac only");')
s = rep(s, 'from both phones', 'from this Mac')
s = rep(s, 'Your first order will show up here, for both of you.', 'Your first order will show up here.')
s = rep(s, '.toast{', '.offtag{font-family:var(--body);font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:var(--turmeric);color:#1c2618;padding:2px 8px;border-radius:99px;vertical-align:middle}\n.backup .eactions label{cursor:pointer}\n.toast{')

backup_html = '''  <section aria-labelledby="hBackup">
    <h2 id="hBackup">Backup</h2>
    <div class="card backup">
      <p class="hint">This copy saves only in this browser on this Mac. Download a backup at the end of each day. Clearing Safari's website data or history would erase it. To merge these sales into the online tracker later, send the backup file to Claude.</p>
      <div class="eactions">
        <button class="btn-add" id="backupBtn" type="button">Download backup</button>
        <label class="secondary" for="restoreFile">Restore from backup</label>
        <input id="restoreFile" type="file" accept=".json,application/json" hidden>
      </div>
      <div id="restoreConfirm" class="confirm" hidden>
        <p id="restoreMsg"></p>
        <div class="eactions"><button class="btn-danger" id="restoreYes" type="button">Yes, replace</button><button class="secondary" id="restoreNo" type="button">Cancel</button></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="hReset">'''
s = rep(s, '  <section aria-labelledby="hReset">', backup_html)

local_layer = r'''<script>
/* Offline storage: same calls as the online ledger's shared database, kept in this browser's localStorage. */
(function(){
  const KEY = "snack-stall-ledger-offline-v1";
  const SEED = {
    settings: { menu: { items: [
      {id:"vadai", name:"Medhu Vadai", unit:"1 plate", price:6, stock:50},
      {id:"puff", name:"Paneer Puff", unit:"1 piece", price:4, stock:40},
      {id:"idly", name:"Podi Idly", unit:"1 plate", price:8, stock:30},
      {id:"rosemilk", name:"Rose Milk", unit:"10 oz", price:4, stock:20}
    ] } },
    expenses: {
      "stall-fee": {label:"Stall fee", amount:60, at:1},
      "supplies": {label:"Supplies", amount:50, at:2},
      "cooking": {label:"Cooking items", amount:50, at:3}
    },
    sales: {}, extras: {}
  };
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if (!state || typeof state !== "object") state = JSON.parse(JSON.stringify(SEED));
  const listeners = new Set();
  const notify = () => listeners.forEach(l => { try { l(); } catch(e){ console.error(e); } });
  function persist(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(e){ throw {code:"quota_exceeded", message:"This browser's storage is full or blocked."}; }
    notify();
  }
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}
  window.addEventListener("storage", e => { if (e.key === KEY && e.newValue){ try { state = JSON.parse(e.newValue); notify(); } catch(_){} } });
  const coll = n => (state[n] ||= {});
  const clone = d => JSON.parse(JSON.stringify(d));
  const snap = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: {fromCache:false, hasPendingWrites:false} });
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function listen(fn){ listeners.add(fn); setTimeout(fn, 0); return () => listeners.delete(fn); }
  function docRef(col, id){
    return {
      id, path: col + "/" + id,
      async get(){ return snap(id, coll(col)[id]); },
      async set(d){ coll(col)[id] = clone(d); persist(); },
      async update(d){ if (!coll(col)[id]) throw {code:"unavailable", message:"Nothing to update."}; coll(col)[id] = {...coll(col)[id], ...clone(d)}; persist(); },
      async delete(){ delete coll(col)[id]; persist(); },
      onSnapshot(next){ return listen(() => next(snap(id, coll(col)[id]))); },
      collection(){ throw new TypeError("Not supported offline"); }
    };
  }
  function query(col, ord, lim){
    function build(){
      let docs = Object.entries(coll(col)).map(([id, d]) => snap(id, d));
      if (ord) docs.sort((a, b) => { const x = a.data()[ord[0]], y = b.data()[ord[0]]; return (x < y ? -1 : x > y ? 1 : 0) * (ord[1] === "desc" ? -1 : 1); });
      if (lim) docs = docs.slice(0, lim);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {fromCache:false, hasPendingWrites:false} };
    }
    return {
      path: col,
      orderBy(f, dir){ return query(col, [f, dir || "asc"], lim); },
      limit(n){ return query(col, ord, n); },
      where(){ throw new TypeError("Not supported offline"); },
      async get(){ return build(); },
      onSnapshot(next){ return listen(() => next(build())); },
      doc(id){ return docRef(col, id || newId()); },
      async add(d){ const r = docRef(col, newId()); await r.set(d); return r; }
    };
  }
  const db = { collection: n => query(n), doc: p => { const [c, id] = p.split("/"); return docRef(c, id); } };
  const downloads = { async save({filename, data}){
    const blob = data instanceof Blob ? data : new Blob([data], {type: filename.endsWith(".json") ? "application/json" : "text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return {status:"saved"};
  } };
  window.__offline = {
    snapshot: () => clone(state),
    replace: next => { state = clone(next); persist(); },
    KEY
  };
  window.claude = { use: async name => name === "db" ? db : name === "downloads" ? downloads : null };
})();
</script>
'''

backup_js = r'''
<script>
(function(){
  const $ = id => document.getElementById(id);
  const stamp = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0") + "-" + String(d.getHours()).padStart(2,"0") + String(d.getMinutes()).padStart(2,"0"); };
  $("backupBtn").onclick = async () => {
    const data = JSON.stringify({app:"snack-stall-ledger", version:1, savedAt:new Date().toISOString(), data: window.__offline.snapshot()}, null, 2);
    (await window.claude.use("downloads")).save({filename: "stall-backup-" + stamp() + ".json", data});
  };
  let pending = null;
  $("restoreFile").onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || j.app !== "snack-stall-ledger" || !j.data || !j.data.settings) throw 0;
      pending = j.data;
      const n = Object.keys(j.data.sales || {}).length;
      $("restoreMsg").textContent = "Replace everything on this Mac with the backup from " + new Date(j.savedAt).toLocaleString() + " (" + n + " sales)?";
      $("restoreConfirm").hidden = false;
    } catch(_) { $("restoreMsg").textContent = "That file isn't a ledger backup. Pick a stall-backup-….json file."; $("restoreConfirm").hidden = false; pending = null; }
  };
  $("restoreNo").onclick = () => { pending = null; $("restoreConfirm").hidden = true; };
  $("restoreYes").onclick = () => { if (pending) window.__offline.replace(pending); pending = null; $("restoreConfirm").hidden = true; };
})();
</script>
'''

s = rep(s, '<script>\n(function(){\n  const $ = id', local_layer + '<script>\n(function(){\n  const $ = id')
s = s.rstrip() + '\n' + backup_js

head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
# move title+style into head
i = s.index('</style>') + len('</style>')
doc = head + s[:i] + '\n<style>[hidden]{display:none!important} body{margin:0} img{max-width:100%}</style>\n</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n'
open(OUT, 'w').write(doc)
print("wrote", OUT, len(doc))
