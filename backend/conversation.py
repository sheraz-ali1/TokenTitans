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
    chat_history = session_data.get("chat_history", [])

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

    # If contents is empty (starting chat), provide a simple prompt to initiate conversation
    # This ensures the API has at least one content item
    auto_generated_prompt = False
    if not contents:
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text="Hello, I'd like to review my medical bill.")],
            )
        )
        auto_generated_prompt = True

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.7,
                system_instruction=system,
            ),
        )

        # Extract text from response - same approach as extraction.py
        assistant_message = None
        
        # Check if response was blocked (candidates is None or empty)
        if response.candidates is None or (hasattr(response, 'candidates') and not response.candidates):
            # Check prompt_feedback for blocking reason
            block_reason = "Content was filtered by safety settings"
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                feedback = response.prompt_feedback
                if hasattr(feedback, 'block_reason'):
                    block_reason = f"Blocked: {feedback.block_reason}"
                elif hasattr(feedback, 'block_reason_message'):
                    block_reason = f"Blocked: {feedback.block_reason_message}"
            
            # Provide a fallback message instead of failing
            # This allows the chat to continue even if the initial response was blocked
            assistant_message = (
                "Hello! I'm here to help you review your medical bill. "
                "I've analyzed your bill and found some items that may need your attention. "
                "Could you tell me about your hospital visit? For example, how long were you there, "
                "and what procedures or treatments do you remember receiving?"
            )
            print(f"Warning: Response was blocked ({block_reason}). Using fallback message.")
        else:
            try:
                # Direct access to text property (same as extraction.py)
                assistant_message = response.text
                # Check if text is None or empty
                if not assistant_message:
                    assistant_message = None
            except AttributeError:
                # If .text doesn't exist, try accessing via candidates
                try:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content'):
                        content = candidate.content
                        if hasattr(content, 'parts') and content.parts:
                            # Get text from first part
                            part = content.parts[0]
                            if hasattr(part, 'text'):
                                assistant_message = part.text
                except (AttributeError, IndexError, KeyError) as e:
                    print(f"Error accessing response content: {e}")
            
            # Check for finish reasons that indicate blocking
            if not assistant_message and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'finish_reason'):
                    finish_reason = candidate.finish_reason
                    if finish_reason and finish_reason != 'STOP':
                        raise Exception(f"Response blocked. Finish reason: {finish_reason}")
            
            if not assistant_message:
                raise Exception("No text content found in API response. The response may have been blocked or filtered.")
            
    except Exception as e:
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise Exception(f"API authentication error: {error_msg}")
        elif "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
            raise Exception(f"API quota/rate limit error: {error_msg}")
        else:
            raise Exception(f"Failed to generate chat response: {error_msg}")

    # Ensure we have a valid message
    if not assistant_message:
        assistant_message = "I apologize, but I'm having trouble processing your request. Please try again."

    # Only append user message if it was provided (not the auto-generated one)
    if user_message:
        chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "model", "content": assistant_message})

    assessment = None
    if assistant_message and "```json" in assistant_message and "assessment_complete" in assistant_message:
        try:
            json_str = assistant_message.split("```json")[1].split("```")[0]
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            pass

    return {
        "message": assistant_message,
        "assessment": assessment,
    }
