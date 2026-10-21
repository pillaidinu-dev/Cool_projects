"""Per-stat prop models.

Ridge regression on rolling-form features, like the NFL dashboard's yardage
models — a heavier model overfits the noise in a 10-game window, and Ridge
stays sane on players with thin history. On top of the point projection,
each prop gets a spread whose variance scales with the projection (a 30 ppg
scorer swings more than an 8 ppg one) and an over/under probability against
the line: a normal tail for points/rebounds/assists/PRA, a Poisson tail for
the low-count markets (threes, steals, blocks).
"""
import math

import numpy as np
from scipy.stats import norm, poisson
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error

from features import COUNT_STATS, FEATURE_COLS

MIN_TRAINING_ROWS = 60
ALPHA = 3.0


def _matrix(df):
    return df[FEATURE_COLS].to_numpy(dtype=float)


def _fallback(df):
    """Weighted recent form, for when there isn't enough history to fit on."""
    return (0.5 * df["l10"] + 0.3 * df["l5"] + 0.2 * df["l20"]).to_numpy(dtype=float)


def backtest(train_df, holdout_frac=0.2):
    """Fits on the earlier dates and scores the most recent ones (a time
    split, the way the model is actually used) — and scores a plain last-10
    -game average on the same rows, so the UI can show whether the model
    beats the naive baseline a bettor would use."""
    dates = np.sort(train_df["date"].unique())
    if len(train_df) < MIN_TRAINING_ROWS or len(dates) < 5:
        return None
    cutoff = dates[int(len(dates) * (1 - holdout_frac))]
    fit, test = train_df[train_df["date"] < cutoff], train_df[train_df["date"] >= cutoff]
    if len(fit) < MIN_TRAINING_ROWS // 2 or test.empty:
        return None
    model = Ridge(alpha=ALPHA).fit(_matrix(fit), fit["target"])
    pred = np.clip(model.predict(_matrix(test)), 0, None)
    return {
        "mae": round(float(mean_absolute_error(test["target"], pred)), 2),
        "baselineMae": round(float(mean_absolute_error(test["target"], test["l10"])), 2),
        "n": int(len(test)),
    }


def project(train_df, upcoming_df):
    """(projection, sigma) arrays for every upcoming row."""
    if upcoming_df.empty:
        return np.array([]), np.array([])
    if len(train_df) >= MIN_TRAINING_ROWS:
        model = Ridge(alpha=ALPHA).fit(_matrix(train_df), train_df["target"])
        fitted = np.clip(model.predict(_matrix(train_df)), 0, None)
        resid = train_df["target"].to_numpy(dtype=float) - fitted
        dispersion = float(np.mean(resid**2 / np.maximum(fitted, 1.0)))
        pred = np.clip(model.predict(_matrix(upcoming_df)), 0, None)
    else:
        pred = np.clip(_fallback(upcoming_df), 0, None)
        dispersion = 1.5
    sigma = np.sqrt(max(dispersion, 0.25) * np.maximum(pred, 1.0))
    return pred, sigma


def prop_line(l10):
    """The x.5 line nearest a player's last-10 average — the anchor
    sportsbooks typically start from, used here because there's no free
    source of real posted lines."""
    return max(math.floor(float(l10)) + 0.5, 0.5)


def p_over(stat, projection, sigma, line):
    if stat in COUNT_STATS:
        return float(poisson.sf(math.floor(line), max(projection, 1e-6)))
    return float(norm.sf(line, loc=projection, scale=max(sigma, 1e-6)))
