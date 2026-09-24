"""Model training + backtesting for the weekly projection categories.

Ridge regression (not a bigger model like gradient boosting) is deliberate:
early in a season there are only a handful of games per player, and a
high-variance model overfits that noise badly. Ridge's regularization keeps
projections sane when a player has 1-2 games of history, and its accuracy
converges toward a heavier model's as more weeks of data accumulate.
"""
import numpy as np
from sklearn.linear_model import PoissonRegressor, Ridge
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance
from sklearn.model_selection import KFold

from features import FEATURE_COLS

TD_ALPHA_GRID = [0.1, 0.3, 1.0, 3.0, 10.0, 30.0]
TD_ALPHA_DEFAULT = 1.0

# Games of personal history weighted evenly against the pooled/global
# residual variance when building a player's own low-high band -- see
# _blended_player_variance.
PLAYER_SPREAD_SHRINKAGE_GAMES = 4


def _matrix(df, cols):
    return df[cols].to_numpy(dtype=float)


def backtest_mae(train_df, n_splits=5):
    """Cross-validated MAE for a yardage target, shown in the UI so viewers
    can see how trustworthy the current model actually is (and why early
    -season projections carry a wider band than late-season ones)."""
    if len(train_df) < 12:
        return None
    X, y = _matrix(train_df, FEATURE_COLS), train_df["target"].to_numpy(dtype=float)
    splits = min(n_splits, len(train_df) // 4)
    if splits < 2:
        return None
    kf = KFold(n_splits=splits, shuffle=True, random_state=7)
    errors = []
    for train_idx, test_idx in kf.split(X):
        model = Ridge(alpha=5.0)
        model.fit(X[train_idx], y[train_idx])
        errors.append(mean_absolute_error(y[test_idx], model.predict(X[test_idx])))
    return float(np.mean(errors))


def _blended_player_variance(train_df, resid, keys, global_var, k=PLAYER_SPREAD_SHRINKAGE_GAMES):
    """Each player's own residual variance, shrunk toward the pooled/global
    variance via empirical-Bayes weighting. A band should reflect how
    volatile THIS player specifically has been -- a bell-cow back who
    grinds out a steady 80-90 yards every week deserves a tighter band than
    a boom-bust one projected at the same number -- but 1-2 games of
    personal history is too noisy a sample to trust on its own. Weight on
    the player's own variance grows with games played: at `k` games it's
    split 50/50 with the global variance, approaching fully personal as
    more accumulate; a player with 0-1 games (or who wasn't in the training
    frame at all -- a debut) falls back to the global variance entirely.

    `keys` is a (player, team) DataFrame, one row per player being
    projected, in the same order as the predictions it corresponds to.
    """
    resid_df = train_df[["player", "team"]].assign(resid=resid)
    grouped = resid_df.groupby(["player", "team"])["resid"]
    player_var = grouped.var()  # ddof=1 (pandas default) -> NaN when n < 2
    player_n = grouped.size()

    variances = []
    for _, row in keys.iterrows():
        pkey = (row["player"], row["team"])
        n = int(player_n.get(pkey, 0))
        pv = player_var.get(pkey)
        if n >= 2 and pv is not None and not np.isnan(pv):
            weight = n / (n + k)
            variances.append(weight * pv + (1 - weight) * global_var)
        else:
            variances.append(global_var)
    return np.array(variances)


def project_yardage(train_df, upcoming_df):
    """Fits on every historical game so far and predicts the upcoming week.
    Returns (predictions_df with projection/low/high columns, backtested_mae).

    Each player's low-high band is their own residual variance blended
    toward the position group's pooled variance (see
    _blended_player_variance) rather than one fixed spread applied to
    everyone -- a consistent player's band narrows as their track record
    accumulates, instead of every player at a position sharing an
    identically-wide band all season."""
    mae = backtest_mae(train_df)
    if train_df.empty or upcoming_df.empty:
        return upcoming_df.assign(projection=0.0, low=0.0, high=0.0), mae

    model = Ridge(alpha=5.0)
    model.fit(_matrix(train_df, FEATURE_COLS), train_df["target"].to_numpy(dtype=float))

    pred = np.clip(model.predict(_matrix(upcoming_df, FEATURE_COLS)), 0, None)
    resid = train_df["target"].to_numpy(dtype=float) - model.predict(_matrix(train_df, FEATURE_COLS))
    global_var = float(np.var(resid)) if len(resid) > 1 else max(float(pred.var()), 1.0)

    variance = _blended_player_variance(train_df, resid, upcoming_df[["player", "team"]], global_var)
    spread = np.sqrt(np.clip(variance, 0.0, None))

    out = upcoming_df.copy()
    out["projection"] = pred
    out["low"] = np.clip(pred - spread, 0, None)
    out["high"] = pred + spread
    return out, mae


def _best_td_alpha(train_df, n_splits=5):
    """Cross-validated pick of the Poisson regressor's alpha (L2 penalty) by
    mean Poisson deviance -- the correct scoring rule for a count model,
    where MAE would reward under-confident predictions that hug the mean.
    Falls back to TD_ALPHA_DEFAULT when there isn't enough history to split
    reliably, same threshold as backtest_mae uses for the yardage models.
    """
    if len(train_df) < 12:
        return TD_ALPHA_DEFAULT
    X, y = _matrix(train_df, FEATURE_COLS), train_df["target"].to_numpy(dtype=float)
    splits = min(n_splits, len(train_df) // 4)
    if splits < 2:
        return TD_ALPHA_DEFAULT

    kf = KFold(n_splits=splits, shuffle=True, random_state=7)
    fold_idx = list(kf.split(X))
    best_alpha, best_score = TD_ALPHA_DEFAULT, None
    for alpha in TD_ALPHA_GRID:
        scores = []
        for train_idx, test_idx in fold_idx:
            model = PoissonRegressor(alpha=alpha, max_iter=500)
            model.fit(X[train_idx], y[train_idx])
            pred = np.clip(model.predict(X[test_idx]), 1e-6, None)
            scores.append(mean_poisson_deviance(y[test_idx], pred))
        mean_score = float(np.mean(scores))
        if best_score is None or mean_score < best_score:
            best_alpha, best_score = alpha, mean_score
    return best_alpha


def project_touchdowns(train_df, upcoming_df):
    """Poisson regression on TD counts per game -> expected TDs -> P(>=1 TD),
    the same math sportsbooks use to price an "anytime touchdown scorer" line.
    The L2 penalty (alpha) is cross-validated per run rather than fixed, since
    a flat guess either underfits once enough weeks of history accumulate or
    overfits the sparse early-season data -- see _best_td_alpha."""
    if train_df.empty or upcoming_df.empty:
        return upcoming_df.assign(expected_td=0.0, td_probability=0.0)

    alpha = _best_td_alpha(train_df)
    model = PoissonRegressor(alpha=alpha, max_iter=500)
    model.fit(_matrix(train_df, FEATURE_COLS), train_df["target"].to_numpy(dtype=float))

    lam = np.clip(model.predict(_matrix(upcoming_df, FEATURE_COLS)), 0, None)
    out = upcoming_df.copy()
    out["expected_td"] = lam
    out["td_probability"] = 1 - np.exp(-lam)
    return out
