import sqlite3
import os
import json
from typing import Optional, Dict

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")
REFERENCE_PRICES_PATH = os.path.join(os.path.dirname(__file__), "reference_prices.json")

# Load reference prices from JSON as fallback
_reference_prices_cache = None

def _load_reference_prices_json():
    """Load reference prices from JSON file."""
    global _reference_prices_cache
    if _reference_prices_cache is None:
        try:
            if os.path.exists(REFERENCE_PRICES_PATH):
                with open(REFERENCE_PRICES_PATH, 'r') as f:
                    _reference_prices_cache = json.load(f)
            else:
                _reference_prices_cache = {}
        except Exception as e:
            print(f"Error loading reference_prices.json: {e}")
            _reference_prices_cache = {}
    return _reference_prices_cache

def get_db_connection():
    """Establish a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_fee_info(code: str) -> Optional[Dict]:
    """
    Retrieve fee information for a specific HCPCS code.
    First tries data.db, then falls back to reference_prices.json.
    Returns a dictionary with 'avg_price' and 'high_price' if found, else None.
    
    Args:
        code: HCPCS procedure code (e.g., "99284")
    
    Returns:
        Dictionary with avg_price and high_price, or None if not found
    """
    # Try database first
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if fee_schedule table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='fee_schedule'")
        table_exists = cursor.fetchone() is not None
        
        if table_exists:
            # We'll consider both non-facility and facility fees.
            # Some rows might have 0.0 for one or the other, so we exclude 0s to get real prices.
            query = """
                SELECT 
                    MIN(NULLIF(non_fac_fee, 0)) as min_non_fac,
                    MAX(non_fac_fee) as max_non_fac,
                    AVG(NULLIF(non_fac_fee, 0)) as avg_non_fac,
                    MIN(NULLIF(fac_fee, 0)) as min_fac,
                    MAX(fac_fee) as max_fac,
                    AVG(NULLIF(fac_fee, 0)) as avg_fac
                FROM fee_schedule
                WHERE hcpcs = ?
            """
            
            cursor.execute(query, (code,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                # Collect all valid price points to determine overall range
                # Handle None values and 0 values properly
                prices = []
                if row["min_non_fac"] is not None and row["min_non_fac"] > 0:
                    prices.append(row["min_non_fac"])
                if row["max_non_fac"] is not None and row["max_non_fac"] > 0:
                    prices.append(row["max_non_fac"])
                if row["min_fac"] is not None and row["min_fac"] > 0:
                    prices.append(row["min_fac"])
                if row["max_fac"] is not None and row["max_fac"] > 0:
                    prices.append(row["max_fac"])
                
                if not prices:
                    # Try to use averages if min/max are not available
                    if row["avg_non_fac"] is not None and row["avg_non_fac"] > 0:
                        prices.append(row["avg_non_fac"])
                    if row["avg_fac"] is not None and row["avg_fac"] > 0:
                        prices.append(row["avg_fac"])
                
                if prices:
                    # Heuristic: 
                    # High Price = The absolute maximum observed fee (facility or non-facility) across all regions.
                    # Avg Price = A blended average of facility and non-facility averages.
                    
                    high_price = max(prices)
                    
                    # Calculate a simple average of the averages if available
                    avgs = []
                    if row["avg_non_fac"] is not None and row["avg_non_fac"] > 0:
                        avgs.append(row["avg_non_fac"])
                    if row["avg_fac"] is not None and row["avg_fac"] > 0:
                        avgs.append(row["avg_fac"])
                    
                    avg_price = sum(avgs) / len(avgs) if avgs else high_price
                    
                    # Ensure we have valid prices
                    if avg_price > 0 and high_price > 0:
                        return {
                            "description": "Medical Service",
                            "avg_price": round(avg_price, 2),
                            "high_price": round(high_price, 2)
                        }
        else:
            conn.close()
    except Exception as e:
        # Log error but continue to fallback
        print(f"Error querying data.db for code {code}: {e}")
    
    # Fallback to JSON file
    try:
        ref_prices = _load_reference_prices_json()
        if code in ref_prices:
            ref_data = ref_prices[code]
            return {
                "description": ref_data.get("description", "Medical Service"),
                "avg_price": float(ref_data.get("avg_price", 0)),
                "high_price": float(ref_data.get("high_price", 0))
            }
    except Exception as e:
        print(f"Error loading from reference_prices.json for code {code}: {e}")
    
    return None
