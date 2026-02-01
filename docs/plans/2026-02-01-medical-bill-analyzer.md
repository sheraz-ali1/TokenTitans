# Medical Bill Analyzer - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that extracts medical bill data from uploaded images/PDFs using Gemini Vision, detects billing discrepancies, and conducts a conversational interview with the patient to confirm findings.

**Architecture:** FastAPI backend with 3 endpoints (upload, chat, results). React frontend with 3 screens (upload, chat, results). All AI features powered by Gemini API. No database — in-memory state for hackathon demo.

**Tech Stack:** Python 3.11+, FastAPI, google-genai SDK, React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS

---

### Task 1: Backend Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/.env.example`

**Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn==0.30.0
python-multipart==0.0.9
google-genai==1.0.0
python-dotenv==1.0.1
Pillow==10.4.0
PyPDF2==3.0.1
```

**Step 2: Create minimal FastAPI app**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MedBill Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 3: Create .env.example**

```
GEMINI_API_KEY=your-api-key-here
```

**Step 4: Install dependencies and verify server starts**

Run: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
Expected: Server running, `GET /health` returns `{"status": "ok"}`

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend with FastAPI and dependencies"
```

---

### Task 2: Bill Extraction Module

**Files:**
- Create: `backend/extraction.py`
- Modify: `backend/main.py`

**Step 1: Create extraction.py with Gemini Vision integration**

```python
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
```

**Step 2: Add upload endpoint to main.py**

Add to `main.py`:

```python
from fastapi import UploadFile, File, HTTPException
from extraction import extract_bill_data

# In-memory store for demo
bill_store = {}
session_counter = 0

ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp",
    "application/pdf"
}

@app.post("/upload-bill")
async def upload_bill(file: UploadFile = File(...)):
    global session_counter

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    bill_data = extract_bill_data(file_bytes, file.content_type)

    session_counter += 1
    session_id = f"session-{session_counter}"
    bill_store[session_id] = {
        "bill_data": bill_data,
        "discrepancies": [],
        "chat_history": [],
    }

    return {"session_id": session_id, "bill_data": bill_data}
```

**Step 3: Test manually with a sample bill image**

Run: `uvicorn main:app --reload --port 8000`
Test: Upload a medical bill image via curl or Postman
Expected: Returns structured JSON with extracted line items

**Step 4: Commit**

```bash
git add backend/extraction.py backend/main.py
git commit -m "feat: add bill extraction via Gemini Vision API"
```

---

### Task 3: Discrepancy Detection Module

**Files:**
- Create: `backend/discrepancy.py`
- Create: `backend/reference_prices.json`
- Modify: `backend/main.py`

**Step 1: Create reference_prices.json**

```json
{
  "99213": {"description": "Office visit, established patient (low complexity)", "avg_price": 150, "high_price": 300},
  "99214": {"description": "Office visit, established patient (moderate complexity)", "avg_price": 250, "high_price": 450},
  "99283": {"description": "Emergency dept visit (moderate severity)", "avg_price": 600, "high_price": 1200},
  "99284": {"description": "Emergency dept visit (high severity)", "avg_price": 1100, "high_price": 2200},
  "99285": {"description": "Emergency dept visit (critical severity)", "avg_price": 1800, "high_price": 3500},
  "36415": {"description": "Venipuncture (blood draw)", "avg_price": 15, "high_price": 50},
  "85025": {"description": "Complete blood count (CBC)", "avg_price": 30, "high_price": 80},
  "80053": {"description": "Comprehensive metabolic panel", "avg_price": 35, "high_price": 100},
  "71046": {"description": "Chest X-ray, 2 views", "avg_price": 75, "high_price": 250},
  "93000": {"description": "Electrocardiogram (ECG/EKG)", "avg_price": 50, "high_price": 200},
  "80061": {"description": "Lipid panel", "avg_price": 40, "high_price": 120},
  "81001": {"description": "Urinalysis", "avg_price": 15, "high_price": 60},
  "97110": {"description": "Therapeutic exercises", "avg_price": 75, "high_price": 200},
  "29125": {"description": "Forearm splint", "avg_price": 100, "high_price": 300},
  "99221": {"description": "Initial hospital care (low complexity)", "avg_price": 200, "high_price": 450},
  "99222": {"description": "Initial hospital care (moderate complexity)", "avg_price": 300, "high_price": 600},
  "99223": {"description": "Initial hospital care (high complexity)", "avg_price": 400, "high_price": 800},
  "99231": {"description": "Subsequent hospital care (low complexity)", "avg_price": 100, "high_price": 250},
  "99232": {"description": "Subsequent hospital care (moderate complexity)", "avg_price": 150, "high_price": 350},
  "99233": {"description": "Subsequent hospital care (high complexity)", "avg_price": 200, "high_price": 450}
}
```

**Step 2: Create discrepancy.py**

```python
import json
from pathlib import Path

# Load reference prices
REFERENCE_PRICES = json.loads(
    (Path(__file__).parent / "reference_prices.json").read_text()
)


def detect_discrepancies(bill_data: dict) -> list[dict]:
    """Run all discrepancy checks against extracted bill data."""
    discrepancies = []
    line_items = bill_data.get("line_items", [])

    discrepancies.extend(_check_duplicates(line_items))
    discrepancies.extend(_check_price_inflation(line_items))
    discrepancies.extend(_check_quantity_anomalies(line_items))
    discrepancies.extend(_check_math_errors(bill_data))

    return discrepancies


def _check_duplicates(items: list[dict]) -> list[dict]:
    """Find duplicate charges — same code, description, and date."""
    seen = {}
    duplicates = []
    for i, item in enumerate(items):
        key = (
            item.get("code"),
            item.get("description", "").lower().strip(),
            item.get("date_of_service"),
        )
        if key in seen:
            duplicates.append({
                "type": "duplicate_charge",
                "severity": "high",
                "confidence": "high",
                "description": f"Duplicate charge detected: '{item['description']}' appears multiple times on {item.get('date_of_service', 'same date')}",
                "items_involved": [seen[key], i],
                "potential_overcharge": item.get("total_charge", 0),
            })
        else:
            seen[key] = i
    return duplicates


def _check_price_inflation(items: list[dict]) -> list[dict]:
    """Flag charges significantly above reference prices."""
    flags = []
    for i, item in enumerate(items):
        code = item.get("code")
        if code and code in REFERENCE_PRICES:
            ref = REFERENCE_PRICES[code]
            charge = item.get("total_charge", 0)
            if charge > ref["high_price"] * 1.5:
                flags.append({
                    "type": "price_inflation",
                    "severity": "high",
                    "confidence": "medium",
                    "description": f"'{item['description']}' charged at ${charge:.2f}, well above typical range (${ref['avg_price']}-${ref['high_price']})",
                    "items_involved": [i],
                    "potential_overcharge": round(charge - ref["high_price"], 2),
                    "reference": ref,
                })
            elif charge > ref["high_price"]:
                flags.append({
                    "type": "price_inflation",
                    "severity": "medium",
                    "confidence": "medium",
                    "description": f"'{item['description']}' charged at ${charge:.2f}, above typical high of ${ref['high_price']}",
                    "items_involved": [i],
                    "potential_overcharge": round(charge - ref["high_price"], 2),
                    "reference": ref,
                })
    return flags


def _check_quantity_anomalies(items: list[dict]) -> list[dict]:
    """Flag unusually high quantities."""
    flags = []
    for i, item in enumerate(items):
        qty = item.get("quantity", 1)
        if qty > 5:
            flags.append({
                "type": "quantity_anomaly",
                "severity": "medium",
                "confidence": "low",
                "description": f"'{item['description']}' has quantity of {qty} — verify this is correct",
                "items_involved": [i],
                "potential_overcharge": 0,
            })
    return flags


def _check_math_errors(bill_data: dict) -> list[dict]:
    """Check if line items add up to the stated total."""
    flags = []
    items = bill_data.get("line_items", [])
    total_billed = bill_data.get("total_billed")

    if total_billed is not None and items:
        calculated_total = sum(item.get("total_charge", 0) for item in items)
        diff = abs(calculated_total - total_billed)
        if diff > 1.0:
            flags.append({
                "type": "math_error",
                "severity": "high",
                "confidence": "high",
                "description": f"Line items total ${calculated_total:.2f} but bill states ${total_billed:.2f} (difference: ${diff:.2f})",
                "items_involved": [],
                "potential_overcharge": diff if calculated_total < total_billed else 0,
            })
    return flags
```

**Step 3: Wire discrepancy detection into upload endpoint**

In `main.py`, after `extract_bill_data`, add:

```python
from discrepancy import detect_discrepancies

# Inside upload_bill, after bill_data is extracted:
    discrepancies = detect_discrepancies(bill_data)
    bill_store[session_id] = {
        "bill_data": bill_data,
        "discrepancies": discrepancies,
        "chat_history": [],
    }
    return {"session_id": session_id, "bill_data": bill_data, "discrepancies": discrepancies}
```

**Step 4: Test with sample bill**

Run server and upload a bill — verify discrepancies are returned.

**Step 5: Commit**

```bash
git add backend/discrepancy.py backend/reference_prices.json backend/main.py
git commit -m "feat: add discrepancy detection with duplicate, price, quantity, and math checks"
```

---

### Task 4: Conversational Agent Module

**Files:**
- Create: `backend/conversation.py`
- Modify: `backend/main.py`

**Step 1: Create conversation.py**

```python
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
{
  "assessment_complete": true,
  "confirmed_discrepancies": [...],
  "new_concerns": [...],
  "cleared_items": [...]
}
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

    # Build message history for Gemini
    contents = []
    for msg in chat_history:
        contents.append(
            types.Content(
                role=msg["role"],
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    # Add new user message
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

    # Update chat history
    if user_message:
        chat_history.append({"role": "user", "content": user_message})
    chat_history.append({"role": "model", "content": assistant_message})

    # Check if assessment is complete
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
```

**Step 2: Add chat and results endpoints to main.py**

```python
from pydantic import BaseModel
from conversation import get_chat_response

class ChatMessage(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
async def chat(msg: ChatMessage):
    if msg.session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[msg.session_id]
    result = get_chat_response(session, msg.message)

    if result["assessment"]:
        session["final_assessment"] = result["assessment"]

    return result

@app.post("/chat/start")
async def start_chat(msg: dict):
    session_id = msg.get("session_id")
    if session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[session_id]
    result = get_chat_response(session, "")

    return result

@app.get("/results/{session_id}")
async def get_results(session_id: str):
    if session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[session_id]
    discrepancies = session["discrepancies"]
    assessment = session.get("final_assessment")

    total_potential_savings = sum(
        d.get("potential_overcharge", 0) for d in discrepancies
    )

    return {
        "bill_data": session["bill_data"],
        "discrepancies": discrepancies,
        "assessment": assessment,
        "total_potential_savings": total_potential_savings,
        "chat_history": session["chat_history"],
    }
```

**Step 3: Test chat flow manually**

Upload a bill, then POST to `/chat/start`, then send messages to `/chat`.

**Step 4: Commit**

```bash
git add backend/conversation.py backend/main.py
git commit -m "feat: add conversational agent with Gemini for patient interview"
```

---

### Task 5: Frontend Project Setup

**Files:**
- Create: `frontend/` (via Vite + React + TypeScript)
- Install: shadcn/ui, tailwind

**Step 1: Scaffold React project**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

**Step 2: Install shadcn components needed**

```bash
npx shadcn@latest add button card input badge progress tabs
```

**Step 3: Set up API helper**

Create `frontend/src/lib/api.ts`:

```typescript
const API_BASE = "http://localhost:8000";

export async function uploadBill(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload-bill`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function startChat(sessionId: string) {
  const res = await fetch(`${API_BASE}/chat/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Chat start failed: ${res.statusText}`);
  return res.json();
}

export async function sendMessage(sessionId: string, message: string) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}

export async function getResults(sessionId: string) {
  const res = await fetch(`${API_BASE}/results/${sessionId}`);
  if (!res.ok) throw new Error(`Results failed: ${res.statusText}`);
  return res.json();
}
```

**Step 4: Verify dev server runs**

Run: `npm run dev`
Expected: Vite dev server at localhost:5173

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with React, Vite, Tailwind, shadcn/ui"
```

---

### Task 6: Frontend - Upload Screen

**Files:**
- Create: `frontend/src/components/BillUpload.tsx`
- Create: `frontend/src/components/BillItemsTable.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Build Upload component**

Use frontend-design skill for high-quality UI. Component should have:
- Drag-and-drop zone with file picker fallback
- Loading state with progress indicator during extraction
- Clean display of results on success
- Medical/trust aesthetic: whites, blues, clean typography

**Step 2: Build BillItemsTable component**

- Display extracted line items in a clean table
- Highlight rows with discrepancies in orange/red
- Show discrepancy badges next to flagged items

**Step 3: Wire into App.tsx with state management**

- App holds: currentScreen ("upload" | "chat" | "results"), sessionId, billData, discrepancies
- Upload success transitions to chat screen

**Step 4: Test upload flow end-to-end**

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add bill upload and extraction display UI"
```

---

### Task 7: Frontend - Chat Screen

**Files:**
- Create: `frontend/src/components/ChatInterface.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Build ChatInterface component**

- Chat bubble UI (user on right, agent on left)
- Auto-initiates conversation on mount (calls /chat/start)
- Text input at bottom
- Bill summary sidebar/banner for reference
- Auto-scroll to latest message
- Loading indicator while agent responds

**Step 2: Handle assessment completion**

- When agent returns `assessment`, show a "View Results" button
- Transition to results screen

**Step 3: Test chat flow end-to-end**

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add chat interface for patient interview"
```

---

### Task 8: Frontend - Results Screen

**Files:**
- Create: `frontend/src/components/ResultsDashboard.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Build ResultsDashboard component**

- Big "Potential Savings" number at top
- Discrepancy cards: type, description, severity badge, confidence, estimated overcharge
- Color coding: high severity = red, medium = orange, low = yellow
- Bill summary section
- Disabled "Dispute" button with "Coming Soon" label
- "Analyze Another Bill" button to restart

**Step 2: Test full flow end-to-end**

Upload → Extract → Chat → Results

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: add results dashboard with discrepancy report"
```

---

### Task 9: Polish and Final Integration

**Files:**
- Modify: various frontend/backend files

**Step 1: Add error handling**

- Backend: wrap Gemini calls in try/except, return meaningful errors
- Frontend: show error toasts/alerts on API failures

**Step 2: Add a .env to backend with real Gemini API key**

**Step 3: Test full end-to-end flow with a real medical bill**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: polish and finalize medical bill analyzer for demo"
```

---

## Work Split Summary

| Task | Person A (Backend) | Person B (Frontend) |
|------|-------------------|---------------------|
| 1 | Backend setup | — |
| 2 | Bill extraction | — |
| 3 | Discrepancy detection | — |
| 4 | Conversation agent | — |
| 5 | — | Frontend setup |
| 6 | — | Upload screen |
| 7 | — | Chat screen |
| 8 | — | Results screen |
| 9 | Both | Both |

**Person B can start Task 5 immediately** and mock API responses while Person A builds Tasks 1-4. They converge at Task 9.
