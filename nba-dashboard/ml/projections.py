"""Builds one slate's prop projections: who's playing, and a projection,
range, line and over probability for each of their prop markets."""
from datetime import timedelta

import pandas as pd

from features import STATS, build_training_frame, build_upcoming_frame
from model import backtest, p_over, prop_line, project

# Rotation players only — a 6-minute bench guy's "prop" isn't one anyone posts.
MIN_MINUTES = 12
RECENT_DAYS = 21
# A market is only posted when the player's last-10 average clears this —
# nobody books "a point guard's blocks, under 0.5", and those near-certain
# unders would otherwise crowd the top leans and flatter the tracker.
MIN_L10 = {"pts": 5, "reb": 3, "ast": 2, "fg3m": 1, "stl": 0.8, "blk": 0.8, "pra": 10, "stocks": 1.5}


def _fallback_roster(form, team_abbr, today):
    """Players whose most recent stored game was for `team_abbr` — used when
    ESPN's roster endpoint fails. Prefers players seen in the last few weeks,
    but at the start of a season nobody has, so it falls back to whoever
    last played for the team at all (the tail of last season)."""
    on_team = form[form["last_team"] == team_abbr]
    recent = on_team[on_team["last_date"] >= pd.Timestamp(today - timedelta(days=RECENT_DAYS))]
    chosen = recent if not recent.empty else on_team
    return [
        {"id": pid, "name": r["player"], "position": r["position"], "status": None}
        for pid, r in chosen.iterrows()
    ]


def build_slate(games, client, form, today, log=print):
    """[{player_id, name, team, opponent, is_home, position, status, game}]
    for every rotation player on a team playing today and not ruled out."""
    slate = []
    for game in games:
        for side, other, is_home in (("home", "away", 1), ("away", "home", 0)):
            team, opponent = game.get(side) or {}, game.get(other) or {}
            if not team.get("abbr") or not opponent.get("abbr"):
                continue
            roster = None
            if team.get("id"):
                try:
                    roster = client.get_team_roster(team["id"])
                except Exception as err:  # noqa: BLE001 — any fetch failure just means "use the fallback"
                    log(f"Roster fetch failed for {team['abbr']} ({err}); using last-known roster")
            if not roster:
                roster = _fallback_roster(form, team["abbr"], today)

            for player in roster:
                pid = player["id"]
                if pid not in form.index or (player.get("status") or "").lower() == "out":
                    continue
                if form.at[pid, "min_l5"] < MIN_MINUTES:
                    continue
                slate.append(
                    {
                        "player_id": pid,
                        "name": player.get("name") or form.at[pid, "player"],
                        "team": team["abbr"],
                        "opponent": opponent["abbr"],
                        "is_home": is_home,
                        "position": player.get("position") or form.at[pid, "position"],
                        "status": player.get("status"),
                        "game": game.get("name"),
                    }
                )
    return slate


# A player who sat out this many of his team's games in a row, right before
# today, gets flagged: his rolling averages predate whatever kept him out.
MISSED_GAMES_FLAG = 3


def history_flags(logs, form, slate):
    """player_id -> plain-language reasons his history may not describe
    tonight: he missed his team's most recent games, or he's on a new team.
    Flagged players stay on the board but are kept out of the top picks."""
    team_dates = {team: g["date"].drop_duplicates() for team, g in logs.groupby("team")}
    flags = {}
    for p in slate:
        pid = p["player_id"]
        last_team, last_date = form.at[pid, "last_team"], form.at[pid, "last_date"]
        reasons = []
        if last_team != p["team"]:
            reasons.append(f"New team (last played for {last_team})")
        else:
            missed = int((team_dates.get(last_team, pd.Series(dtype="datetime64[ns]")) > last_date).sum())
            if missed >= MISSED_GAMES_FLAG:
                reasons.append(f"Missed his team's last {missed} games")
        if reasons:
            flags[pid] = reasons
    return flags


def _r(value, digits=1):
    return round(float(value), digits)


def build_projections(logs, form, slate, games, today):
    flags = history_flags(logs, form, slate)
    players = {
        p["player_id"]: {
            "id": p["player_id"],
            "name": p["name"],
            "team": p["team"],
            "opp": p["opponent"],
            "home": p["is_home"],
            "pos": None if pd.isna(p["position"]) else p["position"],
            "status": p["status"],
            "game": p["game"],
            "min": _r(form.at[p["player_id"], "min_l5"]),
            "lastPlayed": form.at[p["player_id"], "last_date"].date().isoformat(),
            "flags": flags.get(p["player_id"], []),
            "props": {},
        }
        for p in slate
    }
    metrics = {}
    for stat in STATS:
        train = build_training_frame(logs, stat)
        upcoming = build_upcoming_frame(logs, stat, slate, form, today)
        metrics[stat] = backtest(train)
        projection, sigma = project(train, upcoming)
        for row, mu, sd in zip(upcoming.itertuples(index=False), projection, sigma):
            if row.l10 < MIN_L10[stat]:
                continue
            line = prop_line(row.l10)
            # The over price a book anchored on recent form would offer: the
            # same distribution, centred on the last-10 average instead.
            fair_sd = sd * (max(row.l10, 1.0) / max(mu, 1.0)) ** 0.5
            players[row.player_id]["props"][stat] = {
                "proj": _r(mu),
                "lo": _r(max(mu - sd, 0)),
                "hi": _r(mu + sd),
                "line": line,
                "pOver": _r(p_over(stat, mu, sd, line), 3),
                "pFair": _r(p_over(stat, row.l10, fair_sd, line), 3),
                "l5": _r(row.l5),
                "l10": _r(row.l10),
            }

    return {
        "date": today.isoformat(),
        "metrics": metrics,
        "trainedOnGames": int(logs["event_id"].nunique()) if not logs.empty else 0,
        "games": [
            {"id": g["id"], "name": g["name"], "start": g.get("date"), "home": g["home"].get("abbr"),
             "away": g["away"].get("abbr")}
            for g in games
        ],
        "players": sorted(
            (p for p in players.values() if p["props"]),
            key=lambda p: -p["props"].get("pts", {}).get("proj", 0),
        ),
        "graded": False,
    }
