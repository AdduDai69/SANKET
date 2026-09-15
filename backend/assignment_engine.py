"""
SANKET CivicLens — Department-Based Automatic Field Worker Assignment Engine

Production-quality deterministic assignment system.

Rules:
1. Exactly 5 Departments:
   - Electrical
   - Roads
   - Water Supply
   - Sanitation
   - Horticulture
   (NO Stray Animal / Animal Control)

2. Deterministic Complaint -> Department Mapping:
   Broken Streetlight -> Electrical
   Pothole -> Roads
   Water Leakage -> Water Supply
   Garbage -> Sanitation
   Fallen Tree -> Horticulture
   If category is unsupported/invalid -> REJECT complaint (do not guess).

3. Dedicated Field Workers per Department:
   E-104 -> Electrical
   R-203 -> Roads
   W-117 -> Water Supply
   S-052 -> Sanitation
   H-031 -> Horticulture

4. Automatic Assignment:
   A worker is eligible ONLY if their department matches the complaint department.
   Never assign a complaint to a worker from another department.
   If multiple workers exist in the department, select the one with lowest active workload.
   If no eligible worker exists:
     assignment_status = "Awaiting Worker"
     assigned_worker = None
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


# ============================================================
# 5 MANDATORY DEPARTMENTS
# ============================================================

DEPARTMENTS = [
    "Electrical",
    "Roads",
    "Water Supply",
    "Sanitation",
    "Horticulture",
]

ALLOWED_DEPARTMENTS = set(DEPARTMENTS)


# ============================================================
# COMPLAINT CATEGORY -> DEPARTMENT MAPPING
# ============================================================

CATEGORY_TO_DEPARTMENT: dict[str, str] = {
    # 1. Electrical
    "streetlight": "Electrical",
    "broken streetlight": "Electrical",
    "broken_streetlight": "Electrical",
    "streetlight not working": "Electrical",
    "streetlight_not_working": "Electrical",
    "traffic signal": "Electrical",
    "traffic_signal": "Electrical",
    "electrical signal": "Electrical",
    "electrical": "Electrical",
    "damaged electrical infrastructure": "Electrical",
    "damaged_electrical_infrastructure": "Electrical",

    # 2. Roads
    "pothole": "Roads",
    "potholes": "Roads",
    "road_damage": "Roads",
    "road damage": "Roads",
    "damaged road": "Roads",
    "damaged_road": "Roads",
    "broken pavement": "Roads",
    "broken_pavement": "Roads",
    "road infrastructure": "Roads",
    "road_infrastructure": "Roads",
    "roads": "Roads",

    # 3. Water Supply
    "water_leak": "Water Supply",
    "water leak": "Water Supply",
    "water leakage": "Water Supply",
    "water_leakage": "Water Supply",
    "broken water pipeline": "Water Supply",
    "broken_water_pipeline": "Water Supply",
    "water supply": "Water Supply",
    "water_supply": "Water Supply",
    "drainage": "Water Supply",
    "water": "Water Supply",

    # 4. Sanitation
    "garbage": "Sanitation",
    "waste": "Sanitation",
    "waste accumulation": "Sanitation",
    "waste_accumulation": "Sanitation",
    "unclean public area": "Sanitation",
    "unclean_public_area": "Sanitation",
    "sanitation": "Sanitation",

    # 5. Horticulture
    "fallen tree": "Horticulture",
    "fallen_tree": "Horticulture",
    "damaged tree": "Horticulture",
    "damaged_tree": "Horticulture",
    "public green area": "Horticulture",
    "public_green_area": "Horticulture",
    "horticulture": "Horticulture",
    "tree": "Horticulture",
    "trees": "Horticulture",
}


def map_category_to_department(category: str | None) -> str | None:
    """
    Deterministically maps a complaint category to one of the 5 municipal departments.
    Returns None if category is invalid or unsupported.
    """
    if not category:
        return None
    raw = str(category).strip().lower().replace("-", " ")
    if raw in CATEGORY_TO_DEPARTMENT:
        return CATEGORY_TO_DEPARTMENT[raw]
    with_underscores = raw.replace(" ", "_")
    if with_underscores in CATEGORY_TO_DEPARTMENT:
        return CATEGORY_TO_DEPARTMENT[with_underscores]

    # Keyword matching for compound category strings (e.g. "Public Works Department (Roads & Bridges)")
    if any(k in raw for k in ("pothole", "road", "pavement", "asphalt", "bridges")):
        return "Roads"
    if any(k in raw for k in ("streetlight", "street light", "signal", "electric")):
        return "Electrical"
    if any(k in raw for k in ("water", "pipeline", "drainage", "pipe", "leak")):
        return "Water Supply"
    if any(k in raw for k in ("garbage", "waste", "sanitat", "unclean")):
        return "Sanitation"
    if any(k in raw for k in ("tree", "horticult", "green area")):
        return "Horticulture"

    return None


# ============================================================
# FIELD WORKERS REGISTRY
# ============================================================

FIELD_WORKERS: list[dict[str, Any]] = [
    {
        "id": "E-104",
        "name": "Rajesh Kumar",
        "department": "Electrical",
        "role": "Senior Lineman",
        "zone": "Sector 35 / Zone 1",
        "status": "Available",
    },
    {
        "id": "E-108",
        "name": "Sunita Verma",
        "department": "Electrical",
        "role": "Field Electrical Engineer",
        "zone": "Sector 17 / Central",
        "status": "Available",
    },
    {
        "id": "R-203",
        "name": "Vikas Sen",
        "department": "Roads",
        "role": "Pavement Maintenance Officer",
        "zone": "Sector 35 / Zone 1",
        "status": "Available",
    },
    {
        "id": "R-207",
        "name": "Manoj Tiwari",
        "department": "Roads",
        "role": "Road Inspector",
        "zone": "Sector 22 / West",
        "status": "Available",
    },
    {
        "id": "W-117",
        "name": "Suresh Sharma",
        "department": "Water Supply",
        "role": "Pipeline Technician",
        "zone": "Sector 35 / Zone 1",
        "status": "Available",
    },
    {
        "id": "W-121",
        "name": "Deepak Chawla",
        "department": "Water Supply",
        "role": "Hydraulic Maintenance Officer",
        "zone": "Sector 19 / East",
        "status": "Available",
    },
    {
        "id": "S-052",
        "name": "Amit Singh",
        "department": "Sanitation",
        "role": "Sanitation Supervisor",
        "zone": "Sector 35 / Zone 1",
        "status": "Available",
    },
    {
        "id": "S-059",
        "name": "Neha Rani",
        "department": "Sanitation",
        "role": "Waste Logistics Officer",
        "zone": "Sector 26 / Market",
        "status": "Available",
    },
    {
        "id": "H-031",
        "name": "Gurpreet Gill",
        "department": "Horticulture",
        "role": "Horticulture Inspector",
        "zone": "Sector 35 / Zone 1",
        "status": "Available",
    },
    {
        "id": "H-038",
        "name": "Harinder Brar",
        "department": "Horticulture",
        "role": "Arborist & Green Area Lead",
        "zone": "Sector 17 / Parks",
        "status": "Available",
    },
]


# ============================================================
# AUTOMATIC WORKER ASSIGNMENT ALGORITHM
# ============================================================

def assign_worker_for_department(
    department: str,
    existing_incidents: list[dict[str, Any]] | None = None,
    custom_workers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Find eligible workers matching the complaint department.
    Priority:
    1. Correct department (MANDATORY: never assign another department's worker).
    2. Available worker with lowest active workload.
    If no eligible worker exists:
      assignment_status = "Awaiting Worker"
      assigned_worker_id = None
      assigned_worker_name = "Unassigned"
      assigned_at = None
    """
    workers_pool = custom_workers if custom_workers is not None else FIELD_WORKERS

    eligible = [
        w for w in workers_pool
        if str(w.get("department", "")).strip().lower() == str(department).strip().lower()
    ]

    if not eligible:
        return {
            "assigned_worker_id": None,
            "assigned_worker_name": "Unassigned",
            "assigned_department": department,
            "assigned_at": None,
            "assignment_status": "Awaiting Worker",
        }

    # Count active workload for eligible workers
    incidents = existing_incidents or []
    workload_counts: dict[str, int] = {w["id"]: 0 for w in eligible}

    for inc in incidents:
        w_id = inc.get("assigned_worker_id")
        status = str(inc.get("status", "")).strip().lower()
        if w_id in workload_counts and status in ("assigned", "in_progress", "reported"):
            workload_counts[w_id] += 1

    # Sort eligible workers by active workload ascending, preserving stable priority order
    eligible.sort(key=lambda w: workload_counts.get(w["id"], 0))
    selected = eligible[0]

    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "assigned_worker_id": selected["id"],
        "assigned_worker_name": selected["name"],
        "assigned_department": selected["department"],
        "assigned_at": now_iso,
        "assignment_status": "Assigned",
    }


def filter_tasks_for_department(
    incidents: list[dict[str, Any]],
    department: str | None = None,
    worker_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Filters tasks so that a field worker sees ONLY tasks for their department / worker ID.
    Enforces strict backend isolation between departments.
    """
    filtered = []
    for inc in incidents:
        inc_dept = str(inc.get("assigned_department") or inc.get("department") or "").strip().lower()
        inc_worker = str(inc.get("assigned_worker_id") or "").strip()

        if department:
            target_dept = department.strip().lower()
            if inc_dept != target_dept:
                continue

        if worker_id:
            if inc_worker != worker_id.strip():
                continue

        filtered.append(inc)

    return filtered
