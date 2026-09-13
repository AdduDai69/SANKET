"""
SANKET Priority Aging & Fairness Engine

Purpose:
    Calculate deterministic incident priority using actual
    Civic Risk, incident age, corroboration and recurrence.

No random scores.
No fabricated traffic/exposure data.
No fabricated historical information.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from memory_engine import calculate_age_days


PRIORITY_ENGINE_VERSION = "1.0.0"


def _safe_number(
    value: Any,
    default: float = 0.0,
) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(
    value: Any,
    default: int = 0,
) -> int:
    try:
        return max(
            0,
            int(value or 0),
        )
    except (TypeError, ValueError):
        return default


def calculate_priority_aging(
    incident: dict[str, Any],
    reference_time: datetime | None = None,
) -> dict[str, Any]:
    """
    Deterministic Priority Aging calculation.

    Components:

        Civic Risk       50%
        Waiting/Age      25%
        Corroboration    15%
        Recurrence       10%

    This means a newer high-risk incident can outrank an older
    low-risk incident, while genuinely aging unresolved issues
    are prevented from disappearing from the queue.

    Maximum = 100.
    """

    risk_score = max(
        0.0,
        min(
            100.0,
            _safe_number(
                incident.get("risk_score"),
                0,
            ),
        ),
    )

    report_count = _safe_int(
        incident.get("report_count"),
        default=1,
    )

    recurrence_count = _safe_int(
        incident.get("recurrence_count"),
        default=0,
    )

    age_days = calculate_age_days(
        incident.get("created_at"),
        reference_time=reference_time,
    )

    # --------------------------------------------------------
    # Aging score
    # --------------------------------------------------------

    if age_days is None:
        aging_score = 0.0

    elif age_days >= 30:
        aging_score = 100.0

    elif age_days >= 14:
        aging_score = 85.0

    elif age_days >= 7:
        aging_score = 65.0

    elif age_days >= 3:
        aging_score = 45.0

    elif age_days >= 1:
        aging_score = 25.0

    else:
        aging_score = 0.0

    # --------------------------------------------------------
    # Corroboration
    # --------------------------------------------------------

    if report_count >= 5:
        corroboration_score = 100.0
    elif report_count == 4:
        corroboration_score = 85.0
    elif report_count == 3:
        corroboration_score = 70.0
    elif report_count == 2:
        corroboration_score = 50.0
    else:
        corroboration_score = 20.0

    # --------------------------------------------------------
    # Recurrence
    # --------------------------------------------------------

    if recurrence_count >= 4:
        recurrence_score = 100.0
    elif recurrence_count == 3:
        recurrence_score = 85.0
    elif recurrence_count == 2:
        recurrence_score = 65.0
    elif recurrence_count == 1:
        recurrence_score = 40.0
    else:
        recurrence_score = 0.0

    # --------------------------------------------------------
    # Final priority
    # --------------------------------------------------------

    score = (
        risk_score * 0.50
        + aging_score * 0.25
        + corroboration_score * 0.15
        + recurrence_score * 0.10
    )

    score = round(
        max(
            0.0,
            min(
                100.0,
                score,
            ),
        ),
        2,
    )

    if score >= 80:
        level = "critical"
    elif score >= 60:
        level = "high"
    elif score >= 35:
        level = "medium"
    else:
        level = "low"

    # --------------------------------------------------------
    # Explainability
    # --------------------------------------------------------

    reasons: list[str] = []

    if risk_score >= 80:
        reasons.append(
            "High Civic Risk"
        )
    elif risk_score >= 60:
        reasons.append(
            "Elevated Civic Risk"
        )

    if age_days is not None:
        if age_days >= 30:
            reasons.append(
                "Aging unresolved incident"
            )
        elif age_days >= 7:
            reasons.append(
                "Incident has been waiting "
                "for more than 7 days"
            )

    if report_count >= 2:
        reasons.append(
            f"{report_count} citizen reports "
            "support the incident"
        )

    if recurrence_count > 0:
        reasons.append(
            f"{recurrence_count} recorded recurrence"
            + (
                "s"
                if recurrence_count != 1
                else ""
            )
        )

    if not reasons:
        reasons.append(
            "Priority based on currently "
            "available incident data."
        )

    return {
        "score": score,
        "level": level,
        "engine_version": PRIORITY_ENGINE_VERSION,

        "age_days": age_days,

        "components": {
            "risk": round(
                risk_score,
                2,
            ),
            "aging": round(
                aging_score,
                2,
            ),
            "corroboration": round(
                corroboration_score,
                2,
            ),
            "recurrence": round(
                recurrence_score,
                2,
            ),
        },

        "weights": {
            "risk": 0.50,
            "aging": 0.25,
            "corroboration": 0.15,
            "recurrence": 0.10,
        },

        "reasoning": reasons,

        "fairness_note": (
            "Priority uses transparent, incident-level "
            "signals. No demographic or sensitive citizen "
            "attributes are used."
        ),
    }