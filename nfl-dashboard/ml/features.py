"""Feature engineering shared between model training (features built only
from *prior* weeks, to avoid leaking the target) and generating this week's
projections (features built from every game played so far, including the
most recent one).
"""
import pandas as pd

FEATURE_COLS = ["prev", "roll3", "season_avg", "games_played", "is_home", "opp_allowed_avg"]


def _team_week_allowed(df, stat_col):
    allowed = df.groupby(["opponent", "week"])[stat_col].sum().reset_index()
    return allowed.rename(columns={"opponent": "defense_team", stat_col: "allowed"})


def build_training_frame(df, stat_col, position_filter):
    """One row per player-game with leakage-free features (built from games
    strictly before that row's week) and the target column."""
    scoped = df[df["position"].isin(position_filter)].sort_values(["player", "team", "week"]).copy()

    # NB: SeriesGroupBy.apply(fn) returns a MultiIndex of (group keys...,
    # original row index) — drop only the group-key levels (level=[0, 1]) so
    # the remaining index still lines up with `scoped`'s own index for the
    # label-aligned assignments below. A plain reset_index(drop=True) would
    # silently renumber positionally and corrupt every row after the first
    # group, since `scoped` itself is not 0..n-1 indexed after filtering.
    grp = scoped.groupby(["player", "team"])[stat_col]
    scoped["prev"] = grp.shift(1).fillna(0.0)
    scoped["roll3"] = (
        grp.apply(lambda s: s.shift(1).rolling(3, min_periods=1).mean())
        .reset_index(level=[0, 1], drop=True)
        .fillna(0.0)
    )
    scoped["season_avg"] = (
        grp.apply(lambda s: s.shift(1).expanding(min_periods=1).mean())
        .reset_index(level=[0, 1], drop=True)
        .fillna(0.0)
    )
    scoped["games_played"] = scoped.groupby(["player", "team"]).cumcount()

    allowed = _team_week_allowed(df, stat_col).sort_values(["defense_team", "week"])
    allowed["opp_allowed_avg"] = (
        allowed.groupby("defense_team")["allowed"]
        .apply(lambda s: s.shift(1).expanding(min_periods=1).mean())
        .reset_index(level=0, drop=True)
    )
    lookup = allowed.set_index(["defense_team", "week"])["opp_allowed_avg"]
    league_avg = df[stat_col].mean() if len(df) else 0.0
    scoped["opp_allowed_avg"] = scoped.apply(
        lambda r: lookup.get((r["opponent"], r["week"]), league_avg), axis=1
    ).fillna(league_avg)

    scoped["target"] = scoped[stat_col]
    # Keep rows where the player had at least some history, or actually
    # produced the stat this game — nothing for the model to learn from an
    # all-zero debut row otherwise.
    scoped = scoped[(scoped["games_played"] > 0) | (scoped["target"] > 0)]
    return scoped[["player", "team", "opponent", "week"] + FEATURE_COLS + ["target"]].reset_index(drop=True)


def build_upcoming_frame(df, stat_col, position_filter, matchups, lookback_weeks=2):
    """One row per likely participant for the week being projected, with
    features computed from every game played so far (including the most
    recent one — there's no "next game" leakage to worry about here)."""
    scoped = df[df["position"].isin(position_filter)].copy()
    if scoped.empty:
        return pd.DataFrame(columns=["player", "team", "position", "opponent", "is_home"] + FEATURE_COLS)

    current_week = int(df["week"].max())
    recent = scoped[scoped["week"] > current_week - lookback_weeks][["player", "team"]].drop_duplicates()

    def summarize(group):
        ordered = group.sort_values("week")
        return pd.Series(
            {
                "position": ordered["position"].iloc[-1],
                "prev": ordered[stat_col].iloc[-1],
                "roll3": ordered[stat_col].tail(3).mean(),
                "season_avg": ordered[stat_col].mean(),
                "games_played": len(ordered),
            }
        )

    summary = scoped.groupby(["player", "team"]).apply(summarize, include_groups=False).reset_index()
    summary = summary.merge(recent, on=["player", "team"], how="inner")

    allowed = _team_week_allowed(df, stat_col)
    overall_allowed = allowed.groupby("defense_team")["allowed"].mean()
    league_avg = df[stat_col].mean() if len(df) else 0.0

    team_to_opponent, team_to_home = {}, {}
    for m in matchups:
        if m["home"] and m["away"]:
            team_to_opponent[m["home"]] = m["away"]
            team_to_opponent[m["away"]] = m["home"]
            team_to_home[m["home"]] = 1
            team_to_home[m["away"]] = 0

    rows = []
    for _, r in summary.iterrows():
        opponent = team_to_opponent.get(r["team"])
        if opponent is None:
            continue  # bye week
        rows.append(
            {
                "player": r["player"],
                "team": r["team"],
                "position": r["position"],
                "opponent": opponent,
                "is_home": team_to_home.get(r["team"], 0),
                "prev": r["prev"],
                "roll3": r["roll3"],
                "season_avg": r["season_avg"],
                "games_played": r["games_played"],
                "opp_allowed_avg": overall_allowed.get(opponent, league_avg),
            }
        )
    return pd.DataFrame(rows)
