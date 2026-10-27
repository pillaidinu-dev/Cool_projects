"""Feature engineering for the per-stat prop models.

Training rows are built only from games *before* each row's date (no
target leakage); the upcoming-slate rows use every game played so far.
Features are rolling windows over a player's own games regardless of season,
so early-season projections lean on the tail of last season rather than on
one or two games.
"""
import numpy as np
import pandas as pd

# Prop markets, each the sum of one or more box-score columns.
STATS = {
    "pts": ["pts"],
    "reb": ["reb"],
    "ast": ["ast"],
    "fg3m": ["fg3m"],
    "stl": ["stl"],
    "blk": ["blk"],
    "pra": ["pts", "reb", "ast"],
    "stocks": ["stl", "blk"],
}
# A double-double is 10+ in at least two of these.
DD_CATS = ["pts", "reb", "ast", "stl", "blk"]
# Every prop market: the summed stats above plus the double-double, a yes/no
# market (the `dd` column is 1 or 0, so its line is 0.5).
MARKETS = list(STATS) + ["dd"]
# Low-count markets whose over/under odds come from a Poisson tail rather
# than a normal approximation.
COUNT_STATS = {"fg3m", "stl", "blk", "stocks"}

FEATURE_COLS = ["l1", "l5", "l10", "l20", "min_l5", "games", "is_home", "rest", "opp_factor", "l10_opp"]
DEFENSE_WINDOW = 15


def add_derived(df):
    df = df.copy()
    for stat, parts in STATS.items():
        df[stat] = df[parts].sum(axis=1)
    df["dd"] = (df[DD_CATS].ge(10).sum(axis=1) >= 2).astype(float)
    return df


def _defense_allowed(df, stat):
    """Per defense per game: total `stat` the opposing players put up."""
    allowed = df.groupby(["opponent", "event_id", "date"], as_index=False)[stat].sum()
    return allowed.rename(columns={"opponent": "defense", stat: "allowed"}).sort_values("date")


def _training_defense_factor(df, stat):
    """(defense, event_id) -> how much more/less of `stat` that defense had
    allowed than the league average, both measured over games strictly
    before that one."""
    allowed = _defense_allowed(df, stat)
    allowed["prior"] = allowed.groupby("defense")["allowed"].transform(
        lambda s: s.shift(1).rolling(DEFENSE_WINDOW, min_periods=3).mean()
    )
    by_date = allowed.groupby("date")["allowed"].agg(["sum", "count"]).sort_index()
    league_prior = (by_date["sum"].cumsum().shift(1) / by_date["count"].cumsum().shift(1)).rename("league")
    allowed = allowed.merge(league_prior, left_on="date", right_index=True, how="left")
    allowed["opp_factor"] = (allowed["prior"] / allowed["league"]).replace([np.inf, -np.inf], np.nan).fillna(1.0)
    return allowed[["defense", "event_id", "opp_factor"]]


def current_defense_factors(df, stat):
    """defense -> factor over its most recent games, for the upcoming slate."""
    allowed = _defense_allowed(df, stat)
    if allowed.empty:
        return {}
    league = allowed["allowed"].mean() or 1.0
    recent = allowed.groupby("defense")["allowed"].apply(lambda s: s.tail(DEFENSE_WINDOW).mean())
    return (recent / league).to_dict()


def build_training_frame(df, stat):
    d = df.sort_values(["player_id", "date"]).copy()
    by_player = d.groupby("player_id")
    for n in (1, 5, 10, 20):
        d[f"l{n}"] = by_player[stat].transform(lambda s, n=n: s.shift(1).rolling(n, min_periods=1).mean())
    d["min_l5"] = by_player["min"].transform(lambda s: s.shift(1).rolling(5, min_periods=1).mean())
    d["games"] = by_player.cumcount().clip(upper=20)
    d["rest"] = (by_player["date"].diff().dt.days - 1).clip(0, 4).fillna(4)

    d = d.merge(_training_defense_factor(df, stat), left_on=["opponent", "event_id"],
                right_on=["defense", "event_id"], how="left")
    d["opp_factor"] = d["opp_factor"].fillna(1.0)
    d["l10_opp"] = d["l10"] * d["opp_factor"]
    d["target"] = d[stat]

    # Need a few prior games for the rolling windows to mean anything.
    d = d[d["games"] >= 3]
    return d[["player_id", "player", "date"] + FEATURE_COLS + ["target"]].reset_index(drop=True)


def player_form(df, today):
    """player_id -> rolling-window summary as of `today` (every stored game
    counts). Shared by every stat's upcoming frame."""
    d = df.sort_values(["player_id", "date"])
    last = d.groupby("player_id").tail(1).set_index("player_id")
    form = pd.DataFrame(
        {
            "player": last["player"],
            "last_team": last["team"],
            "position": last["position"],
            "last_date": last["date"],
            "games": d.groupby("player_id").size().clip(upper=20),
            "min_l5": d.groupby("player_id")["min"].apply(lambda s: s.tail(5).mean()),
        }
    )
    form["rest"] = ((pd.Timestamp(today) - form["last_date"]).dt.days - 1).clip(0, 4)
    return form


def build_upcoming_frame(df, stat, slate, form, today):
    """`slate` is [{player_id, team, opponent, is_home, ...}]; returns one row
    per slate player that has at least one stored game."""
    if not slate or df.empty:
        return pd.DataFrame(columns=["player_id"] + FEATURE_COLS)
    d = df.sort_values(["player_id", "date"])
    grouped = d.groupby("player_id")[stat]
    windows = pd.DataFrame({f"l{n}": grouped.apply(lambda s, n=n: s.tail(n).mean()) for n in (1, 5, 10, 20)})
    factors = current_defense_factors(df, stat)

    rows = []
    for p in slate:
        pid = p["player_id"]
        if pid not in windows.index:
            continue
        w = windows.loc[pid]
        opp_factor = float(factors.get(p["opponent"], 1.0))
        rows.append(
            {
                "player_id": pid,
                "l1": w["l1"], "l5": w["l5"], "l10": w["l10"], "l20": w["l20"],
                "min_l5": form.at[pid, "min_l5"],
                "games": form.at[pid, "games"],
                "is_home": p["is_home"],
                "rest": form.at[pid, "rest"],
                "opp_factor": opp_factor,
                "l10_opp": w["l10"] * opp_factor,
            }
        )
    return pd.DataFrame(rows, columns=["player_id"] + FEATURE_COLS)
