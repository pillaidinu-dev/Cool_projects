// Turns ESPN's per-game NBA box scores into a flat player list and per-stat
// leader boards. Mirrors nba-dashboard/ml/boxscore.py, which does the same
// parsing for the projection model's training data.

// Each field can be found by its display label or, in newer payloads, by
// its machine-readable key.
const FIELDS = {
  min: [['MIN'], ['minutes']],
  pts: [['PTS'], ['points']],
  reb: [['REB'], ['rebounds', 'totalRebounds']],
  ast: [['AST'], ['assists']],
  stl: [['STL'], ['steals']],
  blk: [['BLK'], ['blocks']],
  tov: [['TO'], ['turnovers']],
  fg3: [['3PT'], ['threePointFieldGoalsMade-threePointFieldGoalsAttempted']],
};

export const LEADER_STATS = ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk'];

function lookup(labels, keys, stats, field) {
  const [labelOptions, keyOptions] = FIELDS[field];
  for (const [names, options] of [
    [labels, labelOptions],
    [keys, keyOptions],
  ]) {
    for (const option of options) {
      const idx = names.indexOf(option);
      if (idx !== -1 && stats[idx] !== undefined) return stats[idx];
    }
  }
  return undefined;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseMinutes(value) {
  const text = String(value ?? '');
  if (text.includes(':')) {
    const [m, s] = text.split(':');
    return toNumber(m) + toNumber(s) / 60;
  }
  return toNumber(text);
}

function madeAttempted(value) {
  const [made, attempted] = String(value ?? '').split('-');
  return [toNumber(made), toNumber(attempted)];
}

export function parseBoxscore(summary, game) {
  const players = [];
  for (const teamBlock of summary?.boxscore?.players || []) {
    const team = teamBlock.team?.abbreviation;
    for (const category of teamBlock.statistics || []) {
      const labels = category.labels || category.names || [];
      const keys = category.keys || [];
      for (const entry of category.athletes || []) {
        const stats = entry.stats || [];
        const name = entry.athlete?.displayName;
        if (!name || entry.didNotPlay || stats.length === 0) continue;
        const min = parseMinutes(lookup(labels, keys, stats, 'min'));
        if (min <= 0) continue;
        const [fg3m, fg3a] = madeAttempted(lookup(labels, keys, stats, 'fg3'));
        const pts = toNumber(lookup(labels, keys, stats, 'pts'));
        const reb = toNumber(lookup(labels, keys, stats, 'reb'));
        const ast = toNumber(lookup(labels, keys, stats, 'ast'));
        const stl = toNumber(lookup(labels, keys, stats, 'stl'));
        const blk = toNumber(lookup(labels, keys, stats, 'blk'));
        players.push({
          id: String(entry.athlete?.id ?? name),
          name,
          team,
          position: entry.athlete?.position?.abbreviation,
          game: game.name,
          gameState: game.state,
          min: Math.round(min),
          pts,
          reb,
          ast,
          fg3m,
          fg3a,
          stl,
          blk,
          tov: toNumber(lookup(labels, keys, stats, 'tov')),
          pra: pts + reb + ast,
          stocks: stl + blk,
          // 1 for a double-double (10+ in two of these), else 0 — the dd market.
          dd: Number([pts, reb, ast, stl, blk].filter((v) => v >= 10).length >= 2),
        });
      }
    }
  }
  return players;
}

// `games` is [{ id, name, state }]; only games that have tipped off have a
// box score. `fetchSummary` is injectable for testing.
export async function buildLeaders(games, fetchSummary, limit = 10) {
  const players = [];
  const errors = [];
  await Promise.all(
    games
      .filter((game) => game.state === 'in' || game.state === 'post')
      .map(async (game) => {
        try {
          players.push(...parseBoxscore(await fetchSummary(game.id), game));
        } catch (err) {
          errors.push({ game: game.name, error: err.message });
        }
      }),
  );

  const leaders = Object.fromEntries(
    LEADER_STATS.map((stat) => [
      stat,
      players
        .filter((p) => p[stat] > 0)
        .sort((a, b) => b[stat] - a[stat] || b.min - a.min)
        .slice(0, limit),
    ]),
  );
  return { players, leaders, errors };
}
