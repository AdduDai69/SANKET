"""
SANKET Civic Risk Engine

Deterministic, explainable civic-risk scoring.
No random values.
No synthetic data.

Risk score: 0-100
Risk levels:
    0-29   Low
    30-59  Medium
    60-79  High
    80-100 Critical
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


RISK_ENGINE_VERSION = "1.0.0"


# Component weights must add up to 1.0.
WEIGHTS = {
    "severity": 0.35,
    "waiting": 0.25,
    "corroboration": 0.25,
    "recurrence": 0.15,
}


SEVERITY_SCORES = {
    "low": 20.0,
    "medium": 50.0,
    "high": 75.0,
    "critical": 100.0,
}


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def calculate_waiting_days(created_at: Any) -> float:
    """
    Calculate how many days an incident has existed.

    Future timestamps are treated as zero days.
    Missing/invalid timestamps return zero.
    """

    if not created_at:
        return 0.0

    try:
        if isinstance(created_at, datetime):
            timestamp = created_at

        else:
            timestamp_string = str(created_at)

            if timestamp_string.endswith("Z"):
                timestamp_string = timestamp_string[:-1] + "+00:00"

            timestamp = datetime.fromisoformat(timestamp_string)

        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)

        days = (now - timestamp).total_seconds() / 86400

        return max(0.0, days)

    except (ValueError, TypeError, OverflowError):
        return 0.0


def waiting_score(waiting_days: float) -> float:
    """
    Convert unresolved age into a deterministic 0-100 score.

    0 days       -> 0
    1 day        -> 20
    3 days       -> 40
    7 days       -> 60
    14 days      -> 75
    30+ days     -> 100
    """

    days = max(0.0, float(waiting_days))

    if days <= 1:
        return days * 20.0

    if days <= 3:
        return 20.0 + ((days - 1) / 2) * 20.0

    if days <= 7:
        return 40.0 + ((days - 3) / 4) * 20.0

    if days <= 14:
        return 60.0 + ((days - 7) / 7) * 15.0

    if days <= 30:
        return 75.0 + ((days - 14) / 16) * 25.0

    return 100.0


def corroboration_score(report_count: Any) -> float:
    """
    More independent citizen reports increase confidence that
    the issue is repeatedly observed.

    1 report  -> 20
    2 reports -> 50
    3 reports -> 70
    4 reports -> 85
    5+        -> 100
    """

    try:
        count = max(1, int(report_count or 1))
    except (ValueError, TypeError):
        count = 1

    mapping = {
        1: 20.0,
        2: 50.0,
        3: 70.0,
        4: 85.0,
    }

    return mapping.get(count, 100.0)


def recurrence_score(recurrence_count: Any) -> float:
    """
    Recurrence indicates that an issue has returned or persisted
    through repeated incident cycles.

    0 -> 0
    1 -> 40
    2 -> 65
    3 -> 85
    4+ -> 100
    """

    try:
        count = max(0, int(recurrence_count or 0))
    except (ValueError, TypeError):
        count = 0

    mapping = {
        0: 0.0,
        1: 40.0,
        2: 65.0,
        3: 85.0,
    }

    return mapping.get(count, 100.0)


def severity_score(severity: Any) -> float:
    if not severity:
        return 50.0

    return SEVERITY_SCORES.get(str(severity).lower(), 50.0)


def get_risk_level(score: float) -> str:
    score = clamp(score)

    if score >= 80:
        return "critical"

    if score >= 60:
        return "high"

    if score >= 30:
        return "medium"

    return "low"


def build_risk_reasoning(
    severity: str,
    waiting_days: float,
    report_count: int,
    recurrence_count: int,
    level: str,
) -> str:
    """
    Create a deterministic human-readable explanation.
    """

    reasons: list[str] = []

    severity_lower = str(severity or "medium").lower()

    if severity_lower == "critical":
        reasons.append("critical severity")
    elif severity_lower == "high":
        reasons.append("high severity")
    elif severity_lower == "medium":
        reasons.append("medium severity")

    if waiting_days >= 30:
        reasons.append("the incident has remained unresolved for over 30 days")
    elif waiting_days >= 14:
        reasons.append("the incident has remained unresolved for over 14 days")
    elif waiting_days >= 7:
        reasons.append("the incident has remained unresolved for over 7 days")

    if report_count >= 5:
        reasons.append("5 or more citizen reports")
    elif report_count >= 3:
        reasons.append(f"{report_count} citizen reports")
    elif report_count == 2:
        reasons.append("2 citizen reports")

    if recurrence_count >= 3:
        reasons.append("multiple recurrence events")
    elif recurrence_count >= 1:
        reasons.append("a previous recurrence")

    if not reasons:
        reasons.append("limited available evidence")

    if len(reasons) == 1:
        reason_text = reasons[0]
    elif len(reasons) == 2:
        reason_text = f"{reasons[0]} and {reasons[1]}"
    else:
        reason_text = ", ".join(reasons[:-1]) + f", and {reasons[-1]}"

    return f"{level.capitalize()} risk because of {reason_text}."


def calculate_civic_risk(incident: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate the complete Civic Risk result for one incident.

    Input:
        Supabase incident dictionary.

    Output:
        {
            score,
            level,
            waiting_days,
            components,
            reasoning,
            engine_version
        }
    """

    severity = str(incident.get("severity") or "medium").lower()

    report_count = max(
        1,
        int(incident.get("report_count") or 1),
    )

    recurrence_count = max(
        0,
        int(incident.get("recurrence_count") or 0),
    )

    waiting_days = calculate_waiting_days(
        incident.get("created_at")
    )

    components = {
        "severity": round(
            severity_score(severity),
            2,
        ),
        "waiting": round(
            waiting_score(waiting_days),
            2,
        ),
        "corroboration": round(
            corroboration_score(report_count),
            2,
        ),
        "recurrence": round(
            recurrence_score(recurrence_count),
            2,
        ),
    }

    score = (
        components["severity"] * WEIGHTS["severity"]
        + components["waiting"] * WEIGHTS["waiting"]
        + components["corroboration"] * WEIGHTS["corroboration"]
        + components["recurrence"] * WEIGHTS["recurrence"]
    )

    score = round(clamp(score), 2)

    level = get_risk_level(score)

    reasoning = build_risk_reasoning(
        severity=severity,
        waiting_days=waiting_days,
        report_count=report_count,
        recurrence_count=recurrence_count,
        level=level,
    )

    return {
        "score": score,
        "level": level,
        "waiting_days": round(waiting_days, 2),
        "components": components,
        "weights": WEIGHTS,
        "reasoning": reasoning,
        "engine_version": RISK_ENGINE_VERSION,
    }