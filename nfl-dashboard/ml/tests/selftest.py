#!/usr/bin/env python3
"""Exercises the feature/model pipeline against synthetic game logs, with no
network access — proves dataset.py's *shape* is consumed correctly by
features.py and model.py without needing a real ESPN connection. Run from
the ml/ directory: `python tests/selftest.py`.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import random

import pandas as pd

from features import FEATURE_COLS, build_training_frame, build_upcoming_frame
from model import project_touchdowns, project_yardage
from train import touchdown_rows, yardage_rows


def synthetic_gamelogs(weeks=5, seed=7):
    random.seed(seed)
    teams = ["AAA", "BBB", "CCC", "DDD"]
    rosters = {
        team: {
            "QB": [f"{team} QB1"],
            "RB": [f"{team} RB1", f"{team} RB2"],
            "WR": [f"{team} WR1", f"{team} WR2", f"{team} WR3"],
            "TE": [f"{team} TE1"],
        }
        for team in teams
    }
    rows = []
    for week in range(1, weeks + 1):
        pairings = list(zip(teams[::2], teams[1::2]))
        for home, away in pairings:
            for team, opp, is_home in ((home, away, 1), (away, home, 0)):
                for name in rosters[team]["QB"]:
                    att = random.randint(25, 38)
                    rows.append(
                        _row(week, team, opp, is_home, name, "QB", pass_att=att, pass_yards=random.randint(150, 340),
                             pass_td=random.randint(0, 3), pass_int=random.randint(0, 2))
                    )
                for name in rosters[team]["RB"]:
                    rows.append(
                        _row(week, team, opp, is_home, name, "RB", rush_car=random.randint(5, 22),
                             rush_yards=random.randint(10, 130), rush_td=random.choice([0, 0, 0, 1]))
                    )
                for name in rosters[team]["WR"] + rosters[team]["TE"]:
                    pos = "TE" if "TE" in name else "WR"
                    rows.append(
                        _row(week, team, opp, is_home, name, pos, rec=random.randint(1, 9),
                             rec_yards=random.randint(5, 120), rec_td=random.choice([0, 0, 0, 1]))
                    )
    return pd.DataFrame(rows), pairings


def _row(week, team, opponent, is_home, player, position, **stats):
    base = {
        "week": week, "year": 2026, "event_id": f"E{week}-{team}-{opponent}",
        "player": player, "team": team, "opponent": opponent, "is_home": is_home,
        "position": position,
        "pass_att": 0.0, "pass_yards": 0.0, "pass_td": 0.0, "pass_int": 0.0,
        "rush_car": 0.0, "rush_yards": 0.0, "rush_td": 0.0,
        "rec": 0.0, "rec_yards": 0.0, "rec_td": 0.0,
    }
    base.update({k: float(v) for k, v in stats.items()})
    return base


def main():
    gamelogs, last_pairings = synthetic_gamelogs()
    gamelogs["td_total"] = gamelogs["rush_td"] + gamelogs["rec_td"]
    matchups = [
        {"event_id": f"next-{h}-{a}", "name": f"{a} @ {h}", "home": h, "away": a} for h, a in last_pairings
    ]

    checks = 0

    for category, stat_col, positions in [
        ("passing", "pass_yards", ["QB"]),
        ("rushing", "rush_yards", ["RB"]),
        ("receiving", "rec_yards", ["WR", "TE"]),
    ]:
        train_df = build_training_frame(gamelogs, stat_col, positions)
        assert not train_df.empty, f"{category}: training frame is empty"
        assert list(train_df[FEATURE_COLS].columns) == FEATURE_COLS
        assert train_df[FEATURE_COLS].isna().sum().sum() == 0, f"{category}: NaNs leaked into features"

        upcoming_df = build_upcoming_frame(gamelogs, stat_col, positions, matchups)
        assert not upcoming_df.empty, f"{category}: upcoming frame is empty"

        predicted, mae = project_yardage(train_df, upcoming_df)
        assert (predicted["projection"] >= 0).all(), f"{category}: negative projection"
        assert (predicted["high"] >= predicted["low"]).all(), f"{category}: high < low"
        rows = yardage_rows(predicted)
        assert rows and "projection" in rows[0]
        checks += 1
        print(f"[ok] {category}: {len(train_df)} training rows, {len(upcoming_df)} projected, MAE={mae}")

    train_td = build_training_frame(gamelogs, "td_total", ["RB", "WR", "TE", "QB"])
    upcoming_td = build_upcoming_frame(gamelogs, "td_total", ["RB", "WR", "TE", "QB"], matchups)
    predicted_td = project_touchdowns(train_td, upcoming_td)
    assert ((predicted_td["td_probability"] >= 0) & (predicted_td["td_probability"] <= 1)).all(), "prob out of [0,1]"
    rows = touchdown_rows(predicted_td)
    assert rows and "probability" in rows[0]
    checks += 1
    print(f"[ok] touchdowns: {len(train_td)} training rows, {len(upcoming_td)} projected")

    from espn_client import _all_games_final

    assert _all_games_final([]) is False, "no events shouldn't count as 'final'"
    assert _all_games_final([{"status": {"type": {"state": "post"}}}]) is True
    assert (
        _all_games_final(
            [{"status": {"type": {"state": "post"}}}, {"status": {"type": {"state": "in"}}}]
        )
        is False
    ), "one game still in progress means the week isn't done"
    assert _all_games_final([{"status": {"type": {"state": "pre"}}}]) is False
    print("[ok] week rollover: _all_games_final")

    _test_get_current_week_advances_on_a_quiet_weekday()
    print("[ok] week rollover: get_current_week")

    _test_parse_boxscore_position_fallback()
    print("[ok] boxscore: position fallback from stat category")

    print(f"\nselftest passed ({checks + 4} sections)")


def _test_get_current_week_advances_on_a_quiet_weekday():
    """Regression test for a real bug: the bare `scoreboard` call's own
    `events` list defaults to *today's* games, not the whole current week's
    -- empty on any non-game day. get_current_week() must check the full
    named week (a second, explicit call), not that today-only list, or it
    silently never advances past a week that finished days ago.
    """
    import espn_client

    responses = {
        ("scoreboard", ()): {"season": {"year": 2026}, "week": {"number": 1}, "events": []},
        ("scoreboard", (("seasontype", 2), ("week", 1), ("year", 2026))): {
            "events": [
                {"status": {"type": {"state": "post"}}},
                {"status": {"type": {"state": "post"}}},
            ]
        },
    }

    def fake_get(path, **params):
        key = (path, tuple(sorted(params.items())))
        if key not in responses:
            raise AssertionError(f"unexpected ESPN call: {path} {params}")
        return responses[key]

    original_get = espn_client._get
    espn_client._get = fake_get
    try:
        year, week = espn_client.get_current_week()
    finally:
        espn_client._get = original_get

    assert (year, week) == (2026, 2), (
        f"expected get_current_week() to advance past a fully-final week 1 to week 2, got {(year, week)}"
    )


def _test_parse_boxscore_position_fallback():
    """Regression test for a real bug: ESPN's real boxscore athlete stub
    carries NO position field at all (confirmed against live data: id, uid,
    guid, firstName, lastName, displayName, links, headshot, jersey -- and
    nothing else). The code assumed `athlete.position.abbreviation` existed,
    which only ever held on synthetic test fixtures -- every real gamelog
    row came back position=None until this was caught in production. The
    fix falls back to the stat category itself (passing -> QB, rushing ->
    RB, receiving -> WR), with passing always winning so a mobile QB's
    rushing line can't unset the QB tag his passing line established.
    """
    from boxscore import parse_boxscore

    def athlete(id_, name):
        return {"id": id_, "uid": f"s:20~l:28~a:{id_}", "displayName": name, "jersey": "1"}

    summary = {
        "header": {
            "competitions": [
                {
                    "competitors": [
                        {"team": {"abbreviation": "BUF"}, "homeAway": "home"},
                        {"team": {"abbreviation": "DEN"}, "homeAway": "away"},
                    ]
                }
            ]
        },
        "boxscore": {
            "players": [
                {
                    "team": {"abbreviation": "DEN"},
                    "statistics": [
                        {
                            "name": "rushing",
                            "labels": ["CAR", "YDS", "TD"],
                            "athletes": [
                                {"athlete": athlete("1", "Mobile QB"), "stats": ["4", "16", "1"]},
                                {"athlete": athlete("2", "Real RB"), "stats": ["18", "90", "1"]},
                            ],
                        },
                        {
                            "name": "passing",
                            "labels": ["C/ATT", "YDS", "TD", "INT"],
                            "athletes": [
                                {"athlete": athlete("1", "Mobile QB"), "stats": ["17/28", "131", "1", "1"]},
                            ],
                        },
                    ],
                },
            ]
        },
    }

    rows = {r["player"]: r for r in parse_boxscore(summary, week=2, year=2026, event_id="1")}
    assert rows["Mobile QB"]["position"] == "QB", (
        f"passing must win over rushing regardless of category order, got {rows['Mobile QB']['position']}"
    )
    assert rows["Real RB"]["position"] == "RB"
    assert rows["Mobile QB"]["opponent"] == "BUF"
    assert rows["Mobile QB"]["is_home"] == 0


if __name__ == "__main__":
    main()
