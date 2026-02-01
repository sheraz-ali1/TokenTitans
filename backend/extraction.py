import json
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EXTRACTION_PROMPT = """You are a medical bill data extraction expert. Analyze this medical bill image/document and extract ALL line items into structured JSON.

For each line item extract:
- code: CPT/HCPCS code if visible (string, or null if not visible)
- description: description of the service/procedure (string)
- quantity: number of units (integer)
- unit_charge: charge per unit in dollars (float)
- total_charge: total charge for this line in dollars (float)
- date_of_service: date if visible (string YYYY-MM-DD, or null)
- category: one of "room", "procedure", "lab", "medication", "supply", "imaging", "therapy", "consultation", "other"

Also extract these top-level fields:
- patient_name: string or null
- provider_name: hospital/clinic name (string or null)
- billing_date: date on the bill (string or null)
- account_number: string or null
- total_billed: total amount on bill (float or null)
- insurance_adjustments: total insurance adjustments (float or null)
- patient_responsibility: amount patient owes (float or null)

Return ONLY valid JSON in this exact format:
{
  "patient_name": "...",
  "provider_name": "...",
  "billing_date": "...",
  "account_number": "...",
  "total_billed": 0.0,
  "insurance_adjustments": 0.0,
  "patient_responsibility": 0.0,
  "line_items": [
    {
      "code": "...",
      "description": "...",
      "quantity": 1,
      "unit_charge": 0.0,
      "total_charge": 0.0,
      "date_of_service": "...",
      "category": "..."
    }
  ]
}
"""


def extract_bill_data(file_bytes: bytes, mime_type: str) -> dict:
    """Extract structured data from a medical bill image or PDF."""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    types.Part.from_text(text=EXTRACTION_PROMPT),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)
