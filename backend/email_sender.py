import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional

try:
    import resend
    resend.api_key = os.getenv("RESEND_API_KEY")
except ImportError:
    resend = None  # resend is optional


def send_dispute_email(recipient_email: str, letter: str, account_number: str = "Unknown"):
    """Send dispute email via Resend."""
    
    if resend is None:
        raise ImportError("resend package not installed. Please install it with: pip install resend")
    
    if not resend.api_key:
        raise ValueError("RESEND_API_KEY not set")

    try:
        params = {
            "from": "MedBill Analyzer <onboarding@resend.dev>",
            "to": [recipient_email],
            "subject": f"Formal Billing Dispute - Account #{account_number}",
            "text": letter,
            "html": f"<div style='font-family: sans-serif; white-space: pre-wrap;'>{letter}</div>"
        }
        
        email = resend.Emails.send(params)
        return email
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise e
