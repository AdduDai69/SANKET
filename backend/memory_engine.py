"""
SANKET Civic Memory Engine

Purpose:
    Deterministically derive historical/recurrence signals from
    the incident's actual database fields.

Important:
    No fabricated historical data is created.

If historical information is unavailable, the engine explicitly
reports that historical data is unavailable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


MEMORY_ENGINE_VERSION = "1.0.0"


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        try:
            text = str(value).strip()

            if not text:
                return None

            if text.endswith("Z"):
                text = text[:-1] + "+00:00"

            dt = datetime.fromisoformat(text)

        except (TypeError, ValueError):
            return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def calculate_age_days(
    created_at: Any,
    reference_time: datetime | None = None,
) -> float | None:
    """
    Calculate actual incident age.

    Returns None when created_at is unavailable.
    """

    created = _parse_datetime(created_at)

    if created is None:
        return None

    reference = reference_time or datetime.now(timezone.utc)

    if reference.tzinfo is None:
        reference = reference.replace(
            tzinfo=timezone.utc
        )

    reference = reference.astimezone(timezone.utc)

    seconds = max(
        0.0,
        (reference - created).total_seconds(),
    )

    return round(
        seconds / 86400.0,
        2,
    )


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


def calculate_civic_memory(
    incident: dict[str, Any],
    reference_time: datetime | None = None,
) -> dict[str, Any]:
    """
    Calculate deterministic Civic Memory metadata.

    Inputs:
        - actual report_count
        - actual recurrence_count
        - actual created_at
        - actual updated_at

    No historical records are invented.

    Memory score:
        Recurrence signal      0-40
        Corroboration signal  0-30
        Age/history signal    0-30

    Maximum = 100.
    """

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

    updated_age_days = calculate_age_days(
        incident.get("updated_at"),
        reference_time=reference_time,
    )

    # --------------------------------------------------------
    # Recurrence signal
    # --------------------------------------------------------

    if recurrence_count >= 5:
        recurrence_score = 40
    elif recurrence_count == 4:
        recurrence_score = 35
    elif recurrence_count == 3:
        recurrence_score = 30
    elif recurrence_count == 2:
        recurrence_score = 20
    elif recurrence_count == 1:
        recurrence_score = 10
    else:
        recurrence_score = 0

    # --------------------------------------------------------
    # Corroboration signal
    # --------------------------------------------------------

    if report_count >= 5:
        corroboration_score = 30
    elif report_count == 4:
        corroboration_score = 25
    elif report_count == 3:
        corroboration_score = 20
    elif report_count == 2:
        corroboration_score = 12
    else:
        corroboration_score = 0

    # --------------------------------------------------------
    # Age signal
    # --------------------------------------------------------

    if age_days is None:
        age_score = 0
    elif age_days >= 30:
        age_score = 30
    elif age_days >= 14:
        age_score = 25
    elif age_days >= 7:
        age_score = 20
    elif age_days >= 3:
        age_score = 12
    elif age_days >= 1:
        age_score = 6
    else:
        age_score = 0

    memory_score = min(
        100,
        recurrence_score
        + corroboration_score
        + age_score,
    )

    historical_data_available = (
        recurrence_count > 0
        or report_count > 1
    )

    if historical_data_available:
        history_status = "available"
    else:
        history_status = "limited"

    if age_days is None:
        age_status = "Historical data unavailable"
    else:
        age_status = (
            f"Incident age: {age_days:.2f} days"
        )

    if memory_score >= 70:
        memory_level = "high"
    elif memory_score >= 40:
        memory_level = "medium"
    else:
        memory_level = "low"

    return {
        "score": memory_score,
        "level": memory_level,
        "engine_version": MEMORY_ENGINE_VERSION,

        "report_count": report_count,
        "recurrence_count": recurrence_count,

        "age_days": age_days,
        "updated_age_days": updated_age_days,

        "historical_data_available": (
            historical_data_available
        ),

        "history_status": history_status,
        "age_status": age_status,

        "breakdown": {
            "recurrence": recurrence_score,
            "corroboration": corroboration_score,
            "age": age_score,
        },

        "maximum": {
            "recurrence": 40,
            "corroboration": 30,
            "age": 30,
        },

        "message": (
            "Historical data unavailable"
            if not historical_data_available
            else (
                "Civic Memory derived from "
                "actual incident history."
            )
        ),
    }