from fastapi import FastAPI, UploadFile, File, Form, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from google import genai

from PIL import Image

from database import supabase

from pydantic import BaseModel

from datetime import datetime, timezone

import io

import json

class AssignmentRequest(BaseModel):
    team: str
    officer: str | None = None


# =========================================================
# APP
# =========================================================

app = FastAPI(title="CivicLens Backend")


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# GEMINI
# =========================================================

client = genai.Client()


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "CivicLens backend is running"
    }


# =========================================================
# GEMINI IMAGE ANALYSIS
# =========================================================

async def analyze_with_gemini(image_bytes: bytes):

    try:

        # -------------------------------------------------
        # Convert bytes into an image
        # -------------------------------------------------

        image = Image.open(
            io.BytesIO(image_bytes)
        )

        # -------------------------------------------------
        # CivicLens AI prompt
        # -------------------------------------------------

        prompt = """
You are the vision intelligence layer of CivicLens,
a civic issue reporting platform.

Analyze the provided image and identify the most
relevant civic issue visible in it.

Return ONLY valid JSON.

Use exactly this structure:

{
    "issue_type": "",
    "confidence": 0.0,
    "severity": "",
    "description": "",
    "recommended_department": "",
    "visible_evidence": []
}

Allowed issue_type values:

pothole
road_damage
drainage
streetlight
waste
other
not_civic_issue

Allowed severity values:

low
medium
high
critical

Rules:

- confidence must be a number between 0 and 1.
- visible_evidence must be an array of strings.
- Analyze what is actually visible in the image.
- Do not assume that every image is a pothole.
- Correctly distinguish between potholes, road damage,
  drainage problems, streetlights, waste and other
  civic issues.
- If there is no recognizable civic issue, use
  "not_civic_issue".
- Do not include markdown.
- Do not include explanations outside the JSON.
"""

        # -------------------------------------------------
        # Send image to Gemini
        # -------------------------------------------------

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                image
            ],
            config={
                "response_mime_type": "application/json"
            }
        )

        # -------------------------------------------------
        # Convert Gemini response to Python dictionary
        # -------------------------------------------------

        result = json.loads(
            response.text
        )

        return result

    except Exception as e:

        print("====================================")
        print("GEMINI ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Gemini image analysis failed: {str(e)}"
        )


# =========================================================
# ANALYZE IMAGE ONLY
# =========================================================
#
# This endpoint is used by the Citizen UI when the user
# clicks "Analyze with CivicLens AI".
#
# IMPORTANT:
# This does NOT create a database report.
#
# It only:
#
# Frontend
#    ↓
# FastAPI
#    ↓
# Gemini
#    ↓
# AI result
#    ↓
# Frontend confirmation screen
#
# =========================================================

@app.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...)
):

    # -----------------------------------------------------
    # Validate image
    # -----------------------------------------------------

    if not file.content_type:

        raise HTTPException(
            status_code=400,
            detail="File type could not be determined."
        )

    if not file.content_type.startswith("image/"):

        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    # -----------------------------------------------------
    # Read image
    # -----------------------------------------------------

    image_bytes = await file.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    # -----------------------------------------------------
    # Analyze with Gemini
    # -----------------------------------------------------

    analysis = await analyze_with_gemini(
        image_bytes
    )

    # -----------------------------------------------------
    # Return AI result
    # -----------------------------------------------------

    return analysis


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
):

    # =====================================================
    # VALIDATE IMAGE
    # =====================================================

    if not file.content_type:

        raise HTTPException(
            status_code=400,
            detail="File type could not be determined."
        )

    if not file.content_type.startswith("image/"):

        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )


    # =====================================================
    # READ IMAGE
    # =====================================================

    image_bytes = await file.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )


    # =====================================================
    # GEMINI ANALYSIS
    # =====================================================

    analysis = await analyze_with_gemini(
        image_bytes
    )


    # =====================================================
    # EXTRACT AI RESULTS
    # =====================================================

    issue_type = analysis.get(
        "issue_type",
        "other"
    )

    confidence = analysis.get(
        "confidence",
        0
    )

    severity = analysis.get(
        "severity",
        "medium"
    )

    ai_description = analysis.get(
        "description",
        ""
    )

    department = analysis.get(
        "recommended_department",
        ""
    )


    # =====================================================
    # HUMAN-READABLE TITLE
    # =====================================================

    issue_titles = {

        "pothole":
            "Pothole",

        "road_damage":
            "Road Damage",

        "drainage":
            "Drainage Issue",

        "streetlight":
            "Broken Streetlight",

        "waste":
            "Waste / Sanitation Issue",

        "other":
            "Civic Issue",

        "not_civic_issue":
            "Unclassified Image",
    }

    title = issue_titles.get(
        issue_type,
        "Civic Issue"
    )


    # =====================================================
    # CREATE INCIDENT DATA
    # =====================================================

    incident_data = {

        "issue_type":
            issue_type,

        "title":
            title,

        "description": (
            description.strip()
            if description.strip()
            else ai_description
        ),

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

        "confidence_score":
            confidence,

        "risk_score":
            0,

        "report_count":
            1,

        "recurrence_count":
            0,
    }


    # =====================================================
    # INSERT INCIDENT INTO SUPABASE
    # =====================================================

    try:

        incident_response = (
            supabase
            .table("incidents")
            .insert(incident_data)
            .execute()
        )

    except Exception as e:

        print("====================================")
        print("SUPABASE INCIDENT ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Could not create incident: {str(e)}"
        )


    # =====================================================
    # VERIFY INCIDENT CREATION
    # =====================================================

    if not incident_response.data:

        raise HTTPException(
            status_code=500,
            detail="Incident was not created."
        )


    incident = incident_response.data[0]

    incident_id = incident[
        "incident_id"
    ]


    # =====================================================
    # CREATE REPORT LINKED TO INCIDENT
    # =====================================================

    # Supabase citizen_id column is UUID.
    #
    # If the frontend sends:
    #
    # ""
    #
    # PostgreSQL cannot convert that empty string to UUID.
    #
    # Therefore:
    #
    # "" → None → NULL
    #
    # A real UUID will still be saved normally.

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

        # Supabase Storage will be connected later.
        "image_url":
            None,
    }


    # =====================================================
    # INSERT REPORT INTO SUPABASE
    # =====================================================

    try:

        report_response = (
            supabase
            .table("reports")
            .insert(report_data)
            .execute()
        )

    except Exception as e:

        print("====================================")
        print("SUPABASE REPORT ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Incident created but report could not be saved.",

                "error":
                    str(e)
            }
        )


    # =====================================================
    # RETURN RESULT
    # =====================================================

    return {

        "message":
            "Report created successfully.",

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


# =========================================================
# GET ALL INCIDENTS
# =========================================================

@app.get("/incidents")
def get_incidents():

    try:

        response = (
            supabase
            .table("incidents")
            .select("*")
            .order(
                "created_at",
                desc=True
            )
            .execute()
        )

        return {

            "count":
                len(response.data),

            "incidents":
                response.data,
        }

    except Exception as e:

        print("====================================")
        print("SUPABASE INCIDENTS ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve incidents: {str(e)}"
        )


# =========================================================
# GET SINGLE INCIDENT
# =========================================================

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):

    try:

        response = (
            supabase
            .table("incidents")
            .select("*")
            .eq("incident_id", incident_id)
            .execute()
        )

        print("====================================")
        print("SINGLE INCIDENT QUERY")
        print("ID:", incident_id)
        print("DATA:", response.data)
        print("====================================")

    except Exception as e:

        print("====================================")
        print("SUPABASE INCIDENT LOOKUP ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve incident: {str(e)}"
        )

    if not response.data:

        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    return response.data[0]

# =========================================================
# ASSIGN INCIDENT
# =========================================================

@app.post("/incidents/{incident_id}/assign")
def assign_incident(
    incident_id: str,
    assignment: AssignmentRequest
):

    assigned_at = datetime.now(timezone.utc).isoformat()

    update_data = {
        "status": "assigned",

        "assigned_team":
            assignment.team,

        "assigned_officer":
            assignment.officer
            or "Senior Field Inspector",

        "assigned_at":
            assigned_at,

        "updated_at":
            assigned_at,
    }

    try:

        response = (
            supabase
            .table("incidents")
            .update(update_data)
            .eq(
                "incident_id",
                incident_id
            )
            .execute()
        )

    except Exception as e:

        print("====================================")
        print("SUPABASE INCIDENT ASSIGNMENT ERROR:")
        print(str(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Could not assign incident: {str(e)}"
        )

    if not response.data:

        raise HTTPException(
            status_code=404,
            detail="Incident not found."
        )

    return {
        "success": True,
        "incident": response.data[0]
    }