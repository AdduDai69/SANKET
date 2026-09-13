import base64
import io
import json
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from supabase import create_client, Client


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
FREE_VISION_MODEL = "openrouter/free"


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="SANKET CivicLens API",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

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


# =========================================================
# SUPABASE
# =========================================================

if not SUPABASE_URL:
    print("WARNING: SUPABASE_URL is not configured.")

if not SUPABASE_SERVICE_ROLE_KEY:
    print("WARNING: SUPABASE_SERVICE_ROLE_KEY is not configured.")

supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )


# =========================================================
# OPENROUTER
# =========================================================

openrouter_client: OpenAI | None = None

if OPENROUTER_API_KEY:
    openrouter_client = OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
    )
else:
    print("WARNING: OPENROUTER_API_KEY is not configured.")


# =========================================================
# CONSTANTS
# =========================================================

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


# =========================================================
# AI PROMPT
# =========================================================

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


# =========================================================
# ASSIGNMENT MODEL
# =========================================================

class AssignmentRequest(BaseModel):
    team: str
    officer: str | None = None


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def root():
    return {
        "name": "SANKET CivicLens API",
        "status": "running",
        "vision_provider": "OpenRouter",
        "vision_model": FREE_VISION_MODEL,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "openrouter_configured": bool(OPENROUTER_API_KEY),
        "supabase_configured": bool(supabase),
        "vision_model": FREE_VISION_MODEL,
    }


# =========================================================
# IMAGE VALIDATION
# =========================================================

def validate_image_bytes(image_bytes: bytes) -> None:
    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image.",
        )


# =========================================================
# AI RESULT VALIDATION
# =========================================================

def validate_ai_analysis(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("AI response is not a JSON object.")

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
                f"AI response is missing required field: {field}"
            )

    issue_type = str(
        data.get("issue_type", "other")
    ).lower().strip()

    if issue_type not in ALLOWED_ISSUE_TYPES:
        issue_type = "other"

    try:
        confidence = float(
            data.get("confidence", 0)
        )
    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(
        0.0,
        min(1.0, confidence),
    )

    severity = str(
        data.get("severity", "medium")
    ).lower().strip()

    if severity not in ALLOWED_SEVERITIES:
        severity = "medium"

    description = str(
        data.get("description", "")
    ).strip()

    recommended_department = str(
        data.get("recommended_department", "")
    ).strip()

    visible_evidence = data.get(
        "visible_evidence",
        [],
    )

    if not isinstance(visible_evidence, list):
        visible_evidence = []

    visible_evidence = [
        str(item).strip()
        for item in visible_evidence
        if str(item).strip()
    ]

    return {
        "issue_type": issue_type,
        "confidence": confidence,
        "severity": severity,
        "description": description,
        "recommended_department": recommended_department,
        "visible_evidence": visible_evidence,
    }


# =========================================================
# OPENROUTER IMAGE ANALYSIS
# =========================================================

async def analyze_with_openrouter(
    image_bytes: bytes,
    content_type: str | None = None,
) -> dict[str, Any]:

    if not openrouter_client:
        raise HTTPException(
            status_code=500,
            detail=(
                "OpenRouter is not configured. "
                "Add OPENROUTER_API_KEY to backend/.env."
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

        encoded_image = base64.b64encode(
            image_bytes
        ).decode("utf-8")

        data_url = (
            f"data:{mime_type};base64,"
            f"{encoded_image}"
        )

        response = openrouter_client.chat.completions.create(
            model=FREE_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": CIVIC_VISION_PROMPT,
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

        if not response.choices:
            raise ValueError(
                "OpenRouter returned no choices."
            )

        content = (
            response.choices[0]
            .message
            .content
        )

        if not content:
            raise ValueError(
                "OpenRouter returned an empty response."
            )

        content = str(content).strip()

        # Some models may still surround JSON with
        # Markdown fences. Remove them safely.
        if content.startswith("```json"):
            content = content[7:]

        elif content.startswith("```"):
            content = content[3:]

        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        result = json.loads(content)

        result = validate_ai_analysis(result)

        # Preserve provider information for provenance.
        result["ai_provider"] = "OpenRouter"

        result["model_router"] = FREE_VISION_MODEL

        result["model_used"] = getattr(
            response,
            "model",
            None,
        )

        return result

    except HTTPException:
        raise

    except json.JSONDecodeError as exc:
        print("OPENROUTER JSON ERROR:")
        print(str(exc))

        raise HTTPException(
            status_code=502,
            detail=(
                "The vision model returned an invalid "
                "JSON response."
            ),
        )

    except Exception as exc:
        print("====================================")
        print("OPENROUTER IMAGE ANALYSIS ERROR:")
        print(str(exc))
        print("====================================")

        raise HTTPException(
            status_code=502,
            detail=(
                "OpenRouter image analysis failed: "
                f"{str(exc)}"
            ),
        )


# =========================================================
# ANALYZE IMAGE
# =========================================================

@app.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
):
    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File type could not be determined.",
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed.",
        )

    image_bytes = await file.read()

    validate_image_bytes(image_bytes)

    analysis = await analyze_with_openrouter(
        image_bytes=image_bytes,
        content_type=file.content_type,
    )

    return analysis


# =========================================================
# ISSUE TITLE
# =========================================================

def get_issue_title(issue_type: str) -> str:
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


# =========================================================
# CREATE REPORT
# =========================================================

@app.post("/reports")
async def create_report(
    file: UploadFile = File(...),
    description: str = Form(...),
    sector: str = Form(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
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

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File type could not be determined.",
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed.",
        )

    image_bytes = await file.read()

    validate_image_bytes(image_bytes)

    # -----------------------------------------------------
    # IMPORTANT
    #
    # The frontend already called /analyze-image.
    #
    # We receive that result here instead of calling
    # the vision model a second time.
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Citizen-confirmed category
    # -----------------------------------------------------

    confirmed_category = str(
        analysis.get(
            "confirmed_category",
            "",
        )
    ).lower().strip()

    if confirmed_category in ALLOWED_ISSUE_TYPES:
        issue_type = confirmed_category
    else:
        issue_type = analysis["issue_type"]

    confidence = analysis["confidence"]

    severity = analysis["severity"]

    ai_description = analysis["description"]

    department = analysis[
        "recommended_department"
    ]

    title = get_issue_title(
        issue_type
    )

    final_description = (
        description.strip()
        if description.strip()
        else ai_description
    )

    # -----------------------------------------------------
    # Civic Risk is intentionally NOT fabricated here.
    #
    # The deterministic risk engine will be implemented
    # separately using severity, exposure, recurrence,
    # aging and affected area.
    # -----------------------------------------------------

    risk_score = 0

    # -----------------------------------------------------
    # Create incident
    # -----------------------------------------------------

    incident_data = {
        "issue_type": issue_type,
        "title": title,
        "description": final_description,
        "area": sector,
        "address": f"{sector}, Chandigarh",
        "latitude": latitude,
        "longitude": longitude,
        "department": department,
        "status": "reported",
        "severity": severity,
        "confidence_score": confidence,
        "risk_score": risk_score,
        "report_count": 1,
        "recurrence_count": 0,
    }

    try:
        incident_response = (
            supabase
            .table("incidents")
            .insert(incident_data)
            .execute()
        )

    except Exception as exc:
        print("====================================")
        print("SUPABASE INCIDENT ERROR:")
        print(str(exc))
        print("====================================")

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
            detail="Incident was not created.",
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

    # -----------------------------------------------------
    # Create linked report
    # -----------------------------------------------------

    clean_citizen_id = (
        citizen_id.strip()
        if citizen_id
        and citizen_id.strip()
        else None
    )

    report_data = {
        "incident_id": incident_id,
        "citizen_id": clean_citizen_id,
        "description": description.strip(),
        "image_url": None,
    }

    try:
        report_response = (
            supabase
            .table("reports")
            .insert(report_data)
            .execute()
        )

    except Exception as exc:
        print("====================================")
        print("SUPABASE REPORT ERROR:")
        print(str(exc))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail={
                "message": (
                    "Incident created but "
                    "report could not be saved."
                ),
                "error": str(exc),
                "incident_id": incident_id,
            },
        )

    return {
        "message": "Report created successfully.",
        "incident_id": incident_id,
        "report": (
            report_response.data[0]
            if report_response.data
            else None
        ),
        "ai_analysis": analysis,
        "incident": incident,
    }


# =========================================================
# GET ALL INCIDENTS
# =========================================================

@app.get("/incidents")
def get_incidents():
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured.",
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

        return {
            "count": len(response.data),
            "incidents": response.data,
        }

    except Exception as exc:
        print("====================================")
        print("SUPABASE INCIDENTS ERROR:")
        print(str(exc))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve incidents: "
                f"{str(exc)}"
            ),
        )


# =========================================================
# GET SINGLE INCIDENT
# =========================================================

@app.get("/incidents/{incident_id}")
def get_incident(
    incident_id: str,
):
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured.",
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
        print("====================================")
        print("SUPABASE INCIDENT LOOKUP ERROR:")
        print(str(exc))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve incident: "
                f"{str(exc)}"
            ),
        )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    return response.data[0]


# =========================================================
# ASSIGN INCIDENT
# =========================================================

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
            detail="Supabase is not configured.",
        )

    assigned_at = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    update_data = {
        "status": "assigned",
        "assigned_team": assignment.team,
        "assigned_officer": (
            assignment.officer
            or "Senior Field Inspector"
        ),
        "assigned_at": assigned_at,
        "updated_at": assigned_at,
    }

    try:
        response = (
            supabase
            .table("incidents")
            .update(update_data)
            .eq(
                "incident_id",
                incident_id,
            )
            .execute()
        )

    except Exception as exc:
        print("====================================")
        print("SUPABASE INCIDENT ASSIGNMENT ERROR:")
        print(str(exc))
        print("====================================")

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
        "incident": response.data[0],
    }