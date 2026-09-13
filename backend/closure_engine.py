"""
SANKET CivicLens
Smart Closure Match Engine

Deterministic, GPS-based closure verification.

Rules:
- A real repair photo is required.
- A real field GPS location is required.
- Original incident GPS must exist.
- Distance is calculated using Haversine.
- Automatic closure is allowed only when the repair
  location is within the configured threshold.
- No random scores.
- No fake visual-match scores.
"""

from __future__ import annotations

import math
from typing import Any


# ============================================================
# ENGINE VERSION
# ============================================================

CLOSURE_ENGINE_VERSION = "2.0.0"


# ============================================================
# CONFIGURATION
# ============================================================

# A repair photo taken within this distance of the
# original incident is considered geographically matched.
#
# This is intentionally configurable and deterministic.
MAX_CLOSURE_DISTANCE_METERS = 50.0


# ============================================================
# DISTANCE
# ============================================================

def calculate_distance_meters(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    """
    Calculate distance between two GPS coordinates
    using the Haversine formula.

    Returns:
        Distance in metres.
    """

    earth_radius_meters = 6_371_000.0

    lat1 = math.radians(latitude_1)
    lat2 = math.radians(latitude_2)

    delta_lat = math.radians(
        latitude_2 - latitude_1
    )

    delta_lon = math.radians(
        longitude_2 - longitude_1
    )

    a = (
        math.sin(delta_lat / 2) ** 2
        +
        math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_lon / 2) ** 2
    )

    # Protect against floating point drift.
    a = max(0.0, min(1.0, a))

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return earth_radius_meters * c


# ============================================================
# HELPERS
# ============================================================

def _safe_float(value: Any) -> float | None:
    """
    Safely convert a value to float.
    """

    if value is None:
        return None

    try:
        result = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(result):
        return None

    return result


def _valid_latitude(value: Any) -> bool:
    parsed = _safe_float(value)

    return (
        parsed is not None
        and -90.0 <= parsed <= 90.0
    )


def _valid_longitude(value: Any) -> bool:
    parsed = _safe_float(value)

    return (
        parsed is not None
        and -180.0 <= parsed <= 180.0
    )


# ============================================================
# MATCH ENGINE
# ============================================================

def calculate_closure_match(
    incident: dict[str, Any],
    closure_evidence: dict[str, Any],
) -> dict[str, Any]:
    """
    Determine whether field closure evidence belongs
    to the original incident.

    Required evidence:
        - original incident GPS
        - field GPS
        - repair photo

    Automatic resolution:
        GPS distance <= MAX_CLOSURE_DISTANCE_METERS
        AND repair photo exists.

    No visual similarity score is invented here.

    If visual AI comparison is added later, it must be
    a separate real evidence signal.
    """

    incident_latitude = _safe_float(
        incident.get("latitude")
    )

    incident_longitude = _safe_float(
        incident.get("longitude")
    )

    closure_latitude = _safe_float(
        closure_evidence.get("latitude")
    )

    closure_longitude = _safe_float(
        closure_evidence.get("longitude")
    )

    photo_url = str(
        closure_evidence.get(
            "photo_url",
            "",
        )
        or ""
    ).strip()

    checks: dict[str, bool] = {
        "incident_gps_available": (
            _valid_latitude(incident_latitude)
            and _valid_longitude(incident_longitude)
        ),
        "closure_gps_available": (
            _valid_latitude(closure_latitude)
            and _valid_longitude(closure_longitude)
        ),
        "repair_photo_available": bool(
            photo_url
        ),
    }

    # --------------------------------------------------------
    # Missing GPS
    # --------------------------------------------------------

    if not checks["incident_gps_available"]:
        return {
            "engine_version": CLOSURE_ENGINE_VERSION,
            "match_status": "unavailable",
            "match_score": 0,
            "distance_meters": None,
            "automatic_closure_allowed": False,
            "recommendation": "needs_review",
            "checks": checks,
            "explanation": (
                "The original incident does not contain "
                "valid GPS coordinates. Automatic closure "
                "cannot verify that the repair evidence "
                "belongs to this incident."
            ),
        }

    if not checks["closure_gps_available"]:
        return {
            "engine_version": CLOSURE_ENGINE_VERSION,
            "match_status": "unavailable",
            "match_score": 0,
            "distance_meters": None,
            "automatic_closure_allowed": False,
            "recommendation": "needs_review",
            "checks": checks,
            "explanation": (
                "Field GPS coordinates were not available "
                "or were invalid. Automatic closure "
                "requires real field location evidence."
            ),
        }

    # --------------------------------------------------------
    # Distance
    # --------------------------------------------------------

    distance = calculate_distance_meters(
        incident_latitude,
        incident_longitude,
        closure_latitude,
        closure_longitude,
    )

    distance = round(
        distance,
        2,
    )

    location_match = (
        distance
        <= MAX_CLOSURE_DISTANCE_METERS
    )

    # --------------------------------------------------------
    # Photo required
    # --------------------------------------------------------

    if not checks["repair_photo_available"]:
        if location_match:
            return {
                "engine_version": CLOSURE_ENGINE_VERSION,
                "match_status": "partial",
                "match_score": 50,
                "distance_meters": distance,
                "automatic_closure_allowed": False,
                "recommendation": "needs_review",
                "checks": checks,
                "explanation": (
                    f"Field GPS is within "
                    f"{MAX_CLOSURE_DISTANCE_METERS:.0f} metres "
                    f"of the original incident "
                    f"({distance:.2f} metres), but a real "
                    "repair photo was not provided."
                ),
            }

        return {
            "engine_version": CLOSURE_ENGINE_VERSION,
            "match_status": "weak",
            "match_score": 0,
            "distance_meters": distance,
            "automatic_closure_allowed": False,
            "recommendation": "needs_review",
            "checks": checks,
            "explanation": (
                f"Field location is {distance:.2f} metres "
                "from the original incident and no repair "
                "photo was provided."
            ),
        }

    # --------------------------------------------------------
    # Strong geographic match
    # --------------------------------------------------------

    if location_match:
        return {
            "engine_version": CLOSURE_ENGINE_VERSION,
            "match_status": "strong",
            "match_score": 100,
            "distance_meters": distance,
            "automatic_closure_allowed": True,
            "recommendation": "resolve",
            "checks": checks,
            "explanation": (
                f"Real repair photo received. Field GPS "
                f"is {distance:.2f} metres from the original "
                f"incident, within the "
                f"{MAX_CLOSURE_DISTANCE_METERS:.0f}-metre "
                "automatic closure threshold."
            ),
        }

    # --------------------------------------------------------
    # GPS mismatch
    # --------------------------------------------------------

    return {
        "engine_version": CLOSURE_ENGINE_VERSION,
        "match_status": "weak",
        "match_score": 0,
        "distance_meters": distance,
        "automatic_closure_allowed": False,
        "recommendation": "needs_review",
        "checks": checks,
        "explanation": (
            f"Real repair photo received, but field GPS "
            f"is {distance:.2f} metres from the original "
            f"incident. This exceeds the "
            f"{MAX_CLOSURE_DISTANCE_METERS:.0f}-metre "
            "automatic closure threshold."
        ),
    }