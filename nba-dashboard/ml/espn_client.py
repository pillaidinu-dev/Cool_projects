"""Thin client for ESPN's public (unofficial, undocumented) NBA endpoints.
Same data source as the Node server (nba-dashboard/server/src/espn.js). No
API key is needed, but no response shape is guaranteed either, so every
field is read defensively.

NBA games are bucketed by US Eastern calendar date (a 10:30pm ET tip still
belongs to that day's slate), which is also how ESPN's `dates=` param works.
"""
import time

import requests

BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
TIMEOUT = 20
ATTEMPTS = 3


def _get(path, **params):
    """GET a JSON endpoint, retrying ESPN's transient failures — a 5xx, a
    dropped connection, or (seen in production on 2026-10-27) a 200 with an
    empty body. A 4xx is a real answer and is raised straight away."""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            res = requests.get(f"{BASE}/{path}", params=params, timeout=TIMEOUT)
            if res.status_code < 500:
                res.raise_for_status()
                return res.json()
            res.raise_for_status()
        except requests.HTTPError as err:
            if err.response is not None and err.response.status_code < 500:
                raise
            if attempt == ATTEMPTS:
                raise
        except (requests.ConnectionError, requests.Timeout, ValueError):
            if attempt == ATTEMPTS:
                raise
        time.sleep(2 * attempt)


def _ymd(day):
    return day.strftime("%Y%m%d")


# ESPN season types: 1 preseason, 2 regular season, 3 playoffs, 4 off-season
# (All-Star), 5 play-in. Only real games are worth training on.
REAL_GAME_SEASON_TYPES = {2, 3, 5}


def summarize_event(event):
    """{id, name, date, state, season_type, home, away} where home/away are
    {id, abbr}."""
    competition = (event.get("competitions") or [{}])[0]
    sides = {}
    for c in competition.get("competitors", []) or []:
        team = c.get("team") or {}
        sides[c.get("homeAway")] = {"id": team.get("id"), "abbr": team.get("abbreviation")}
    return {
        "id": event.get("id"),
        "name": event.get("shortName") or event.get("name", ""),
        "date": event.get("date"),
        "state": ((event.get("status") or {}).get("type") or {}).get("state"),  # pre | in | post
        "season_type": (event.get("season") or {}).get("type"),
        "home": sides.get("home", {}),
        "away": sides.get("away", {}),
    }


def get_scoreboard(day):
    """Every game on a given (Eastern) calendar date, summarized."""
    data = _get("scoreboard", dates=_ymd(day))
    return [summarize_event(e) for e in data.get("events", []) or []]


def get_event_summary(event_id):
    """Box score + header for a single game."""
    return _get("summary", event=event_id)


def get_team_roster(team_id):
    """[{id, name, position, status}] for a team's current roster, where
    status is ESPN's injury designation ("Out", "Day-To-Day", ...) or None."""
    data = _get(f"teams/{team_id}/roster")
    athletes = data.get("athletes", []) or []
    # Some ESPN rosters come grouped ({position, items: [...]}) rather than flat.
    if athletes and isinstance(athletes[0], dict) and "items" in athletes[0]:
        athletes = [a for group in athletes for a in group.get("items", []) or []]
    roster = []
    for a in athletes:
        injuries = a.get("injuries") or []
        status = (injuries[0] or {}).get("status") if injuries else None
        roster.append(
            {
                "id": str(a.get("id")),
                "name": a.get("displayName"),
                "position": (a.get("position") or {}).get("abbreviation"),
                "status": status,
            }
        )
    return roster
