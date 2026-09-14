"""
Civic DNA — Persistent Infrastructure Intelligence Engine for SANKET × CivicLens.

Provides deterministic and heuristic intelligence for municipal assets:
1. Explainable Civic Health Score (0-100) with 6-factor breakdown.
2. Asset Risk Score (0-100) extending SANKET's risk engine methodology.
3. Failure Pattern Analysis (interval acceleration detection & frequency bars).
4. Repair Again or Replace? Decision Engine.
5. Proximity matching of complaints to nearby assets.
"""

from typing import Dict, List, Any, Optional, Tuple
import math
from datetime import datetime

EARTH_RADIUS_METERS = 6371000.0

def haversine_distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse YYYY-MM-DD date string safely."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        return None


def analyze_failure_pattern(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze failure events to detect interval acceleration.
    Identifies if intervals between failures are decreasing (accelerating breakdown).
    """
    failure_events = [
        e for e in events 
        if e.get("type") in ("failure", "complaint") and e.get("date")
    ]
    # Sort chronologically
    failure_events.sort(key=lambda x: x.get("date", ""))

    intervals: List[Dict[str, Any]] = []
    for i in range(len(failure_events) - 1):
        d1 = parse_date(failure_events[i].get("date", ""))
        d2 = parse_date(failure_events[i + 1].get("date", ""))
        if d1 and d2:
            days = max(1, (d2 - d1).days)
            intervals.append({
                "fromEventId": failure_events[i].get("id", f"ev-{i}"),
                "toEventId": failure_events[i + 1].get("id", f"ev-{i+1}"),
                "fromDate": failure_events[i].get("date", ""),
                "toDate": failure_events[i + 1].get("date", ""),
                "daysBetween": days,
                "description": f"Failure #{i+1} to Failure #{i+2}: {days} days"
            })

    total_failures = len(failure_events)
    is_accelerating = False
    acceleration_ratio = 1.0

    if len(intervals) >= 2:
        # Check if recent intervals are noticeably shorter than earlier intervals
        first_interval = intervals[0]["daysBetween"]
        latest_interval = intervals[-1]["daysBetween"]
        if first_interval > 0:
            acceleration_ratio = round(latest_interval / first_interval, 2)
            if latest_interval < first_interval * 0.7:  # At least 30% drop
                is_accelerating = True

    # Compute frequency bars (grouped by year or period)
    frequency_bars = []
    years_count: Dict[str, int] = {}
    for ev in failure_events:
        d = parse_date(ev.get("date", ""))
        yr = str(d.year) if d else "Unknown"
        years_count[yr] = years_count.get(yr, 0) + 1

    for yr in sorted(years_count.keys()):
        count = years_count[yr]
        frequency_bars.append({
            "period": yr,
            "failureCount": count,
            "severity": "high" if count >= 3 else ("medium" if count == 2 else "low")
        })

    avg_interval = (
        round(sum(i["daysBetween"] for i in intervals) / len(intervals), 1)
        if intervals else None
    )

    recurring_component = None
    component_failures: Dict[str, int] = {}
    for ev in failure_events:
        meta = ev.get("metadata", {})
        comp = meta.get("component") or meta.get("failed_component")
        if comp:
            component_failures[comp] = component_failures.get(comp, 0) + 1
    if component_failures:
        top_comp = max(component_failures.items(), key=lambda x: x[1])
        if top_comp[1] >= 2:
            recurring_component = top_comp[0]

    pattern_summary = (
        f"Critical interval acceleration: Failures quickening from {intervals[0]['daysBetween']} days to {intervals[-1]['daysBetween']} days."
        if is_accelerating and len(intervals) >= 2
        else (f"{total_failures} failures recorded with stable intervals." if total_failures > 1 else "Normal failure rate.")
    )

    return {
        "totalFailures": total_failures,
        "intervals": intervals,
        "isAccelerating": is_accelerating,
        "accelerationRatio": acceleration_ratio,
        "averageIntervalDays": avg_interval,
        "recurringComponent": recurring_component,
        "frequencyBars": frequency_bars,
        "patternSummary": pattern_summary
    }


def calculate_asset_health_score(
    asset_type: str,
    installed_year: int,
    expected_lifespan_years: int,
    cumulative_spend: float,
    replacement_cost: float,
    total_failures: int,
    is_accelerating: bool,
    active_complaints_count: int,
    last_inspected_date: Optional[str] = None
) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate an explainable 0-100 Civic Health Score based on 6 core factors.
    Returns (health_score, breakdown_dict).
    """
    current_year = 2026
    age_years = max(0, current_year - installed_year)
    lifespan_ratio = age_years / max(1, expected_lifespan_years)
    
    # 1. Base Score: 100
    base_score = 100.0

    # 2. Age & Depreciation penalty (max -15)
    # If age exceeds expected lifespan, penalty is applied up to 15
    age_penalty = min(15.0, lifespan_ratio * 10.0 + (3.0 if age_years > expected_lifespan_years else 0.0))

    # 3. Failure History penalty (max -18)
    failure_penalty = min(18.0, total_failures * 3.5)

    # 4. Interval Acceleration penalty (max -10)
    acceleration_penalty = 10.0 if is_accelerating else 0.0

    # 5. Maintenance Cost Inflation penalty (max -15)
    cost_ratio = cumulative_spend / max(1.0, replacement_cost)
    if cost_ratio >= 1.5:
        cost_penalty = 14.0
    elif cost_ratio >= 1.0:
        cost_penalty = 10.0
    elif cost_ratio >= 0.5:
        cost_penalty = 5.0
    else:
        cost_penalty = cost_ratio * 6.0

    # 6. Active Grievance penalty (max -8)
    active_penalty = min(8.0, active_complaints_count * 4.0)

    health_score = max(5, min(100, int(round(
        base_score - (age_penalty + failure_penalty + acceleration_penalty + cost_penalty + active_penalty)
    ))))

    # Factor explanations
    factors = [
        {
            "name": "Age & Lifecycle Depreciation",
            "score": round(max(0, 20.0 - age_penalty), 1),
            "maxScore": 20.0,
            "impact": "negative" if age_penalty > 8 else "neutral",
            "explanation": f"Asset is {age_years} yrs old ({round(lifespan_ratio*100)}% of expected {expected_lifespan_years} yr life)."
        },
        {
            "name": "Failure Frequency",
            "score": round(max(0, 25.0 - failure_penalty), 1),
            "maxScore": 25.0,
            "impact": "negative" if failure_penalty > 10 else "neutral",
            "explanation": f"{total_failures} recorded breakdown events since installation."
        },
        {
            "name": "Failure Interval Dynamics",
            "score": round(15.0 - acceleration_penalty, 1),
            "maxScore": 15.0,
            "impact": "negative" if is_accelerating else "positive",
            "explanation": "Interval acceleration detected (failures clustering closer)." if is_accelerating else "Breakdown intervals are stable or non-existent."
        },
        {
            "name": "Maintenance Economic Burden",
            "score": round(max(0, 25.0 - cost_penalty), 1),
            "maxScore": 25.0,
            "impact": "negative" if cost_penalty > 8 else "neutral",
            "explanation": f"Maintenance spending is {round(cost_ratio*100)}% of total new replacement cost."
        },
        {
            "name": "Citizen Grievances & Active Distress",
            "score": round(max(0, 15.0 - active_penalty), 1),
            "maxScore": 15.0,
            "impact": "negative" if active_complaints_count > 0 else "positive",
            "explanation": f"{active_complaints_count} active citizen grievances linked to this asset."
        }
    ]

    breakdown = {
        "score": health_score,
        "ageImpact": round(-age_penalty, 1),
        "failureImpact": round(-failure_penalty, 1),
        "intervalImpact": round(-acceleration_penalty, 1),
        "costImpact": round(-cost_penalty, 1),
        "activeComplaintImpact": round(-active_penalty, 1),
        "factors": factors
    }

    return health_score, breakdown


def calculate_asset_risk_score(
    health_score: int,
    total_failures: int,
    is_accelerating: bool,
    cost_ratio: float,
    active_complaints_count: int,
    asset_type: str
) -> Tuple[int, str, List[Dict[str, Any]]]:
    """
    Compute asset predictive risk score (0-100) extending SANKET's risk methodology.
    Returns (risk_score, risk_tier, risk_factors).
    """
    normalized_type = (asset_type or "").lower().replace("_", "").replace(" ", "")

    # Baseline risk is inverse of health
    base_risk = 100 - health_score

    # Add extra weight if high-impact civic asset (e.g., Traffic signals, Deep drainage)
    criticality_bonus = 0
    if "traffic" in normalized_type or "drain" in normalized_type:
        criticality_bonus = 6
    elif "light" in normalized_type or "road" in normalized_type or "water" in normalized_type:
        criticality_bonus = 4

    # Acceleration and failure boosts
    risk_boost = 0
    if is_accelerating:
        risk_boost += 8
    if total_failures >= 3:
        risk_boost += 6
    if cost_ratio >= 1.2:
        risk_boost += 5

    risk_score = min(99, max(5, base_risk + criticality_bonus + risk_boost))

    if risk_score >= 70:
        tier = "CRITICAL"
    elif risk_score >= 50:
        tier = "HIGH"
    elif risk_score >= 30:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    factors = []
    if is_accelerating:
        factors.append({
            "name": "Accelerating Breakdown Interval",
            "contribution": 35,
            "description": "Time between failure events has shrunk significantly, signaling imminent repeat outage."
        })
    if cost_ratio >= 1.0:
        factors.append({
            "name": "Maintenance Sunk Cost Trap",
            "contribution": 25,
            "description": f"Cumulative repair spending ({round(cost_ratio*100)}%) has exceeded full replacement cost."
        })
    if total_failures >= 3:
        factors.append({
            "name": "Chronic Failure Recidivism",
            "contribution": 25,
            "description": f"Has failed {total_failures} times across lifecycle."
        })
    if active_complaints_count > 0:
        factors.append({
            "name": "Active Public Grievance",
            "contribution": 15,
            "description": f"{active_complaints_count} open complaints currently unresolved."
        })

    return risk_score, tier, factors


def calculate_repair_vs_replace(
    asset_type: str,
    cumulative_spend: float,
    replacement_cost: float,
    typical_repair_cost: float,
    total_failures: int,
    is_accelerating: bool,
    health_score: int,
    age_years: int,
    expected_lifespan_years: int,
    recurring_component: Optional[str] = None
) -> Dict[str, Any]:
    """
    Signature Decision Engine: 'Repair Again or Replace?'
    Compares:
    - Estimated cost of recurring repairs over next 18 months vs full capital replacement.
    - Expected life extension (e.g. 4 months with repair vs 10 years with replacement).
    - Recommendation type with clear confidence and deterministic rationale.
    """
    projected_repair_frequency_18m = 3 if is_accelerating else (2 if total_failures >= 2 else 1)
    projected_repair_cost_18m = typical_repair_cost * projected_repair_frequency_18m
    expected_repair_lifespan_months = 4 if is_accelerating else (8 if total_failures >= 3 else 24)

    expected_replace_lifespan_years = expected_lifespan_years
    cost_ratio = cumulative_spend / max(1.0, replacement_cost)

    # Decision Matrix
    if cost_ratio > 1.2 or (is_accelerating and total_failures >= 3 and age_years >= expected_lifespan_years * 0.7):
        if recurring_component and "driver" in recurring_component.lower():
            rec_type = "REPLACE_COMPONENT"
            rationale = (
                f"Repeated failures localized to '{recurring_component}'. Replacing this specific sub-assembly "
                f"or full unit prevents further sinkhole spending (already ₹{int(cumulative_spend):,} spent vs ₹{int(replacement_cost):,} unit cost)."
            )
            confidence = 89
            payback_months = 14
        else:
            rec_type = "REPLACE_FULL"
            rationale = (
                f"Cumulative repairs (₹{int(cumulative_spend):,}) exceed replacement threshold (₹{int(replacement_cost):,}). "
                f"Repairs only extend life by ~{expected_repair_lifespan_months} months before next failure."
            )
            confidence = 92
            payback_months = 12
    elif is_accelerating and total_failures >= 2:
        rec_type = "REPLACE_COMPONENT"
        rationale = (
            f"Failure intervals are shortening rapidly. Routine patch repairs fail within ~{expected_repair_lifespan_months} months. "
            f"Replace faulty core assembly rather than standard re-patching."
        )
        confidence = 82
        payback_months = 18
    elif health_score >= 65 and total_failures <= 2:
        rec_type = "REPAIR"
        rationale = (
            f"Asset has sound structural integrity ({health_score}/100) and reasonable age ({age_years}/{expected_lifespan_years} yrs). "
            f"Standard repair is financially optimal."
        )
        confidence = 85
        payback_months = None
    elif total_failures == 0:
        rec_type = "INSPECT"
        rationale = "No breakdown history recorded. Routine preventive inspection recommended to baseline telemetry."
        confidence = 95
        payback_months = None
    else:
        rec_type = "MONITOR"
        rationale = "Asset nearing critical economic threshold. Perform scheduled inspection before deciding capital replacement."
        confidence = 74
        payback_months = 20

    net_savings = max(0.0, (projected_repair_cost_18m * 2) - replacement_cost) if rec_type in ("REPLACE_FULL", "REPLACE_COMPONENT") else 0.0

    return {
        "type": rec_type,
        "confidence": confidence,
        "rationale": rationale,
        "repairCostEstimate": typical_repair_cost,
        "replacementCostEstimate": replacement_cost,
        "expectedRepairLifetimeMonths": expected_repair_lifespan_months,
        "expectedReplaceLifetimeYears": expected_replace_lifespan_years,
        "netSavings18Months": net_savings,
        "projectedPaybackMonths": payback_months,
        "evaluatedAt": datetime.now().isoformat()
    }


def find_nearby_assets(
    lat: float,
    lng: float,
    assets: List[Dict[str, Any]],
    max_radius_meters: float = 100.0,
    preferred_department: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Find infrastructure assets in proximity to a given coordinate.
    Sorts by distance and priority match.
    """
    matched = []
    for asset in assets:
        a_lat = asset.get("latitude")
        a_lng = asset.get("longitude")
        if a_lat is None or a_lng is None:
            continue

        dist = haversine_distance_meters(lat, lng, a_lat, a_lng)
        if dist <= max_radius_meters:
            dept_match = (
                preferred_department.lower() in asset.get("department", "").lower()
                if preferred_department else False
            )
            matched.append({
                "assetId": asset.get("id"),
                "assetNumber": asset.get("assetNumber"),
                "name": asset.get("name"),
                "type": asset.get("type"),
                "department": asset.get("department"),
                "distanceMeters": round(dist, 1),
                "healthScore": asset.get("healthScore"),
                "riskScore": asset.get("riskScore"),
                "riskTier": asset.get("riskTier"),
                "departmentMatch": dept_match
            })

    # Sort primarily by department match then by distance
    matched.sort(key=lambda x: (not x["departmentMatch"], x["distanceMeters"]))
    return matched
