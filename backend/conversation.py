import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You are a friendly, professional medical billing assistant. Your job is to help patients understand their medical bills and identify potential errors.

You have been given the patient's extracted bill data and any automatically detected discrepancies. Your role is to:

1. Briefly introduce yourself and explain you're here to help review their bill
2. Ask targeted, specific questions about their hospital visit to verify charges
3. Keep questions simple and conversational — the patient is not a medical expert
4. Focus on verifiable facts: length of stay, procedures they remember, medications given, tests done
5. Do NOT ask more than 6-8 questions total
6. After gathering enough information, summarize your findings

IMPORTANT GUIDELINES:
- Patient testimony is supporting evidence, not definitive proof
- If patient says "I don't remember," that's fine — move on
- Weight your confidence based on how specific and certain the patient's answers are
- Be empathetic — medical bills are stressful
- Use plain language, avoid medical jargon

When you have enough information, respond with a JSON block wrapped in ```json``` tags containing your updated assessment:
```json
{{
  "assessment_complete": true,
  "confirmed_discrepancies": [...],
  "new_concerns": [...],
  "cleared_items": [...]
}}
```

Until then, just ask your next question naturally.

BILL DATA:
{bill_data}

AUTO-DETECTED DISCREPANCIES:
{discrepancies}
"""


def get_chat_response(session_data: dict, user_message: str) -> dict:
    """Process a chat message and return the agent's response."""
    bill_data = session_data["bill_data"]
    discrepancies = session_data["discrepancies"]
    chat_history = session_data["chat_history"]

    system = SYSTEM_PROMPT.format(
        bill_data=json.dumps(bill_data, indent=2),
        discrepancies=json.dumps(discrepancies, indent=2),
    )

    contents = []
    for msg in chat_history:
        contents.append(
            types.Content(
                role=msg["role"],
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    if user_message:
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )
        )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.7,
            system_instruction=system,
        ),
    )

    assistant_message = response.text

    if user_message:
        chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "model", "content": assistant_message})

    assessment = None
    if "```json" in assistant_message and "assessment_complete" in assistant_message:
        try:
            json_str = assistant_message.split("```json")[1].split("```")[0]
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            pass

    return {
        "message": assistant_message,
        "assessment": assessment,
    }
