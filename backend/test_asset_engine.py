"""
Tests for Civic DNA asset engine:
- Health score calculation (0-100) and factor breakdowns
- Risk score calculation (0-100)
- Failure interval acceleration detection
- 'Repair Again or Replace?' decision engine
- Asset proximity matching
"""

import sys
import os

# Add backend dir to path
sys.path.insert(0, os.path.dirname(__file__))

from asset_engine import (
    haversine_distance_meters,
    analyze_failure_pattern,
    calculate_asset_health_score,
    calculate_asset_risk_score,
    calculate_repair_vs_replace,
    find_nearby_assets,
)

def test_haversine_distance():
    # Sector 35 points ~18-20 meters apart
    d = haversine_distance_meters(30.7188, 76.7562, 30.7189, 76.7563)
    assert 10.0 <= d <= 25.0, f"Expected ~18m, got {d}"


def test_failure_acceleration_detection():
    # Events with accelerating failure pattern (18 mo, then 9 mo, then 4 mo)
    events = [
        {"id": "e1", "type": "failure", "date": "2021-01-01"},
        {"id": "e2", "type": "failure", "date": "2022-07-01", "metadata": {"component": "LED Driver"}},
        {"id": "e3", "type": "failure", "date": "2023-04-01", "metadata": {"component": "LED Driver"}},
        {"id": "e4", "type": "failure", "date": "2023-08-01", "metadata": {"component": "LED Driver"}},
    ]
    analysis = analyze_failure_pattern(events)
    assert analysis["totalFailures"] == 4
    assert analysis["isAccelerating"] is True
    assert analysis["recurringComponent"] == "LED Driver"
    assert len(analysis["intervals"]) == 3
    assert analysis["intervals"][-1]["daysBetween"] < analysis["intervals"][0]["daysBetween"]


def test_health_score_calculation():
    # Asset with high failure and acceleration
    score, breakdown = calculate_asset_health_score(
        asset_type="streetlight",
        installed_year=2019,
        expected_lifespan_years=12,
        cumulative_spend=19700.0,
        replacement_cost=11000.0,
        total_failures=4,
        is_accelerating=True,
        active_complaints_count=1
    )
    assert 40 <= score <= 70, f"Expected health score around 50-65 for stressed asset, got {score}"
    assert breakdown["score"] == score
    assert len(breakdown["factors"]) == 5


def test_risk_score_calculation():
    risk_score, tier, factors = calculate_asset_risk_score(
        health_score=61,
        total_failures=4,
        is_accelerating=True,
        cost_ratio=1.79,
        active_complaints_count=1,
        asset_type="streetlight"
    )
    assert risk_score >= 40
    assert tier in ("HIGH", "CRITICAL", "MEDIUM")
    assert len(factors) >= 2


def test_repair_vs_replace_decision():
    # Streetlight #S35-L092 scenario: spent 19.7k vs 11k replace, recurring driver
    rec = calculate_repair_vs_replace(
        asset_type="streetlight",
        cumulative_spend=19700.0,
        replacement_cost=11000.0,
        typical_repair_cost=8000.0,
        total_failures=4,
        is_accelerating=True,
        health_score=61,
        age_years=7,
        expected_lifespan_years=12,
        recurring_component="LED driver (150W IP66)"
    )
    assert rec["type"] in ("REPLACE_COMPONENT", "REPLACE_FULL")
    assert rec["confidence"] >= 80
    assert "driver" in rec["rationale"].lower() or "replace" in rec["rationale"].lower()
    assert rec["expectedRepairLifetimeMonths"] <= 6


def test_find_nearby_assets():
    sample_assets = [
        {
            "id": "S35-L092",
            "assetNumber": "S35-L092",
            "name": "High-Mast Luminaire #S35-L092",
            "type": "streetlight",
            "department": "Street Lighting Department",
            "latitude": 30.7189,
            "longitude": 76.7563,
            "healthScore": 61,
            "riskScore": 73,
            "riskTier": "HIGH"
        },
        {
            "id": "RD17-P001",
            "assetNumber": "RD17-P001",
            "name": "Madhya Marg Corridor",
            "type": "road_segment",
            "department": "Roads & Infrastructure",
            "latitude": 30.7380,
            "longitude": 76.7820,
            "healthScore": 48,
            "riskScore": 81,
            "riskTier": "CRITICAL"
        }
    ]
    # Search near Sector 35-D complaint
    nearby = find_nearby_assets(30.7188, 76.7562, sample_assets, max_radius_meters=100.0)
    assert len(nearby) == 1
    assert nearby[0]["assetId"] == "S35-L092"
    assert nearby[0]["distanceMeters"] < 30.0


if __name__ == "__main__":
    test_haversine_distance()
    test_failure_acceleration_detection()
    test_health_score_calculation()
    test_risk_score_calculation()
    test_repair_vs_replace_decision()
    test_find_nearby_assets()
    print("All Civic DNA Asset Engine unit tests passed successfully!")
