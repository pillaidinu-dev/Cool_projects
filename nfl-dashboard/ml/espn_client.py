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


def _all_games_final(events):
    """True if every game in a week's event list has already finished.

    ESPN's own notion of "current week" doesn't roll forward until some
    point after the last game (often not until Tuesday) — so on the tail
    end of a week (e.g. Monday, right up through Monday Night Football)
    "current" still points at a week that's otherwise fully played out. We
    want the *next* projectable week in that case, not a week where there's
    nothing left to project.
    """
    if not events:
        return False
    return all((e.get("status", {}).get("type", {}).get("state")) == "post" for e in events)


def get_current_week():
    """(year, week_number) to project — the week ESPN considers 'current',
    advanced by one if every game in that week has already finished."""
    data = _get("scoreboard")
    year = data.get("season", {}).get("year")
    week = data.get("week", {}).get("number")
    if not year or not week:
        raise RuntimeError("Could not determine the current NFL week from ESPN's scoreboard response")
    if _all_games_final(data.get("events", [])):
        week += 1
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
