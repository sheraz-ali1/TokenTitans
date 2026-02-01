def lookup_hospital(provider_name: str) -> dict:
    """Return hospital info from bill data (no web search for now)."""
    
    return {
        "hospital_name": provider_name or "Unknown Provider",
        "address": "",
        "billing_email": "",
        "billing_phone": ""
    }
