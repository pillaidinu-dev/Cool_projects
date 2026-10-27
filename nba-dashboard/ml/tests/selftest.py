#!/usr/bin/env python3
"""End-to-end check of the daily prop pipeline against a synthetic league
served in ESPN's response shapes (tests/fake_espn.py) — no network needed.
Runs daily.run() day by day the way the scheduled job does, then asserts
on the box-score store, the saved slates, grading and the tracker.

Run from the ml/ directory: `python tests/selftest.py`
"""
import json
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import daily  # noqa: E402
from boxscore import parse_boxscore, parse_minutes  # noqa: E402
from fake_espn import FakeESPN  # noqa: E402
from features import MARKETS, STATS  # noqa: E402
from model import p_over, prop_line  # noqa: E402


def quiet(_msg):
    pass


def test_pipeline():
    start, today = date(2026, 10, 1), date(2026, 11, 10)
    with tempfile.TemporaryDirectory() as tmp:
        data = Path(tmp)
        # Bootstrap run on an empty store, then one run per day for 8 days.
        for offset in range(8, -1, -1):
            day = today - timedelta(days=offset)
            fake = FakeESPN(start, days=45, now=day)
            summary = daily.run(data, day, client=fake, log=quiet)

        assert (data / "state.json").exists()
        assert json.loads((data / "state.json").read_text())["lastFetched"] == (today - timedelta(days=1)).isoformat()
        box_files = sorted((data / "boxscores").glob("*.csv"))
        assert len(box_files) >= 20, f"expected a bootstrapped store, got {len(box_files)} days"

        slates = sorted((data / "projections").glob("*.json"))
        assert slates, "no slates saved"
        docs = [json.loads(p.read_text()) for p in slates]
        todays = docs[-1]
        assert todays["date"] == today.isoformat() and not todays["graded"], "today's slate should be ungraded"
        assert all(d["graded"] for d in docs[:-1]), "every past slate should be graded"

        players = todays["players"]
        assert players, "today's slate has no players"
        names = {p["name"] for p in players}
        assert not any("Deep Bench" in n for n in names), "sub-12-minute players should be filtered out"
        assert "BOS Sixth Man" not in names, "players ruled Out on the roster should be excluded"
        for p in players:
            assert isinstance(p["flags"], list) and p["lastPlayed"]
            assert p["props"] and set(p["props"]) <= set(MARKETS), f"{p['name']}: {set(p['props'])}"
            for stat, prop in p["props"].items():
                assert 0 <= prop["pOver"] <= 1 and 0 <= prop["pFair"] <= 1, f"{stat} probability out of range"
                if stat == "dd":
                    assert prop["proj"] == prop["pOver"] and 0 <= prop["l10"] <= 1, "dd is a yes/no market"
                    continue
                assert prop["lo"] <= prop["proj"] <= prop["hi"], f"{stat} range doesn't contain projection"
                assert prop["line"] % 1 == 0.5, f"{stat} line {prop['line']} isn't a half-point"
        from projections import MIN_L10

        posted = [(s, prop) for p in players for s, prop in p["props"].items()]
        assert all(prop["l10"] >= MIN_L10[s] for s, prop in posted if s != "dd"), "posted a market below its L10 floor"
        assert {s for s, _ in posted} == set(MARKETS), "every market should be posted for someone"
        dd_posted = sorted((prop["pOver"], name) for name, prop in ((p["name"], p["props"]["dd"]) for p in players if "dd" in p["props"]))
        assert any("Big Man" in name for _, name in dd_posted[-3:]), f"16-and-11 big men belong near the top, got {dd_posted[-3:]}"
        assert not any("Deep Bench" in name or "Sixth Man" in name for _, name in dd_posted[-5:]), dd_posted[-5:]
        for stat, m in todays["metrics"].items():
            if stat == "dd":
                assert m and 0 <= m["brier"] <= 0.25 and m["brier"] <= m["baselineBrier"] + 0.02, f"dd backtest {m}"
                continue
            assert m and m["mae"] >= 0 and m["baselineMae"] >= 0, f"{stat} has no backtest"

        graded = docs[-2]
        played = [p for p in graded["players"] if p["actual"]]
        assert played and all("result" in prop for p in played for prop in p["props"].values())
        for p in played:
            a = p["actual"]
            assert a["dd"] == float(sum(a[c] >= 10 for c in ("pts", "reb", "ast", "stl", "blk")) >= 2)
        assert history_has_dd(data), "double-double props should be graded into the tracker"

        history = json.loads((data / "history.json").read_text())
        assert history["overall"]["n"] > 0 and 0 <= history["overall"]["hitRate"] <= 1
        assert sum(d["n"] for d in history["days"]) == history["overall"]["n"]
        assert sum(b["n"] for b in history["calibration"]) == history["overall"]["n"]
        assert abs(sum(d["units"] for d in history["days"]) - history["overall"]["units"]) < 0.1
        assert history["overall"]["roi"] is not None
        assert json.loads((data / "latest.json").read_text())["date"] == today.isoformat()
        assert json.loads((data / "index.json").read_text())["dates"] == [p.stem for p in reversed(slates)]

        # Re-running after tip-off must not overwrite the frozen slate.
        before = (data / "projections" / f"{today.isoformat()}.json").read_text()
        started = FakeESPN(start, days=45, now=today + timedelta(days=1))
        summary = daily.run(data, today, client=started, log=quiet)
        assert summary["slate"].startswith("kept"), summary
        assert (data / "projections" / f"{today.isoformat()}.json").read_text() == before

        print(f"[ok] pipeline: {len(box_files)} box-score days, {len(slates)} slates, "
              f"{history['overall']['n']} graded props, ROI {history['overall']['roi']}, "
              f"top-10 ROI {history['topPicks']['roi']}")


def history_has_dd(data):
    history = json.loads((data / "history.json").read_text())
    return history["byStat"]["dd"]["n"] > 0


def test_parse_boxscore():
    summary = {
        "header": {"competitions": [{"competitors": [
            {"homeAway": "home", "team": {"abbreviation": "LAL"}},
            {"homeAway": "away", "team": {"abbreviation": "GSW"}},
        ]}]},
        "boxscore": {"players": [{
            "team": {"abbreviation": "GSW"},
            "statistics": [{
                # keys only, no labels: the newer payload shape
                "keys": ["minutes", "points", "rebounds", "assists", "steals", "blocks", "turnovers",
                         "threePointFieldGoalsMade-threePointFieldGoalsAttempted"],
                "athletes": [
                    {"athlete": {"id": "1", "displayName": "Shooter"}, "starter": True,
                     "stats": ["36:30", "31", "4", "6", "2", "0", "3", "7-13"]},
                    {"athlete": {"id": "2", "displayName": "Benched"}, "didNotPlay": True, "stats": []},
                    {"athlete": {"id": "3", "displayName": "Zero Min"}, "stats": ["0", "0", "0", "0", "0", "0", "0", "0-0"]},
                ],
            }],
        }]},
    }
    rows = parse_boxscore(summary, "2026-11-01", "99")
    assert [r["player"] for r in rows] == ["Shooter"], rows
    r = rows[0]
    assert (r["pts"], r["fg3m"], r["fg3a"], r["opponent"], r["is_home"]) == (31, 7, 13, "LAL", 0)
    assert abs(r["min"] - 36.5) < 1e-9
    assert parse_minutes("34") == 34 and parse_minutes(None) == 0
    print("[ok] boxscore: keys-only payload, DNP and zero-minute rows skipped")


def test_pricing():
    from grade import edge, lean, units

    under_line = {"pOver": 0.41, "pFair": 0.30}  # line above the mean: under is the "easy" side
    assert lean(under_line) == "over", "model rates the over above its price, so it leans over"
    assert abs(edge(under_line) - 0.11) < 1e-9
    assert abs(units(under_line, True) - (1 / 0.30 - 1)) < 1e-9 and units(under_line, False) == -1
    assert lean({"pOver": 0.62, "pFair": 0.70}) == "under"
    print("[ok] grade: leans priced against the L10-average line")


def test_fetch_day_skips_preseason_and_missing_summaries():
    """Regression test for the first live run: ESPN 404'd one game's
    summary during the bootstrap and the whole run died. Preseason games are
    now filtered out, and any single unservable summary is skipped."""
    import requests

    import gamelogs
    from fake_espn import FakeESPN

    day = date(2026, 10, 2)
    fake = FakeESPN(date(2026, 10, 1), days=5, now=date(2026, 10, 5))
    real = fake.get_scoreboard(day)
    missing_id, kept = real[0]["id"], real[1:]

    class Client:
        def get_scoreboard(self, _day):
            preseason = {**real[0], "id": "pre1", "season_type": 1}
            return real + [preseason]

        def get_event_summary(self, event_id):
            if event_id in (missing_id, "pre1"):
                raise requests.HTTPError(f"404 Client Error: Not Found for event {event_id}")
            return fake.get_event_summary(event_id)

    logged = []
    rows, had_games = gamelogs._fetch_day(Client(), day, log=logged.append)
    assert had_games and rows
    assert {r["event_id"] for r in rows} == {e["id"] for e in kept}, "kept games should all be parsed"
    assert len(logged) == 1 and missing_id in logged[0], logged
    assert gamelogs.is_real_game({"season_type": None}) and not gamelogs.is_real_game({"season_type": 1})
    print("[ok] gamelogs: preseason filtered, a missing box score is skipped not fatal")


def test_bootstrap_backfills_an_older_store():
    """Regression test for the first live run: the old bootstrap stopped
    after 40 game days of any kind, which right after opening night meant
    almost only playoff games (16 teams). It now counts regular-season days,
    skips non-real games, and backfills a store built by the old rule
    (state.json without the current bootstrap version) on its next run."""
    import gamelogs

    class League:
        """Day 0..9 before `today`: 2 regular-season days just behind us,
        then 5 playoff days, then regular season again."""

        def __init__(self, today):
            self.today, self.summaries = today, 0
            self.fake = FakeESPN(today - timedelta(days=40), days=40, now=today)

        def kind(self, day):
            back = (self.today - day).days
            return 2 if back <= 2 or back > 7 else 3

        def get_scoreboard(self, day):
            return [{**e, "season_type": self.kind(day)} for e in self.fake.get_scoreboard(day)]

        def get_event_summary(self, event_id):
            self.summaries += 1
            return self.fake.get_event_summary(event_id)

    today = date(2026, 10, 22)
    with tempfile.TemporaryDirectory() as tmp:
        data = Path(tmp)
        league = League(today)
        old_day = today - timedelta(days=1)
        gamelogs._write_day(data, old_day, gamelogs._fetch_day(league, old_day)[0])
        (data / "state.json").write_text(json.dumps({"lastFetched": old_day.isoformat()}))
        before = league.summaries

        gamelogs.update(data, today, client=league, bootstrap_regular_days=6, log=quiet)
        state = json.loads((data / "state.json").read_text())
        assert state["bootstrap"] == gamelogs.BOOTSTRAP_VERSION and state["lastFetched"] == old_day.isoformat()
        stored = sorted(p.stem for p in (data / "boxscores").glob("*.csv"))
        regular = [d for d in stored if league.kind(date.fromisoformat(d)) == 2]
        assert len(regular) >= 6, f"backfill should reach 6 regular-season days past the playoffs, got {stored}"
        refetched = (league.summaries - before) // 3  # 3 games a day
        assert refetched == len(stored) - 1, "the day already on disk shouldn't be fetched again"

        league.summaries = 0
        gamelogs.update(data, today, client=league, bootstrap_regular_days=6, log=quiet)
        assert league.summaries == 0, "a store on the current bootstrap version shouldn't backfill again"
    print("[ok] gamelogs: bootstrap counts regular-season days and backfills older stores")


def test_history_flags():
    """Flags the two cases where a player's rolling history doesn't describe
    tonight: he sat out his team's recent games, or he changed teams. A
    team simply not playing (eliminated, off-season) is not a flag."""
    from features import player_form
    from projections import history_flags

    def g(pid, team, day):
        return {"player_id": pid, "player": pid, "team": team, "position": "G", "date": pd.Timestamp(day), "min": 30.0}

    import pandas as pd
    rows = [g("regular", "AAA", f"2026-04-0{d}") for d in range(1, 9)]
    rows += [g("hurt", "AAA", f"2026-04-0{d}") for d in range(1, 4)]  # sat out AAA's last 5
    rows += [g("traded", "BBB", "2026-04-08")]
    rows += [g("eliminated", "CCC", "2026-04-03")]  # CCC's season ended; nobody missed anything
    logs = pd.DataFrame(rows)
    form = player_form(logs, date(2026, 10, 21))
    slate = [{"player_id": pid, "team": team} for pid, team in
             [("regular", "AAA"), ("hurt", "AAA"), ("traded", "AAA"), ("eliminated", "CCC")]]
    flags = history_flags(logs, form, slate)
    assert set(flags) == {"hurt", "traded"}, flags
    assert flags["hurt"] == ["Missed his team's last 5 games"]
    assert flags["traded"] == ["New team (last played for BBB)"]
    print("[ok] projections: flags missed-games and new-team players only")


def test_espn_retries_transient_failures():
    """Regression test for 2026-10-27: ESPN answered the scoreboard with an
    empty 200 and the whole daily run crashed. Transient failures (5xx, a
    dropped connection, a non-JSON body) are retried; a 4xx is not."""
    import requests

    import espn_client

    class Res:
        def __init__(self, status, body):
            self.status_code, self.body = status, body

        def raise_for_status(self):
            if self.status_code >= 400:
                err = requests.HTTPError(f"{self.status_code}")
                err.response = self
                raise err

        def json(self):
            if self.body is None:
                raise requests.exceptions.JSONDecodeError("Expecting value", "", 0)
            return self.body

    def run(responses):
        calls = []

        def fake_get(url, params=None, timeout=None):
            calls.append(url)
            return responses[len(calls) - 1]

        original, sleep = espn_client.requests.get, espn_client.time.sleep
        espn_client.requests.get, espn_client.time.sleep = fake_get, lambda _s: None
        try:
            return espn_client._get("scoreboard"), len(calls)
        finally:
            espn_client.requests.get, espn_client.time.sleep = original, sleep

    assert run([Res(200, None), Res(503, {}), Res(200, {"events": []})]) == ({"events": []}, 3)
    try:
        run([Res(404, {})])
        raise AssertionError("a 404 must raise, not retry")
    except requests.HTTPError:
        pass
    print("[ok] espn_client: empty bodies and 5xx retried, 4xx raised")


def test_lines_and_odds():
    assert prop_line(24.3) == 24.5 and prop_line(24.9) == 24.5 and prop_line(0.2) == 0.5
    assert p_over("pts", 30, 6, 24.5) > 0.5 > p_over("pts", 20, 6, 24.5)
    assert abs(p_over("blk", 1.0, 1.0, 0.5) - (1 - 2.718281828 ** -1)) < 1e-6
    print("[ok] model: half-point lines and over probabilities")


if __name__ == "__main__":
    test_parse_boxscore()
    test_lines_and_odds()
    test_pricing()
    test_fetch_day_skips_preseason_and_missing_summaries()
    test_bootstrap_backfills_an_older_store()
    test_history_flags()
    test_espn_retries_transient_failures()
    test_pipeline()
    print("\nselftest passed")
