"""Turns one ESPN game summary into flat per-player-per-game rows. Mirrors
the parsing in nfl-dashboard/server/src/stats.js, but keeps every offensive
category on one row per player instead of splitting into separate leader
lists, since the model needs a single training example per player-game.
"""

# ESPN's boxscore athlete stub carries no position field at all (confirmed
# against real data: id/uid/guid/firstName/lastName/displayName/links/
# headshot/jersey, nothing else) -- so the stat category itself is the only
# position signal available. Passing wins ties (set unconditionally): a
# mobile QB's rushing line shouldn't unset the position his passing line
# already established, but a truly rare non-QB trick-play pass shouldn't
# relabel a real RB/WR either -- passing is the more decisive signal either
# way it's ordered.
_CATEGORY_POSITION = {"passing": "QB", "rushing": "RB", "receiving": "WR"}


def _stat(labels, stats, candidates):
    for label in candidates:
        if label in labels:
            idx = labels.index(label)
            if idx < len(stats):
                return stats[idx]
    return None


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_boxscore(summary, week, year, event_id):
    """Returns a list of dict rows, one per player who recorded an offensive stat."""
    competitors = (summary.get("header", {}).get("competitions") or [{}])[0].get("competitors", [])
    team_meta = {}
    for c in competitors:
        abbr = c.get("team", {}).get("abbreviation")
        if abbr:
            team_meta[abbr] = {"is_home": c.get("homeAway") == "home"}

    abbrs = list(team_meta.keys())
    opponent_of = {}
    if len(abbrs) == 2:
        opponent_of[abbrs[0]] = abbrs[1]
        opponent_of[abbrs[1]] = abbrs[0]

    rows = {}
    for team_block in summary.get("boxscore", {}).get("players", []) or []:
        team_abbr = team_block.get("team", {}).get("abbreviation")
        for category in team_block.get("statistics", []) or []:
            labels = category.get("labels") or []
            cat_name = category.get("name")
            if cat_name not in ("passing", "rushing", "receiving"):
                continue
            for entry in category.get("athletes", []) or []:
                athlete = entry.get("athlete") or {}
                name = athlete.get("displayName")
                if not name:
                    continue

                key = (team_abbr, name)
                row = rows.setdefault(
                    key,
                    {
                        "week": week,
                        "year": year,
                        "event_id": event_id,
                        "player": name,
                        "team": team_abbr,
                        "opponent": opponent_of.get(team_abbr),
                        "is_home": int(team_meta.get(team_abbr, {}).get("is_home", False)),
                        "position": None,
                        "pass_att": 0.0,
                        "pass_yards": 0.0,
                        "pass_td": 0.0,
                        "pass_int": 0.0,
                        "rush_car": 0.0,
                        "rush_yards": 0.0,
                        "rush_td": 0.0,
                        "rec": 0.0,
                        "rec_yards": 0.0,
                        "rec_td": 0.0,
                    },
                )
                stats = entry.get("stats") or []
                position = _CATEGORY_POSITION.get(cat_name)
                if position and (row["position"] is None or cat_name == "passing"):
                    row["position"] = position

                if cat_name == "passing":
                    ca = _stat(labels, stats, ["C/ATT", "CMP/ATT"])
                    if ca and "/" in str(ca):
                        row["pass_att"] = _num(str(ca).split("/")[-1])
                    row["pass_yards"] = _num(_stat(labels, stats, ["YDS"]))
                    row["pass_td"] = _num(_stat(labels, stats, ["TD"]))
                    row["pass_int"] = _num(_stat(labels, stats, ["INT"]))
                elif cat_name == "rushing":
                    row["rush_car"] = _num(_stat(labels, stats, ["CAR"]))
                    row["rush_yards"] = _num(_stat(labels, stats, ["YDS"]))
                    row["rush_td"] = _num(_stat(labels, stats, ["TD"]))
                elif cat_name == "receiving":
                    row["rec"] = _num(_stat(labels, stats, ["REC"]))
                    row["rec_yards"] = _num(_stat(labels, stats, ["YDS"]))
                    row["rec_td"] = _num(_stat(labels, stats, ["TD"]))

    return list(rows.values())
