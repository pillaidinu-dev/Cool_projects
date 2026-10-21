"""The accumulated player-game-log store the models train on: one CSV per
game date under <data_dir>/boxscores/, plus <data_dir>/state.json recording
the last date fully fetched.

Each daily run only fetches the dates since the last one, so ESPN sees a
handful of requests a day instead of a whole season's worth. The very first
run (an empty store) bootstraps by walking backwards from yesterday until it
has `bootstrap_game_days` days that actually had games — which reaches back
into last season when it's early in this one, so opening-week projections
still have real history behind them.
"""
import json
from datetime import timedelta
from pathlib import Path

import pandas as pd
import requests

import espn_client
from boxscore import COLUMNS, parse_boxscore


def _boxscore_dir(data_dir):
    return Path(data_dir) / "boxscores"


def _state_path(data_dir):
    return Path(data_dir) / "state.json"


def read_state(data_dir):
    try:
        return json.loads(_state_path(data_dir).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_state(data_dir, state):
    _state_path(data_dir).write_text(json.dumps(state, indent=2) + "\n")


def is_real_game(event):
    """Preseason and All-Star games don't count (and ESPN often 404s their
    box scores). An event with no season type is assumed to be real."""
    season_type = event.get("season_type")
    return season_type is None or season_type in espn_client.REAL_GAME_SEASON_TYPES


def _fetch_day(client, day, log=print):
    """(rows, had_games) for every finished real game on `day`. A game whose
    box score ESPN can't serve is skipped, not fatal — one missing summary
    shouldn't stop a whole season's bootstrap."""
    events = [e for e in client.get_scoreboard(day) if is_real_game(e)]
    rows = []
    for event in events:
        if event["state"] != "post":
            continue
        try:
            summary = client.get_event_summary(event["id"])
        except requests.HTTPError as err:
            log(f"Skipping {event.get('name') or event['id']} on {day}: {err}")
            continue
        rows.extend(parse_boxscore(summary, day.isoformat(), event["id"]))
    return rows, bool(events)


def _write_day(data_dir, day, rows):
    out = _boxscore_dir(data_dir) / f"{day.isoformat()}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).to_csv(out, index=False)


def update(data_dir, today, client=espn_client, bootstrap_game_days=40, max_lookback_days=240, log=print):
    """Fetches every completed date before `today` that isn't stored yet.
    Returns the list of dates written."""
    state = read_state(data_dir)
    yesterday = today - timedelta(days=1)
    written = []

    last = state.get("lastFetched")
    if last:
        day = pd.Timestamp(last).date() + timedelta(days=1)
        while day <= yesterday:
            rows, _ = _fetch_day(client, day, log)
            if rows:
                _write_day(data_dir, day, rows)
                written.append(day)
            day += timedelta(days=1)
    else:
        log(f"Empty game-log store: bootstrapping the last {bootstrap_game_days} game days...")
        day, game_days = yesterday, 0
        while game_days < bootstrap_game_days and (yesterday - day).days < max_lookback_days:
            rows, had_games = _fetch_day(client, day, log)
            if rows:
                _write_day(data_dir, day, rows)
                written.append(day)
            game_days += int(had_games)
            day -= timedelta(days=1)

    if yesterday.isoformat() > (last or ""):
        state["lastFetched"] = yesterday.isoformat()
        _write_state(data_dir, state)
    return sorted(written)


def load(data_dir, since=None):
    """Every stored player-game row (optionally only dates >= `since`)."""
    frames = []
    for path in sorted(_boxscore_dir(data_dir).glob("*.csv")):
        if since and path.stem < since.isoformat():
            continue
        frames.append(pd.read_csv(path, dtype={"player_id": str, "event_id": str}))
    if not frames:
        return pd.DataFrame(columns=COLUMNS)
    df = pd.concat([f for f in frames if not f.empty] or frames, ignore_index=True)
    df["date"] = pd.to_datetime(df["date"])
    return df
