# Walkthrough: Physician Fee Schedule DB & App

I have converted the text-based fee schedule into a SQLite database and created a web application to query it.

## Database Conversion
- **Input**: `PFALL26AR.txt` (136MB, ~1 million rows)
- **Schema**: Extracted from `PF26PAR.pdf`.
- **Output**: `data.db` (SQLite)
- **Table**: `fee_schedule`

### Schema Mapping
| CSV Column | DB Column | Description |
|---|---|---|
| 0 | `year` | Calendar Year |
| 1 | `carrier` | Carrier Number |
| 2 | `locality` | Bundled? |
| 3 | `hcpcs` | Procedure Code |
| 4 | `modifier` | Modifier |
| 5 | `non_fac_fee` | Non-Facility Fee |
| 6 | `fac_fee` | Facility Fee |
... and others including OPPS and Therapy Reductions.

## Web Application
- **File**: `app.py` (Flask)
- **Interface**: `templates/index.html`
- **Features**:
    - **HCPCS Search**: Look up prices by procedure code.
    - **Locality Filter**: Refine results by Carrier and Locality ID to see specific regional pricing.

### How to Run
1. **Activate Environment**:
   ```bash
   source venv/bin/activate
   ```
2. **Run App**:
   ```bash
   python app.py
   ```
3. **Open Browser**:
   Navigate to `http://127.0.0.1:8080/`

## Verification
- **Database**: Populated with 1,035,391 rows.
- **Server**: Verified startup on port 8080.
- **Filtering**: Verified that searching for `99284` with locality `05` correctly filters the results.
