import json
import unittest
from fastapi.testclient import TestClient
import main
from test_location_verification import create_test_jpeg_bytes


class TestColocationDuplicateRules(unittest.TestCase):
    """
    Automated test suite enforcing the core rule:
    'Same location does NOT mean same complaint.'
    
    Covers the 7 explicit test scenarios:
    1. Same location + same issue + different wording -> Duplicate fused, report_count increments.
    2. Same location + different issue -> 2 separate complaints registered.
    3. Same location + 3 different issues -> 3 separate complaints registered.
    4. Same issue + same location + multiple reports -> priority/report_count increase for that issue only.
    5. Same location + different issues + different departments -> independent department assignment.
    6. Resolve one issue -> only that issue is resolved; others at same location remain active.
    7. Different issue at location where another exists -> new independent complaint created.
    """

    def setUp(self):
        self.orig_supabase = main.supabase
        main.supabase = None
        self.client = TestClient(main.app)
        # Clear in-memory incidents and reports before each test
        main._IN_MEMORY_INCIDENTS.clear()
        main._IN_MEMORY_REPORTS.clear()
        self.img_bytes = create_test_jpeg_bytes(include_exif=False)
        self.lat = 30.7415
        self.lon = 76.7794
        self.sector = "Sector 17"

    def tearDown(self):
        main.supabase = self.orig_supabase

    def submit_report(self, issue_type: str, description: str, department: str | None = None, severity: str = "medium"):
        ai_data = {
            "issue_type": issue_type,
            "confidence": 0.95,
            "severity": severity,
            "description": description,
            "visible_evidence": ["verified civic evidence"],
        }
        if department:
            ai_data["recommended_department"] = department

        response = self.client.post(
            "/reports",
            data={
                "description": description,
                "sector": self.sector,
                "incident_latitude": str(self.lat),
                "incident_longitude": str(self.lon),
                "location_source": "CURRENT_DEVICE_GPS",
                "ai_analysis": json.dumps(ai_data),
            },
            files={"file": ("civic_issue.jpg", self.img_bytes, "image/jpeg")},
        )
        return response

    def test_1_same_location_same_issue_different_wording_fuses_duplicate(self):
        """
        Test Case 1: Same location + same issue + different wording
        Report 1: "There is a huge pothole outside the school." (type: pothole)
        Report 2: "Road mein bada gaddha hai" (type: road_damage, text mentioning gaddha)
        Expected: Duplicate fused into existing complaint; report_count increments to 2.
        """
        res1 = self.submit_report("pothole", "There is a huge pothole outside the school.")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        inc1_id = data1["incident_id"]
        self.assertFalse(data1["fusion"]["matched"])
        self.assertEqual(data1["fusion"]["new_report_count"], 1)

        # Second report at exact same location with Hindi/colloquial phrasing for pothole
        res2 = self.submit_report("road_damage", "Road mein bada gaddha hai school ke bahar")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()

        self.assertTrue(data2["fusion"]["matched"], "Expected road_damage with 'gaddha' to fuse into existing pothole incident")
        self.assertEqual(data2["incident_id"], inc1_id, "Must match same incident ID")
        self.assertEqual(data2["fusion"]["new_report_count"], 2)
        self.assertEqual(len(main._IN_MEMORY_INCIDENTS), 1, "Only 1 incident record should exist")

    def test_2_same_location_different_issue_creates_two_separate_complaints(self):
        """
        Test Case 2: Same location + different issue (Pothole vs Streetlight)
        Expected: Two separate complaints with different incident IDs.
        """
        res_pothole = self.submit_report("pothole", "Pothole on main road")
        self.assertEqual(res_pothole.status_code, 200)
        pothole_id = res_pothole.json()["incident_id"]

        res_light = self.submit_report("streetlight", "Broken streetlight pole dark at night")
        self.assertEqual(res_light.status_code, 200)
        light_id = res_light.json()["incident_id"]

        self.assertNotEqual(pothole_id, light_id, "Pothole and Streetlight must create 2 distinct incidents")
        self.assertFalse(res_light.json()["fusion"]["matched"], "Different issue must NOT be treated as duplicate")
        self.assertEqual(len(main._IN_MEMORY_INCIDENTS), 2)

    def test_3_same_location_three_different_issues_creates_three_complaints(self):
        """
        Test Case 3: Same location + 3 different issues (Pothole, Streetlight, Garbage)
        Expected: Three separate complaints maintained independently.
        """
        res1 = self.submit_report("pothole", "Deep road crater")
        res2 = self.submit_report("streetlight", "Lamp post fixture damaged")
        res3 = self.submit_report("waste", "Overflowing dumpster and trash")

        id1 = res1.json()["incident_id"]
        id2 = res2.json()["incident_id"]
        id3 = res3.json()["incident_id"]

        self.assertEqual(len({id1, id2, id3}), 3, "All 3 IDs must be unique")
        self.assertEqual(len(main._IN_MEMORY_INCIDENTS), 3)

        # Check co-located endpoint returns the other two
        coloc = self.client.get(f"/incidents/{id1}/co-located")
        self.assertEqual(coloc.status_code, 200)
        coloc_data = coloc.json()
        self.assertEqual(coloc_data["count"], 2)
        other_ids = [c["incident_id"] for c in coloc_data["co_located_incidents"]]
        self.assertIn(id2, other_ids)
        self.assertIn(id3, other_ids)

    def test_4_same_issue_same_location_priority_increases_only_for_that_issue(self):
        """
        Test Case 4: Multiple reports for same issue increase report_count and risk only for that issue.
        Unrelated issue at the same location remains unaffected.
        """
        # Register Pothole
        res_p1 = self.submit_report("pothole", "First report of pothole", severity="medium")
        pothole_id = res_p1.json()["incident_id"]
        initial_pothole_risk = res_p1.json()["incident"]["risk_score"]

        # Register Streetlight at same location
        res_s = self.submit_report("streetlight", "Dark lamp post", severity="low")
        streetlight_id = res_s.json()["incident_id"]
        initial_street_risk = res_s.json()["incident"]["risk_score"]

        # Report Pothole 2 more times (same issue)
        res_p2 = self.submit_report("pothole", "Second report of same pothole", severity="medium")
        res_p3 = self.submit_report("pothole", "Third report of same pothole", severity="high")

        # Pothole report count should be 3, risk escalated
        final_pothole = main._IN_MEMORY_INCIDENTS[pothole_id]
        self.assertEqual(final_pothole["report_count"], 3)
        self.assertGreater(final_pothole["risk_score"], initial_pothole_risk)

        # Streetlight must remain completely unaffected: report_count 1, original risk
        final_streetlight = main._IN_MEMORY_INCIDENTS[streetlight_id]
        self.assertEqual(final_streetlight["report_count"], 1)
        self.assertEqual(final_streetlight["risk_score"], initial_street_risk)

    def test_5_different_issues_assigned_to_different_departments(self):
        """
        Test Case 5: Same location + different issues -> mapped to proper independent departments.
        Roads & Infrastructure, Electrical & Lighting, Sanitation.
        """
        res_p = self.submit_report("pothole", "Pothole on junction")
        res_s = self.submit_report("streetlight", "Flickering streetlight")
        res_w = self.submit_report("waste", "Garbage dumped on road")
        res_wl = self.submit_report("water_leak", "Pipeline burst water leaking")

        p_inc = main._IN_MEMORY_INCIDENTS[res_p.json()["incident_id"]]
        s_inc = main._IN_MEMORY_INCIDENTS[res_s.json()["incident_id"]]
        w_inc = main._IN_MEMORY_INCIDENTS[res_w.json()["incident_id"]]
        wl_inc = main._IN_MEMORY_INCIDENTS[res_wl.json()["incident_id"]]

        self.assertIn("Road", p_inc["department"])
        self.assertIn("Electrical", s_inc["department"])
        self.assertIn("Sanitation", w_inc["department"])
        self.assertIn("Water", wl_inc["department"])

    def test_6_resolving_one_issue_leaves_others_active_at_same_location(self):
        """
        Test Case 6: Resolving one issue at a location must NOT resolve or close other issues at that location.
        """
        res1 = self.submit_report("pothole", "Pothole to be fixed")
        res2 = self.submit_report("streetlight", "Streetlight still dark")
        id1 = res1.json()["incident_id"]
        id2 = res2.json()["incident_id"]

        # Resolve Pothole only
        patch_res = self.client.patch(f"/incidents/{id1}/status", json={"status": "resolved"})
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(main._IN_MEMORY_INCIDENTS[id1]["status"], "resolved")

        # Streetlight MUST remain active (not resolved/closed)!
        self.assertNotEqual(main._IN_MEMORY_INCIDENTS[id2]["status"], "resolved")
        self.assertIn(main._IN_MEMORY_INCIDENTS[id2]["status"], ["reported", "needs_review", "in_progress"])

        # Verify co-located lookup for streetlight: only returns open incidents by default
        coloc = self.client.get(f"/incidents/{id2}/co-located")
        self.assertEqual(coloc.status_code, 200)
        # Resolved pothole should not show up under active co-located issues
        active_coloc_ids = [c["incident_id"] for c in coloc.json()["co_located_incidents"]]
        self.assertNotIn(id1, active_coloc_ids)

    def test_7_different_issue_at_location_where_another_exists_creates_independent_complaint(self):
        """
        Test Case 7: When a complaint already exists at a location, a new complaint for a DIFFERENT issue
        creates a new independent complaint with its own lifecycle, rather than fusing.
        """
        res_existing = self.submit_report("waste", "Overflowing garbage bin")
        existing_id = res_existing.json()["incident_id"]

        # New report at exact same coordinates for water leak
        res_new = self.submit_report("water_leak", "Clean water pipe leaking on the pavement")
        new_id = res_new.json()["incident_id"]

        self.assertNotEqual(existing_id, new_id)
        self.assertFalse(res_new.json()["fusion"]["matched"])
        self.assertEqual(main._IN_MEMORY_INCIDENTS[new_id]["issue_type"], "water_leak")
        self.assertEqual(main._IN_MEMORY_INCIDENTS[existing_id]["issue_type"], "waste")


if __name__ == "__main__":
    unittest.main()
