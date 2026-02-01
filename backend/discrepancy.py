


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
    from database import get_fee_info
    
    flags = []
    for i, item in enumerate(items):
        code = item.get("code")
        # Ensure code is a string and clean it up (assuming 5-digit CPT usually)
        if code:
             # Basic cleanup if code contains extra chars, though extraction should handle it.
             code = str(code).strip()
             
             ref = get_fee_info(code)
             
             if ref:
                charge = item.get("total_charge", 0)
                # If charge is 0 or None, skip
                if not charge:
                    continue
                    
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
