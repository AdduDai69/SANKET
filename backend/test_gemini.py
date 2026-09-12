from google import genai
from PIL import Image

client = genai.Client()

image = Image.open("test_image.jpg")

prompt = """
Analyze this image for CivicLens, a civic issue reporting platform.

Identify the civic issue visible in the image.

Return ONLY valid JSON.

Use exactly this structure:

{
    "issue_type": "pothole",
    "confidence": 0.0,
    "severity": "low",
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
- visible_evidence must be an array of short strings.
- Do not include markdown.
- Do not include explanations outside the JSON.
"""

response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=[prompt, image],
    config={
        "response_mime_type": "application/json"
    }
)

print(response.text)