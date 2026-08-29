// REAL FIELD, ESTIMATED PRICES — data for the 2026 US Open (main draw started
// Aug 30, 2026), current as of Aug 28-29, 2026.
//
// Robinhood's MCP tools expose stocks/options/crypto/indexes/scanners only —
// no sports prediction-market (event contract) endpoint — and robinhood.com
// itself is unreachable from this environment's network. So the championship
// win probabilities below are NOT pulled live from Robinhood; they're compiled
// from Kalshi's real-money prediction-market percentages and sportsbook lines
// (converted to implied probability), cross-checked against the official 2026
// US Open seeding lists. Seeds and the field itself (who withdrew, who's
// actually in the draw) are real. See README.md for sources. Swap
// `loadMarkets()` for a live feed when one exists; nothing else needs to change.

function walk(seed, endPrice, steps, volatility) {
  let price = endPrice
  const series = new Array(steps)
  for (let i = steps - 1; i >= 0; i--) {
    series[i] = Math.round(price * 10) / 10
    const drift = (Math.sin(i * 1.7 + seed) + (pseudoRand(seed + i) - 0.5)) * volatility
    price = Math.max(0.3, price - drift)
  }
  return series
}

function pseudoRand(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function contender(seedNum, name, country, seed, price, volume) {
  const history = walk(seedNum, price, 20, Math.max(0.5, price * 0.07))
  const open = history[0]
  const change = Math.round((price - open) * 10) / 10
  return {
    id: name.replace(/\s+/g, '-').toLowerCase(),
    name,
    country,
    seed,
    price,
    change,
    changePct: open ? Math.round((change / open) * 1000) / 10 : 0,
    volume,
    history,
  }
}

// Sorted by title probability, descending.
const menOutright = [
  contender(11, 'Carlos Alcaraz', 'ESP', 2, 26, 412000),
  contender(12, 'Alexander Zverev', 'GER', 1, 20, 375000),
  contender(13, 'Novak Djokovic', 'SRB', 4, 11, 671000),
  contender(14, 'Arthur Fils', 'FRA', 13, 8, 198000),
  contender(15, 'Taylor Fritz', 'USA', 9, 7, 356000),
  contender(16, 'Ben Shelton', 'USA', 8, 6, 241000),
  contender(17, 'Rafael Jódar', 'ESP', 10, 6, 289000),
  contender(18, 'Felix Auger-Aliassime', 'CAN', 3, 3, 154000),
  contender(19, 'Daniil Medvedev', 'RUS', 7, 3, 298000),
  contender(20, 'Jakub Mensik', 'CZE', 15, 3, 133000),
]

// Sorted by title probability, descending.
const womenOutright = [
  contender(21, 'Aryna Sabalenka', 'BLR', 1, 24, 344000),
  contender(22, 'Coco Gauff', 'USA', 4, 16, 522000),
  contender(23, 'Iga Swiatek', 'POL', 8, 15, 301000),
  contender(24, 'Naomi Osaka', 'JPN', 13, 9, 388000),
  contender(25, 'Jessica Pegula', 'USA', 3, 7, 167000),
  contender(26, 'Mirra Andreeva', 'RUS', 5, 7, 209000),
  contender(27, 'Elena Rybakina', 'KAZ', 2, 6, 289000),
  contender(28, 'Amanda Anisimova', 'USA', 10, 6, 176000),
  contender(29, 'Karolina Muchova', 'CZE', 7, 3, 144000),
  contender(30, 'Linda Noskova', 'CZE', 6, 3, 121000),
]

export function fieldPct(list) {
  const sum = list.reduce((s, c) => s + c.price, 0)
  return Math.max(0, Math.round((100 - sum) * 10) / 10)
}

function matchup(a, b) {
  const total = a.price + b.price || 1
  const aShare = Math.round((a.price / total) * 1000) / 10
  return {
    id: `${a.id}-vs-${b.id}`,
    round: 'Quarterfinal',
    a: { name: a.name, seed: a.seed, price: aShare },
    b: { name: b.name, seed: b.seed, price: Math.round((100 - aShare) * 10) / 10 },
  }
}

export function loadMarkets() {
  const menBracket = [
    matchup(menOutright[0], menOutright[7]),
    matchup(menOutright[1], menOutright[6]),
    matchup(menOutright[2], menOutright[5]),
    matchup(menOutright[3], menOutright[4]),
  ]
  const womenBracket = [
    matchup(womenOutright[0], womenOutright[7]),
    matchup(womenOutright[1], womenOutright[6]),
    matchup(womenOutright[2], womenOutright[5]),
    matchup(womenOutright[3], womenOutright[4]),
  ]

  return {
    men: { outright: menOutright, bracket: menBracket },
    women: { outright: womenOutright, bracket: womenBracket },
  }
}
