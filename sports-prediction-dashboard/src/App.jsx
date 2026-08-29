import { useEffect, useMemo, useState } from 'react'
import { loadMarkets, fieldPct } from './data/markets.js'
import MarketRow from './components/MarketRow.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import Bracket from './components/Bracket.jsx'

const DRAWS = [
  { key: 'men', label: "Men's Singles" },
  { key: 'women', label: "Women's Singles" },
]

const SORTS = {
  probability: (a, b) => b.price - a.price,
  movers: (a, b) => Math.abs(b.change) - Math.abs(a.change),
  volume: (a, b) => b.volume - a.volume,
}

export default function App() {
  const [markets] = useState(loadMarkets)
  const [draw, setDraw] = useState('men')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('probability')
  const [selectedId, setSelectedId] = useState(null)

  const outright = markets[draw].outright
  const bracket = markets[draw].bracket

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? outright.filter((c) => c.name.toLowerCase().includes(q)) : outright
    return [...list].sort(SORTS[sort])
  }, [outright, query, sort])

  const selected = outright.find((c) => c.id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    setSelectedId(null)
  }, [draw])

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            🎾 US Open Prediction Markets
          </h1>
          <p className="text-sm text-neutral-500">Event contracts · winner-take-all · settles at $1.00 or $0</p>
        </div>
        <span className="rounded-full border border-yellow-600/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
          As of Aug 29, 2026 — not live Robinhood quotes
        </span>
      </header>

      <div className="mb-4 flex gap-2">
        {DRAWS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDraw(d.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              draw === d.key ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contenders…"
              className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
            >
              <option value="probability">Sort: Probability</option>
              <option value="movers">Sort: Biggest movers</option>
              <option value="volume">Sort: Volume</option>
            </select>
          </div>

          <h2 className="mb-2 mt-4 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
            Championship winner
          </h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-900">
            {filtered.map((c) => (
              <MarketRow key={c.id} contender={c} selected={c.id === selected?.id} onSelect={setSelectedId} />
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-neutral-500">No contenders match "{query}"</div>
            )}
            {filtered.length > 0 && !query.trim() && (
              <div className="flex items-center justify-between px-4 py-2.5 text-xs text-neutral-500">
                <span>Field (rest of draw)</span>
                <span className="font-mono">{fieldPct(outright).toFixed(1)}¢</span>
              </div>
            )}
          </div>

          <h2 className="mb-2 mt-8 text-sm font-semibold tracking-wide text-neutral-400 uppercase">
            Quarterfinal matchups
          </h2>
          <Bracket matchups={bracket} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <DetailPanel contender={selected} />
        </div>
      </div>

      <footer className="mt-10 border-t border-neutral-900 pt-4 text-xs text-neutral-600">
        Robinhood's MCP tools don't expose sports prediction-market (event contract) data, and
        robinhood.com itself isn't reachable from this environment — so these aren't live
        Robinhood quotes. The field (who withdrew, seeds) and win probabilities are compiled from
        Kalshi's prediction-market percentages and sportsbook lines as of Aug 28–29, 2026; see
        README.md for sources. Swap <code>loadMarkets()</code> in{' '}
        <code>src/data/markets.js</code> for a live feed to go live.
      </footer>
    </div>
  )
}
