import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

DISPUTE_GENERATOR_PROMPT = """
Write a formal medical billing dispute letter based on the following information:

Patient Information:
{bill_data}

Discrepancies Found:
{discrepancies}

Interview Assessment:
{assessment}

The letter should:
1. Be professional and firm but polite
2. Include the patient's name and account number
3. List specific line items being disputed and the reason (e.g., duplicate, price gouging)
4. State the total amount being disputed
5. Request an itemized review and adjustment
6. Mention rights under the No Surprises Act if relevant
7. Be formatted as a plain text email body

Return ONLY the letter text.
"""


def generate_dispute_letter(bill_data: dict, discrepancies: list, assessment: dict = None) -> str:
    """Generate a formal dispute letter using Gemini."""
    
    prompt = DISPUTE_GENERATOR_PROMPT.format(
        bill_data=json.dumps(bill_data, indent=2),
        discrepancies=json.dumps(discrepancies, indent=2),
        assessment=json.dumps(assessment, indent=2) if assessment else "No interview conducted"
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
            ),
        )
        return response.text
    except Exception as e:
        print(f"Letter generation failed: {e}")
        return "Error generating dispute letter. Please try again."
