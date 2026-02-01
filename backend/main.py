from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from extraction import extract_bill_data
from discrepancy import detect_discrepancies
from conversation import get_chat_response

app = FastAPI(title="MedBill Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for demo
bill_store = {}
session_counter = 0

ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp",
    "application/pdf"
}


class ChatMessage(BaseModel):
    session_id: str
    message: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload-bill")
async def upload_bill(file: UploadFile = File(...)):
    global session_counter

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()

    try:
        bill_data = extract_bill_data(file_bytes, file.content_type)
    except Exception as e:
        raise HTTPException(500, f"Failed to extract bill data: {str(e)}")

    discrepancies = detect_discrepancies(bill_data)

    session_counter += 1
    session_id = f"session-{session_counter}"
    bill_store[session_id] = {
        "bill_data": bill_data,
        "discrepancies": discrepancies,
        "chat_history": [],
    }

    return {"session_id": session_id, "bill_data": bill_data, "discrepancies": discrepancies}


@app.post("/chat")
async def chat(msg: ChatMessage):
    if msg.session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[msg.session_id]

    try:
        result = get_chat_response(session, msg.message)
    except Exception as e:
        raise HTTPException(500, f"Chat error: {str(e)}")

    if result["assessment"]:
        session["final_assessment"] = result["assessment"]

    return result


@app.post("/chat/start")
async def start_chat(msg: dict):
    session_id = msg.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id is required")
    
    if session_id not in bill_store:
        raise HTTPException(404, f"Session not found: {session_id}")

    session = bill_store[session_id]
    
    # Ensure chat_history exists
    if "chat_history" not in session:
        session["chat_history"] = []

    try:
        result = get_chat_response(session, "")
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Chat start error for session {session_id}: {error_details}")
        raise HTTPException(500, f"Chat start error: {str(e)}")

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
