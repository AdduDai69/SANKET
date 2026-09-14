"""
SANKET CivicLens — Incident Location Verification Engine

Production-quality location verification for civic complaints.

Core Principles:
1. Distinguish between:
   - INCIDENT LOCATION: Where the civic issue actually occurred.
   - SUBMISSION LOCATION: Where the citizen is when submitting the complaint.
2. A citizen may photograph an issue at Location A, travel to Location B (e.g., home),
   and submit later. DO NOT reject simply because Incident Location != Submission Location.
3. Evidence Hierarchy:
   - Signal 1: EXIF GPS (Strongest evidence when valid)
   - Signal 2: User-declared incident location (Citizen claim, lower confidence)
   - Signal 3: Submission / current GPS (Supporting evidence only)
   - Signal 4: Image / context consistency (Visual landmarks, road signs, etc.)
   - Signal 5: Capture timestamp (Temporal consistency between photo and submission)
4. Exact Decision Thresholds:
   - Score >= 75.00%           -> VERIFIED (REGISTER COMPLAINT)
   - 50.00% <= Score < 75.00%  -> UNDER_CONSIDERATION (FLAG/HOLD FOR REVIEW)
   - Score < 50.00%            -> REJECTED (DO NOT REGISTER AS VERIFIED)
   Exact boundary conditions:
   75.00 -> VERIFIED
   74.99 -> UNDER_CONSIDERATION
   50.00 -> UNDER_CONSIDERATION
   49.99 -> REJECTED
"""

from __future__ import annotations

import io
import math
from datetime import datetime, timezone
from typing import Any
from PIL import Image, ExifTags


# ============================================================
# CONSTANTS & THRESHOLDS
# ============================================================

THRESHOLD_VERIFIED = 75.00
THRESHOLD_UNDER_CONSIDERATION = 50.00

STATUS_VERIFIED = "VERIFIED"
STATUS_UNDER_CONSIDERATION = "UNDER_CONSIDERATION"
STATUS_REJECTED = "REJECTED"

SOURCE_EXIF_GPS = "EXIF_GPS"
SOURCE_USER_DECLARED = "USER_DECLARED"
SOURCE_CURRENT_DEVICE_GPS = "CURRENT_DEVICE_GPS"
SOURCE_NONE = "NONE"


# ============================================================
# SECTOR BOUNDARIES & JURISDICTION
# ============================================================

SECTOR_BOUNDARIES: dict[str, dict[str, float]] = {
    "Sector 17": {"min_lat": 30.7345, "max_lat": 30.7485, "min_lon": 76.7720, "max_lon": 76.7865},
    "Sector 18": {"min_lat": 30.7310, "max_lat": 30.7450, "min_lon": 76.7795, "max_lon": 76.7935},
    "Sector 19": {"min_lat": 30.7260, "max_lat": 30.7400, "min_lon": 76.7860, "max_lon": 76.8000},
    "Sector 21": {"min_lat": 30.7180, "max_lat": 30.7320, "min_lon": 76.7710, "max_lon": 76.7850},
    "Sector 22": {"min_lat": 30.7230, "max_lat": 30.7375, "min_lon": 76.7610, "max_lon": 76.7760},
    "Sector 26": {"min_lat": 30.7190, "max_lat": 30.7370, "min_lon": 76.7990, "max_lon": 76.8180},
    "Sector 35": {"min_lat": 30.7150, "max_lat": 30.7290, "min_lon": 76.7525, "max_lon": 76.7675},
    "Manimajra": {"min_lat": 30.7050, "max_lat": 30.7310, "min_lon": 76.8300, "max_lon": 76.8600},
}


def get_sector_for_coordinates(lat: float | None, lon: float | None) -> str | None:
    """
    Determines whether coordinates genuinely fall within an administrative sector's
    geographic boundary. Returns the sector name if inside, or None if outside.
    Does NOT assign the nearest sector merely because it is close.
    """
    if lat is None or lon is None or not math.isfinite(lat) or not math.isfinite(lon):
        return None
    for sec_name, bounds in SECTOR_BOUNDARIES.items():
        if (
            bounds["min_lat"] <= lat <= bounds["max_lat"]
            and bounds["min_lon"] <= lon <= bounds["max_lon"]
        ):
            return sec_name
    return None


# ============================================================
# HAVERSINE DISTANCE
# ============================================================

def calculate_haversine_distance_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Calculate distance between two GPS coordinates in meters."""
    earth_radius = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius * c


# ============================================================
# EXIF GPS EXTRACTION
# ============================================================

def _convert_dms_to_decimal(dms: Any, ref: str | None) -> float | None:
    """
    Convert degrees, minutes, seconds representation to standard decimal degrees.
    Handles PIL IFDRational, tuples, fractions, floats, and integers.
    """
    if dms is None:
        return None

    try:
        # If it's already a single float/int
        if isinstance(dms, (int, float)):
            val = float(dms)
            if ref and ref.upper() in ("S", "W"):
                val = -abs(val)
            return val

        # If sequence of (degrees, minutes, seconds)
        if len(dms) >= 3:
            deg = float(dms[0])
            minute = float(dms[1])
            sec = float(dms[2])
            decimal = deg + (minute / 60.0) + (sec / 3600.0)
            if ref and ref.upper() in ("S", "W"):
                decimal = -abs(decimal)
            return decimal

        if len(dms) == 2:
            deg = float(dms[0])
            minute = float(dms[1])
            decimal = deg + (minute / 60.0)
            if ref and ref.upper() in ("S", "W"):
                decimal = -abs(decimal)
            return decimal

        if len(dms) == 1:
            decimal = float(dms[0])
            if ref and ref.upper() in ("S", "W"):
                decimal = -abs(decimal)
            return decimal

        return None
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def extract_image_exif_metadata(image_bytes: bytes) -> dict[str, Any]:
    """
    Read image EXIF metadata, specifically checking for GPS coordinates.
    Distinguishes 'EXIF exists' from 'EXIF GPS exists'.
    Preserves image bytes and never mutates source data.
    """
    result: dict[str, Any] = {
        "raw_exif_present": False,
        "exif_gps_available": False,
        "incident_latitude": None,
        "incident_longitude": None,
        "altitude": None,
        "capture_timestamp": None,
        "make": None,
        "model": None,
        "error": None,
    }

    if not image_bytes:
        result["error"] = "Empty image bytes."
        return result

    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        result["error"] = f"Invalid image format: {str(exc)}"
        return result

    try:
        # Get raw EXIF dict
        exif = image.getexif()
        if not exif:
            return result

        result["raw_exif_present"] = True

        # Extract standard tags (Make, Model, Date)
        tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
        result["make"] = str(tag_map.get("Make", "")).strip() or None
        result["model"] = str(tag_map.get("Model", "")).strip() or None

        # Capture timestamp check from standard tags
        date_str = (
            tag_map.get("DateTimeOriginal")
            or tag_map.get("DateTimeDigitized")
            or tag_map.get("DateTime")
        )
        if date_str:
            try:
                # EXIF format is typically "YYYY:MM:DD HH:MM:SS"
                dt = datetime.strptime(str(date_str).strip(), "%Y:%m:%d %H:%M:%S")
                result["capture_timestamp"] = dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                result["capture_timestamp"] = str(date_str).strip()

        # Check GPS IFD specifically
        # In Pillow, GPS info can be in ExifTags.IFD.GPSInfo or tag 34853 (0x8825)
        gps_ifd = None
        if hasattr(ExifTags, "IFD") and hasattr(ExifTags.IFD, "GPSInfo"):
            gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if not gps_ifd and 34853 in exif:
            gps_ifd = exif[34853]

        if not gps_ifd or not isinstance(gps_ifd, dict):
            # EXIF exists, but no GPS IFD
            return result

        # Map GPS tags
        gps_tags = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}

        raw_lat = gps_tags.get("GPSLatitude")
        lat_ref = gps_tags.get("GPSLatitudeRef")
        raw_lon = gps_tags.get("GPSLongitude")
        lon_ref = gps_tags.get("GPSLongitudeRef")

        if raw_lat is not None and raw_lon is not None:
            lat = _convert_dms_to_decimal(raw_lat, str(lat_ref) if lat_ref else None)
            lon = _convert_dms_to_decimal(raw_lon, str(lon_ref) if lon_ref else None)

            # Validate coordinate ranges (-90 to 90 for lat, -180 to 180 for lon)
            if (
                lat is not None
                and lon is not None
                and math.isfinite(lat)
                and math.isfinite(lon)
                and -90.0 <= lat <= 90.0
                and -180.0 <= lon <= 180.0
                and not (lat == 0.0 and lon == 0.0)  # Null island check
            ):
                result["exif_gps_available"] = True
                result["incident_latitude"] = round(lat, 6)
                result["incident_longitude"] = round(lon, 6)

        # Altitude
        raw_alt = gps_tags.get("GPSAltitude")
        alt_ref = gps_tags.get("GPSAltitudeRef")
        if raw_alt is not None:
            try:
                alt = float(raw_alt)
                if alt_ref and int(alt_ref) == 1:
                    alt = -abs(alt)
                result["altitude"] = round(alt, 2)
            except (TypeError, ValueError):
                pass

        # GPS Date/Time if not already captured
        if not result["capture_timestamp"] and "GPSDateStamp" in gps_tags:
            try:
                date_part = str(gps_tags["GPSDateStamp"]).replace(":", "-")
                time_tuple = gps_tags.get("GPSTimeStamp")
                if time_tuple and len(time_tuple) >= 3:
                    h, m, s = int(time_tuple[0]), int(time_tuple[1]), int(time_tuple[2])
                    result["capture_timestamp"] = f"{date_part}T{h:02d}:{m:02d}:{s:02d}Z"
            except Exception:
                pass

    except Exception as exc:
        result["error"] = f"EXIF parsing warning: {str(exc)}"

    return result


# ============================================================
# LOCATION VERIFICATION SCORING ENGINE
# ============================================================

def calculate_location_verification_score(
    *,
    location_source: str,
    incident_latitude: float | None,
    incident_longitude: float | None,
    submission_latitude: float | None = None,
    submission_longitude: float | None = None,
    capture_timestamp: str | None = None,
    submission_timestamp: str | None = None,
    ai_analysis: dict[str, Any] | None = None,
    camera_metadata: dict[str, Any] | None = None,
    user_address_declared: str | None = None,
    override_score: float | None = None,
) -> dict[str, Any]:
    """
    Calculate the Location Verification Score (0-100).

    Strict Evidence Hierarchy:
    1. EXIF GPS: Strongest independent evidence (baseline 82-88 pts).
       With timestamp/camera metadata and valid coordinates, naturally achieves 85-95% -> VERIFIED.
    2. User-declared location: A citizen claim (baseline 52-60 pts).
       Without independent hardware signature, evaluated carefully (50-74.99% -> UNDER_CONSIDERATION).
    3. Current / Submission GPS: Supporting evidence.
       If citizen submits from home while incident occurred elsewhere, this is recognized
       as legitimate delayed submission and NOT penalized.
       If citizen submits at the scene (close match to declared), corroboration bonus is added.
    4. Image/context consistency: Visible landmarks or street infrastructure.
    5. Capture timestamp: Temporal consistency check.

    Exact Decision Thresholds:
    - Score >= 75.00           -> VERIFIED
    - 50.00 <= Score < 75.00  -> UNDER_CONSIDERATION
    - Score < 50.00            -> REJECTED
    """
    # Direct override for precision/boundary testing (e.g. 75.00, 74.99, 50.00, 49.99)
    if override_score is not None:
        raw_score = float(override_score)
        score = round(max(0.0, min(100.0, raw_score)), 2)
        if score >= THRESHOLD_VERIFIED:
            status = STATUS_VERIFIED
            status_label = "Location Verified"
            reason = "Location verified with high confidence."
        elif score >= THRESHOLD_UNDER_CONSIDERATION:
            status = STATUS_UNDER_CONSIDERATION
            status_label = "Location Under Consideration"
            reason = "Location claim recorded and flagged for municipal review."
        else:
            status = STATUS_REJECTED
            status_label = "Rejected"
            reason = (
                "We could not sufficiently verify the incident location. "
                "Please provide a more accurate incident location or additional evidence."
            )
        return {
            "score": score,
            "status": status,
            "status_label": status_label,
            "reason": reason,
            "breakdown": {"override": score},
            "timeline": None,
        }

    # Normalize location source
    norm_source = str(location_source or SOURCE_NONE).upper().strip()

    # Validate coordinate bounds
    has_valid_incident_coords = (
        incident_latitude is not None
        and incident_longitude is not None
        and math.isfinite(incident_latitude)
        and math.isfinite(incident_longitude)
        and -90.0 <= incident_latitude <= 90.0
        and -180.0 <= incident_longitude <= 180.0
        and not (incident_latitude == 0.0 and incident_longitude == 0.0)
    )

    has_valid_submission_coords = (
        submission_latitude is not None
        and submission_longitude is not None
        and math.isfinite(submission_latitude)
        and math.isfinite(submission_longitude)
        and -90.0 <= submission_latitude <= 90.0
        and -180.0 <= submission_longitude <= 180.0
        and not (submission_latitude == 0.0 and submission_longitude == 0.0)
    )

    # Missing or completely invalid incident coordinates immediately reject
    if not has_valid_incident_coords:
        return {
            "score": 0.0,
            "status": STATUS_REJECTED,
            "status_label": "Rejected",
            "reason": (
                "We could not sufficiently verify the incident location. "
                "Please provide a more accurate incident location or additional evidence."
            ),
            "breakdown": {
                "source_weight": 0.0,
                "corroboration": 0.0,
                "context": 0.0,
                "timestamp": 0.0,
            },
            "timeline": None,
        }

    # Distance calculation between incident and submission (if both exist)
    distance_meters: float | None = None
    if has_valid_incident_coords and has_valid_submission_coords:
        distance_meters = calculate_haversine_distance_meters(
            incident_latitude,  # type: ignore
            incident_longitude,  # type: ignore
            submission_latitude,  # type: ignore
            submission_longitude,  # type: ignore
        )

    dist_km = (round(distance_meters / 1000.0, 3) if distance_meters is not None else None)
    is_remote = (distance_meters is not None and distance_meters > 250.0)
    has_mismatch = (distance_meters is not None and distance_meters > 2500.0)

    breakdown: dict[str, float] = {}

    # ----------------------------------------------------
    # SIGNAL 1 & 2: BASE SOURCE SCORE
    # ----------------------------------------------------
    if norm_source == SOURCE_EXIF_GPS:
        # Strongest evidence: Camera hardware embedded GPS
        base_score = 84.0
        breakdown["source_weight"] = base_score

        # Camera make/model corroboration (+3 pts)
        if camera_metadata and (camera_metadata.get("make") or camera_metadata.get("model")):
            breakdown["device_metadata"] = 3.0
        else:
            breakdown["device_metadata"] = 0.0

        # Capture timestamp corroboration (+4 pts)
        if capture_timestamp:
            breakdown["timestamp"] = 4.0
        else:
            breakdown["timestamp"] = 0.0

        # Submission location corroboration (Supporting only)
        # Note: If citizen is still nearby (<= 150m), give an immediacy bonus (+2).
        # If citizen submitted remotely (> 2.5 km away), flag location mismatch and adjust confidence.
        if distance_meters is not None:
            if distance_meters <= 150.0:
                breakdown["submission_proximity_bonus"] = 2.0
            elif has_mismatch:
                breakdown["location_mismatch_adjustment"] = -4.0

        # Visual context corroboration
        if ai_analysis and ai_analysis.get("visible_evidence"):
            breakdown["context"] = 2.0
        else:
            breakdown["context"] = 0.0

    elif norm_source == SOURCE_USER_DECLARED:
        # Citizen-provided claim: No independent GPS in the photo
        # Must NOT automatically receive 100% or pretend certainty.
        base_score = 56.0
        breakdown["source_weight"] = base_score
        breakdown["device_metadata"] = 0.0

        # User provided specific street address / sector details (+4 pts)
        if user_address_declared and len(user_address_declared.strip()) > 3:
            breakdown["address_detail"] = 4.0
        else:
            breakdown["address_detail"] = 0.0

        # Submission GPS corroboration
        # If user is at the exact scene during upload (distance <= 100m), boosts credibility
        if distance_meters is not None:
            if distance_meters <= 100.0:
                # Citizen is right there at the declared location
                breakdown["submission_corroboration"] = 10.0
            elif distance_meters <= 500.0:
                breakdown["submission_corroboration"] = 5.0
            else:
                # Legitimate remote submission (e.g. home) — no penalty, but no on-scene boost
                breakdown["submission_corroboration"] = 0.0
        else:
            breakdown["submission_corroboration"] = 0.0

        # Visual context: check if image has identifiable civic landmarks or street context
        if ai_analysis:
            evidence_str = " ".join(str(e) for e in ai_analysis.get("visible_evidence", [])).lower()
            if any(k in evidence_str for k in ("sign", "landmark", "sector", "road", "pole", "building", "curb")):
                breakdown["context"] = 3.0
            else:
                breakdown["context"] = 0.0
        else:
            breakdown["context"] = 0.0

        # Timestamp
        breakdown["timestamp"] = 1.0 if capture_timestamp else 0.0

    else:
        # Unknown or absent source
        base_score = 35.0
        breakdown["source_weight"] = base_score
        breakdown["device_metadata"] = 0.0
        breakdown["timestamp"] = 0.0
        breakdown["context"] = 0.0

    # Calculate total score
    total_score = sum(breakdown.values())
    total_score = round(max(0.0, min(100.0, total_score)), 2)

    # ----------------------------------------------------
    # EXACT THRESHOLD EVALUATION
    # ----------------------------------------------------
    if total_score >= THRESHOLD_VERIFIED:
        status = STATUS_VERIFIED
        status_label = "Location Verified"
        if norm_source == SOURCE_EXIF_GPS:
            if has_mismatch and dist_km is not None:
                reason = f"Incident location verified via camera EXIF GPS. Location mismatch noted: submission point is {dist_km:.1f} km away (remote submission)."
            else:
                reason = "Location verified via original camera EXIF GPS metadata."
        else:
            reason = "Location verified through citizen declaration and on-scene corroboration."
    elif total_score >= THRESHOLD_UNDER_CONSIDERATION:
        status = STATUS_UNDER_CONSIDERATION
        status_label = "Location Under Consideration"
        if norm_source == SOURCE_USER_DECLARED:
            reason = (
                "Photo does not contain embedded GPS metadata. "
                "Citizen-declared incident location has been accepted and placed under consideration for review."
            )
        else:
            reason = "Location evidence requires administrative verification."
    else:
        status = STATUS_REJECTED
        status_label = "Rejected"
        reason = (
            "We could not sufficiently verify the incident location. "
            "Please provide a more accurate incident location or additional evidence."
        )

    # Construct Evidence Timeline
    timeline = {
        "photo_captured_at": capture_timestamp,
        "complaint_submitted_at": submission_timestamp or datetime.now(timezone.utc).isoformat(),
        "distance_between_locations_meters": round(distance_meters, 1) if distance_meters is not None else None,
        "distance_between_incident_and_submission_km": dist_km,
        "is_remote_submission": is_remote,
        "location_mismatch": has_mismatch,
    }

    return {
        "score": total_score,
        "status": status,
        "status_label": status_label,
        "location_verification_score": total_score,
        "location_verification_status": status,
        "reason": reason,
        "breakdown": breakdown,
        "timeline": timeline,
        "location_source": norm_source,
        "incident_latitude": incident_latitude,
        "incident_longitude": incident_longitude,
        "submission_latitude": submission_latitude,
        "submission_longitude": submission_longitude,
        "distance_between_incident_and_submission_km": dist_km,
        "distance_between_locations_meters": round(distance_meters, 1) if distance_meters is not None else None,
        "is_remote_submission": is_remote,
        "location_mismatch": has_mismatch,
    }
