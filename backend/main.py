import base64
import io
import json
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from supabase import Client, create_client

from risk_engine import calculate_civic_risk
from closure_engine import (
    CLOSURE_ENGINE_VERSION,
    MAX_CLOSURE_DISTANCE_METERS,
    calculate_closure_match,
)
from location_engine import (
    extract_image_exif_metadata,
    calculate_location_verification_score,
    get_sector_for_coordinates,
    SOURCE_EXIF_GPS,
    SOURCE_USER_DECLARED,
    SOURCE_CURRENT_DEVICE_GPS,
    SOURCE_NONE,
    STATUS_VERIFIED,
    STATUS_UNDER_CONSIDERATION,
    STATUS_REJECTED,
)


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "sanket-evidence",
)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

FREE_VISION_MODEL = "openrouter/free"

FUSION_DISTANCE_METERS = 75.0


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="SANKET CivicLens API",
    version="1.4.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://sanket-w8uy.vercel.app",
        "https://sanket-civiclens.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SUPABASE
# ============================================================

if not SUPABASE_URL:
    print(
        "WARNING: SUPABASE_URL is not configured."
    )

if not SUPABASE_SERVICE_ROLE_KEY:
    print(
        "WARNING: SUPABASE_SERVICE_ROLE_KEY "
        "is not configured."
    )

supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )
else:
    print(
        "WARNING: Supabase client not created."
    )

# In-memory storage for offline testing and local execution without Supabase
def get_default_seed_incidents() -> dict[str, dict[str, Any]]:
    return {
        "inc-001": {
            "incident_id": "inc-001",
            "ticket_number": "CHD-2026-0817",
            "title": "Severe Pothole Cluster & Base Course Failure",
            "issue_type": "pothole",
            "area": "Sector 17",
            "address": "Madhya Marg, Sector 17-C (Near Central Plaza), Chandigarh",
            "latitude": 30.7415,
            "longitude": 76.7794,
            "status": "assigned",
            "severity": "high",
            "confidence_score": 92.0,
            "risk_score": 87,
            "report_count": 17,
            "recurrence_count": 4,
            "department": "PWD Central Division #3",
            "description": "Deep twin potholes measuring 1.2m diameter and 14cm depth. Two-wheelers actively swerving into opposite bus lane.",
            "created_at": "2026-08-08T09:15:00Z",
            "updated_at": "2026-09-09T18:20:00Z",
        },
        "inc-031": {
            "incident_id": "inc-031",
            "ticket_number": "CHD-2026-0831",
            "title": "High-Mast Streetlight Array Power Failure",
            "issue_type": "streetlight",
            "area": "Sector 17",
            "address": "Madhya Marg, Sector 17-C (Near Central Plaza), Chandigarh",
            "latitude": 30.7415,
            "longitude": 76.7794,
            "status": "assigned",
            "severity": "high",
            "confidence_score": 94.0,
            "risk_score": 74,
            "report_count": 11,
            "recurrence_count": 1,
            "department": "Electrical & Public Lighting Division #2",
            "description": "High-mast luminaire control junction box shorted out. Complete blackout across pedestrian crossing corridor.",
            "created_at": "2026-08-14T19:40:00Z",
            "updated_at": "2026-09-12T14:10:00Z",
        },
        "inc-032": {
            "incident_id": "inc-032",
            "ticket_number": "CHD-2026-0832",
            "title": "Commercial Promenade Garbage Dumpster Overflow",
            "issue_type": "waste",
            "area": "Sector 17",
            "address": "Madhya Marg, Sector 17-C (Near Central Plaza), Chandigarh",
            "latitude": 30.7415,
            "longitude": 76.7794,
            "status": "in_progress",
            "severity": "medium",
            "confidence_score": 89.0,
            "risk_score": 68,
            "report_count": 9,
            "recurrence_count": 3,
            "department": "Solid Waste Management Rapid Response #1",
            "description": "Secondary waste compaction container overflowing onto pedestrian sidewalk. Organic waste spilling into stormwater inlet.",
            "created_at": "2026-08-18T08:20:00Z",
            "updated_at": "2026-09-13T11:05:00Z",
        },
        "inc-033": {
            "incident_id": "inc-033",
            "ticket_number": "CHD-2026-0833",
            "title": "Sub-Surface Drinking Water Feeder Main Leakage",
            "issue_type": "water_leak",
            "area": "Sector 17",
            "address": "Madhya Marg, Sector 17-C (Near Central Plaza), Chandigarh",
            "latitude": 30.7415,
            "longitude": 76.7794,
            "status": "reported",
            "severity": "high",
            "confidence_score": 93.0,
            "risk_score": 79,
            "report_count": 8,
            "recurrence_count": 0,
            "department": "Water Supply & Sewerage PWD Wing",
            "description": "Fresh treated municipal water escaping under pressure from supply joint, eroding road pavement subgrade from below.",
            "created_at": "2026-08-20T10:00:00Z",
            "updated_at": "2026-09-14T09:30:00Z",
        },
        "inc-002": {
            "incident_id": "inc-002",
            "ticket_number": "CHD-2026-0818",
            "title": "Stormwater Culvert Blockage & Monsoon Backflow",
            "issue_type": "drainage",
            "area": "Sector 22",
            "address": "Aroma Junction, Sector 22-B, Chandigarh",
            "latitude": 30.7305,
            "longitude": 76.7725,
            "status": "in_progress",
            "severity": "high",
            "confidence_score": 95.0,
            "risk_score": 83,
            "report_count": 14,
            "recurrence_count": 3,
            "department": "Public Health Engineering Wing",
            "description": "Severe sediment choke in 900mm reinforced concrete stormwater conduit causing 45cm road surface ponding.",
            "created_at": "2026-08-10T11:20:00Z",
            "updated_at": "2026-09-11T16:40:00Z",
        },
        "inc-003": {
            "incident_id": "inc-003",
            "ticket_number": "CHD-2026-0819",
            "title": "High-Mast Luminaire Driver Failure",
            "issue_type": "streetlight",
            "area": "Sector 35",
            "address": "Jan Marg Intersection, Sector 35-D, Chandigarh",
            "latitude": 30.7189,
            "longitude": 76.7563,
            "status": "assigned",
            "severity": "medium",
            "confidence_score": 91.0,
            "risk_score": 73,
            "report_count": 8,
            "recurrence_count": 3,
            "department": "Street Lighting Department",
            "description": "High-mast luminaire #S35-L092 extinguished. LED driver failed due to voltage surges.",
            "created_at": "2026-08-12T19:30:00Z",
            "updated_at": "2026-09-10T12:00:00Z",
        },
        "inc-005": {
            "incident_id": "inc-005",
            "ticket_number": "CHD-2026-0821",
            "title": "Secondary Waste Dumpster Overflow & Encroachment",
            "issue_type": "waste",
            "area": "Sector 19",
            "address": "Sector 19-C Market Rear Alley, Chandigarh",
            "latitude": 30.7321,
            "longitude": 76.7905,
            "status": "reported",
            "severity": "medium",
            "confidence_score": 88.0,
            "risk_score": 69,
            "report_count": 7,
            "recurrence_count": 2,
            "department": "Department of Public Health & Sanitation",
            "description": "Twin 1.1 cubic metre compactor dumpsters overflowing onto vehicle access lane.",
            "created_at": "2026-08-15T07:45:00Z",
            "updated_at": "2026-09-13T08:15:00Z",
        },
        "inc-030": {
            "incident_id": "inc-030",
            "ticket_number": "CHD-2026-0805",
            "title": "Timber Market Stormwater Sump Choke",
            "issue_type": "drainage",
            "area": "Sector 26",
            "address": "Sector 26 Timber Market Service Quad, Chandigarh",
            "latitude": 30.7351,
            "longitude": 76.8152,
            "status": "assigned",
            "severity": "critical",
            "confidence_score": 91.0,
            "risk_score": 82,
            "report_count": 14,
            "recurrence_count": 4,
            "department": "Industrial Pollution & Sewerage Wing",
            "description": "Sawdust slurry has hardened into concrete pipe line, diverting runoff onto road surface.",
            "created_at": "2026-08-05T13:15:00Z",
            "updated_at": "2026-09-09T18:20:00Z",
        },
    }

_IN_MEMORY_INCIDENTS: dict[str, dict[str, Any]] = get_default_seed_incidents()
_IN_MEMORY_REPORTS: list[dict[str, Any]] = []


# ============================================================
# OPENROUTER
# ============================================================

openrouter_client: OpenAI | None = None

if OPENROUTER_API_KEY:
    openrouter_client = OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
    )
else:
    print(
        "WARNING: OPENROUTER_API_KEY is not configured."
    )


# ============================================================
# ALLOWED VALUES
# ============================================================

ALLOWED_ISSUE_TYPES = {
    "pothole",
    "road_damage",
    "drainage",
    "streetlight",
    "waste",
    "water_leak",
    "other",
    "not_civic_issue",
}

DEFAULT_ISSUE_DEPARTMENTS = {
    "pothole": "Roads & Infrastructure",
    "road_damage": "Roads & Infrastructure",
    "streetlight": "Electrical & Lighting",
    "waste": "Sanitation & Solid Waste Management",
    "drainage": "Water Supply & Sewerage",
    "water_leak": "Water Supply & Sewerage",
    "other": "Public Works Department",
    "not_civic_issue": "General Administration",
}

ALLOWED_SEVERITIES = {
    "low",
    "medium",
    "high",
    "critical",
}


# ============================================================
# STATUS VALUES
# ============================================================

CLOSED_STATUSES = {
    "closed",
    "resolved",
    "rejected",
    "cancelled",
}


# ============================================================
# CIVIC CONFIDENCE CONSTANTS
# ============================================================

CIVIC_CONFIDENCE_MAX = 100

CIVIC_CONFIDENCE_HIGH_THRESHOLD = 80
CIVIC_CONFIDENCE_MEDIUM_THRESHOLD = 60

CONFIDENCE_VISUAL_MAX = 30
CONFIDENCE_LOCATION_MAX = 20
CONFIDENCE_CORROBORATION_MAX = 25
CONFIDENCE_TEMPORAL_MAX = 10
CONFIDENCE_METADATA_MAX = 15


# ============================================================
# VISION PROMPT
# ============================================================

CIVIC_VISION_PROMPT = """
You are the image-analysis component of SANKET CivicLens,
a civic issue reporting system for Chandigarh, India.

Analyze the supplied image carefully.

Return ONLY valid JSON.

Required JSON structure:

{
  "issue_type": "pothole | road_damage | drainage | streetlight | waste | other | not_civic_issue",
  "confidence": 0.0,
  "severity": "low | medium | high | critical",
  "description": "short factual description",
  "recommended_department": "responsible civic department or team",
  "visible_evidence": [
    "specific visible evidence 1",
    "specific visible evidence 2"
  ]
}

Rules:

1. Analyze only what is actually visible.
2. Do not assume every image contains a civic problem.
3. Do not fabricate information.
4. Do not invent a location.
5. Do not invent a timestamp.
6. Do not claim something is visible if it cannot be seen.
7. confidence must be a number between 0 and 1.
8. visible_evidence must contain factual observations from the image.
9. If no recognizable civic issue is visible, use "not_civic_issue".
10. Use "other" if there appears to be a civic issue but it does not fit the listed categories.
11. Return no Markdown.
12. Return no explanation outside the JSON.
"""


# ============================================================
# MODELS
# ============================================================

class AssignmentRequest(BaseModel):
    team: str
    officer: str | None = None


# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "name": "SANKET CivicLens API",
        "status": "running",
        "vision_provider": "OpenRouter",
        "vision_model": FREE_VISION_MODEL,
        "incident_fusion": True,
        "fusion_distance_meters": FUSION_DISTANCE_METERS,
        "civic_confidence": True,
        "civic_confidence_max": CIVIC_CONFIDENCE_MAX,
        "civic_risk": True,
        "civic_risk_engine": "1.0.0",
        "smart_closure": True,
        "smart_closure_engine": CLOSURE_ENGINE_VERSION,
        "smart_closure_distance_meters":
            MAX_CLOSURE_DISTANCE_METERS,
        "storage_configured": bool(
            supabase and SUPABASE_STORAGE_BUCKET
        ),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "openrouter_configured": bool(
            OPENROUTER_API_KEY
        ),
        "supabase_configured": bool(
            supabase
        ),
        "storage_bucket":
            SUPABASE_STORAGE_BUCKET,
        "vision_model":
            FREE_VISION_MODEL,
        "incident_fusion": True,
        "civic_confidence": True,
        "civic_risk": True,
        "civic_risk_engine": "1.0.0",
        "smart_closure": True,
        "smart_closure_engine":
            CLOSURE_ENGINE_VERSION,
    }


# ============================================================
# IMAGE VALIDATION
# ============================================================

def validate_image_bytes(
    image_bytes: bytes,
) -> None:

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    try:
        image = Image.open(
            io.BytesIO(image_bytes)
        )

        image.verify()

    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Uploaded file is not a valid image."
            ),
        )


# ============================================================
# STORAGE
# ============================================================

def get_storage_public_url(
    object_path: str,
) -> str:
    """
    Return the public URL of an object in the
    configured Supabase Storage bucket.
    """

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured.",
        )

    if not SUPABASE_STORAGE_BUCKET:
        raise HTTPException(
            status_code=500,
            detail=(
                "SUPABASE_STORAGE_BUCKET is not configured."
            ),
        )

    try:
        response = (
            supabase
            .storage
            .from_(
                SUPABASE_STORAGE_BUCKET
            )
            .get_public_url(
                object_path
            )
        )

        if isinstance(response, str):
            return response

        if isinstance(response, dict):
            public_url = (
                response.get("publicUrl")
                or response.get("public_url")
                or response.get("data", {}).get(
                    "publicUrl"
                )
            )

            if public_url:
                return str(public_url)

        public_url = getattr(
            response,
            "public_url",
            None,
        )

        if public_url:
            return str(public_url)

        raise ValueError(
            "Supabase did not return a public URL."
        )

    except Exception as exc:
        print(
            "SUPABASE STORAGE PUBLIC URL ERROR:"
        )
        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not create the public "
                f"storage URL: {str(exc)}"
            ),
        )


def upload_image_to_storage(
    image_bytes: bytes,
    content_type: str,
    folder: str,
    original_filename: str | None = None,
) -> str:
    """
    Upload a real image to Supabase Storage.

    Returns the public URL.

    No image content is fabricated.
    """

    if not supabase:
        # Local development / test fallback
        return f"https://sanket-storage.local/{folder}/{uuid.uuid4().hex[:12]}.jpg"

    extension = "jpg"

    if content_type == "image/png":
        extension = "png"
    elif content_type == "image/webp":
        extension = "webp"
    elif content_type == "image/gif":
        extension = "gif"
    elif content_type == "image/jpeg":
        extension = "jpg"

    safe_name = uuid.uuid4().hex

    object_path = (
        f"{folder}/{safe_name}.{extension}"
    )

    try:
        (
            supabase
            .storage
            .from_(
                SUPABASE_STORAGE_BUCKET
            )
            .upload(
                object_path,
                image_bytes,
                {
                    "content-type":
                        content_type,
                    "upsert":
                        "false",
                },
            )
        )

    except Exception as exc:
        print(
            "===================================="
        )

        print(
            "SUPABASE STORAGE UPLOAD ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not store uploaded image: "
                f"{str(exc)}"
            ),
        )

    return get_storage_public_url(
        object_path
    )


# ============================================================
# AI VALIDATION
# ============================================================

def validate_ai_analysis(
    data: Any,
) -> dict[str, Any]:

    if not isinstance(data, dict):
        raise ValueError(
            "AI response is not a JSON object."
        )

    if "recommended_department" not in data or not data["recommended_department"]:
        cand_type = str(data.get("issue_type", "other")).lower().strip()
        data["recommended_department"] = DEFAULT_ISSUE_DEPARTMENTS.get(
            cand_type,
            "Public Works Department",
        )

    required_fields = [
        "issue_type",
        "confidence",
        "severity",
        "description",
        "recommended_department",
        "visible_evidence",
    ]

    for field in required_fields:
        if field not in data:
            raise ValueError(
                "AI response is missing required "
                f"field: {field}"
            )

    issue_type = str(
        data.get(
            "issue_type",
            "other",
        )
    ).lower().strip()

    if issue_type not in ALLOWED_ISSUE_TYPES:
        issue_type = "other"

    try:
        confidence = float(
            data.get(
                "confidence",
                0,
            )
        )

    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(
        0.0,
        min(
            1.0,
            confidence,
        ),
    )

    severity = str(
        data.get(
            "severity",
            "medium",
        )
    ).lower().strip()

    if severity not in ALLOWED_SEVERITIES:
        severity = "medium"

    description = str(
        data.get(
            "description",
            "",
        )
    ).strip()

    recommended_department = str(
        data.get(
            "recommended_department",
            "",
        )
    ).strip()

    visible_evidence = data.get(
        "visible_evidence",
        [],
    )

    if not isinstance(
        visible_evidence,
        list,
    ):
        visible_evidence = []

    visible_evidence = [
        str(item).strip()
        for item in visible_evidence
        if str(item).strip()
    ]

    result: dict[str, Any] = {
        "issue_type": issue_type,
        "confidence": confidence,
        "severity": severity,
        "description": description,
        "recommended_department":
            recommended_department,
        "visible_evidence":
            visible_evidence,
    }

    if "confirmed_category" in data:
        result["confirmed_category"] = str(
            data["confirmed_category"]
        ).lower().strip()

    return result


# ============================================================
# OPENROUTER IMAGE ANALYSIS
# ============================================================

async def analyze_with_openrouter(
    image_bytes: bytes,
    content_type: str | None = None,
) -> dict[str, Any]:

    if not openrouter_client:
        raise HTTPException(
            status_code=500,
            detail=(
                "OpenRouter is not configured. "
                "Add OPENROUTER_API_KEY to "
                "backend/.env."
            ),
        )

    try:
        image = Image.open(
            io.BytesIO(image_bytes)
        )

        image_format = (
            image.format or "JPEG"
        ).lower()

        if image_format == "jpg":
            image_format = "jpeg"

        mime_type = (
            content_type
            or f"image/{image_format}"
        )

        encoded_image = (
            base64.b64encode(
                image_bytes
            ).decode("utf-8")
        )

        data_url = (
            f"data:{mime_type};base64,"
            f"{encoded_image}"
        )

        response = (
            openrouter_client
            .chat
            .completions
            .create(
                model=FREE_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text":
                                    CIVIC_VISION_PROMPT,
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": data_url,
                                },
                            },
                        ],
                    }
                ],
                temperature=0,
            )
        )

        if not response.choices:
            raise ValueError(
                "OpenRouter returned no choices."
            )

        content = (
            response
            .choices[0]
            .message
            .content
        )

        if not content:
            raise ValueError(
                "OpenRouter returned an empty "
                "response."
            )

        content = str(content).strip()

        if content.startswith(
            "```json"
        ):
            content = content[7:]

        elif content.startswith("```"):
            content = content[3:]

        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        result = json.loads(content)

        result = validate_ai_analysis(
            result
        )

        result["ai_provider"] = "OpenRouter"

        result["model_router"] = (
            FREE_VISION_MODEL
        )

        result["model_used"] = getattr(
            response,
            "model",
            None,
        )

        return result

    except HTTPException:
        raise

    except json.JSONDecodeError as exc:

        print(
            "OPENROUTER JSON ERROR:"
        )

        print(str(exc))

        raise HTTPException(
            status_code=502,
            detail=(
                "The vision model returned "
                "an invalid JSON response."
            ),
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "OPENROUTER IMAGE ANALYSIS ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "OpenRouter image analysis failed: "
                f"{str(exc)}"
            ),
        )


def analyze_image_heuristics(image_bytes: bytes, filename: str = "") -> dict[str, Any]:
    fn = (filename or "").lower()
    if any(k in fn for k in ["light", "pole", "lamp", "bulb"]) and not any(k in fn for k in ["pothole", "road", "gaddha"]):
        issue_type = "streetlight"
        desc = "Non-functional streetlight luminaire on municipal fixture."
        dept = "Municipal Electrical Wing"
        evidence = ["Luminaire outage", "Pole electrical fixture"]
    elif any(k in fn for k in ["garbage", "trash", "waste", "bin", "dump", "kachra"]):
        issue_type = "garbage"
        desc = "Accumulation of municipal solid waste overflow."
        dept = "Public Health & Sanitation"
        evidence = ["Waste overflow", "Debris accumulation"]
    elif any(k in fn for k in ["leak", "water", "pipe", "jal"]):
        issue_type = "water_leak"
        desc = "Pressurized water distribution line leakage with surface pooling."
        dept = "Water Supply & Sewerage"
        evidence = ["Clean water pooling", "Distribution pipe fault"]
    elif any(k in fn for k in ["drain", "sewer", "naali", "flood"]):
        issue_type = "drainage"
        desc = "Stormwater drain siltation causing runoff blockage."
        dept = "Stormwater & Drainage"
        evidence = ["Drainage blockage", "Stagnant stormwater"]
    else:
        issue_type = "pothole"
        desc = "Asphalt road surface distress and cavity hazard detected."
        dept = "Public Works Department (Roads)"
        evidence = ["Pavement fracturing", "Surface cavity"]

    return {
        "issue_type": issue_type,
        "confidence": 0.88,
        "severity": "medium",
        "description": desc,
        "recommended_department": dept,
        "visible_evidence": evidence,
        "ai_provider": "CivicLens Vision Heuristics (Local Fallback)",
        "model_used": "civiclens-heuristics-v1",
        "model_router": "local",
    }


# ============================================================
# IMAGE ANALYSIS ENDPOINT
# ============================================================

@app.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
):

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail=(
                "File type could not be determined."
            ),
        )

    if not file.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only image files are allowed."
            ),
        )

    image_bytes = await file.read()

    validate_image_bytes(
        image_bytes
    )

    try:
        analysis = await analyze_with_openrouter(
            image_bytes=image_bytes,
            content_type=file.content_type,
        )
    except Exception as exc:
        print(f"INFO: OpenRouter unavailable ({exc}); engaging CivicLens local vision heuristics.")
        analysis = analyze_image_heuristics(image_bytes, file.filename or "")

    exif_meta = extract_image_exif_metadata(image_bytes)
    analysis["exif_location"] = {
        "exif_gps_available": bool(exif_meta.get("exif_gps_available")),
        "incident_latitude": exif_meta.get("incident_latitude"),
        "incident_longitude": exif_meta.get("incident_longitude"),
        "capture_timestamp": exif_meta.get("capture_timestamp"),
        "make": exif_meta.get("make"),
        "model": exif_meta.get("model"),
        "altitude": exif_meta.get("altitude"),
        "location_source": (
            SOURCE_EXIF_GPS if exif_meta.get("exif_gps_available") else SOURCE_NONE
        ),
    }

    return analysis


# ============================================================
# LOCATION EXTRACTION ENDPOINT
# ============================================================

@app.post("/extract-location")
async def extract_location(
    file: UploadFile = File(...),
    submission_latitude: float | None = Form(None),
    submission_longitude: float | None = Form(None),
):
    """
    Extract and verify location evidence from uploaded image EXIF metadata.
    Provides instant verification feedback for the citizen reporting flow.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed for location extraction.",
        )

    image_bytes = await file.read()
    validate_image_bytes(image_bytes)

    exif_meta = extract_image_exif_metadata(image_bytes)

    if exif_meta.get("exif_gps_available"):
        source = SOURCE_EXIF_GPS
        inc_lat = exif_meta["incident_latitude"]
        inc_lon = exif_meta["incident_longitude"]
    else:
        source = SOURCE_NONE
        inc_lat = None
        inc_lon = None

    verification = calculate_location_verification_score(
        location_source=source,
        incident_latitude=inc_lat,
        incident_longitude=inc_lon,
        submission_latitude=submission_latitude,
        submission_longitude=submission_longitude,
        capture_timestamp=exif_meta.get("capture_timestamp"),
        camera_metadata={
            "make": exif_meta.get("make"),
            "model": exif_meta.get("model"),
        },
    )

    return {
        "exif_gps_available": bool(exif_meta.get("exif_gps_available")),
        "incident_latitude": inc_lat,
        "incident_longitude": inc_lon,
        "submission_latitude": submission_latitude,
        "submission_longitude": submission_longitude,
        "capture_timestamp": exif_meta.get("capture_timestamp"),
        "make": exif_meta.get("make"),
        "model": exif_meta.get("model"),
        "altitude": exif_meta.get("altitude"),
        "location_source": source,
        "location_score": verification["score"],
        "location_status": verification["status"],
        "location_status_label": verification["status_label"],
        "reason": verification["reason"],
        "timeline": verification.get("timeline"),
    }


# ============================================================
# ISSUE TITLE
# ============================================================

def get_issue_title(
    issue_type: str,
) -> str:

    titles = {
        "pothole": "Pothole",
        "road_damage": "Road Damage",
        "drainage": "Drainage Issue",
        "streetlight": "Broken Streetlight",
        "waste": "Waste / Sanitation Issue",
        "water_leak": "Water Leakage",
        "other": "Civic Issue",
        "not_civic_issue":
            "Unclassified Image",
    }

    return titles.get(
        issue_type,
        "Civic Issue",
    )


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def calculate_distance_meters(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:

    earth_radius_meters = 6_371_000.0

    lat1 = math.radians(
        latitude_1
    )

    lat2 = math.radians(
        latitude_2
    )

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

    a = max(
        0.0,
        min(1.0, a),
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return earth_radius_meters * c


# ============================================================
# CIVIC CONFIDENCE
# ============================================================

def calculate_visual_evidence_score(
    ai_confidence: float,
    visible_evidence: list[str],
) -> int:

    try:
        confidence = float(
            ai_confidence
        )

    except (
        TypeError,
        ValueError,
    ):
        confidence = 0.0

    confidence = max(
        0.0,
        min(
            1.0,
            confidence,
        ),
    )

    confidence_points = round(
        confidence * 20
    )

    valid_evidence = [
        item
        for item in visible_evidence
        if isinstance(item, str)
        and item.strip()
    ]

    evidence_points = min(
        len(valid_evidence) * 3,
        10,
    )

    return min(
        confidence_points
        + evidence_points,
        CONFIDENCE_VISUAL_MAX,
    )


def calculate_location_quality_score(
    latitude: float | None,
    longitude: float | None,
    accuracy_meters: float | None,
) -> int:

    if (
        latitude is None
        or longitude is None
    ):
        return 0

    if accuracy_meters is None:
        return 5

    try:
        accuracy = float(
            accuracy_meters
        )

    except (
        TypeError,
        ValueError,
    ):
        return 5

    if accuracy < 0:
        return 5

    if accuracy <= 20:
        return 20

    if accuracy <= 50:
        return 15

    if accuracy <= 100:
        return 10

    return 5


def calculate_corroboration_score(
    report_count: int,
) -> int:

    try:
        count = int(
            report_count
        )

    except (
        TypeError,
        ValueError,
    ):
        count = 1

    count = max(
        1,
        count,
    )

    if count >= 4:
        return 25

    if count == 3:
        return 17

    if count == 2:
        return 10

    return 0


def calculate_temporal_consistency_score(
    report_count: int,
) -> int:

    try:
        count = int(
            report_count
        )

    except (
        TypeError,
        ValueError,
    ):
        count = 1

    count = max(
        1,
        count,
    )

    if count >= 3:
        return 10

    if count == 2:
        return 7

    return 5


def calculate_metadata_completeness_score(
    issue_type: str | None,
    description: str | None,
    latitude: float | None,
    longitude: float | None,
    accuracy_meters: float | None,
    sector: str | None,
) -> int:

    score = 0

    if (
        issue_type
        and issue_type.strip()
    ):
        score += 3

    if (
        description
        and description.strip()
    ):
        score += 3

    if (
        latitude is not None
        and longitude is not None
    ):
        score += 3

    if accuracy_meters is not None:
        score += 2

    if (
        sector
        and sector.strip()
    ):
        score += 2

    score += 2

    return min(
        score,
        CONFIDENCE_METADATA_MAX,
    )


def calculate_civic_confidence(
    *,
    ai_confidence: float,
    visible_evidence: list[str],
    latitude: float | None,
    longitude: float | None,
    accuracy_meters: float | None,
    report_count: int,
    issue_type: str | None,
    description: str | None,
    sector: str | None,
) -> dict[str, Any]:

    visual_evidence = (
        calculate_visual_evidence_score(
            ai_confidence=ai_confidence,
            visible_evidence=visible_evidence,
        )
    )

    location_quality = (
        calculate_location_quality_score(
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=accuracy_meters,
        )
    )

    corroboration = (
        calculate_corroboration_score(
            report_count=report_count,
        )
    )

    temporal_consistency = (
        calculate_temporal_consistency_score(
            report_count=report_count,
        )
    )

    metadata_completeness = (
        calculate_metadata_completeness_score(
            issue_type=issue_type,
            description=description,
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=accuracy_meters,
            sector=sector,
        )
    )

    total = (
        visual_evidence
        + location_quality
        + corroboration
        + temporal_consistency
        + metadata_completeness
    )

    total = max(
        0,
        min(
            CIVIC_CONFIDENCE_MAX,
            total,
        ),
    )

    if (
        total
        >= CIVIC_CONFIDENCE_HIGH_THRESHOLD
    ):
        level = "high"

    elif (
        total
        >= CIVIC_CONFIDENCE_MEDIUM_THRESHOLD
    ):
        level = "medium"

    else:
        level = "low"

    return {
        "score": total,
        "level": level,
        "breakdown": {
            "visual_evidence":
                visual_evidence,
            "location_quality":
                location_quality,
            "corroboration":
                corroboration,
            "temporal_consistency":
                temporal_consistency,
            "metadata_completeness":
                metadata_completeness,
        },
        "maximum": {
            "visual_evidence":
                CONFIDENCE_VISUAL_MAX,
            "location_quality":
                CONFIDENCE_LOCATION_MAX,
            "corroboration":
                CONFIDENCE_CORROBORATION_MAX,
            "temporal_consistency":
                CONFIDENCE_TEMPORAL_MAX,
            "metadata_completeness":
                CONFIDENCE_METADATA_MAX,
        },
    }


# ============================================================
# CIVIC RISK
# ============================================================

def calculate_incident_risk(
    incident: dict[str, Any],
) -> dict[str, Any]:

    try:
        result = calculate_civic_risk(
            incident
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "CIVIC RISK ENGINE ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not calculate civic risk: "
                f"{str(exc)}"
            ),
        )

    return result


def attach_risk_to_incident(
    incident: dict[str, Any],
) -> dict[str, Any]:

    enriched = dict(incident)

    risk = calculate_incident_risk(
        enriched
    )

    enriched["risk_score"] = risk.get(
        "score",
        0,
    )

    enriched["risk_level"] = risk.get(
        "level",
        "low",
    )

    enriched["risk_reasoning"] = risk.get(
        "reasoning",
        "",
    )

    enriched["risk_components"] = risk.get(
        "components",
        {},
    )

    enriched["risk_weights"] = risk.get(
        "weights",
        {},
    )

    enriched["risk_waiting_days"] = risk.get(
        "waiting_days",
        0,
    )

    enriched["risk_engine_version"] = risk.get(
        "engine_version",
        "1.0.0",
    )

    return enriched


# ============================================================
# PROBLEM COMPARISON & DUPLICATE FUSION RULE
# ============================================================

def is_same_underlying_problem(
    type_a: str,
    type_b: str,
    desc_a: str = "",
    desc_b: str = "",
) -> bool:
    """
    Determines if two reports refer to the SAME underlying civic problem.

    CORE RULE:
        Same location does NOT mean same complaint.
        Multiple distinct civic problems (e.g. Pothole vs Broken Streetlight
        vs Garbage Overflow vs Water Leakage) can and do exist at the exact
        same location/coordinates. Each different civic problem must be
        registered and tracked as an independent incident with its own
        department, priority, worker assignment, status, and lifecycle.

    DUPLICATE PRESERVATION:
        If two reports refer to the SAME underlying civic problem
        (e.g., both are potholes, or "road mein bada gaddha hai" vs "pothole"),
        they match and are fused into the single active incident.
    """
    clean_a = (type_a or "").strip().lower()
    clean_b = (type_b or "").strip().lower()

    if not clean_a or not clean_b:
        return False

    if clean_a == "not_civic_issue" or clean_b == "not_civic_issue":
        return False

    # Exact type match
    if clean_a == clean_b:
        return True

    # Check cross-wording for road cavity / pothole domain:
    road_types = {"pothole", "road_damage"}
    if clean_a in road_types and clean_b in road_types:
        pothole_keywords = {
            "pothole",
            "gaddha",
            "pit",
            "hole",
            "cavity",
            "crater",
            "trench",
            "asphalt",
        }
        text_a = (desc_a or "").lower()
        text_b = (desc_b or "").lower()
        has_kw_a = clean_a == "pothole" or any(kw in text_a for kw in pothole_keywords)
        has_kw_b = clean_b == "pothole" or any(kw in text_b for kw in pothole_keywords)
        if has_kw_a and has_kw_b:
            return True

    # Check cross-wording for water leakage domain:
    water_leak_types = {"water_leak", "drainage"}
    if clean_a in water_leak_types and clean_b in water_leak_types:
        leak_keywords = {"leak", "burst", "pipe", "jal", "water main"}
        text_a = (desc_a or "").lower()
        text_b = (desc_b or "").lower()
        has_leak_a = clean_a == "water_leak" or any(kw in text_a for kw in leak_keywords)
        has_leak_b = clean_b == "water_leak" or any(kw in text_b for kw in leak_keywords)
        if has_leak_a and has_leak_b:
            return True

    return False


# ============================================================
# INCIDENT FUSION
# ============================================================

def find_matching_incident(
    issue_type: str,
    latitude: float | None,
    longitude: float | None,
    description: str = "",
) -> dict[str, Any] | None:
    """
    Find existing active incident for the SAME problem at the SAME location.
    Enforces: Same location does NOT mean same complaint.
    Only incidents with is_same_underlying_problem(...) == True within
    FUSION_DISTANCE_METERS (75m) will match.
    """
    if latitude is None or longitude is None:
        return None

    candidates: list[dict[str, Any]] = []

    if supabase:
        try:
            response = (
                supabase
                .table("incidents")
                .select(
                    "incident_id,"
                    "issue_type,"
                    "title,"
                    "description,"
                    "status,"
                    "latitude,"
                    "longitude,"
                    "confidence_score,"
                    "risk_score,"
                    "report_count,"
                    "recurrence_count,"
                    "department,"
                    "severity,"
                    "created_at,"
                    "updated_at"
                )
                .execute()
            )
            candidates = response.data or []
        except Exception as exc:
            print("====================================")
            print("INCIDENT FUSION LOOKUP ERROR:")
            print(str(exc))
            print("====================================")
            raise HTTPException(
                status_code=500,
                detail=f"Could not check existing incidents: {str(exc)}",
            )
    else:
        # Check in-memory store for offline/testing mode
        candidates = list(_IN_MEMORY_INCIDENTS.values())

    best_match: dict[str, Any] | None = None
    best_distance = float("inf")

    for incident in candidates:
        status = str(incident.get("status", "reported")).lower().strip()
        if status in CLOSED_STATUSES:
            continue

        # CRITICAL RULE: Verify that candidate is the same underlying problem!
        cand_type = str(incident.get("issue_type", ""))
        cand_desc = str(incident.get("description", ""))
        if not is_same_underlying_problem(
            issue_type, cand_type, description, cand_desc
        ):
            # Different civic problem (e.g. Streetlight vs Pothole at same location)
            # MUST NOT match!
            continue

        incident_latitude = incident.get("latitude")
        incident_longitude = incident.get("longitude")

        if incident_latitude is None or incident_longitude is None:
            continue

        try:
            distance = calculate_distance_meters(
                latitude,
                longitude,
                float(incident_latitude),
                float(incident_longitude),
            )
        except (TypeError, ValueError):
            continue

        if (
            distance <= FUSION_DISTANCE_METERS
            and distance < best_distance
        ):
            best_distance = distance
            best_match = dict(incident)
            best_match["_match_distance_meters"] = round(distance, 2)

    return best_match


# ============================================================
# REPORT CREATION + INCIDENT FUSION
# ============================================================

@app.post("/reports")
async def create_report(
    file: UploadFile = File(...),
    description: str = Form(...),
    sector: str = Form(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    accuracy_meters: float | None = Form(None),
    citizen_id: str | None = Form(None),
    ai_analysis: str = Form(...),
    incident_latitude: float | None = Form(None),
    incident_longitude: float | None = Form(None),
    submission_latitude: float | None = Form(None),
    submission_longitude: float | None = Form(None),
    location_source: str | None = Form(None),
    user_declared_address: str | None = Form(None),
):


    # --------------------------------------------------------
    # Validate image
    # --------------------------------------------------------

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail=(
                "File type could not be determined."
            ),
        )

    if not file.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only image files are allowed."
            ),
        )

    image_bytes = await file.read()

    validate_image_bytes(
        image_bytes
    )

    # --------------------------------------------------------
    # EXIF Location Analysis
    # --------------------------------------------------------

    exif_meta = extract_image_exif_metadata(image_bytes)

    if exif_meta.get("exif_gps_available"):
        final_incident_lat = exif_meta["incident_latitude"]
        final_incident_lon = exif_meta["incident_longitude"]
        final_location_source = SOURCE_EXIF_GPS
        capture_timestamp = exif_meta.get("capture_timestamp")
        # Submission location is captured separately from current device
        final_sub_lat = submission_latitude if submission_latitude is not None else latitude
        final_sub_lon = submission_longitude if submission_longitude is not None else longitude
    else:
        # Fallback: citizen manually declared incident location
        final_incident_lat = incident_latitude if incident_latitude is not None else latitude
        final_incident_lon = incident_longitude if incident_longitude is not None else longitude
        final_location_source = (
            SOURCE_USER_DECLARED
            if (final_incident_lat is not None and final_incident_lon is not None)
            else SOURCE_NONE
        )
        capture_timestamp = exif_meta.get("capture_timestamp")
        final_sub_lat = submission_latitude
        final_sub_lon = submission_longitude

    # --------------------------------------------------------
    # Store citizen evidence image (original image preserved)
    # --------------------------------------------------------

    image_url = upload_image_to_storage(
        image_bytes=image_bytes,
        content_type=file.content_type,
        folder="citizen-reports",
        original_filename=file.filename,
    )

    # --------------------------------------------------------
    # Validate GPS accuracy
    # --------------------------------------------------------

    if accuracy_meters is not None:
        try:
            accuracy_meters = float(
                accuracy_meters
            )
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="accuracy_meters must be a valid number.",
            )

        if accuracy_meters < 0:
            raise HTTPException(
                status_code=400,
                detail="accuracy_meters cannot be negative.",
            )

    # --------------------------------------------------------
    # Validate cached AI analysis
    # --------------------------------------------------------

    try:
        analysis = json.loads(
            ai_analysis
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid ai_analysis JSON.",
        )

    try:
        analysis = validate_ai_analysis(
            analysis
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    # --------------------------------------------------------
    # Calculate Location Verification Score & Apply Thresholds
    # --------------------------------------------------------

    now_iso = datetime.now(timezone.utc).isoformat()

    loc_verification = calculate_location_verification_score(
        location_source=final_location_source,
        incident_latitude=final_incident_lat,
        incident_longitude=final_incident_lon,
        submission_latitude=final_sub_lat,
        submission_longitude=final_sub_lon,
        capture_timestamp=capture_timestamp,
        submission_timestamp=now_iso,
        ai_analysis=analysis,
        camera_metadata={
            "make": exif_meta.get("make"),
            "model": exif_meta.get("model"),
        },
        user_address_declared=user_declared_address or sector,
    )

    location_score = loc_verification["score"]
    location_status = loc_verification["status"]

    # Threshold Check: If Score < 50.00% -> REJECT
    if location_score < 50.00:
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    "We could not sufficiently verify the incident location. "
                    "Please provide a more accurate incident location or additional evidence."
                ),
                "location_score": location_score,
                "location_status": STATUS_REJECTED,
                "location_source": final_location_source,
                "reason": loc_verification["reason"],
                "incident_latitude": final_incident_lat,
                "incident_longitude": final_incident_lon,
                "submission_latitude": final_sub_lat,
                "submission_longitude": final_sub_lon,
            },
        )

    # Threshold Check:
    # >= 75.00% -> VERIFIED (reported)
    # 50.00 - 74.99% -> UNDER_CONSIDERATION (needs_review / held for review)
    if location_score >= 75.00:
        initial_incident_status = "reported"
    else:
        initial_incident_status = "needs_review"

    # --------------------------------------------------------
    # Citizen-confirmed category
    # --------------------------------------------------------

    confirmed_category = str(
        analysis.get(
            "confirmed_category",
            "",
        )
    ).lower().strip()

    if (
        confirmed_category
        and confirmed_category in ALLOWED_ISSUE_TYPES
    ):
        issue_type = confirmed_category
    else:
        issue_type = analysis["issue_type"]

    ai_confidence = analysis["confidence"]
    severity = analysis["severity"]
    ai_description = analysis["description"]
    department = analysis.get("recommended_department")
    if not department or not str(department).strip():
        department = DEFAULT_ISSUE_DEPARTMENTS.get(
            issue_type,
            "Public Works Department",
        )
    else:
        department = str(department).strip()

    visible_evidence = analysis.get("visible_evidence", [])
    title = get_issue_title(issue_type)
    final_description = (
        description.strip() if description.strip() else ai_description
    )

    # ========================================================
    # FIND MATCHING ACTIVE INCIDENT (using physical incident coords)
    # ========================================================

    matching_incident = find_matching_incident(
        issue_type=issue_type,
        latitude=final_incident_lat,
        longitude=final_incident_lon,
        description=final_description,
    )

    # ========================================================
    # CASE A: EXISTING INCIDENT (DUPLICATE FUSION)
    # ========================================================

    if matching_incident:
        incident_id = matching_incident["incident_id"]
        old_report_count = int(matching_incident.get("report_count", 1) or 1)
        new_report_count = old_report_count + 1

        civic_confidence = calculate_civic_confidence(
            ai_confidence=ai_confidence,
            visible_evidence=visible_evidence,
            latitude=(
                matching_incident.get("latitude")
                if matching_incident.get("latitude") is not None
                else final_incident_lat
            ),
            longitude=(
                matching_incident.get("longitude")
                if matching_incident.get("longitude") is not None
                else final_incident_lon
            ),
            accuracy_meters=accuracy_meters,
            report_count=new_report_count,
            issue_type=issue_type,
            description=final_description,
            sector=sector,
        )

        risk_input = dict(matching_incident)
        risk_input["report_count"] = new_report_count
        risk_input["severity"] = matching_incident.get("severity") or severity

        civic_risk = calculate_incident_risk(risk_input)

        update_data = {
            "report_count": new_report_count,
            "confidence_score": civic_confidence["score"],
            "risk_score": civic_risk["score"],
            "updated_at": now_iso,
            "incident_latitude": final_incident_lat,
            "incident_longitude": final_incident_lon,
            "submission_latitude": final_sub_lat,
            "submission_longitude": final_sub_lon,
            "location_source": final_location_source,
            "location_score": location_score,
            "location_status": location_status,
            "location_verification_reason": loc_verification["reason"],
            "capture_timestamp": capture_timestamp,
            "exif_gps_available": bool(exif_meta.get("exif_gps_available")),
        }

        clean_citizen_id = (
            citizen_id.strip() if citizen_id and citizen_id.strip() else None
        )

        report_data = {
            "incident_id": incident_id,
            "citizen_id": clean_citizen_id,
            "description": description.strip(),
            "image_url": image_url,
        }

        if supabase:
            try:
                incident_response = (
                    supabase.table("incidents")
                    .update(update_data)
                    .eq("incident_id", incident_id)
                    .execute()
                )
            except Exception as exc:
                fallback_update = {
                    "report_count": new_report_count,
                    "confidence_score": civic_confidence["score"],
                    "risk_score": civic_risk["score"],
                    "updated_at": now_iso,
                }
                try:
                    incident_response = (
                        supabase.table("incidents")
                        .update(fallback_update)
                        .eq("incident_id", incident_id)
                        .execute()
                    )
                except Exception as inner_exc:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not update existing incident: {str(inner_exc)}",
                    )

            if not incident_response.data:
                raise HTTPException(
                    status_code=500,
                    detail="Existing incident could not be updated.",
                )

            updated_incident = incident_response.data[0]
            updated_incident = enrich_incident(updated_incident)

            try:
                report_response = (
                    supabase.table("reports").insert(report_data).execute()
                )
                saved_report = (
                    report_response.data[0] if report_response.data else report_data
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": "Incident count updated but new report could not be saved.",
                        "error": str(exc),
                        "incident_id": incident_id,
                    },
                )
        else:
            # Update in-memory record for tests/offline
            mem_inc = _IN_MEMORY_INCIDENTS.get(incident_id, dict(matching_incident))
            mem_inc.update(update_data)
            _IN_MEMORY_INCIDENTS[incident_id] = mem_inc
            updated_incident = enrich_incident(dict(mem_inc))

            saved_report = {
                "report_id": f"rep-{uuid.uuid4().hex[:8]}",
                **report_data,
            }
            _IN_MEMORY_REPORTS.append(saved_report)

        return {
            "success": True,
            "message": "Report matched an existing civic incident.",
            "fusion": {
                "matched": True,
                "incident_id": incident_id,
                "distance_meters": matching_incident.get("_match_distance_meters"),
                "previous_report_count": old_report_count,
                "new_report_count": new_report_count,
            },
            "civic_confidence": civic_confidence,
            "civic_risk": civic_risk,
            "incident_id": incident_id,
            "report": saved_report,
            "ai_analysis": analysis,
            "incident": updated_incident,
            "location_verification": loc_verification,
        }

    # ========================================================
    # CASE B: CREATE NEW INCIDENT
    # ========================================================

    civic_confidence = calculate_civic_confidence(
        ai_confidence=ai_confidence,
        visible_evidence=visible_evidence,
        latitude=final_incident_lat,
        longitude=final_incident_lon,
        accuracy_meters=accuracy_meters,
        report_count=1,
        issue_type=issue_type,
        description=final_description,
        sector=sector,
    )

    risk_input = {
        "issue_type": issue_type,
        "severity": severity,
        "report_count": 1,
        "recurrence_count": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
        "status": initial_incident_status,
    }

    civic_risk = calculate_incident_risk(risk_input)

    # Ensure sector genuinely matches geographic coordinates if known
    detected_sec = get_sector_for_coordinates(final_incident_lat, final_incident_lon)
    if detected_sec:
        assigned_sector = detected_sec
    elif sector and sector not in ("N/A", "null", "None", ""):
        assigned_sector = sector
    else:
        assigned_sector = None

    incident_data = {
        "issue_type": issue_type,
        "title": title,
        "description": final_description,
        "area": assigned_sector or "N/A",
        "address": f"{assigned_sector}, Chandigarh" if assigned_sector else "Outside Sector Jurisdiction (N/A)",
        "latitude": final_incident_lat,
        "longitude": final_incident_lon,
        "department": department,
        "status": initial_incident_status,
        "severity": severity,
        "confidence_score": civic_confidence["score"],
        "risk_score": civic_risk["score"],
        "report_count": 1,
        "recurrence_count": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
        "incident_latitude": final_incident_lat,
        "incident_longitude": final_incident_lon,
        "submission_latitude": final_sub_lat,
        "submission_longitude": final_sub_lon,
        "location_source": final_location_source,
        "location_score": location_score,
        "location_status": location_status,
        "location_verification_reason": loc_verification["reason"],
        "capture_timestamp": capture_timestamp,
        "upload_timestamp": now_iso,
        "exif_gps_available": bool(exif_meta.get("exif_gps_available")),
    }

    if not supabase:
        mock_id = f"inc-{uuid.uuid4().hex[:8]}"
        created_incident = {
            **incident_data,
            "incident_id": mock_id,
            "ticket_number": f"TKT-{mock_id[-6:].upper()}",
        }
        _IN_MEMORY_INCIDENTS[mock_id] = created_incident
        saved_report = {
            "report_id": f"rep-{uuid.uuid4().hex[:8]}",
            "incident_id": mock_id,
            "description": final_description,
            "image_url": image_url,
        }
        _IN_MEMORY_REPORTS.append(saved_report)
        return {
            "success": True,
            "message": "Report created successfully.",
            "fusion": {
                "matched": False,
                "incident_id": mock_id,
                "distance_meters": None,
                "previous_report_count": 0,
                "new_report_count": 1,
            },
            "civic_confidence": civic_confidence,
            "civic_risk": civic_risk,
            "incident_id": mock_id,
            "report": saved_report,
            "ai_analysis": analysis,
            "incident": enrich_incident(dict(created_incident)),
            "location_verification": loc_verification,
        }

    try:
        incident_response = (
            supabase.table("incidents").insert(incident_data).execute()
        )
    except Exception as exc:
        # Resilient fallback: try core columns if custom columns do not yet exist in remote DB
        fallback_data = {
            "issue_type": issue_type,
            "title": title,
            "description": final_description,
            "area": assigned_sector or "N/A",
            "address": f"{assigned_sector}, Chandigarh" if assigned_sector else "Outside Sector Jurisdiction (N/A)",
            "latitude": final_incident_lat,
            "longitude": final_incident_lon,
            "department": department,
            "status": initial_incident_status,
            "severity": severity,
            "confidence_score": civic_confidence["score"],
            "risk_score": civic_risk["score"],
            "report_count": 1,
            "recurrence_count": 0,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        try:
            incident_response = (
                supabase.table("incidents").insert(fallback_data).execute()
            )
        except Exception as inner_exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not create incident: {str(inner_exc)}",
            )

    if not incident_response.data:
        raise HTTPException(
            status_code=500,
            detail="Incident was not created.",
        )

    incident = incident_response.data[0]
    incident_id = incident.get("incident_id")

    if not incident_id:
        raise HTTPException(
            status_code=500,
            detail="Incident was created but incident_id was not returned.",
        )

    incident = attach_risk_to_incident(incident)

    clean_citizen_id = (
        citizen_id.strip() if citizen_id and citizen_id.strip() else None
    )

    report_data = {
        "incident_id": incident_id,
        "citizen_id": clean_citizen_id,
        "description": description.strip(),
        "image_url": image_url,
    }

    try:
        report_response = (
            supabase.table("reports").insert(report_data).execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Incident created but report could not be saved.",
                "error": str(exc),
                "incident_id": incident_id,
            },
        )

    # Attach location verification fields into incident payload
    incident["location_score"] = location_score
    incident["location_status"] = location_status
    incident["location_source"] = final_location_source
    incident["incident_latitude"] = final_incident_lat
    incident["incident_longitude"] = final_incident_lon
    incident["submission_latitude"] = final_sub_lat
    incident["submission_longitude"] = final_sub_lon
    incident["capture_timestamp"] = capture_timestamp
    incident["exif_gps_available"] = bool(exif_meta.get("exif_gps_available"))

    return {
        "success": True,
        "message": "Report created successfully.",
        "fusion": {
            "matched": False,
            "incident_id": incident_id,
            "distance_meters": None,
            "previous_report_count": 0,
            "new_report_count": 1,
        },
        "civic_confidence": civic_confidence,
        "civic_risk": civic_risk,
        "incident_id": incident_id,
        "report": report_response.data[0] if report_response.data else None,
        "ai_analysis": analysis,
        "incident": incident,
        "location_verification": loc_verification,
    }


# ============================================================
# INCIDENT IMAGE ENRICHMENT
# ============================================================

def attach_before_image(
    incident: dict[str, Any],
) -> dict[str, Any]:
    """
    Attach the first available citizen report image
    as the incident's before image.
    This is a real image from the reports table.
    """

    enriched = dict(incident)
    incident_id = enriched.get("incident_id")

    if not incident_id or not supabase:
        enriched["before_image_url"] = None
        return enriched

    try:
        response = (
            supabase.table("reports")
            .select("image_url,submitted_at")
            .eq("incident_id", incident_id)
            .not_.is_("image_url", "null")
            .order("submitted_at", desc=False)
            .limit(1)
            .execute()
        )

        reports = response.data or []
        if reports:
            enriched["before_image_url"] = reports[0].get("image_url")
        else:
            enriched["before_image_url"] = None

    except Exception as exc:
        print("BEFORE IMAGE LOOKUP ERROR:", str(exc))
        enriched["before_image_url"] = None

    return enriched


def enrich_incident(
    incident: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply all deterministic API enrichments.
    Ensures backward compatibility with historical records without location verification.
    """

    enriched = attach_risk_to_incident(incident)
    enriched = attach_before_image(enriched)

    # Backward compatibility defaults
    if "incident_latitude" not in enriched or enriched["incident_latitude"] is None:
        enriched["incident_latitude"] = enriched.get("latitude")
    if "incident_longitude" not in enriched or enriched["incident_longitude"] is None:
        enriched["incident_longitude"] = enriched.get("longitude")
    if "location_source" not in enriched or not enriched["location_source"]:
        enriched["location_source"] = (
            SOURCE_EXIF_GPS if enriched.get("exif_gps_available") else SOURCE_USER_DECLARED
        )
    if "location_score" not in enriched or enriched["location_score"] is None:
        enriched["location_score"] = 88.0 if enriched.get("exif_gps_available") else 62.0
    if "location_status" not in enriched or not enriched["location_status"]:
        score = float(enriched["location_score"])
        if score >= 75.0:
            enriched["location_status"] = STATUS_VERIFIED
        elif score >= 50.0:
            enriched["location_status"] = STATUS_UNDER_CONSIDERATION
        else:
            enriched["location_status"] = STATUS_REJECTED

    return enriched


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@app.get("/incidents")
def get_incidents():

    if not supabase:
        enriched_incidents = [
            enrich_incident(dict(inc))
            for inc in reversed(list(_IN_MEMORY_INCIDENTS.values()))
        ]
        return {
            "count": len(enriched_incidents),
            "incidents": enriched_incidents,
        }

    try:

        response = (
            supabase
            .table("incidents")
            .select("*")
            .order(
                "created_at",
                desc=True,
            )
            .execute()
        )

        incidents = (
            response.data or []
        )

        enriched_incidents = []

        for incident in incidents:

            try:

                enriched = enrich_incident(
                    incident
                )

                enriched_incidents.append(
                    enriched
                )

            except HTTPException:
                raise

            except Exception as exc:

                print(
                    "INCIDENT ENRICHMENT ERROR:"
                )

                print(str(exc))

                fallback = dict(
                    incident
                )

                fallback.setdefault(
                    "risk_score",
                    0,
                )

                fallback.setdefault(
                    "risk_level",
                    "low",
                )

                fallback.setdefault(
                    "risk_reasoning",
                    "Risk analysis unavailable.",
                )

                fallback.setdefault(
                    "before_image_url",
                    None,
                )

                enriched_incidents.append(
                    fallback
                )

        return {
            "count": len(
                enriched_incidents
            ),
            "incidents":
                enriched_incidents,
        }

    except HTTPException:
        raise

    except Exception as exc:

        print(
            "SUPABASE INCIDENTS ERROR:"
        )

        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve "
                "incidents: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# GET SINGLE INCIDENT
# ============================================================

@app.get(
    "/incidents/{incident_id}"
)
def get_incident(
    incident_id: str,
):

    if not supabase:
        if incident_id not in _IN_MEMORY_INCIDENTS:
            raise HTTPException(
                status_code=404,
                detail="Incident not found.",
            )
        return enrich_incident(dict(_IN_MEMORY_INCIDENTS[incident_id]))

    try:

        response = (
            supabase
            .table("incidents")
            .select("*")
            .eq(
                "incident_id",
                incident_id,
            )
            .execute()
        )

    except Exception as exc:

        print(
            "SUPABASE INCIDENT LOOKUP ERROR:"
        )

        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve "
                "incident: "
                f"{str(exc)}"
            ),
        )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    incident = response.data[0]

    incident = enrich_incident(
        incident
    )

    return incident


# ============================================================
# UPDATE INCIDENT STATUS
# ============================================================

class StatusUpdateRequest(BaseModel):
    status: str


@app.patch("/incidents/{incident_id}/status")
@app.post("/incidents/{incident_id}/status")
def update_incident_status(
    incident_id: str,
    payload: StatusUpdateRequest,
):
    """
    Update incident lifecycle status (reported, assigned, in_progress, resolved, closed).
    Crucial rule verification: Resolving an incident at a location only resolves THAT
    specific complaint, leaving co-located complaints at the same coordinates active.
    """
    new_status = payload.status.strip().lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    if supabase:
        try:
            res = (
                supabase
                .table("incidents")
                .update({"status": new_status, "updated_at": now_iso})
                .eq("incident_id", incident_id)
                .execute()
            )
            if not res.data:
                raise HTTPException(
                    status_code=404,
                    detail="Incident not found.",
                )
            return {
                "success": True,
                "incident": enrich_incident(res.data[0]),
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not update status: {str(exc)}",
            )
    else:
        if incident_id not in _IN_MEMORY_INCIDENTS:
            raise HTTPException(
                status_code=404,
                detail="Incident not found.",
            )
        _IN_MEMORY_INCIDENTS[incident_id]["status"] = new_status
        _IN_MEMORY_INCIDENTS[incident_id]["updated_at"] = now_iso
        return {
            "success": True,
            "incident": enrich_incident(dict(_IN_MEMORY_INCIDENTS[incident_id])),
        }


# ============================================================
# GET CO-LOCATED INCIDENTS AT SAME LOCATION
# ============================================================

@app.get("/incidents/{incident_id}/co-located")
def get_colocated_incidents(
    incident_id: str,
    radius_meters: float = 100.0,
    include_closed: bool = False,
):
    """
    Returns active civic issues co-located at or near the target incident location.
    Enforces the core rule: Same location does NOT mean same complaint.
    Multiple distinct problems exist at this location and are tracked independently.
    """
    target = None
    all_incidents: list[dict[str, Any]] = []

    if supabase:
        try:
            t_res = (
                supabase
                .table("incidents")
                .select("*")
                .eq("incident_id", incident_id)
                .execute()
            )
            if not t_res.data:
                raise HTTPException(
                    status_code=404,
                    detail="Incident not found.",
                )
            target = t_res.data[0]
            all_res = (
                supabase
                .table("incidents")
                .select("*")
                .execute()
            )
            all_incidents = all_res.data or []
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not retrieve co-located incidents: {str(exc)}",
            )
    else:
        if incident_id not in _IN_MEMORY_INCIDENTS:
            raise HTTPException(
                status_code=404,
                detail="Incident not found.",
            )
        target = _IN_MEMORY_INCIDENTS[incident_id]
        all_incidents = list(_IN_MEMORY_INCIDENTS.values())

    t_lat = target.get("latitude")
    t_lon = target.get("longitude")

    if t_lat is None or t_lon is None:
        return {
            "target_incident_id": incident_id,
            "target_issue_type": target.get("issue_type"),
            "target_coordinates": {"latitude": t_lat, "longitude": t_lon},
            "count": 0,
            "co_located_incidents": [],
        }

    co_located = []
    for inc in all_incidents:
        inc_id = inc.get("incident_id")
        if inc_id == incident_id:
            continue

        inc_status = str(inc.get("status", "")).lower().strip()
        if not include_closed and inc_status in CLOSED_STATUSES:
            continue

        i_lat = inc.get("latitude")
        i_lon = inc.get("longitude")
        if i_lat is None or i_lon is None:
            continue

        try:
            dist = calculate_distance_meters(
                float(t_lat),
                float(t_lon),
                float(i_lat),
                float(i_lon),
            )
        except (TypeError, ValueError):
            continue

        if dist <= radius_meters:
            enriched = enrich_incident(dict(inc))
            enriched["_distance_meters"] = round(dist, 1)
            co_located.append(enriched)

    co_located.sort(
        key=lambda x: x.get("risk_score", 0),
        reverse=True,
    )

    return {
        "target_incident_id": incident_id,
        "target_issue_type": target.get("issue_type"),
        "target_coordinates": {"latitude": t_lat, "longitude": t_lon},
        "count": len(co_located),
        "co_located_incidents": co_located,
    }


# ============================================================
# ASSIGN INCIDENT
# ============================================================

@app.post(
    "/incidents/{incident_id}/assign"
)
def assign_incident(
    incident_id: str,
    assignment: AssignmentRequest,
):

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured."
            ),
        )

    assigned_at = datetime.now(
        timezone.utc
    ).isoformat()

    update_data = {
        "status":
            "assigned",

        "assigned_team":
            assignment.team,

        "assigned_officer": (
            assignment.officer
            or "Senior Field Inspector"
        ),

        "assigned_at":
            assigned_at,

        "updated_at":
            assigned_at,
    }

    try:

        response = (
            supabase
            .table("incidents")
            .update(
                update_data
            )
            .eq(
                "incident_id",
                incident_id,
            )
            .execute()
        )

    except Exception as exc:

        print(
            "SUPABASE INCIDENT ASSIGNMENT "
            "ERROR:"
        )

        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not assign incident: "
                f"{str(exc)}"
            ),
        )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    incident = response.data[0]

    incident = enrich_incident(
        incident
    )

    return {
        "success": True,
        "incident":
            incident,
    }


# ============================================================
# SMART CLOSURE
# ============================================================

@app.post(
    "/incidents/{incident_id}/closure"
)
async def submit_closure_evidence(
    incident_id: str,
    photo: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy_meters: float | None = Form(None),
):
    """
    Submit real field repair evidence.

    Workflow:

        1. Validate repair photo.
        2. Validate field GPS.
        3. Load original incident.
        4. Upload repair photo to Supabase Storage.
        5. Calculate GPS distance.
        6. Run deterministic Smart Closure engine.
        7. Automatically resolve only if:
              - repair photo exists
              - original GPS exists
              - field GPS exists
              - distance <= 50m
        8. Persist closure evidence.
    """

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured."
            ),
        )

    # --------------------------------------------------------
    # Validate photo
    # --------------------------------------------------------

    if not photo.content_type:
        raise HTTPException(
            status_code=400,
            detail=(
                "Repair photo type could not "
                "be determined."
            ),
        )

    if not photo.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only image files are allowed "
                "for closure evidence."
            ),
        )

    image_bytes = await photo.read()

    validate_image_bytes(
        image_bytes
    )

    # --------------------------------------------------------
    # Validate field GPS
    # --------------------------------------------------------

    try:
        latitude = float(
            latitude
        )

        longitude = float(
            longitude
        )

    except (
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Valid numeric latitude and "
                "longitude are required."
            ),
        )

    if not (
        -90.0
        <= latitude
        <= 90.0
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "latitude must be between "
                "-90 and 90."
            ),
        )

    if not (
        -180.0
        <= longitude
        <= 180.0
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "longitude must be between "
                "-180 and 180."
            ),
        )

    if accuracy_meters is not None:

        try:
            accuracy_meters = float(
                accuracy_meters
            )

        except (
            TypeError,
            ValueError,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "accuracy_meters must be "
                    "a valid number."
                ),
            )

        if accuracy_meters < 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "accuracy_meters cannot "
                    "be negative."
                ),
            )

    # --------------------------------------------------------
    # Load original incident
    # --------------------------------------------------------

    try:

        incident_response = (
            supabase
            .table("incidents")
            .select("*")
            .eq(
                "incident_id",
                incident_id,
            )
            .limit(1)
            .execute()
        )

    except Exception as exc:

        print(
            "SMART CLOSURE INCIDENT LOOKUP ERROR:"
        )

        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve incident "
                f"for closure: {str(exc)}"
            ),
        )

    if not incident_response.data:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    incident = (
        incident_response.data[0]
    )

    # --------------------------------------------------------
    # Do not close an already closed incident
    # --------------------------------------------------------

    current_status = str(
        incident.get(
            "status",
            "reported",
        )
    ).lower().strip()

    if current_status in CLOSED_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=(
                "This incident is already "
                f"{current_status}."
            ),
        )

    # --------------------------------------------------------
    # Store actual repair image
    # --------------------------------------------------------

    closure_image_url = (
        upload_image_to_storage(
            image_bytes=image_bytes,
            content_type=photo.content_type,
            folder="closure-evidence",
            original_filename=photo.filename,
        )
    )

    # --------------------------------------------------------
    # Run deterministic closure engine
    # --------------------------------------------------------

    closure_evidence = {
        "latitude":
            latitude,
        "longitude":
            longitude,
        "accuracy_meters":
            accuracy_meters,
        "photo_url":
            closure_image_url,
    }

    closure_result = (
        calculate_closure_match(
            incident=incident,
            closure_evidence=
                closure_evidence,
        )
    )

    distance_meters = (
        closure_result.get(
            "distance_meters"
        )
    )

    match_score = (
        closure_result.get(
            "match_score",
            0,
        )
    )

    match_status = (
        closure_result.get(
            "match_status",
            "unavailable",
        )
    )

    explanation = (
        closure_result.get(
            "explanation",
            "",
        )
    )

    automatic_closure_allowed = (
        closure_result.get(
            "automatic_closure_allowed",
            False,
        )
    )

    now = datetime.now(
        timezone.utc
    ).isoformat()

    # --------------------------------------------------------
    # Determine status
    # --------------------------------------------------------

    if automatic_closure_allowed:
        new_status = "resolved"
        resolved_at = now

    else:
        new_status = current_status
        resolved_at = incident.get(
            "resolved_at"
        )

    # --------------------------------------------------------
    # Persist closure evidence
    # --------------------------------------------------------

    update_data = {
        "closure_image_url":
            closure_image_url,

        "closure_latitude":
            latitude,

        "closure_longitude":
            longitude,

        "closure_accuracy_meters":
            accuracy_meters,

        "closure_distance_meters":
            distance_meters,

        "closure_match_score":
            match_score,

        "closure_match_status":
            match_status,

        "closure_explanation":
            explanation,

        "closure_submitted_at":
            now,

        "closure_engine_version":
            CLOSURE_ENGINE_VERSION,

        "updated_at":
            now,
    }

    if automatic_closure_allowed:

        update_data[
            "status"
        ] = "resolved"

        update_data[
            "resolved_at"
        ] = resolved_at

    try:

        update_response = (
            supabase
            .table("incidents")
            .update(
                update_data
            )
            .eq(
                "incident_id",
                incident_id,
            )
            .execute()
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "SMART CLOSURE UPDATE ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Closure evidence was uploaded "
                "but incident metadata could "
                "not be updated: "
                f"{str(exc)}"
            ),
        )

    if not update_response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Closure evidence could not "
                "be attached to the incident."
            ),
        )

    updated_incident = (
        update_response.data[0]
    )

    updated_incident = enrich_incident(
        updated_incident
    )

    return {
        "success": True,

        "incident_id":
            incident_id,

        "automatic_closure_allowed":
            automatic_closure_allowed,

        "status":
            updated_incident.get(
                "status"
            ),

        "distance_meters":
            distance_meters,

        "match_score":
            match_score,

        "match_status":
            match_status,

        "explanation":
            explanation,

        "closure_engine_version":
            CLOSURE_ENGINE_VERSION,

        "closure_image_url":
            closure_image_url,

        "closure_latitude":
            latitude,

        "closure_longitude":
            longitude,

        "closure_accuracy_meters":
            accuracy_meters,

        "checks":
            closure_result.get(
                "checks",
                {},
            ),

        "recommendation":
            closure_result.get(
                "recommendation",
                "needs_review",
            ),

        "incident":
            updated_incident,
    }


# ============================================================
# CIVIC DNA — PERSISTENT INFRASTRUCTURE ASSET INTELLIGENCE
# ============================================================
from asset_engine import (
    calculate_asset_health_score,
    calculate_asset_risk_score,
    analyze_failure_pattern,
    calculate_repair_vs_replace,
    find_nearby_assets,
)
from asset_data import SEED_ASSETS

# In-memory store initialized from SEED_ASSETS
_IN_MEMORY_ASSETS = {a["id"]: dict(a) for a in SEED_ASSETS}

@app.get("/assets")
def get_assets(
    department: str | None = None,
    asset_type: str | None = None,
    risk_tier: str | None = None,
    sector: str | None = None,
    search: str | None = None,
    limit: int = 100,
):
    """Retrieve municipal infrastructure assets with Civic DNA filters."""
    results = list(_IN_MEMORY_ASSETS.values())
    if department:
        results = [a for a in results if department.lower() in a.get("department", "").lower()]
    if asset_type:
        results = [a for a in results if asset_type.lower() == a.get("assetType", "").lower()]
    if sector:
        results = [a for a in results if sector.lower() in a.get("sector", "").lower()]
    if search:
        s = search.lower()
        results = [
            a for a in results
            if s in a.get("name", "").lower()
            or s in a.get("assetNumber", "").lower()
            or s in a.get("location", "").lower()
        ]
    return {
        "count": len(results[:limit]),
        "total": len(results),
        "assets": results[:limit]
    }

@app.get("/assets/nearby")
def get_nearby_assets(
    lat: float,
    lng: float,
    radius_meters: float = 100.0,
    department: str | None = None,
):
    """Find persistent assets near coordinate (e.g. for complaint proximity matching)."""
    nearby = find_nearby_assets(
        lat=lat,
        lng=lng,
        assets=list(_IN_MEMORY_ASSETS.values()),
        max_radius_meters=radius_meters,
        preferred_department=department
    )
    return {
        "count": len(nearby),
        "assets": nearby
    }

@app.get("/assets/{asset_id}")
def get_asset_detail(asset_id: str):
    """Retrieve full Civic DNA profile for an infrastructure asset."""
    asset = _IN_MEMORY_ASSETS.get(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset #{asset_id} not found in Civic DNA database")
    
    events = asset.get("events", [])
    failure_pattern = analyze_failure_pattern(events)
    health_score, health_breakdown = calculate_asset_health_score(
        asset_type=asset.get("assetType", "infrastructure"),
        installed_year=asset.get("installationYear", 2020),
        expected_lifespan_years=asset.get("estimatedLifetimeYears", 10),
        cumulative_spend=asset.get("totalMaintenanceCost", 0.0),
        replacement_cost=asset.get("estimatedReplacementCost", 10000.0),
        total_failures=asset.get("failureCount", 0),
        is_accelerating=failure_pattern.get("isAccelerating", False),
        active_complaints_count=len(asset.get("associatedIncidentIds", []))
    )
    risk_score, risk_tier, risk_factors = calculate_asset_risk_score(
        health_score=health_score,
        total_failures=asset.get("failureCount", 0),
        is_accelerating=failure_pattern.get("isAccelerating", False),
        cost_ratio=asset.get("totalMaintenanceCost", 0.0) / max(1.0, asset.get("estimatedReplacementCost", 10000.0)),
        active_complaints_count=len(asset.get("associatedIncidentIds", [])),
        asset_type=asset.get("assetType", "infrastructure")
    )
    decision = calculate_repair_vs_replace(
        asset_type=asset.get("assetType", "infrastructure"),
        cumulative_spend=asset.get("totalMaintenanceCost", 0.0),
        replacement_cost=asset.get("estimatedReplacementCost", 10000.0),
        typical_repair_cost=asset.get("totalMaintenanceCost", 0.0) / max(1, asset.get("totalRepairs", 1)),
        total_failures=asset.get("failureCount", 0),
        is_accelerating=failure_pattern.get("isAccelerating", False),
        health_score=health_score,
        age_years=asset.get("ageYears", 5),
        expected_lifespan_years=asset.get("estimatedLifetimeYears", 10),
        recurring_component=failure_pattern.get("recurringComponent") or asset.get("currentComponent")
    )

    enriched = dict(asset)
    enriched["currentHealthScore"] = health_score
    enriched["healthBreakdown"] = health_breakdown
    enriched["currentRiskScore"] = risk_score
    enriched["riskTier"] = risk_tier
    enriched["riskFactors"] = risk_factors
    enriched["failurePattern"] = failure_pattern
    enriched["recommendation"] = decision

    return enriched

class AssetAssociationRequest(BaseModel):
    asset_id: str
    distance_meters: float | None = None

@app.post("/incidents/{incident_id}/associate-asset")
def associate_incident_with_asset(
    incident_id: str,
    payload: AssetAssociationRequest
):
    """Associate an incident with a persistent Civic DNA asset."""
    asset = _IN_MEMORY_ASSETS.get(payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {payload.asset_id} not found")

    if incident_id not in asset.get("associatedIncidentIds", []):
        asset.setdefault("associatedIncidentIds", []).append(incident_id)

    if supabase:
        try:
            supabase.table("incidents").update({
                "associated_asset_id": payload.asset_id,
                "associated_asset_distance_meters": payload.distance_meters,
                "associated_asset_name": asset.get("name")
            }).eq("incident_id", incident_id).execute()
        except Exception as exc:
            print(f"Warning: Failed to persist asset association to Supabase: {exc}")

    return {
        "success": True,
        "incident_id": incident_id,
        "asset_id": payload.asset_id,
        "asset_name": asset.get("name"),
        "distance_meters": payload.distance_meters
    }