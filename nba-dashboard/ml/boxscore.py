"""Turns one ESPN NBA game summary into flat per-player-per-game rows. Mirrors
the parsing in nba-dashboard/server/src/stats.js.

ESPN's NBA box score has one statistics block per team, whose `labels`
(MIN, FG, 3PT, ..., PTS) line up positionally with each athlete's `stats`
strings. Newer payloads also carry machine-readable `keys`; either is
accepted, so a relabel on one side doesn't zero out a column.
"""

COLUMNS = [
    "date", "event_id", "player_id", "player", "team", "opponent", "is_home", "position", "starter",
    "min", "pts", "reb", "ast", "fg3m", "fg3a", "stl", "blk", "tov",
]

_FIELDS = {
    "min": (["MIN"], ["minutes"]),
    "pts": (["PTS"], ["points"]),
    "reb": (["REB"], ["rebounds", "totalRebounds"]),
    "ast": (["AST"], ["assists"]),
    "stl": (["STL"], ["steals"]),
    "blk": (["BLK"], ["blocks"]),
    "tov": (["TO"], ["turnovers"]),
    "fg3": (["3PT"], ["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]),
}


def _lookup(labels, keys, stats, field):
    label_options, key_options = _FIELDS[field]
    for names, options in ((labels, label_options), (keys, key_options)):
        for option in options:
            if option in names:
                idx = names.index(option)
                if idx < len(stats):
                    return stats[idx]
    return None


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_minutes(value):
    """ESPN reports minutes as "34", occasionally "34:12"."""
    if value is None:
        return 0.0
    text = str(value)
    if ":" in text:
        mins, _, secs = text.partition(":")
        return _num(mins) + _num(secs) / 60
    return _num(text)


def _made_attempted(value):
    if value and "-" in str(value):
        made, _, attempted = str(value).partition("-")
        return _num(made), _num(attempted)
    return 0.0, 0.0


def parse_boxscore(summary, date, event_id):
    """One dict per player who actually logged minutes in this game."""
    competitors = (summary.get("header", {}).get("competitions") or [{}])[0].get("competitors", []) or []
    is_home = {}
    for c in competitors:
        abbr = (c.get("team") or {}).get("abbreviation")
        if abbr:
            is_home[abbr] = c.get("homeAway") == "home"
    abbrs = list(is_home)
    opponent_of = {abbrs[0]: abbrs[1], abbrs[1]: abbrs[0]} if len(abbrs) == 2 else {}

    rows = []
    for team_block in summary.get("boxscore", {}).get("players", []) or []:
        team = (team_block.get("team") or {}).get("abbreviation")
        for category in team_block.get("statistics", []) or []:
            labels = category.get("labels") or category.get("names") or []
            keys = category.get("keys") or []
            for entry in category.get("athletes", []) or []:
                athlete = entry.get("athlete") or {}
                stats = entry.get("stats") or []
                if entry.get("didNotPlay") or not stats or not athlete.get("displayName"):
                    continue
                minutes = parse_minutes(_lookup(labels, keys, stats, "min"))
                if minutes <= 0:
                    continue
                fg3m, fg3a = _made_attempted(_lookup(labels, keys, stats, "fg3"))
                rows.append(
                    {
                        "date": date,
                        "event_id": str(event_id),
                        "player_id": str(athlete.get("id") or athlete["displayName"]),
                        "player": athlete["displayName"],
                        "team": team,
                        "opponent": opponent_of.get(team),
                        "is_home": int(is_home.get(team, False)),
                        "position": (athlete.get("position") or {}).get("abbreviation"),
                        "starter": int(bool(entry.get("starter"))),
                        "min": round(minutes, 1),
                        "pts": _num(_lookup(labels, keys, stats, "pts")),
                        "reb": _num(_lookup(labels, keys, stats, "reb")),
                        "ast": _num(_lookup(labels, keys, stats, "ast")),
                        "fg3m": fg3m,
                        "fg3a": fg3a,
                        "stl": _num(_lookup(labels, keys, stats, "stl")),
                        "blk": _num(_lookup(labels, keys, stats, "blk")),
                        "tov": _num(_lookup(labels, keys, stats, "tov")),
                    }
                )
    return rows
