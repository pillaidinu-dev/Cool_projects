(function () {
  "use strict";

  const fmtPct = (v) => (v * 100 >= 1000 ? Math.round(v * 100) : (v * 100).toFixed(0)) + "%";
  const fmtPrice = (v) => "$" + (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
  const fmtCap = (v) => {
    if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
    return "$" + v.toFixed(0);
  };
  const fmtVol = (v) => {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
    return String(Math.round(v));
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function tierOf(marketCap) {
    if (marketCap >= 1e10) return "Large & mega cap (≥10B)";
    if (marketCap >= 1e9) return "Mid cap (1B–10B)";
    return "Small & micro cap (<1B)";
  }
  const TIER_ORDER = ["Large & mega cap (≥10B)", "Mid cap (1B–10B)", "Small & micro cap (<1B)"];
  const TIER_VARS = ["--series-1", "--series-2", "--series-3"];

  let DATA = null;
  let SPARKS = null;
  let sortKey = "ytd_pct";
  let sortDir = -1;
  let activeTier = null;
  let searchTerm = "";
  const charts = {};

  function init(data, sparks) {
    DATA = data;
    SPARKS = sparks;
    renderMeta();
    renderKpis();
    renderTopBar();
    renderScatter();
    renderHistogram();
    renderSparklines();
    renderTierChips();
    renderTable();
    document.getElementById("methodology-text").textContent =
      `Universe: ${data.methodology.universe}. YTD baseline: ${data.methodology.ytd_baseline}. ` +
      `Formula: ${data.methodology.ytd_calc}. ${data.methodology.excluded}`;

    document.getElementById("table-search").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderTable();
    });

    document.querySelectorAll("#stocks-table thead th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (sortKey === key) {
          sortDir *= -1;
        } else {
          sortKey = key;
          sortDir = key === "ticker" || key === "name" ? 1 : -1;
        }
        document.querySelectorAll("#stocks-table thead th").forEach((h) => h.removeAttribute("aria-sort"));
        th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
        renderTable();
      });
    });

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        Object.values(charts).forEach((c) => c && c.destroy());
        renderTopBar();
        renderScatter();
        renderHistogram();
        renderSparklines();
      });
    }
  }

  function renderMeta() {
    const d = new Date(DATA.generated_at);
    document.getElementById("hero-meta").innerHTML =
      `Snapshot: ${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}<br/>${DATA.count} stocks qualify`;
  }

  function renderKpis() {
    const stocks = DATA.stocks;
    const sorted = [...stocks].sort((a, b) => b.ytd_pct - a.ytd_pct);
    const median = [...stocks].sort((a, b) => a.ytd_pct - b.ytd_pct)[Math.floor(stocks.length / 2)];
    const megaLarge = stocks.filter((s) => s.market_cap >= 1e10).length;
    const top = sorted[0];

    const tiles = [
      { label: "Qualifying stocks", value: String(stocks.length), sub: "100%+ YTD, broad market" },
      { label: "Median YTD gain", value: fmtPct(median.ytd_pct), sub: "across all qualifiers", good: true },
      { label: "Top gainer", value: `${top.ticker} ${fmtPct(top.ytd_pct)}`, sub: top.name },
      { label: "Large & mega cap", value: String(megaLarge), sub: "market cap ≥ $10B" },
    ];

    document.getElementById("kpi-row").innerHTML = tiles
      .map(
        (t) => `<div class="kpi-tile">
          <p class="kpi-label">${t.label}</p>
          <p class="kpi-value${t.good ? " good" : ""}">${t.value}</p>
          <p class="kpi-sub">${t.sub}</p>
        </div>`
      )
      .join("");
  }

  function renderTopBar() {
    const top = [...DATA.stocks].sort((a, b) => b.ytd_pct - a.ytd_pct).slice(0, 20);
    const ctx = document.getElementById("chart-top20");
    charts.top20 = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map((s) => s.ticker),
        datasets: [
          {
            label: "YTD % change",
            data: top.map((s) => +(s.ytd_pct * 100).toFixed(1)),
            backgroundColor: cssVar("--series-1"),
            borderRadius: 4,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const s = top[items[0].dataIndex];
                return `${s.ticker} — ${s.name}`;
              },
              label: (item) => `YTD: +${item.formattedValue}%  ·  ${fmtPrice(top[item.dataIndex].last)}  ·  ${fmtCap(top[item.dataIndex].market_cap)} cap`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: cssVar("--text-muted"), callback: (v) => v + "%" },
            grid: { color: cssVar("--gridline") },
            title: { display: true, text: "YTD % change", color: cssVar("--text-secondary") },
          },
          y: {
            ticks: { color: cssVar("--text-primary") },
            grid: { display: false },
          },
        },
      },
    });
  }

  function renderScatter() {
    const ctx = document.getElementById("chart-scatter");
    const datasets = TIER_ORDER.map((tier, i) => ({
      label: tier,
      data: DATA.stocks
        .filter((s) => tierOf(s.market_cap) === tier)
        .map((s) => ({ x: s.market_cap, y: +(s.ytd_pct * 100).toFixed(1), ticker: s.ticker, name: s.name })),
      backgroundColor: cssVar(TIER_VARS[i]),
      borderColor: cssVar(TIER_VARS[i]),
      pointRadius: 5,
      pointHoverRadius: 7,
    }));

    charts.scatter = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const p = item.raw;
                return `${p.ticker} — ${p.name}: +${p.y}% YTD, ${fmtCap(p.x)} cap`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: "Market cap (log scale)", color: cssVar("--text-secondary") },
            ticks: {
              color: cssVar("--text-muted"),
              callback: (v) => {
                const s = String(v);
                if (s[0] === "1" || s[0] === "5") return fmtCap(v);
                return "";
              },
            },
            grid: { color: cssVar("--gridline") },
          },
          y: {
            title: { display: true, text: "YTD % change", color: cssVar("--text-secondary") },
            ticks: { color: cssVar("--text-muted"), callback: (v) => v + "%" },
            grid: { color: cssVar("--gridline") },
          },
        },
      },
    });

    document.getElementById("scatter-legend").innerHTML = TIER_ORDER.map(
      (tier, i) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${cssVar(TIER_VARS[i])}"></span>${tier}</span>`
    ).join("");
  }

  function renderHistogram() {
    const buckets = [
      { label: "100–150%", min: 1.0, max: 1.5 },
      { label: "150–200%", min: 1.5, max: 2.0 },
      { label: "200–300%", min: 2.0, max: 3.0 },
      { label: "300–500%", min: 3.0, max: 5.0 },
      { label: "500%+", min: 5.0, max: Infinity },
    ];
    const counts = buckets.map((b) => DATA.stocks.filter((s) => s.ytd_pct >= b.min && s.ytd_pct < b.max).length);

    const ctx = document.getElementById("chart-hist");
    charts.hist = new Chart(ctx, {
      type: "bar",
      data: {
        labels: buckets.map((b) => b.label),
        datasets: [
          {
            label: "Stocks",
            data: counts,
            backgroundColor: cssVar("--series-1"),
            borderRadius: 4,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `${item.formattedValue} stocks` } },
        },
        scales: {
          x: { ticks: { color: cssVar("--text-muted") }, grid: { display: false } },
          y: {
            ticks: { color: cssVar("--text-muted"), precision: 0 },
            grid: { color: cssVar("--gridline") },
            title: { display: true, text: "Number of stocks", color: cssVar("--text-secondary") },
          },
        },
      },
    });
  }

  function sparkPath(points, w, h, pad) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = (w - pad * 2) / (points.length - 1);
    return points
      .map((p, i) => {
        const x = pad + i * step;
        const y = h - pad - ((p - min) / range) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function renderSparklines() {
    const bySymbol = Object.fromEntries(SPARKS.map((s) => [s.symbol, s.points]));
    const top = [...DATA.stocks].sort((a, b) => b.ytd_pct - a.ytd_pct).filter((s) => bySymbol[s.ticker]).slice(0, 12);
    const w = 210, h = 44, pad = 4;
    const color = cssVar("--series-1");

    document.getElementById("spark-grid").innerHTML = top
      .map((s) => {
        const pts = bySymbol[s.ticker];
        const path = sparkPath(pts, w, h, pad);
        return `<div class="spark-card">
          <div class="spark-card-head">
            <span class="spark-ticker">${s.ticker}</span>
            <span class="spark-pct">+${fmtPct(s.ytd_pct)}</span>
          </div>
          <div class="spark-name">${s.name}</div>
          <svg class="spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="${s.ticker} price trend since December 31">
            <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>`;
      })
      .join("");
  }

  function renderTierChips() {
    const chips = ["All", ...TIER_ORDER];
    document.getElementById("tier-chips").innerHTML = chips
      .map(
        (c, i) =>
          `<button class="chip" data-tier="${i === 0 ? "" : c}" aria-pressed="${i === 0 ? "true" : "false"}">${c === "All" ? "All" : c.replace(/ \(.*\)/, "")}</button>`
      )
      .join("");
    document.querySelectorAll("#tier-chips .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTier = btn.dataset.tier || null;
        document.querySelectorAll("#tier-chips .chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        renderTable();
      });
    });
  }

  function renderTable() {
    let rows = DATA.stocks.filter((s) => {
      if (activeTier && tierOf(s.market_cap) !== activeTier) return false;
      if (searchTerm && !(s.ticker.toLowerCase().includes(searchTerm) || s.name.toLowerCase().includes(searchTerm))) return false;
      return true;
    });
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });

    document.getElementById("table-count-sub").textContent = `Showing ${rows.length} of ${DATA.count}`;

    const tbody = document.getElementById("table-body");
    if (rows.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No stocks match this filter.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (s) => `<tr>
          <td class="ticker-cell">${s.ticker}</td>
          <td class="name-cell" title="${s.name}">${s.name}</td>
          <td class="num">${fmtPrice(s.last)}</td>
          <td class="num ytd-cell">+${fmtPct(s.ytd_pct)}</td>
          <td class="num" style="color:${s.day_change_pct >= 0 ? "var(--success)" : "var(--critical)"}">${s.day_change_pct >= 0 ? "+" : ""}${(s.day_change_pct * 100).toFixed(1)}%</td>
          <td class="num">${fmtCap(s.market_cap)}</td>
          <td class="num">${fmtVol(s.avg_volume)}</td>
        </tr>`
      )
      .join("");
  }

  Promise.all([fetch("data/gainers.json").then((r) => r.json()), fetch("data/sparklines.json").then((r) => r.json())])
    .then(([data, sparks]) => init(data, sparks))
    .catch((err) => {
      document.querySelector(".page").innerHTML =
        '<p style="padding:40px;font-family:system-ui">Failed to load dashboard data: ' + err.message + "</p>";
    });
})();
