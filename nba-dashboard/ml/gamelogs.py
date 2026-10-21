"""The accumulated player-game-log store the models train on: one CSV per
game date under <data_dir>/boxscores/, plus <data_dir>/state.json recording
the last date fully fetched.

Each daily run only fetches the dates since the last one, so ESPN sees a
handful of requests a day instead of a whole season's worth. The very first
run (an empty store) bootstraps by walking backwards from yesterday until it
has `bootstrap_regular_days` days of regular-season games — which reaches
back past last season's playoffs when it's early in this one, so
opening-week projections have every team's history behind them.
"""
import json
from datetime import timedelta
from pathlib import Path

import pandas as pd
import requests

import espn_client
from boxscore import COLUMNS, parse_boxscore

REGULAR_SEASON = 2
# Bump when the bootstrap rule changes; stores built under an older rule are
# backfilled on their next run.
BOOTSTRAP_VERSION = 2


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


def _real_events(client, day):
    return [e for e in client.get_scoreboard(day) if is_real_game(e)]


def _fetch_rows(client, day, events, log=print):
    """Rows for every finished game in `events`. A game whose box score ESPN
    can't serve is skipped, not fatal — one missing summary shouldn't stop
    a whole season's bootstrap."""
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
    return rows


def _fetch_day(client, day, log=print):
    """(rows, had_games) for every finished real game on `day`."""
    events = _real_events(client, day)
    return _fetch_rows(client, day, events, log), bool(events)


def _day_path(data_dir, day):
    return _boxscore_dir(data_dir) / f"{day.isoformat()}.csv"


def _write_day(data_dir, day, rows):
    out = _day_path(data_dir, day)
    out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).to_csv(out, index=False)


def _bootstrap(data_dir, client, yesterday, regular_days, max_lookback_days, log):
    """Walks back from yesterday until `regular_days` days of regular-season
    games are stored, fetching box scores only for dates not already on disk.

    Counting regular-season days (not just any game day) matters early in a
    season: the 40 game days before opening night are mostly playoffs, which
    covers only 16 teams and inflates every starter's minutes."""
    written, found, day = [], 0, yesterday
    while found < regular_days and (yesterday - day).days < max_lookback_days:
        events = _real_events(client, day)
        if any(e.get("season_type") in (None, REGULAR_SEASON) for e in events):
            found += 1
        if events and not _day_path(data_dir, day).exists():
            rows = _fetch_rows(client, day, events, log)
            if rows:
                _write_day(data_dir, day, rows)
                written.append(day)
        day -= timedelta(days=1)
    log(f"Bootstrap: {found} regular-season game days within {(yesterday - day).days} days")
    return written


def update(data_dir, today, client=espn_client, bootstrap_regular_days=30, max_lookback_days=300, log=print):
    """Fetches every completed date before `today` that isn't stored yet.
    Returns the list of dates written.

    A store that hasn't been through the current bootstrap (an empty one, or
    one built by an older version) is backfilled first, so changing the
    bootstrap rule fixes existing data on the next run without a reset."""
    state = read_state(data_dir)
    yesterday = today - timedelta(days=1)
    written = []

    if state.get("bootstrap") != BOOTSTRAP_VERSION:
        log(f"Bootstrapping the last {bootstrap_regular_days} regular-season game days...")
        written += _bootstrap(data_dir, client, yesterday, bootstrap_regular_days, max_lookback_days, log)
        state["bootstrap"] = BOOTSTRAP_VERSION

    last = state.get("lastFetched")
    if last:
        day = pd.Timestamp(last).date() + timedelta(days=1)
        while day <= yesterday:
            if not _day_path(data_dir, day).exists():
                rows, _ = _fetch_day(client, day, log)
                if rows:
                    _write_day(data_dir, day, rows)
                    written.append(day)
            day += timedelta(days=1)

    state["lastFetched"] = max(last or "", yesterday.isoformat())
    _write_state(data_dir, state)
    return sorted(set(written))


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
