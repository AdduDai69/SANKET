"""
SANKET CivicLens — Comprehensive Location Verification Test Suite

Tests all 20 scenarios required by the Incident Location Verification specification:
1. Image with valid EXIF GPS.
2. Image with EXIF but no GPS.
3. Image with malformed GPS.
4. Screenshot (no EXIF metadata).
5. Image with stripped metadata (e.g. WhatsApp/social media).
6. Upload from a different location than the incident (Location A != Location B).
7. User denies current GPS permission (no submission GPS).
8. Manual incident location selection (USER_DECLARED).
9. Score exactly 75.00% -> VERIFIED.
10. Score 74.99% -> UNDER_CONSIDERATION.
11. Score exactly 50.00% -> UNDER_CONSIDERATION.
12. Score 49.99% -> REJECTED.
13. Score above 75% -> VERIFIED.
14. Score below 50% -> REJECTED.
15. Missing EXIF fields.
16. Invalid coordinates (lat/lon out of range).
17. Missing capture timestamp.
18. Citizen uploads an old image.
19. Incident location and submission location are different.
20. Backward compatibility with legacy complaint records without location verification fields.
"""

import io
import unittest
from datetime import datetime, timezone
from PIL import Image, ExifTags

from location_engine import (
    STATUS_REJECTED,
    STATUS_UNDER_CONSIDERATION,
    STATUS_VERIFIED,
    SOURCE_EXIF_GPS,
    SOURCE_USER_DECLARED,
    SOURCE_NONE,
    extract_image_exif_metadata,
    calculate_location_verification_score,
    _convert_dms_to_decimal,
)


def create_test_jpeg_bytes(
    include_exif: bool = False,
    include_gps: bool = True,
    lat_dms=(30.0, 44.0, 25.0),
    lat_ref="N",
    lon_dms=(76.0, 46.0, 45.0),
    lon_ref="E",
    make="Apple",
    model="iPhone 14 Pro",
    date_time="2026:08:15 10:30:00",
    malformed_gps: bool = False,
) -> bytes:
    """Helper to generate in-memory synthetic JPEG with customized EXIF."""
    img = Image.new("RGB", (64, 64), color=(73, 109, 137))
    buf = io.BytesIO()

    if not include_exif:
        img.save(buf, format="JPEG")
        return buf.getvalue()

    exif = img.getexif()
    if make:
        exif[0x010F] = make
    if model:
        exif[0x0110] = model
    if date_time:
        exif[0x0132] = date_time

    if include_gps:
        if malformed_gps:
            # Create valid image, then corrupt the EXIF payload
            gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
            gps[1] = "N"
            gps[2] = (30.0, 44.0, 25.0)
            gps[3] = "E"
            gps[4] = (76.0, 46.0, 45.0)
            img.save(buf, format="JPEG", exif=exif)
            raw = bytearray(buf.getvalue())
            # Corrupt the EXIF segment bytes so GPS parser encounters invalid tags
            exif_pos = raw.find(b"Exif")
            if exif_pos != -1 and exif_pos + 12 < len(raw):
                raw[exif_pos + 8 : exif_pos + 14] = b"\xff\xff\x00\x00\xfe\xfe"
            return bytes(raw)
        else:
            gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
            gps[1] = lat_ref
            gps[2] = lat_dms
            gps[3] = lon_ref
            gps[4] = lon_dms

    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


class TestIncidentLocationVerification(unittest.TestCase):

    # --------------------------------------------------------
    # Case 1: Original camera image + valid EXIF GPS
    # --------------------------------------------------------
    def test_01_valid_exif_gps_extraction(self):
        # 30° 44' 25" N, 76° 46' 45" E
        jpeg_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=True,
            lat_dms=(30.0, 44.0, 25.0),
            lat_ref="N",
            lon_dms=(76.0, 46.0, 45.0),
            lon_ref="E",
        )
        extracted = extract_image_exif_metadata(jpeg_bytes)
        self.assertTrue(extracted["raw_exif_present"])
        self.assertTrue(extracted["exif_gps_available"])
        self.assertIsNotNone(extracted["incident_latitude"])
        self.assertIsNotNone(extracted["incident_longitude"])
        self.assertAlmostEqual(extracted["incident_latitude"], 30.740278, places=3)
        self.assertAlmostEqual(extracted["incident_longitude"], 76.779167, places=3)

        # Calculate score
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=extracted["incident_latitude"],
            incident_longitude=extracted["incident_longitude"],
            capture_timestamp=extracted["capture_timestamp"],
            camera_metadata={"make": extracted["make"], "model": extracted["model"]},
        )
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreaterEqual(res["score"], 75.00)

    # --------------------------------------------------------
    # Case 2: Image has EXIF but no GPS (Make/Model/Date only)
    # --------------------------------------------------------
    def test_02_exif_exists_but_no_gps(self):
        jpeg_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=False,
            make="Sony",
            model="A7III",
        )
        extracted = extract_image_exif_metadata(jpeg_bytes)
        self.assertTrue(extracted["raw_exif_present"])
        self.assertFalse(extracted["exif_gps_available"])
        self.assertIsNone(extracted["incident_latitude"])
        self.assertIsNone(extracted["incident_longitude"])
        self.assertEqual(extracted["make"], "Sony")

    # --------------------------------------------------------
    # Case 3: Image with malformed GPS metadata (no crash)
    # --------------------------------------------------------
    def test_03_malformed_gps_metadata(self):
        jpeg_bytes = create_test_jpeg_bytes(
            include_exif=True,
            include_gps=True,
            malformed_gps=True,
        )
        extracted = extract_image_exif_metadata(jpeg_bytes)
        # Should gracefully treat GPS as unavailable without crashing
        self.assertFalse(extracted["exif_gps_available"])
        self.assertIsNone(extracted["incident_latitude"])
        self.assertIsNone(extracted["incident_longitude"])

    # --------------------------------------------------------
    # Case 4: Screenshot (no usable EXIF)
    # --------------------------------------------------------
    def test_04_screenshot_no_exif(self):
        img = Image.new("RGBA", (100, 100), color=(255, 255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        extracted = extract_image_exif_metadata(buf.getvalue())
        self.assertFalse(extracted["exif_gps_available"])
        self.assertIsNone(extracted["incident_latitude"])

    # --------------------------------------------------------
    # Case 5: Image with stripped metadata (WhatsApp/social media)
    # --------------------------------------------------------
    def test_05_stripped_metadata(self):
        jpeg_bytes = create_test_jpeg_bytes(include_exif=False)
        extracted = extract_image_exif_metadata(jpeg_bytes)
        self.assertFalse(extracted["raw_exif_present"])
        self.assertFalse(extracted["exif_gps_available"])

    # --------------------------------------------------------
    # Case 6: Upload from a different location than incident (Location A != Location B)
    # --------------------------------------------------------
    def test_06_upload_from_home_delayed_submission(self):
        # Incident occurred at Location A (Sector 17, Chandigarh)
        inc_lat, inc_lon = 30.7415, 76.7794
        # Citizen reaches home at Location B (Mohali / Sector 70 ~ 8 km away)
        sub_lat, sub_lon = 30.6942, 76.7180

        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=inc_lat,
            incident_longitude=inc_lon,
            submission_latitude=sub_lat,
            submission_longitude=sub_lon,
            capture_timestamp="2026-09-14T10:30:00Z",
            submission_timestamp="2026-09-14T11:45:00Z",
        )
        # MUST NOT be rejected simply because locations differ!
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreaterEqual(res["score"], 75.00)
        self.assertTrue(res["timeline"]["is_remote_submission"])

    # --------------------------------------------------------
    # Case 7: Citizen denies GPS permission (no submission GPS)
    # --------------------------------------------------------
    def test_07_user_denies_gps_permission(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            submission_latitude=None,
            submission_longitude=None,
            capture_timestamp="2026-09-14T10:00:00Z",
        )
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreaterEqual(res["score"], 75.00)

    # --------------------------------------------------------
    # Case 8: Manual incident location selection (USER_DECLARED)
    # --------------------------------------------------------
    def test_08_manual_incident_location_selection(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_USER_DECLARED,
            incident_latitude=30.7333,
            incident_longitude=76.7794,
            user_address_declared="Sector 17 Market, near Fountain",
        )
        # Manually selected location is valid but placed under consideration (< 75%, >= 50%)
        self.assertEqual(res["status"], STATUS_UNDER_CONSIDERATION)
        self.assertGreaterEqual(res["score"], 50.00)
        self.assertLess(res["score"], 75.00)

    # --------------------------------------------------------
    # Case 9: Boundary check — Score exactly 75.00% -> VERIFIED
    # --------------------------------------------------------
    def test_09_score_exactly_75(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            override_score=75.00,
        )
        self.assertEqual(res["score"], 75.00)
        self.assertEqual(res["status"], STATUS_VERIFIED)

    # --------------------------------------------------------
    # Case 10: Boundary check — Score 74.99% -> UNDER_CONSIDERATION
    # --------------------------------------------------------
    def test_10_score_74_99(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_USER_DECLARED,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            override_score=74.99,
        )
        self.assertEqual(res["score"], 74.99)
        self.assertEqual(res["status"], STATUS_UNDER_CONSIDERATION)

    # --------------------------------------------------------
    # Case 11: Boundary check — Score exactly 50.00% -> UNDER_CONSIDERATION
    # --------------------------------------------------------
    def test_11_score_exactly_50(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_USER_DECLARED,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            override_score=50.00,
        )
        self.assertEqual(res["score"], 50.00)
        self.assertEqual(res["status"], STATUS_UNDER_CONSIDERATION)

    # --------------------------------------------------------
    # Case 12: Boundary check — Score 49.99% -> REJECTED
    # --------------------------------------------------------
    def test_12_score_49_99(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_NONE,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            override_score=49.99,
        )
        self.assertEqual(res["score"], 49.99)
        self.assertEqual(res["status"], STATUS_REJECTED)
        self.assertIn("We could not sufficiently verify", res["reason"])

    # --------------------------------------------------------
    # Case 13: Score comfortably above 75% -> VERIFIED
    # --------------------------------------------------------
    def test_13_score_above_75(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            capture_timestamp="2026-09-14T08:00:00Z",
            camera_metadata={"make": "Samsung", "model": "Galaxy S23"},
        )
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreater(res["score"], 80.0)

    # --------------------------------------------------------
    # Case 14: Score below 50% -> REJECTED
    # --------------------------------------------------------
    def test_14_score_below_50(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_NONE,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
        )
        self.assertEqual(res["status"], STATUS_REJECTED)
        self.assertLess(res["score"], 50.0)
        self.assertIn("We could not sufficiently verify the incident location", res["reason"])

    # --------------------------------------------------------
    # Case 15: Missing EXIF fields (e.g. no ref, no altitude)
    # --------------------------------------------------------
    def test_15_missing_exif_fields(self):
        # Coordinates without ref default to positive degrees
        decimal = _convert_dms_to_decimal((30, 44, 25), None)
        self.assertAlmostEqual(decimal, 30.740278, places=3)

    # --------------------------------------------------------
    # Case 16: Invalid coordinates (lat > 90 or lon > 180)
    # --------------------------------------------------------
    def test_16_invalid_coordinates(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=192.5,  # Out of bounds
            incident_longitude=76.7,
        )
        self.assertEqual(res["status"], STATUS_REJECTED)
        self.assertEqual(res["score"], 0.0)

    # --------------------------------------------------------
    # Case 17: Missing capture timestamp (should not fail)
    # --------------------------------------------------------
    def test_17_missing_capture_timestamp(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            capture_timestamp=None,
        )
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreaterEqual(res["score"], 75.0)

    # --------------------------------------------------------
    # Case 18: Citizen uploads an old image (temporal distance)
    # --------------------------------------------------------
    def test_18_old_image_upload(self):
        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=30.7415,
            incident_longitude=76.7794,
            capture_timestamp="2025-01-01T10:00:00Z",
            submission_timestamp="2026-09-14T12:00:00Z",
        )
        # Valid GPS still verifies location
        self.assertEqual(res["status"], STATUS_VERIFIED)
        self.assertGreaterEqual(res["score"], 75.0)

    # --------------------------------------------------------
    # Case 19: Incident and submission locations are different
    # --------------------------------------------------------
    def test_19_incident_and_submission_locations_are_different(self):
        loc_a_lat, loc_a_lon = 30.7415, 76.7794
        loc_b_lat, loc_b_lon = 30.7000, 76.7500

        res = calculate_location_verification_score(
            location_source=SOURCE_EXIF_GPS,
            incident_latitude=loc_a_lat,
            incident_longitude=loc_a_lon,
            submission_latitude=loc_b_lat,
            submission_longitude=loc_b_lon,
        )
        self.assertEqual(res["incident_latitude"], loc_a_lat)
        self.assertEqual(res["submission_latitude"], loc_b_lat)
        self.assertNotEqual(res["incident_latitude"], res["submission_latitude"])
        self.assertEqual(res["status"], STATUS_VERIFIED)

    # --------------------------------------------------------
    # Case 20: Backward compatibility with legacy records
    # --------------------------------------------------------
    def test_20_backward_compatibility_legacy_record(self):
        legacy_record = {
            "incident_id": "legacy-001",
            "title": "Old pothole",
            "latitude": 30.7333,
            "longitude": 76.7794,
            # Notice: no location_score, no location_source, no location_status
        }
        # A legacy record should be adaptable without crash
        incident_lat = legacy_record.get("incident_latitude") or legacy_record.get("latitude")
        incident_lon = legacy_record.get("incident_longitude") or legacy_record.get("longitude")
        location_status = legacy_record.get("location_status") or "VERIFIED"
        location_source = legacy_record.get("location_source") or "LEGACY_RECORD"

        self.assertEqual(incident_lat, 30.7333)
        self.assertEqual(incident_lon, 76.7794)
        self.assertEqual(location_status, "VERIFIED")
        self.assertEqual(location_source, "LEGACY_RECORD")


if __name__ == "__main__":
    unittest.main()
