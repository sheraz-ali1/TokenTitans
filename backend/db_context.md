# Database Context: Physician Fee Schedule

This document describes the structure and usage of `data.db` for automated agents.

## Database File
- **Path**: `data.db` (SQLite)
- **Primary Table**: `fee_schedule`

## Table Schema: `fee_schedule`

```sql
CREATE TABLE fee_schedule (
    year TEXT,                     -- Calendar Year (e.g., "2026")
    carrier TEXT,                  -- 5-digit Carrier ID (e.g., "01112")
    locality TEXT,                 -- 2-digit Locality ID (e.g., "05")
    hcpcs TEXT,                    -- Procedure Code (e.g., "99284")
    modifier TEXT,                 -- Procedure Modifier (optional)
    non_fac_fee REAL,              -- Price in Non-Facility setting
    fac_fee REAL,                  -- Price in Facility setting
    pctc_ind TEXT,                 -- PC/TC Indicator
    status_code TEXT,              -- Status Code (A=Active, etc.)
    multi_surg_ind TEXT,           -- Multiple Surgery Indicator
    therapy_reduct_non_inst REAL,  -- Therapy Reduction (Non-Inst)
    therapy_reduct_inst REAL,      -- Therapy Reduction (Inst)
    opps_ind TEXT,                 -- OPPS Indicator
    opps_non_fac_fee REAL,         -- OPPS Non-Facility Fee
    opps_fac_fee REAL              -- OPPS Facility Fee
);
```

## Common Queries

### Get Price for Procedure
```sql
SELECT non_fac_fee, fac_fee 
FROM fee_schedule 
WHERE hcpcs = '99284' 
  AND carrier = '01112' 
  AND locality = '05';
```

### Search by Partial Code
```sql
SELECT * FROM fee_schedule 
WHERE hcpcs LIKE '99%' 
LIMIT 5;
```

## Files for Context
- `PF26PAR.pdf`: Original schema definition.
- `schema_dump.txt`: Text extraction of the PDF.
