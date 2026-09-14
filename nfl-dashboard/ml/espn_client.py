"""Thin client for ESPN's public (unofficial) NFL endpoints, used to pull the
historical game-log data the projection models train on. Same data source as
the Node server (nfl-dashboard/server/src/espn.js), just walked by week
number instead of by calendar date.
"""
import requests

BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
TIMEOUT = 20


def _get(path, **params):
    res = requests.get(f"{BASE}/{path}", params=params, timeout=TIMEOUT)
    res.raise_for_status()
    return res.json()


def get_current_week():
    """(year, week_number) for the week ESPN currently considers 'current'."""
    data = _get("scoreboard")
    year = data.get("season", {}).get("year")
    week = data.get("week", {}).get("number")
    if not year or not week:
        raise RuntimeError("Could not determine the current NFL week from ESPN's scoreboard response")
    return year, week


def get_week_events(year, week, seasontype=2):
    """[{id, name}] for every game in a given regular-season week."""
    data = _get("scoreboard", seasontype=seasontype, week=week, year=year)
    return [
        {"id": e["id"], "name": e.get("shortName", e.get("name", ""))}
        for e in data.get("events", [])
    ]


def get_event_summary(event_id):
    """Box score + header (team/home-away) for a single game."""
    return _get("summary", event=event_id)
