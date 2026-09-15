"""
Unit Tests for Department-Based Automatic Field Worker Assignment System.
Covers all requirements from Section 15 of specification:
- Test 1: Streetlight -> Electrical, Worker E-104, backend timestamp
- Test 2: Pothole -> Roads, Worker R-203
- Test 3: Water Leakage -> Water Supply, Worker W-117
- Test 4: Garbage -> Sanitation, Worker S-052
- Test 5: Fallen Tree -> Horticulture, Worker H-031
- Test 6: No eligible worker -> Unassigned, Awaiting Worker, assigned_at None
- Test 7: Rejection of invalid/unsupported category
- Test 8: Field worker department filtering (Roads worker cannot see Electrical tasks)
"""

import unittest
from fastapi.testclient import TestClient
import main
from assignment_engine import (
    CATEGORY_TO_DEPARTMENT,
    FIELD_WORKERS,
    map_category_to_department,
    assign_worker_for_department,
    filter_tasks_for_department,
)
from test_location_verification import create_test_jpeg_bytes


class TestWorkerAssignmentSystem(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    # --------------------------------------------------------
    # Test 1 — Streetlight -> Electrical
    # --------------------------------------------------------
    def test_01_streetlight_assigned_to_electrical(self):
        dept = map_category_to_department("Broken Streetlight")
        self.assertEqual(dept, "Electrical")

        assignment = assign_worker_for_department("Electrical", [])
        self.assertEqual(assignment["assigned_department"], "Electrical")
        self.assertEqual(assignment["assigned_worker_id"], "E-104")
        self.assertEqual(assignment["assignment_status"], "Assigned")
        self.assertIsNotNone(assignment["assigned_at"])

        # Submit via API
        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/reports",
            data={
                "description": "Streetlight bulb broken outside school",
                "sector": "Sector 35",
                "incident_latitude": "30.7200",
                "incident_longitude": "76.7600",
                "location_source": "USER_DECLARED",
                "ai_analysis": '{"issue_type":"streetlight","confidence":0.92,"severity":"High","description":"Broken streetlight","recommended_department":"Electrical","visible_evidence":["broken bulb"]}'
            },
            files={"file": ("light.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        inc = data["incident"]
        self.assertEqual(inc["department"], "Electrical")
        self.assertEqual(inc["assigned_worker_id"], "E-104")
        self.assertEqual(inc["assigned_worker_name"], "Rajesh Kumar")
        self.assertEqual(inc["assignment_status"], "Assigned")
        self.assertIsNotNone(inc["assigned_at"])

    # --------------------------------------------------------
    # Test 2 — Pothole -> Roads
    # --------------------------------------------------------
    def test_02_pothole_assigned_to_roads(self):
        dept = map_category_to_department("Pothole")
        self.assertEqual(dept, "Roads")

        assignment = assign_worker_for_department("Roads", [])
        self.assertEqual(assignment["assigned_department"], "Roads")
        self.assertEqual(assignment["assigned_worker_id"], "R-203")

        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/reports",
            data={
                "description": "Deep road crater",
                "sector": "Sector 17",
                "incident_latitude": "30.7415",
                "incident_longitude": "76.7794",
                "location_source": "USER_DECLARED",
                "ai_analysis": '{"issue_type":"pothole","confidence":0.95,"severity":"High","description":"Road pothole","recommended_department":"Roads","visible_evidence":["cracked asphalt"]}'
            },
            files={"file": ("pothole.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        inc = response.json()["incident"]
        self.assertEqual(inc["department"], "Roads")
        self.assertEqual(inc["assigned_worker_id"], "R-203")
        self.assertEqual(inc["assignment_status"], "Assigned")

    # --------------------------------------------------------
    # Test 3 — Water Leakage -> Water Supply
    # --------------------------------------------------------
    def test_03_water_leakage_assigned_to_water_supply(self):
        dept = map_category_to_department("Water Leakage")
        self.assertEqual(dept, "Water Supply")

        assignment = assign_worker_for_department("Water Supply", [])
        self.assertEqual(assignment["assigned_department"], "Water Supply")
        self.assertEqual(assignment["assigned_worker_id"], "W-117")

    # --------------------------------------------------------
    # Test 4 — Garbage -> Sanitation
    # --------------------------------------------------------
    def test_04_garbage_assigned_to_sanitation(self):
        dept = map_category_to_department("Garbage")
        self.assertEqual(dept, "Sanitation")

        assignment = assign_worker_for_department("Sanitation", [])
        self.assertEqual(assignment["assigned_department"], "Sanitation")
        self.assertEqual(assignment["assigned_worker_id"], "S-052")

    # --------------------------------------------------------
    # Test 5 — Fallen Tree -> Horticulture
    # --------------------------------------------------------
    def test_05_fallen_tree_assigned_to_horticulture(self):
        dept = map_category_to_department("Fallen Tree")
        self.assertEqual(dept, "Horticulture")

        assignment = assign_worker_for_department("Horticulture", [])
        self.assertEqual(assignment["assigned_department"], "Horticulture")
        self.assertEqual(assignment["assigned_worker_id"], "H-031")

    # --------------------------------------------------------
    # Test 6 — No Eligible Worker
    # --------------------------------------------------------
    def test_06_no_eligible_worker_awaiting(self):
        # Empty worker pool for a department
        assignment = assign_worker_for_department("Electrical", custom_workers=[])
        self.assertIsNone(assignment["assigned_worker_id"])
        self.assertEqual(assignment["assigned_worker_name"], "Unassigned")
        self.assertEqual(assignment["assignment_status"], "Awaiting Worker")
        self.assertIsNone(assignment["assigned_at"])

    # --------------------------------------------------------
    # Test 7 — Invalid / Unsupported Category Rejected
    # --------------------------------------------------------
    def test_07_invalid_category_rejected(self):
        # Stray animal or arbitrary non-civic category must be rejected
        self.assertIsNone(map_category_to_department("Stray Animal"))
        self.assertIsNone(map_category_to_department("Random Problem"))

        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/reports",
            data={
                "description": "Stray dog barking",
                "sector": "Sector 17",
                "incident_latitude": "30.7415",
                "incident_longitude": "76.7794",
                "location_source": "USER_DECLARED",
                "ai_analysis": '{"issue_type":"stray_animal","confidence":0.95,"severity":"Low","description":"Animal","recommended_department":"Animal Control","visible_evidence":["dog"]}'
            },
            files={"file": ("animal.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertIn("Invalid or unsupported category", detail["message"])

    # --------------------------------------------------------
    # Test 8 — Task Isolation Across Departments
    # --------------------------------------------------------
    def test_08_department_task_isolation(self):
        sample_tasks = [
            {"id": "1", "assigned_department": "Electrical", "assigned_worker_id": "E-104"},
            {"id": "2", "assigned_department": "Roads", "assigned_worker_id": "R-203"},
            {"id": "3", "assigned_department": "Sanitation", "assigned_worker_id": "S-052"},
        ]

        electrical_tasks = filter_tasks_for_department(sample_tasks, department="Electrical")
        self.assertEqual(len(electrical_tasks), 1)
        self.assertEqual(electrical_tasks[0]["id"], "1")

        roads_tasks = filter_tasks_for_department(sample_tasks, department="Roads")
        self.assertEqual(len(roads_tasks), 1)
        self.assertEqual(roads_tasks[0]["id"], "2")
        self.assertNotIn("1", [t["id"] for t in roads_tasks])


if __name__ == "__main__":
    unittest.main()
