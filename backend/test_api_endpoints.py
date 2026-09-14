import unittest
from fastapi.testclient import TestClient
import main
from test_location_verification import create_test_jpeg_bytes

class TestApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_extract_location_with_exif(self):
        img_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=True,
            lat_dms=(30.0, 44.0, 25.0),
            lon_dms=(76.0, 46.0, 45.0)
        )
        response = self.client.post(
            "/extract-location",
            files={"file": ("test.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["exif_gps_available"])
        self.assertEqual(data["location_source"], "EXIF_GPS")
        self.assertAlmostEqual(data["incident_latitude"], 30.740277, places=3)
        self.assertAlmostEqual(data["incident_longitude"], 76.779166, places=3)

    def test_extract_location_without_exif(self):
        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/extract-location",
            files={"file": ("plain.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["exif_gps_available"])
        self.assertEqual(data["location_source"], "NONE")

    def test_reports_remote_submission_verified(self):
        """Photo with EXIF GPS taken at Location A, uploaded from Location B (remote) -> VERIFIED."""
        img_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=True,
            lat_dms=(30.0, 44.0, 25.0),
            lon_dms=(76.0, 46.0, 45.0)
        )
        response = self.client.post(
            "/reports",
            data={
                "description": "Pothole on Madhya Marg",
                "sector": "Sector 17",
                "incident_latitude": "30.7402",
                "incident_longitude": "76.7791",
                "submission_latitude": "30.7600",
                "submission_longitude": "76.8100",
                "location_source": "EXIF_GPS",
                "ai_analysis": '{"issue_type":"pothole","confidence":0.95,"severity":"High","description":"Deep pothole","recommended_department":"Engineering","visible_evidence":["broken asphalt","pothole hole"]}'
            },
            files={"file": ("pothole.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        verification = data["location_verification"]
        self.assertEqual(verification["location_verification_status"], "VERIFIED")
        self.assertGreaterEqual(verification["location_verification_score"], 75.0)
        self.assertTrue(verification["is_remote_submission"])

    def test_reports_user_declared_under_consideration(self):
        """User declared location without device GPS or remote -> UNDER_CONSIDERATION."""
        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/reports",
            data={
                "description": "Streetlight broken",
                "sector": "Sector 22",
                "incident_latitude": "30.7415",
                "incident_longitude": "76.7794",
                "location_source": "USER_DECLARED",
                "ai_analysis": '{"issue_type":"streetlight","confidence":0.90,"severity":"Medium","description":"Light not working","recommended_department":"Electrical","visible_evidence":["unlit lamp post"]}'
            },
            files={"file": ("street.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        verification = data["location_verification"]
        self.assertEqual(verification["location_verification_status"], "UNDER_CONSIDERATION")
        self.assertGreaterEqual(verification["location_verification_score"], 50.0)
        self.assertLess(verification["location_verification_score"], 75.0)

    def test_reports_insufficient_rejected(self):
        """Boundary or invalid coordinates with < 50 score is rejected with HTTP 422."""
        img_bytes = create_test_jpeg_bytes(include_exif=False)
        response = self.client.post(
            "/reports",
            data={
                "description": "Pothole with invalid location",
                "sector": "Sector 17",
                "incident_latitude": "999.0", # Invalid latitude triggers fallback to low score
                "incident_longitude": "999.0",
                "location_source": "NONE",
                "ai_analysis": '{"issue_type":"pothole","confidence":0.5,"severity":"Low","description":"Unclear","recommended_department":"Engineering","visible_evidence":["unclear pattern"]}'
            },
            files={"file": ("none.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertIn("We could not sufficiently verify the incident location", detail["message"])
        self.assertEqual(detail["location_status"], "REJECTED")
        self.assertLess(detail["location_score"], 50.0)

    def test_get_assets(self):
        response = self.client.get("/assets")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data["total"], 3)
        self.assertTrue(any(a["id"] == "S35-L092" for a in data["assets"]))

    def test_get_assets_with_department_filter(self):
        response = self.client.get("/assets?department=Lighting")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(all("light" in a["department"].lower() for a in data["assets"]))

    def test_get_asset_detail(self):
        response = self.client.get("/assets/S35-L092")
        self.assertEqual(response.status_code, 200)
        asset = response.json()
        self.assertEqual(asset["id"], "S35-L092")
        self.assertIn("healthBreakdown", asset)
        self.assertIn("recommendation", asset)
        self.assertIn("failurePattern", asset)
        self.assertEqual(asset["recommendation"]["type"], "REPLACE_COMPONENT")

    def test_get_nearby_assets(self):
        # Coordinates of Sector 35-D complaint (near S35-L092)
        response = self.client.get("/assets/nearby?lat=30.7188&lng=76.7562&radius_meters=100")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data["count"], 1)
        self.assertEqual(data["assets"][0]["assetId"], "S35-L092")
        self.assertLess(data["assets"][0]["distanceMeters"], 30.0)

    def test_associate_incident_with_asset(self):
        response = self.client.post(
            "/incidents/inc-test-001/associate-asset",
            json={"asset_id": "S35-L092", "distance_meters": 18.2}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["asset_id"], "S35-L092")

    def test_verify_location_match_endpoint(self):
        response = self.client.post(
            "/verify-location-match",
            json={
                "actual_latitude": 30.7333,
                "actual_longitude": 76.7794,
                "candidate_latitude": 30.7335,
                "candidate_longitude": 76.7794,
                "candidate_sector": "Sector 17"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["is_correct"])
        self.assertGreaterEqual(data["match_percentage"], 95.0)

    def test_reports_location_mismatch_rejected(self):
        """When photo has EXIF GPS, declaring a mismatched location (~3.5km away) rejects registration with 422."""
        img_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=True,
            lat_dms=(30.0, 44.0, 25.0), # ~30.7402
            lon_dms=(76.0, 46.0, 45.0)  # ~76.7791
        )
        # Declared location is far away in Sector 35 (~30.7200, 76.7600)
        response = self.client.post(
            "/reports",
            data={
                "description": "Pothole in wrong place",
                "sector": "Sector 35",
                "incident_latitude": "30.7200",
                "incident_longitude": "76.7600",
                "location_source": "EXIF_GPS",
                "ai_analysis": '{"issue_type":"pothole","confidence":0.95,"severity":"High","description":"Deep pothole","recommended_department":"Engineering","visible_evidence":["broken asphalt"]}'
            },
            files={"file": ("pothole.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertIn("Location verification failed", detail["message"])
        self.assertEqual(detail["location_status"], "REJECTED")
        self.assertLess(detail["match_percentage"], 50.0)

if __name__ == "__main__":
    unittest.main()

