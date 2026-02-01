import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

HOSPITAL_LOOKUP_PROMPT = """
Find the billing department contact information for this hospital:
Hospital Name: {provider_name}

Return ONLY valid JSON in this exact format:
{{
  "hospital_name": "...",
  "address": "full street address, city, state zip",
  "billing_email": "email for billing disputes",
  "billing_phone": "phone number (optional)"
}}

If you cannot find the exact billing email, provide the general contact email.
"""


def lookup_hospital(provider_name: str) -> dict:
    """Find hospital contact info using Gemini with Google Search grounding."""
    
    if not provider_name:
        return {
            "hospital_name": "Unknown Provider",
            "address": "",
            "billing_email": "",
            "billing_phone": ""
        }

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=HOSPITAL_LOOKUP_PROMPT.format(provider_name=provider_name),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Hospital lookup failed: {e}")
        # Fallback
        return {
            "hospital_name": provider_name,
            "address": "",
            "billing_email": "",
            "billing_phone": ""
        }
