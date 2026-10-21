"""A stand-in for espn_client that serves a synthetic league in ESPN's real
NBA response shapes (scoreboard events, summary box scores with
labels/stats arrays, team rosters). Games dated before `now` are final;
games on or after it haven't tipped off yet. Used by the selftest and by
make_sample.py, so both exercise the real parsing and pipeline code.
"""
import random
from datetime import timedelta

from espn_client import summarize_event

TEAMS = ["BOS", "NYK", "LAL", "GSW", "DEN", "MIL"]
LABELS = ["MIN", "FG", "3PT", "FT", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TO", "PF", "+/-", "PTS"]
# (name suffix, position, minutes, pts, reb, ast, fg3m, stl, blk)
ARCHETYPES = [
    ("Star Guard", "G", 35, 27, 5, 7, 3.2, 1.3, 0.4),
    ("Wing Scorer", "F", 33, 20, 6, 3, 2.4, 1.0, 0.6),
    ("Big Man", "C", 31, 16, 11, 2, 0.4, 0.7, 2.0),
    ("Point Guard", "G", 30, 14, 4, 8, 1.8, 1.4, 0.2),
    ("Stretch Four", "F", 26, 11, 6, 2, 2.0, 0.6, 0.8),
    ("Sixth Man", "G", 24, 12, 3, 3, 1.6, 0.8, 0.2),
    ("Backup Big", "C", 17, 6, 6, 1, 0.1, 0.4, 1.0),
    ("Deep Bench", "G", 7, 2, 1, 1, 0.3, 0.2, 0.0),
]


class FakeESPN:
    def __init__(self, start, days, now, seed=11):
        self.now = now
        self.rng = random.Random(seed)
        self.team_strength = {t: self.rng.uniform(0.85, 1.15) for t in TEAMS}
        self.players = {
            t: [
                {"id": f"{ti}{pi:02d}", "name": f"{t} {a[0]}", "arch": a, "skill": self.rng.uniform(0.8, 1.2)}
                for pi, a in enumerate(ARCHETYPES)
            ]
            for ti, t in enumerate(TEAMS, start=1)
        }
        self.schedule = {}
        for i in range(days):
            day = start + timedelta(days=i)
            if i % 7 == 3:  # an off day each week
                continue
            order = TEAMS[:]
            self.rng.shuffle(order)
            self.schedule[day] = [
                {"id": f"{day:%Y%m%d}{g}", "home": order[2 * g], "away": order[2 * g + 1]} for g in range(3)
            ]
        self._summaries = {}

    def _event(self, day, game):
        state = "post" if day < self.now else "pre"
        team_id = {t: str(i) for i, t in enumerate(TEAMS, start=1)}
        return {
            "id": game["id"],
            "shortName": f"{game['away']} @ {game['home']}",
            "date": f"{day.isoformat()}T23:30Z",
            "status": {"type": {"state": state, "shortDetail": "Final" if state == "post" else "7:30 PM ET"}},
            "competitions": [
                {
                    "competitors": [
                        {"homeAway": "home", "team": {"id": team_id[game["home"]], "abbreviation": game["home"]}},
                        {"homeAway": "away", "team": {"id": team_id[game["away"]], "abbreviation": game["away"]}},
                    ]
                }
            ],
        }

    # --- espn_client interface -------------------------------------------
    def get_scoreboard(self, day):
        return [summarize_event(self._event(day, g)) for g in self.schedule.get(day, [])]

    def get_event_summary(self, event_id):
        if event_id not in self._summaries:
            day, game = next((d, g) for d, gs in self.schedule.items() for g in gs if g["id"] == event_id)
            self._summaries[event_id] = self._box(day, game)
        return self._summaries[event_id]

    def get_team_roster(self, team_id):
        team = TEAMS[int(team_id) - 1]
        return [
            {"id": p["id"], "name": p["name"], "position": p["arch"][1], "status": "Out" if p["arch"][0] == "Sixth Man" and team == "BOS" else None}
            for p in self.players[team]
        ]

    # --- synthetic box scores ---------------------------------------------
    def _line(self, player, defense):
        _, _, mins, pts, reb, ast, fg3m, stl, blk = player["arch"]
        r, k, d = self.rng, player["skill"], self.team_strength[defense]
        minutes = max(int(r.gauss(mins, 3)), 1)
        scale = k * minutes / mins

        def draw(mean):
            return max(int(round(r.gauss(mean * scale, (mean * scale) ** 0.5 + 0.3))), 0)

        threes = draw(fg3m * d)
        points = max(draw(pts * d), 3 * threes)
        rebounds, assists, steals, blocks = draw(reb), draw(ast), draw(stl), draw(blk)
        threes_att = threes + draw(fg3m * 1.6)
        return [
            str(minutes), f"{points // 2}-{points}", f"{threes}-{threes_att}", "0-0", "1", str(max(rebounds - 1, 0)),
            str(rebounds), str(assists), str(steals), str(blocks), "1", "2", "+3", str(points),
        ]

    def _box(self, day, game):
        players = []
        for team, opp in ((game["home"], game["away"]), (game["away"], game["home"])):
            athletes = []
            for p in self.players[team]:
                if self.rng.random() < 0.04:
                    athletes.append({"athlete": {"id": p["id"], "displayName": p["name"]}, "didNotPlay": True, "stats": []})
                    continue
                athletes.append(
                    {
                        "athlete": {"id": p["id"], "displayName": p["name"], "position": {"abbreviation": p["arch"][1]}},
                        "starter": p["arch"][0] in {"Star Guard", "Wing Scorer", "Big Man", "Point Guard", "Stretch Four"},
                        "didNotPlay": False,
                        "stats": self._line(p, opp),
                    }
                )
            players.append({"team": {"abbreviation": team}, "statistics": [{"labels": LABELS, "athletes": athletes}]})
        return {
            "header": {"competitions": [self._event(day, game)["competitions"][0]]},
            "boxscore": {"players": players},
        }
