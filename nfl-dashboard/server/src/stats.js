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

function isTouchdownPlay(play) {
  const abbr = play?.type?.abbreviation;
  const text = play?.type?.text || '';
  return abbr === 'TD' || /touchdown/i.test(text);
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
