"""Builds the historical player-game-log dataset the models train on, by
walking every completed week of the current season through ESPN's API.
"""
import pandas as pd

import espn_client
from boxscore import parse_boxscore


def fetch_week_gamelogs(year, week):
    """All player-game rows for a single, already-played week of `year`."""
    rows = []
    events = espn_client.get_week_events(year, week)
    for event in events:
        summary = espn_client.get_event_summary(event["id"])
        rows.extend(parse_boxscore(summary, week, year, event["id"]))
    return pd.DataFrame(rows)


def fetch_season_gamelogs(year, through_week):
    """All player-game rows for weeks 1..through_week-1 of `year`'s regular season."""
    frames = [fetch_week_gamelogs(year, week) for week in range(1, through_week)]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def fetch_upcoming_matchups(year, week):
    """[{event_id, name, home, away}] for the week being projected."""
    events = espn_client.get_week_events(year, week)
    matchups = []
    for event in events:
        summary = espn_client.get_event_summary(event["id"])
        competitors = (summary.get("header", {}).get("competitions") or [{}])[0].get("competitors", [])
        home = next((c["team"]["abbreviation"] for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c["team"]["abbreviation"] for c in competitors if c.get("homeAway") == "away"), None)
        matchups.append({"event_id": event["id"], "name": event["name"], "home": home, "away": away})
    return matchups
