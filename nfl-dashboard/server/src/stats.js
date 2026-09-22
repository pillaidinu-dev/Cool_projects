// Turns ESPN's per-game boxscore/scoring-play payloads into the flat leader
// lists and TD feed the dashboard renders.

function statFor(labels, stats, candidates) {
  for (const label of candidates) {
    const idx = labels.indexOf(label);
    if (idx !== -1 && stats?.[idx] !== undefined) return stats[idx];
  }
  return undefined;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function splitCompletionsAttempts(value) {
  const match = /^(\d+)\/(\d+)$/.exec(String(value ?? ''));
  return match ? { completions: Number(match[1]), attempts: Number(match[2]) } : { completions: 0, attempts: 0 };
}

// Merges one game's stat line into a player's running season total. `deltas`
// are summed by default; keys listed in `maxFields` (e.g. longest run) are
// maxed instead, since a season "long" is the best single play, not a sum.
function accumulatePlayer(map, key, base, deltas, maxFields = []) {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...base, ...deltas, games: 1 });
    return;
  }
  existing.games += 1;
  for (const [field, value] of Object.entries(deltas)) {
    existing[field] = maxFields.includes(field) ? Math.max(existing[field] ?? 0, value) : (existing[field] ?? 0) + value;
  }
}

function isTouchdownPlay(play) {
  const abbr = play?.type?.abbreviation;
  const text = play?.type?.text || '';
  return abbr === 'TD' || /touchdown/i.test(text);
}

// The player who scored, when ESPN's play data lets us name them.
function extractScorer(play) {
  const participants = play?.participants || [];
  const scorer = participants.find((p) => p.type === 'scorer') || participants[0];
  const name = scorer?.athlete?.displayName || scorer?.athlete?.shortName;
  if (name) return name;

  // Fall back to parsing the play text, e.g. "A.J. Brown 12 Yd pass from Jalen
  // Hurts" or "Saquon Barkley 4 Yd Run" — the scorer's name is the leading
  // phrase before the yardage figure.
  const match = /^([A-Za-z.'\-\s]+?)\s+\d+\s+Yd/.exec(play?.text || '');
  return match ? match[1].trim() : undefined;
}

// `games` is [{ id, name }]. `fetchSummary` is injectable for testing.
export async function buildLeaders(games, fetchSummary) {
  const passing = [];
  const rushing = [];
  const receiving = [];
  const touchdowns = [];
  const errors = [];

  await Promise.all(
    games.map(async (game) => {
      let summary;
      try {
        summary = await fetchSummary(game.id);
      } catch (err) {
        errors.push({ game: game.name, error: err.message });
        return;
      }

      for (const teamBlock of summary?.boxscore?.players || []) {
        const teamAbbr = teamBlock.team?.abbreviation;
        for (const category of teamBlock.statistics || []) {
          const labels = category.labels || [];
          for (const entry of category.athletes || []) {
            const name = entry.athlete?.displayName;
            if (!name) continue;
            const position = entry.athlete?.position?.abbreviation;
            const stats = entry.stats || [];
            const base = { name, team: teamAbbr, position, game: game.name };

            if (category.name === 'passing') {
              const row = {
                ...base,
                completionsAttempts: statFor(labels, stats, ['C/ATT', 'CMP/ATT']),
                yards: toNumber(statFor(labels, stats, ['YDS'])),
                touchdowns: toNumber(statFor(labels, stats, ['TD'])),
                interceptions: toNumber(statFor(labels, stats, ['INT'])),
                rating: statFor(labels, stats, ['RTG', 'QBR']),
              };
              if (row.yards || row.touchdowns || row.completionsAttempts) passing.push(row);
            } else if (category.name === 'rushing') {
              const row = {
                ...base,
                carries: toNumber(statFor(labels, stats, ['CAR'])),
                yards: toNumber(statFor(labels, stats, ['YDS'])),
                touchdowns: toNumber(statFor(labels, stats, ['TD'])),
                long: statFor(labels, stats, ['LONG']),
              };
              if (row.yards || row.touchdowns || row.carries) rushing.push(row);
            } else if (category.name === 'receiving') {
              const row = {
                ...base,
                receptions: toNumber(statFor(labels, stats, ['REC'])),
                yards: toNumber(statFor(labels, stats, ['YDS'])),
                touchdowns: toNumber(statFor(labels, stats, ['TD'])),
                long: statFor(labels, stats, ['LONG']),
              };
              if (row.receptions || row.yards || row.touchdowns) receiving.push(row);
            }
          }
        }
      }

      for (const play of summary?.scoringPlays || []) {
        if (!isTouchdownPlay(play)) continue;
        touchdowns.push({
          game: game.name,
          team: play.team?.abbreviation,
          period: play.period?.number,
          clock: play.clock?.displayValue,
          description: play.text,
          scorer: extractScorer(play),
        });
      }
    }),
  );

  passing.sort((a, b) => b.yards - a.yards);
  rushing.sort((a, b) => b.yards - a.yards);
  receiving.sort((a, b) => b.yards - a.yards);

  return {
    passing: passing.slice(0, 15),
    rushing: rushing.slice(0, 15),
    receiving: receiving.slice(0, 20),
    touchdowns,
    errors,
  };
}

// Same box-score walk as buildLeaders, but summed per player across every
// game passed in (typically every game played so far this season) instead
// of one row per game. `touchdowns` here is a name/team/touchdowns/games
// leaderboard -- rushing + receiving TDs actually scored by that player
// (mirrors ml/train.py's td_total = rush_td + rec_td), not passing TDs
// thrown, so a QB's TD passes don't inflate a "touchdowns scored" ranking.
export async function buildSeasonLeaders(games, fetchSummary) {
  const passing = new Map();
  const rushing = new Map();
  const receiving = new Map();
  const touchdowns = new Map();
  const errors = [];

  await Promise.all(
    games.map(async (game) => {
      let summary;
      try {
        summary = await fetchSummary(game.id);
      } catch (err) {
        errors.push({ game: game.name, error: err.message });
        return;
      }

      for (const teamBlock of summary?.boxscore?.players || []) {
        const teamAbbr = teamBlock.team?.abbreviation;
        for (const category of teamBlock.statistics || []) {
          const labels = category.labels || [];
          for (const entry of category.athletes || []) {
            const name = entry.athlete?.displayName;
            if (!name) continue;
            const position = entry.athlete?.position?.abbreviation;
            const stats = entry.stats || [];
            const key = `${teamAbbr}|${name}`;
            const base = { name, team: teamAbbr, position };

            if (category.name === 'passing') {
              const { completions, attempts } = splitCompletionsAttempts(statFor(labels, stats, ['C/ATT', 'CMP/ATT']));
              const yards = toNumber(statFor(labels, stats, ['YDS']));
              const touchdownsThrown = toNumber(statFor(labels, stats, ['TD']));
              const interceptions = toNumber(statFor(labels, stats, ['INT']));
              if (!attempts && !yards && !touchdownsThrown) continue;
              accumulatePlayer(passing, key, base, { completions, attempts, yards, touchdowns: touchdownsThrown, interceptions });
            } else if (category.name === 'rushing') {
              const carries = toNumber(statFor(labels, stats, ['CAR']));
              const yards = toNumber(statFor(labels, stats, ['YDS']));
              const td = toNumber(statFor(labels, stats, ['TD']));
              const long = toNumber(statFor(labels, stats, ['LONG']));
              if (!carries && !yards && !td) continue;
              accumulatePlayer(rushing, key, base, { carries, yards, touchdowns: td, long }, ['long']);
              if (td) accumulatePlayer(touchdowns, key, base, { touchdowns: td });
            } else if (category.name === 'receiving') {
              const receptions = toNumber(statFor(labels, stats, ['REC']));
              const yards = toNumber(statFor(labels, stats, ['YDS']));
              const td = toNumber(statFor(labels, stats, ['TD']));
              const long = toNumber(statFor(labels, stats, ['LONG']));
              if (!receptions && !yards && !td) continue;
              accumulatePlayer(receiving, key, base, { receptions, yards, touchdowns: td, long }, ['long']);
              if (td) accumulatePlayer(touchdowns, key, base, { touchdowns: td });
            }
          }
        }
      }
    }),
  );

  const passingRows = [...passing.values()]
    .map((r) => ({ ...r, completionsAttempts: `${r.completions}/${r.attempts}` }))
    .sort((a, b) => b.yards - a.yards)
    .slice(0, 15);
  const rushingRows = [...rushing.values()].sort((a, b) => b.yards - a.yards).slice(0, 15);
  const receivingRows = [...receiving.values()].sort((a, b) => b.yards - a.yards).slice(0, 20);
  const touchdownRows = [...touchdowns.values()].sort((a, b) => b.touchdowns - a.touchdowns).slice(0, 20);

  return { passing: passingRows, rushing: rushingRows, receiving: receivingRows, touchdowns: touchdownRows, errors };
}
