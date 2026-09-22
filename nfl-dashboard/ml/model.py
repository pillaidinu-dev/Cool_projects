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


def project_yardage(train_df, upcoming_df):
    """Fits on every historical game so far and predicts the upcoming week.
    Returns (predictions_df with projection/low/high columns, backtested_mae)."""
    mae = backtest_mae(train_df)
    if train_df.empty or upcoming_df.empty:
        return upcoming_df.assign(projection=0.0, low=0.0, high=0.0), mae

    model = Ridge(alpha=5.0)
    model.fit(_matrix(train_df, FEATURE_COLS), train_df["target"].to_numpy(dtype=float))

    pred = np.clip(model.predict(_matrix(upcoming_df, FEATURE_COLS)), 0, None)
    resid = train_df["target"].to_numpy(dtype=float) - model.predict(_matrix(train_df, FEATURE_COLS))
    spread = float(np.std(resid)) if len(resid) > 1 else max(pred.std(), 1.0)

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
