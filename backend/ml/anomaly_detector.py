"""Anomaly detection for expense amounts.

Pure stdlib; an IsolationForest-based helper uses scikit-learn via a guarded
import and degrades gracefully when sklearn is unavailable.
"""
import statistics

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised when sklearn is missing
    IsolationForest = None
    SKLEARN_AVAILABLE = False

_MIN_SAMPLES = 4


def detect_anomaly(amount, amount_history, category=""):
    """Flag a single transaction against its category history.

    Uses the sample standard deviation; with fewer than 4 history samples the
    call is a no-op (not enough data).  A transaction is flagged when its
    z-score exceeds 2.5 or the amount exceeds 3x the median.

    Returns {"isAnomaly", "anomalyReason", "zScore", "pctAboveMean"}.
    """
    history = [float(x) for x in (amount_history or [])]
    amount = float(amount)

    if len(history) < _MIN_SAMPLES:
        return {
            "isAnomaly": False,
            "anomalyReason": "",
            "zScore": 0,
            "pctAboveMean": 0,
        }

    mu = statistics.mean(history)
    sigma = statistics.stdev(history) if len(history) > 1 else 0.0
    median = statistics.median(history)

    if sigma == 0:
        max_hist = max(history)
        threshold = 3 * median if median > 0 else 3 * max_hist
        flag = amount > threshold
        z_score = 0
    else:
        z_score = (amount - mu) / sigma
        flag = z_score > 2.5 or amount > 3 * median

    if flag:
        if mu > 0:
            pct = round(((amount - mu) / mu) * 100)
        else:
            pct = None
        if pct is not None:
            reason = "{}% higher than your average spend in {}".format(
                pct, category or "this category"
            )
        else:
            reason = "Significantly higher than your average spend"
        return {
            "isAnomaly": True,
            "anomalyReason": reason,
            "zScore": round(z_score, 4),
            "pctAboveMean": pct if pct is not None else 0,
        }

    return {
        "isAnomaly": False,
        "anomalyReason": "",
        "zScore": round(z_score, 4),
        "pctAboveMean": 0,
    }
def batch_anomaly_scores(expenses):
    """Flag each expense against its own category's history.

    Groups by category (defaulting to "") and runs detect_anomaly per expense,
    returning the same shape as the input plus "isAnomaly" and "anomalyReason".
    """
    grouped = {}
    for expense in expenses or []:
        category = str(expense.get("category") or "")
        grouped.setdefault(category, []).append(expense)

    results = []
    for expense in expenses or []:
        category = str(expense.get("category") or "")
        history = [float(e.get("amount", 0)) for e in grouped.get(category, [])]
        amount = float(expense.get("amount", 0))
        verdict = detect_anomaly(amount, history, category)
        record = dict(expense)
        record.update(verdict)
        results.append(record)
    return results


def isolation_forest_anomalies(amounts, contamination=0.05):
    """Return indices flagged by IsolationForest.

    Uses scikit-learn behind a guarded import; returns [] when sklearn is
    missing.  amount with fewer than 6 samples is not worth running isolation
    forest, so an empty list is returned as an indication of "no signal".
    """
    if not SKLEARN_AVAILABLE:
        return []
    amounts = [float(x) for x in (amounts or [])]
    if len(amounts) < 6:
        return []
    try:
        import numpy as np

        model = IsolationForest(
            contamination=contamination, random_state=42, n_estimators=64
        )
        model.fit(np.array(amounts).reshape(-1, 1))
        predictions = model.predict(np.array(amounts).reshape(-1, 1))
        return [i for i, p in enumerate(predictions) if p == -1]
    except Exception:
        return []