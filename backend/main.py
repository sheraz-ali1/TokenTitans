from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
import os
import random
import glob

from discrepancy import detect_discrepancies
from database import get_fee_info

# Core imports with error handling
try:
    from extraction import extract_bill_data
except (ImportError, ModuleNotFoundError) as e:
    print(f"Warning: extraction module not available: {e}")
    def extract_bill_data(file_bytes: bytes, mime_type: str) -> dict:
        raise HTTPException(503, "Bill extraction not available. Please install required dependencies (google-genai).")

try:
    from conversation import get_chat_response
except (ImportError, ModuleNotFoundError) as e:
    print(f"Warning: conversation module not available: {e}")
    def get_chat_response(session_data: dict, user_message: str) -> dict:
        raise HTTPException(503, "Chat functionality not available. Please install required dependencies (google-genai).")

# Optional imports for dispute features
try:
    from hospital_lookup import lookup_hospital
except ImportError:
    def lookup_hospital(provider_name: str) -> dict:
        return {
            "hospital_name": provider_name or "Unknown Provider",
            "address": "",
            "billing_email": "",
            "billing_phone": ""
        }

try:
    from dispute_generator import generate_dispute_letter
except ImportError:
    def generate_dispute_letter(bill_data: dict, discrepancies: list, assessment: dict = None) -> str:
        return "Error: Dispute letter generation not available. Please install required dependencies."

try:
    from email_sender import send_dispute_email
except ImportError:
    def send_dispute_email(recipient_email: str, letter: str, account_number: str = "Unknown"):
        raise Exception("Email sending not available. Please install required dependencies.")

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


class ConfirmBillRequest(BaseModel):
    session_id: str
    bill_data: dict  # The edited bill data from frontend


class DisputePreviewRequest(BaseModel):
    session_id: str


class DisputeSendRequest(BaseModel):
    session_id: str
    recipient_email: EmailStr
    letter: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test-image")
def get_test_image():
    """Get a random test image from bill_images directory."""
    # Get the directory where this file is located
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    bill_images_dir = os.path.join(os.path.dirname(backend_dir), "bill_images")
    
    # Find all image files
    image_extensions = ["*.png", "*.jpg", "*.jpeg", "*.webp"]
    image_files = []
    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(bill_images_dir, ext)))
        image_files.extend(glob.glob(os.path.join(bill_images_dir, ext.upper())))
    
    if not image_files:
        raise HTTPException(404, "No test images found in bill_images directory")
    
    # Select a random image
    random_image = random.choice(image_files)
    
    # Determine content type
    ext = os.path.splitext(random_image)[1].lower()
    media_type_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp"
    }
    media_type = media_type_map.get(ext, "image/png")
    
    return FileResponse(random_image, media_type=media_type, filename=os.path.basename(random_image))


def normalize_code(code: str) -> str:
    """Normalize HCPCS/CPT code for database lookup."""
    if not code:
        return ""
    # Remove spaces, dashes, dots, and convert to uppercase
    normalized = str(code).strip().replace("-", "").replace(" ", "").replace(".", "").upper()
    # Extract just the numeric/alphanumeric part (first 5 characters typically)
    # HCPCS codes are usually 5 characters
    if len(normalized) > 5:
        # Might have modifiers, take first 5 chars
        normalized = normalized[:5]
    return normalized


def enrich_line_items_with_reference_prices(bill_data: dict):
    """
    Add expected_charge (avg_price from data.db) to each line item.
    Queries data.db fee_schedule table to get benchmark pricing for each HCPCS code.
    """
    line_items = bill_data.get("line_items", [])
    found_count = 0
    for item in line_items:
        code = item.get("code")
        if code:
            # Normalize code for database lookup
            normalized_code = normalize_code(code)
            
            if normalized_code:
                # Query data.db for reference pricing
                ref = get_fee_info(normalized_code)
                if ref and ref.get("avg_price") and ref["avg_price"] > 0:
                    # Add expected_charge based on avg_price from data.db, adjusted for quantity
                    quantity = item.get("quantity", 1) or 1
                    expected_total = round(ref["avg_price"] * quantity, 2)
                    item["expected_charge"] = expected_total
                    item["expected_charge_per_unit"] = round(ref["avg_price"], 2)
                    item["high_price_per_unit"] = round(ref["high_price"], 2)
                    found_count += 1
                    print(f"✓ Found reference price for code {code} (normalized: {normalized_code}): ${ref['avg_price']:.2f} x {quantity} = ${expected_total:.2f}")
                else:
                    # No reference data found in data.db for this code
                    item["expected_charge"] = None
                    item["expected_charge_per_unit"] = None
                    item["high_price_per_unit"] = None
                    print(f"✗ No reference price found for code: {code} (normalized: {normalized_code})")
            else:
                item["expected_charge"] = None
                item["expected_charge_per_unit"] = None
                item["high_price_per_unit"] = None
        else:
            item["expected_charge"] = None
            item["expected_charge_per_unit"] = None
            item["high_price_per_unit"] = None
    
    print(f"Enriched {found_count}/{len(line_items)} line items with reference prices from data.db")


@app.post("/upload-bill")
async def upload_bill(file: UploadFile = File(...)):
    global session_counter

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()

    try:
        bill_data = extract_bill_data(file_bytes, file.content_type)
    except Exception as e:
        error_msg = str(e)
        if "not available" in error_msg or "dependencies" in error_msg:
            raise HTTPException(503, f"Service temporarily unavailable: {error_msg}")
        raise HTTPException(500, f"Failed to extract bill data: {str(e)}")

    # Enrich line items with reference prices
    enrich_line_items_with_reference_prices(bill_data)

    discrepancies = detect_discrepancies(bill_data)

    session_counter += 1
    session_id = f"session-{session_counter}"
    bill_store[session_id] = {
        "bill_data": bill_data,
        "discrepancies": [],  # Empty until user confirms
        "chat_history": [],
    }

    return {"session_id": session_id, "bill_data": bill_data}


@app.post("/confirm-bill")
async def confirm_bill(req: ConfirmBillRequest):
    """Run discrepancy detection after user confirms/edits the bill."""
    if req.session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[req.session_id]
    
    # Save the (potentially edited) bill data
    session["bill_data"] = req.bill_data
    
    # Now run discrepancy detection on the confirmed data
    discrepancies = detect_discrepancies(req.bill_data)
    session["discrepancies"] = discrepancies
    
    total_savings = sum((d.get("potential_overcharge") or 0) for d in discrepancies)
    
    return {
        "discrepancies": discrepancies,
        "total_savings": total_savings
    }


@app.post("/chat")
async def chat(msg: ChatMessage):
    if msg.session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[msg.session_id]

    try:
        result = get_chat_response(session, msg.message)
    except Exception as e:
        error_msg = str(e)
        if "not available" in error_msg or "dependencies" in error_msg:
            raise HTTPException(503, f"Service temporarily unavailable: {error_msg}")
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
        error_msg = str(e)
        if "not available" in error_msg or "dependencies" in error_msg:
            raise HTTPException(503, f"Service temporarily unavailable: {error_msg}")
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


@app.post("/dispute/preview")
async def dispute_preview(req: DisputePreviewRequest):
    if req.session_id not in bill_store:
        raise HTTPException(404, "Session not found")

    session = bill_store[req.session_id]
    bill_data = session["bill_data"]
    discrepancies = session["discrepancies"]
    assessment = session.get("final_assessment")

    # 1. Look up hospital info
    hospital_info = lookup_hospital(bill_data.get("provider_name"))

    # 2. Generate letter
    draft_letter = generate_dispute_letter(bill_data, discrepancies, assessment)

    # 3. Calculate savings
    total_savings = sum(d.get("potential_overcharge", 0) for d in discrepancies)

    # 4. Summary of issues
    issues = [
        {
            "type": d["type"],
            "description": d["description"],
            "potential_overcharge": d.get("potential_overcharge", 0)
        }
        for d in discrepancies
    ]

    return {
        "hospital_name": hospital_info.get("hospital_name"),
        "hospital_address": hospital_info.get("address"),
        "hospital_email": hospital_info.get("billing_email"),
        "draft_letter": draft_letter,
        "issues": issues,
        "total_savings": total_savings
    }


@app.post("/dispute/send")
async def dispute_send(req: DisputeSendRequest):
    if req.session_id not in bill_store:
        raise HTTPException(404, "Session not found")
    
    session = bill_store[req.session_id]
    account_number = session["bill_data"].get("account_number", "Unknown")

    try:
        send_dispute_email(req.recipient_email, req.letter, account_number)
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")
