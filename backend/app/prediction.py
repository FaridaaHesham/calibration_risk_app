"""
prediction.py — Calibration interval prediction engine.

This module is self-contained (no DB dependency). It operates on plain
Python data structures so it can be called from any router or tested
independently.

HOW IT WORKS
------------
1. Every test row in calibration_tests gets a closeness-to-edge score:
       score = |deviation| / ((max_value - min_value) / 2) * 100
   0 % = dead centre, 100 % = right at the limit, >100 % = failed.

2. One calibration visit (calibration_record) -> one visit score = the
   MAX score across all its test rows (weakest-link principle).

3. All visit scores are sorted by calibration_year to form a timeline.

4. predict_calibration_interval() applies the rules in order:
   Rule 1 - latest visit failed                    -> 1 year
   Rule 2 - latest score >= threshold               -> 1 year
   Rule 3 - meaningful rising trend for 2+ years    -> 1 year
   Rule 4 - fewer than 2 visits                     -> 1 year
   Rule 5 - 3+ visits all below threshold           -> 2 years
   Rule 6 - default (safe option)                   -> 1 year
"""

# ── Easy-to-change settings ───────────────────────────────────────────────
# Readings above this percentage of the allowed range trigger a 1-year interval
# even if the device technically passed.
EDGE_WARNING_THRESHOLD: float = 75.0

# For Rule 3: an "upward trend" must rise by at least this many percentage
# points per step to count as meaningful drift, not just measurement noise.
MIN_TREND_INCREASE: float = 10.0

# How much a visit's score is driven by its single worst test vs. the
# average of all its tests. 1.0 = only the worst test matters (old
# behaviour); 0.0 = only the average matters. A blend means one test
# sitting right on its tolerance boundary can't single-handedly declare
# the whole visit "at the limit" if every other test that day was fine —
# but a visit with several borderline or failing tests will still score
# high, since the average rises too.
WORST_CASE_WEIGHT: float = 0.6
# ─────────────────────────────────────────────────────────────────────────


def closeness_to_edge(deviation: float, min_value: float, max_value: float) -> float:
    """
    Return how close (0-100 %) a single reading was to the edge of the
    allowed range.

    0%   = dead centre of the tolerance band (perfect)
    100% = exactly at the edge, OR past it (failed)

    The score is deliberately capped at 100% — once a reading is at or
    past the limit, how FAR past it went doesn't change the action a
    technician takes (recalibrate now), so letting the number climb to
    300% or 1000% adds no useful information. It would only distort the
    chart's scale and make every other, genuinely informative point
    harder to read.

    Returns 0.0 if the range is zero or inputs are invalid.
    """
    try:
        half_range = (float(max_value) - float(min_value)) / 2.0
        if half_range <= 0:
            return 0.0
        raw_score = abs(float(deviation)) / half_range * 100.0
        return min(raw_score, 100.0)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def visit_score(tests: list[dict]) -> float:
    """
    Given a list of test dicts for one calibration record, return the
    visit's overall closeness-to-edge score.

    This is a weighted blend of the single worst test's score and the
    average across all tests in the visit (see WORST_CASE_WEIGHT above).
    A pure "worst test wins" approach means one reading sitting exactly on
    its tolerance boundary — even while every other test that day passed
    comfortably — drags the entire visit to 100%. Blending in the average
    means an isolated boundary-hugging reading raises the score without
    letting it single-handedly define the whole visit, while a visit with
    multiple weak or failing tests still correctly scores high (since both
    the worst-case term AND the average rise together).

    Each dict must have keys: deviation, min_value, max_value.
    Tests with missing/None values should already be filtered out by the
    caller — they carry no usable measurement and should not be scored as 0.
    """
    if not tests:
        return 0.0
    scores = [
        closeness_to_edge(t.get("deviation", 0), t.get("min_value", 0), t.get("max_value", 0))
        for t in tests
    ]
    worst = max(scores)
    average = sum(scores) / len(scores)
    return WORST_CASE_WEIGHT * worst + (1 - WORST_CASE_WEIGHT) * average


def avg_signed_deviation(tests: list[dict]) -> float | None:
    """
    Return the average signed deviation for a visit's tests.
    Deviation convention: reference_value - actual_value
      positive = reading is below the reference (under-reading)
      negative = reading is above the reference (over-reading)
    Returns None if no valid tests.
    """
    valid = [float(t["deviation"]) for t in tests if t.get("deviation") is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)


def signed_visit_score(tests: list[dict]) -> float:
    """
    Return the visit closeness-to-edge score preserving direction (sign).
    The sign is determined by the test with the largest absolute closeness-to-edge.
    """
    if not tests:
        return 0.0
    worst_test = None
    max_score = -1.0
    for t in tests:
        score = closeness_to_edge(t.get("deviation", 0), t.get("min_value", 0), t.get("max_value", 0))
        if score > max_score:
            max_score = score
            worst_test = t
    
    dev = worst_test.get("deviation", 0) if worst_test else 0.0
    sign = -1.0 if dev < 0 else 1.0
    
    abs_score = visit_score(tests)
    return abs_score * sign


def build_year_scores(records: list[dict]) -> list[dict]:
    """
    Build the year-by-year score timeline for a device (or a single
    accessory's track within a device).

    `records` is a list of dicts, each representing one calibration_record:
        {
          "year": int,
          "result": str,          # "Pass" | "Fail"
          "tests": [ { deviation, min_value, max_value }, ... ]
        }

    Returns a list sorted by year:
        [
          { "year": 2021, "score": 34.2, "signed_score": 34.2, "result": "Pass", "signed_deviation": 0.12 },
          ...
        ]
    If a year has multiple records (rare), the worst score is used.
    """
    year_map: dict[int, dict] = {}
    for rec in records:
        year = rec.get("year")
        result = (rec.get("result") or "").strip()
        score = visit_score(rec.get("tests", []))
        s_score = signed_visit_score(rec.get("tests", []))
        signed_dev = avg_signed_deviation(rec.get("tests", []))
        if year is None:
            continue
        if year not in year_map or score > year_map[year]["score"]:
            year_map[year] = {
                "year": year,
                "score": round(score, 2),
                "signed_score": round(s_score, 2),
                "result": result,
                "signed_deviation": round(signed_dev, 4) if signed_dev is not None else None,
            }

    return sorted(year_map.values(), key=lambda x: x["year"])


def predict_calibration_interval(
    year_scores: list[dict],
    edge_warning_threshold: float | None = None,
    min_trend_increase: float | None = None,
) -> dict:
    """
    Apply prediction rules to a device's (or accessory track's) year-by-year
    score timeline.

    `year_scores` is the output of build_year_scores().

    Optionally pass `edge_warning_threshold` and `min_trend_increase` to
    override the module-level defaults (used by the configurable settings UI).

    Returns:
        {
          "interval_years": int,   # 1 or 2
          "rule": str,             # short identifier
          "message": str,          # plain English short summary
          "reasoning": str,        # detailed plain-language explanation
        }
    """
    threshold = edge_warning_threshold if edge_warning_threshold is not None else EDGE_WARNING_THRESHOLD
    trend_inc = min_trend_increase if min_trend_increase is not None else MIN_TREND_INCREASE

    n = len(year_scores)

    # Rule 4 — not enough history
    if n < 2:
        msg = (
            f"Only {n} calibration visit(s) on record. "
            "At least 2 are needed to assess trends. Defaulting to 1-year interval."
        )
        reasoning = (
            f"We only have {n} calibration record(s) for this device, which is not enough "
            "to identify a trend or confirm consistent performance. "
            "To be safe, we are recommending annual calibration until more data is available."
        )
        return {
            "interval_years": 1,
            "rule": "not enough history",
            "message": msg,
            "reasoning": reasoning,
        }

    latest = year_scores[-1]
    latest_score = latest["score"]
    latest_result = (latest["result"] or "").strip().lower()
    scores = [y["score"] for y in year_scores]
    years = [y["year"] for y in year_scores]

    # Rule 1 — latest visit failed
    if latest_result == "fail":
        msg = (
            f"The most recent calibration ({latest['year']}) recorded a Fail result. "
            "Immediate annual recalibration is required."
        )
        reasoning = (
            f"The calibration performed in {latest['year']} resulted in a Fail — meaning the device's "
            "readings were outside the acceptable limits. A device that has failed calibration "
            "must be recalibrated within 1 year to confirm it has been corrected and is "
            "back within safe operating range."
        )
        return {
            "interval_years": 1,
            "rule": "most recent calibration failed",
            "message": msg,
            "reasoning": reasoning,
        }

    # Rule 2 — latest score above warning threshold
    if latest_score >= threshold:
        msg = (
            f"Most recent score ({latest_score:.1f}%) exceeds the "
            f"{threshold:.0f}% warning threshold. "
            "Annual calibration recommended."
        )
        reasoning = (
            f"In the most recent calibration ({latest['year']}), the device's readings were "
            f"{latest_score:.1f}% of the way toward the failure limit — above our {threshold:.0f}% "
            "warning threshold. This means the device is getting close to the boundary of acceptable "
            "performance. Annual calibration ensures we catch any further drift before it becomes "
            "a problem."
        )
        return {
            "interval_years": 1,
            "rule": "reading above warning threshold",
            "message": msg,
            "reasoning": reasoning,
        }

    # Rule 3 — meaningfully trending upward for 2 consecutive years
    if (
        n >= 3
        and (scores[-1] - scores[-2]) >= trend_inc
        and (scores[-2] - scores[-3]) >= trend_inc
    ):
        score_summary = " → ".join(
            f"{years[i]}: {scores[i]:.1f}%" for i in range(-3, 0)
        )
        msg = (
            f"Scores have risen meaningfully for 2 consecutive years "
            f"({year_scores[-3]['year']}: {scores[-3]:.1f}% -> "
            f"{year_scores[-2]['year']}: {scores[-2]:.1f}% -> "
            f"{year_scores[-1]['year']}: {scores[-1]:.1f}%). "
            "Upward drift detected — annual calibration recommended."
        )
        reasoning = (
            f"Over the last 3 calibrations, this device's closeness-to-limit score has risen "
            f"consistently: {score_summary}. Each year increased by more than {trend_inc:.0f} percentage "
            "points, which indicates the device is gradually drifting toward its tolerance limits. "
            "This kind of steady upward trend is an early warning sign of instrument drift. "
            "Annual calibration is recommended to keep a close eye on this device and intervene "
            "before it approaches the failure zone."
        )
        return {
            "interval_years": 1,
            "rule": "trending upward for 2 consecutive years",
            "message": msg,
            "reasoning": reasoning,
        }

    # Rule 5 — last 3 visits comfortably below threshold
    if n >= 3 and all(s < threshold for s in scores[-3:]):
        score_summary = ", ".join(f"{years[i]}: {scores[i]:.1f}%" for i in range(-3, 0))
        msg = (
            f"All {n} calibration visits recorded scores below "
            f"{threshold:.0f}% (most recent: {latest_score:.1f}%). "
            "Device is stable — 2-year calibration interval recommended."
        )
        reasoning = (
            f"This device has a solid track record across all {n} calibrations on file "
            f"({score_summary}). Every visit showed readings comfortably within the acceptable "
            f"range — all below the {threshold:.0f}% warning threshold. There is no sign of "
            "drift or deterioration. Based on this consistent stability, we are confident "
            "that a 2-year calibration interval is safe and appropriate for this device."
        )
        return {
            "interval_years": 2,
            "rule": "3+ years of stable readings",
            "message": msg,
            "reasoning": reasoning,
        }

    # Rule 6 — default
    return {
        "interval_years": 1,
        "rule": "default safe interval",
        "message": (
            "Insufficient data to confirm extended stability. "
            "Defaulting to the safer 1-year calibration interval."
        ),
        "reasoning": (
            f"With {n} calibrations on record, the data does not yet clearly show a stable "
            "pattern or a worrying trend — but it is also not enough to confidently extend to "
            "a 2-year interval. To be safe, annual calibration is recommended until the device "
            "builds a longer consistent track record."
        ),
    }


def stability_from_rule(rule: str, latest_score: float) -> tuple[str, str]:
    """
    Single source of truth for mapping a prediction rule to a
    (stability_key, display_label) pair. Both routers call this instead of
    keeping their own duplicate copies, so the labeling logic can never
    drift out of sync between the chart page and the predictions list.
    """
    if rule == "3+ years of stable readings":
        return "stable", "Stable"
    if rule in (
        "most recent calibration failed",
        "reading above warning threshold",
        "trending upward for 2 consecutive years",
    ):
        return "unstable", "Needs Attention"
    # "not enough history" and "default safe interval" land here
    return "marginal", "Marginal"