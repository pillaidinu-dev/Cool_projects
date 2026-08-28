// SAMPLE DATA — for UI demo purposes only.
// Robinhood's public trading API does not expose sports prediction-market
// (event contract) endpoints, so these prices are illustrative, not live
// quotes. Swap `loadMarkets()` for a real feed when one is available and
// the rest of the dashboard (charts, sorting, bracket) works unchanged.

function walk(seed, steps, volatility) {
  let price = seed
  const series = [price]
  for (let i = 1; i < steps; i++) {
    const drift = (Math.sin(i * 1.3 + seed) + (Math.random() - 0.5)) * volatility
    price = Math.min(97, Math.max(3, price + drift))
    series.push(Math.round(price * 10) / 10)
  }
  return series
}

function contender(name, country, seed, price) {
  const history = walk(price, 24, 2.2)
  const open = history[0]
  const last = history[history.length - 1]
  return {
    id: `${name}-${seed}`,
    name,
    country,
    seed,
    price: last,
    change: Math.round((last - open) * 10) / 10,
    changePct: Math.round(((last - open) / open) * 1000) / 10,
    volume: Math.round(40000 + Math.random() * 900000),
    history,
  }
}

const menOutright = [
  contender('Jannik Sinner', 'ITA', 1, 34),
  contender('Carlos Alcaraz', 'ESP', 2, 29),
  contender('Novak Djokovic', 'SRB', 3, 11),
  contender('Alexander Zverev', 'GER', 4, 6),
  contender('Taylor Fritz', 'USA', 5, 5),
  contender('Daniil Medvedev', 'RUS', 6, 4),
  contender('Jack Draper', 'GBR', 7, 4),
  contender('Ben Shelton', 'USA', 8, 3),
  contender('Holger Rune', 'DEN', 9, 2),
  contender('Casper Ruud', 'NOR', 10, 2),
]

const womenOutright = [
  contender('Aryna Sabalenka', 'BLR', 1, 31),
  contender('Iga Swiatek', 'POL', 2, 22),
  contender('Coco Gauff', 'USA', 3, 14),
  contender('Jessica Pegula', 'USA', 4, 8),
  contender('Elena Rybakina', 'KAZ', 5, 7),
  contender('Qinwen Zheng', 'CHN', 6, 5),
  contender('Jasmine Paolini', 'ITA', 7, 4),
  contender('Emma Navarro', 'USA', 8, 3),
  contender('Madison Keys', 'USA', 9, 3),
  contender('Mirra Andreeva', 'RUS', 10, 2),
]

function normalize(list) {
  const total = list.reduce((sum, c) => sum + c.price, 0)
  return list
    .map((c) => ({ ...c, price: Math.round((c.price / total) * 1000) / 10 }))
    .sort((a, b) => b.price - a.price)
}

function matchup(a, b, favoriteShare) {
  return {
    id: `${a.name}-vs-${b.name}`,
    round: 'Quarterfinal',
    a: { name: a.name, seed: a.seed, price: favoriteShare },
    b: { name: b.name, seed: b.seed, price: Math.round((100 - favoriteShare) * 10) / 10 },
  }
}

export function loadMarkets() {
  const men = normalize(menOutright)
  const women = normalize(womenOutright)

  const menBracket = [
    matchup(men[0], men[7], 78),
    matchup(men[1], men[6], 71),
    matchup(men[2], men[5], 58),
    matchup(men[3], men[4], 52),
  ]
  const womenBracket = [
    matchup(women[0], women[7], 74),
    matchup(women[1], women[6], 69),
    matchup(women[2], women[5], 61),
    matchup(women[3], women[4], 55),
  ]

  return {
    men: { outright: men, bracket: menBracket },
    women: { outright: women, bracket: womenBracket },
  }
}
