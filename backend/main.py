import base64
import io
import json
import math
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from supabase import Client, create_client


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# OpenRouter automatically selects an available free model.
FREE_VISION_MODEL = "openrouter/free"

# Maximum distance for considering two reports
# to be the same active incident.
FUSION_DISTANCE_METERS = 75.0


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="SANKET CivicLens API",
    version="1.2.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
    "other",
    "not_civic_issue",
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

# These statuses mean the incident should no longer
# absorb new citizen reports as the same active issue.
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

# Maximum points for each confidence dimension.
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
        "vision_model": FREE_VISION_MODEL,
        "incident_fusion": True,
        "civic_confidence": True,
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
# AI VALIDATION
# ============================================================

def validate_ai_analysis(
    data: Any,
) -> dict[str, Any]:

    if not isinstance(data, dict):
        raise ValueError(
            "AI response is not a JSON object."
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

    # Preserve the citizen-confirmed category.
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

    analysis = await analyze_with_openrouter(
        image_bytes=image_bytes,
        content_type=file.content_type,
    )

    return analysis


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
        "other": "Civic Issue",
        "not_civic_issue": "Unclassified Image",
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

    """
    Calculate distance between two GPS coordinates
    using the Haversine formula.

    Returns distance in meters.
    """

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

    """
    Visual evidence component.

    Maximum: 30 points.

    AI model confidence contributes up to 20 points.
    Concrete visible evidence contributes up to 10.

    AI confidence is therefore only an input signal.
    It is NOT Civic Confidence itself.
    """

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

    """
    Location quality component.

    Maximum: 20 points.

    No GPS:
        0

    GPS accuracy:
        >100m       -> 5
        50-100m     -> 10
        20-50m      -> 15
        <=20m       -> 20
    """

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

    """
    Corroboration component.

    Maximum: 25 points.

    1 report -> 0
    2 reports -> 10
    3 reports -> 17
    4+ reports -> 25
    """

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

    """
    Temporal consistency component.

    This MVP uses the number of corroborating
    reports as the available temporal signal.

    Maximum: 10.

    1 report -> 5
    2 reports -> 7
    3+ reports -> 10

    Future Civic Memory work can make this
    more sophisticated using actual historical
    timestamps and recurrence windows.
    """

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

    """
    Metadata completeness component.

    Maximum: 15.

    Category       -> 3
    Description    -> 3
    GPS            -> 3
    GPS accuracy   -> 2
    Sector         -> 2
    Image          -> 2

    The image receives its points because /reports
    requires a validated image before this function
    is called.
    """

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

    # Validated image.
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

    """
    Main deterministic Civic Confidence engine.

    This is deliberately separate from AI/model confidence.

    Maximum:
        100 points.

    Components:
        Visual evidence       30
        Location quality      20
        Corroboration         25
        Temporal consistency  10
        Metadata completeness 15
    """

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
# INCIDENT FUSION
# ============================================================

def find_matching_incident(
    issue_type: str,
    latitude: float | None,
    longitude: float | None,
) -> dict[str, Any] | None:

    """
    Find an existing active incident that is close enough
    and belongs to the same civic issue category.

    Fusion requires GPS coordinates.

    If the new report has no coordinates, a new incident
    is created instead of guessing.
    """

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured."
            ),
        )

    if (
        latitude is None
        or longitude is None
    ):
        return None

    try:
        response = (
            supabase
            .table("incidents")
            .select(
                "incident_id,"
                "issue_type,"
                "status,"
                "latitude,"
                "longitude,"
                "confidence_score,"
                "risk_score,"
                "report_count,"
                "recurrence_count,"
                "created_at,"
                "updated_at"
            )
            .eq(
                "issue_type",
                issue_type,
            )
            .execute()
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "INCIDENT FUSION LOOKUP ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not check existing "
                "incidents: "
                f"{str(exc)}"
            ),
        )

    candidates = (
        response.data or []
    )

    best_match: dict[str, Any] | None = None
    best_distance = float("inf")

    for incident in candidates:

        status = str(
            incident.get(
                "status",
                "reported",
            )
        ).lower().strip()

        if status in CLOSED_STATUSES:
            continue

        incident_latitude = (
            incident.get("latitude")
        )

        incident_longitude = (
            incident.get("longitude")
        )

        if (
            incident_latitude is None
            or incident_longitude is None
        ):
            continue

        try:
            distance = (
                calculate_distance_meters(
                    latitude,
                    longitude,
                    float(
                        incident_latitude
                    ),
                    float(
                        incident_longitude
                    ),
                )
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

        if (
            distance
            <= FUSION_DISTANCE_METERS
            and distance
            < best_distance
        ):
            best_distance = distance

            best_match = dict(
                incident
            )

            best_match[
                "_match_distance_meters"
            ] = round(
                distance,
                2,
            )

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
):

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured. "
                "Check SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY."
            ),
        )

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
    # Validate GPS accuracy
    # --------------------------------------------------------

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
    # Validate coordinates
    # --------------------------------------------------------

    if latitude is not None:

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

    if longitude is not None:

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
        and confirmed_category
        in ALLOWED_ISSUE_TYPES
    ):
        issue_type = confirmed_category

    else:
        issue_type = analysis[
            "issue_type"
        ]

    ai_confidence = analysis[
        "confidence"
    ]

    severity = analysis[
        "severity"
    ]

    ai_description = analysis[
        "description"
    ]

    department = analysis[
        "recommended_department"
    ]

    visible_evidence = analysis.get(
        "visible_evidence",
        [],
    )

    title = get_issue_title(
        issue_type
    )

    final_description = (
        description.strip()
        if description.strip()
        else ai_description
    )

    # ========================================================
    # FIND MATCHING ACTIVE INCIDENT
    # ========================================================

    matching_incident = (
        find_matching_incident(
            issue_type=issue_type,
            latitude=latitude,
            longitude=longitude,
        )
    )

    # ========================================================
    # CASE A: EXISTING INCIDENT FOUND
    # ========================================================

    if matching_incident:

        incident_id = matching_incident[
            "incident_id"
        ]

        old_report_count = int(
            matching_incident.get(
                "report_count",
                1,
            )
            or 1
        )

        new_report_count = (
            old_report_count + 1
        )

        # ----------------------------------------------------
        # Recalculate Civic Confidence
        # ----------------------------------------------------

        civic_confidence = (
            calculate_civic_confidence(
                ai_confidence=ai_confidence,
                visible_evidence=
                    visible_evidence,
                latitude=(
                    matching_incident.get(
                        "latitude"
                    )
                    if matching_incident.get(
                        "latitude"
                    ) is not None
                    else latitude
                ),
                longitude=(
                    matching_incident.get(
                        "longitude"
                    )
                    if matching_incident.get(
                        "longitude"
                    ) is not None
                    else longitude
                ),
                accuracy_meters=(
                    accuracy_meters
                ),
                report_count=
                    new_report_count,
                issue_type=issue_type,
                description=(
                    final_description
                ),
                sector=sector,
            )
        )

        now = datetime.now(
            timezone.utc
        ).isoformat()

        update_data = {
            "report_count":
                new_report_count,
            "confidence_score":
                civic_confidence[
                    "score"
                ],
            "updated_at": now,
        }

        try:

            incident_response = (
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
                "SUPABASE INCIDENT FUSION "
                "UPDATE ERROR:"
            )

            print(str(exc))

            print(
                "===================================="
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Could not update the "
                    "existing incident: "
                    f"{str(exc)}"
                ),
            )

        if not incident_response.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Existing incident could "
                    "not be updated."
                ),
            )

        updated_incident = (
            incident_response.data[0]
        )

        # ----------------------------------------------------
        # Add new citizen report
        # ----------------------------------------------------

        clean_citizen_id = (
            citizen_id.strip()
            if citizen_id
            and citizen_id.strip()
            else None
        )

        report_data = {
            "incident_id":
                incident_id,
            "citizen_id":
                clean_citizen_id,
            "description":
                description.strip(),
            "image_url":
                None,
        }

        try:

            report_response = (
                supabase
                .table("reports")
                .insert(
                    report_data
                )
                .execute()
            )

        except Exception as exc:

            print(
                "===================================="
            )

            print(
                "SUPABASE FUSED REPORT ERROR:"
            )

            print(str(exc))

            print(
                "===================================="
            )

            raise HTTPException(
                status_code=500,
                detail={
                    "message": (
                        "Incident count was "
                        "updated but the new "
                        "report could not "
                        "be saved."
                    ),
                    "error": str(exc),
                    "incident_id":
                        incident_id,
                },
            )

        return {
            "message": (
                "Report matched an existing "
                "civic incident."
            ),

            "fusion": {
                "matched": True,
                "incident_id":
                    incident_id,
                "distance_meters":
                    matching_incident.get(
                        "_match_distance_meters"
                    ),
                "previous_report_count":
                    old_report_count,
                "new_report_count":
                    new_report_count,
            },

            "civic_confidence":
                civic_confidence,

            "incident_id":
                incident_id,

            "report": (
                report_response.data[0]
                if report_response.data
                else None
            ),

            "ai_analysis":
                analysis,

            "incident":
                updated_incident,
        }

    # ========================================================
    # CASE B: NO MATCH → CREATE NEW INCIDENT
    # ========================================================

    civic_confidence = (
        calculate_civic_confidence(
            ai_confidence=ai_confidence,
            visible_evidence=
                visible_evidence,
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=
                accuracy_meters,
            report_count=1,
            issue_type=issue_type,
            description=final_description,
            sector=sector,
        )
    )

    risk_score = 0

    incident_data = {
        "issue_type":
            issue_type,

        "title":
            title,

        "description":
            final_description,

        "area":
            sector,

        "address":
            f"{sector}, Chandigarh",

        "latitude":
            latitude,

        "longitude":
            longitude,

        "department":
            department,

        "status":
            "reported",

        "severity":
            severity,

        # IMPORTANT:
        # This is now Civic Confidence,
        # NOT raw AI confidence.
        "confidence_score":
            civic_confidence[
                "score"
            ],

        "risk_score":
            risk_score,

        "report_count":
            1,

        "recurrence_count":
            0,
    }

    try:

        incident_response = (
            supabase
            .table("incidents")
            .insert(
                incident_data
            )
            .execute()
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "SUPABASE INCIDENT ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not create incident: "
                f"{str(exc)}"
            ),
        )

    if not incident_response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Incident was not created."
            ),
        )

    incident = (
        incident_response.data[0]
    )

    incident_id = incident.get(
        "incident_id"
    )

    if not incident_id:
        raise HTTPException(
            status_code=500,
            detail=(
                "Incident was created but "
                "incident_id was not returned."
            ),
        )

    # --------------------------------------------------------
    # Create first report
    # --------------------------------------------------------

    clean_citizen_id = (
        citizen_id.strip()
        if citizen_id
        and citizen_id.strip()
        else None
    )

    report_data = {
        "incident_id":
            incident_id,

        "citizen_id":
            clean_citizen_id,

        "description":
            description.strip(),

        "image_url":
            None,
    }

    try:

        report_response = (
            supabase
            .table("reports")
            .insert(
                report_data
            )
            .execute()
        )

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "SUPABASE REPORT ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "Incident created but "
                    "report could not "
                    "be saved."
                ),
                "error": str(exc),
                "incident_id":
                    incident_id,
            },
        )

    return {
        "message":
            "Report created successfully.",

        "fusion": {
            "matched": False,
            "incident_id":
                incident_id,
            "distance_meters":
                None,
            "previous_report_count":
                0,
            "new_report_count":
                1,
        },

        "civic_confidence":
            civic_confidence,

        "incident_id":
            incident_id,

        "report": (
            report_response.data[0]
            if report_response.data
            else None
        ),

        "ai_analysis":
            analysis,

        "incident":
            incident,
    }


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@app.get("/incidents")
def get_incidents():

    if not supabase:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured."
            ),
        )

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

        return {
            "count": len(
                incidents
            ),
            "incidents":
                incidents,
        }

    except Exception as exc:

        print(
            "===================================="
        )

        print(
            "SUPABASE INCIDENTS ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

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
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured."
            ),
        )

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
            "===================================="
        )

        print(
            "SUPABASE INCIDENT LOOKUP ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

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

    return response.data[0]


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
            "===================================="
        )

        print(
            "SUPABASE INCIDENT ASSIGNMENT "
            "ERROR:"
        )

        print(str(exc))

        print(
            "===================================="
        )

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

    return {
        "success": True,
        "incident":
            response.data[0],
    }