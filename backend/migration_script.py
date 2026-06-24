import os
import sys
import time
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Reconfigure stdout to use UTF-8 on Windows consoles to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Load environment variables from .env file
load_dotenv()

# Excel file path (relative to the script location)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "Code Blue — Emergency Operations & Patient Flow Analytics_C38.xlsx"))

# Database connection URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

# Clean column names to make them standard PostgreSQL compatible (lowercase, snake_case)
def clean_column_name(col):
    col_str = str(col).strip()
    # Replace special characters and spaces with underscores
    col_str = col_str.replace(" ", "_").replace("-", "_").replace(".", "_").replace("·", "_").replace("/", "_")
    # Make lowercase
    col_str = col_str.lower()
    # Remove duplicate underscores
    while "__" in col_str:
        col_str = col_str.replace("__", "_")
    # Remove leading/trailing underscores
    return col_str.strip("_")

def load_and_clean_sheets():
    print(f"Reading Excel workbook from: {EXCEL_FILE}")
    if not os.path.exists(EXCEL_FILE):
        raise FileNotFoundError(f"Source Excel file not found at: {EXCEL_FILE}")
        
    xls = pd.ExcelFile(EXCEL_FILE)
    print("Sheets found in workbook:", xls.sheet_names)
    
    data_dict = {}
    
    # 1. Dim_Region
    print("Processing Dim_Region...")
    df_region = pd.read_excel(xls, "Dim_Region")
    df_region.columns = [clean_column_name(c) for c in df_region.columns]
    data_dict["dim_region"] = df_region
    
    # 2. Dim_Hospital
    print("Processing Dim_Hospital...")
    df_hospital = pd.read_excel(xls, "Dim_Hospital")
    df_hospital.columns = [clean_column_name(c) for c in df_hospital.columns]
    # Enforce boolean types
    df_hospital["teaching_hospital"] = df_hospital["teaching_hospital"].astype(bool)
    df_hospital["private"] = df_hospital["private"].astype(bool)
    data_dict["dim_hospital"] = df_hospital
    
    # 3. Dim_Department
    print("Processing Dim_Department...")
    df_dept = pd.read_excel(xls, "Dim_Department")
    df_dept.columns = [clean_column_name(c) for c in df_dept.columns]
    df_dept["icu_capable"] = df_dept["icu_capable"].astype(bool)
    data_dict["dim_department"] = df_dept
    
    # 4. Dim_Date
    print("Processing Dim_Date...")
    df_date = pd.read_excel(xls, "Dim_Date")
    df_date.columns = [clean_column_name(c) for c in df_date.columns]
    # Standardize Full_Date to real date objects
    df_date["full_date"] = pd.to_datetime(df_date["full_date"]).dt.date
    # Enforce booleans
    for bool_col in ["is_weekend", "is_holiday", "is_winter", "is_flu_season"]:
        df_date[bool_col] = df_date[bool_col].astype(bool)
    data_dict["dim_date"] = df_date
    
    # 5. Dim_Patient
    print("Processing Dim_Patient...")
    df_patient = pd.read_excel(xls, "Dim_Patient")
    df_patient.columns = [clean_column_name(c) for c in df_patient.columns]
    data_dict["dim_patient"] = df_patient
    
    # 6. Dim_Doctor
    print("Processing Dim_Doctor...")
    df_doc = pd.read_excel(xls, "Dim_Doctor")
    df_doc.columns = [clean_column_name(c) for c in df_doc.columns]
    df_doc["part_time_flag"] = df_doc["part_time_flag"].astype(bool)
    data_dict["dim_doctor"] = df_doc
    
    # 7. Dim_Diagnosis
    print("Processing Dim_Diagnosis...")
    df_diag = pd.read_excel(xls, "Dim_Diagnosis")
    df_diag.columns = [clean_column_name(c) for c in df_diag.columns]
    data_dict["dim_diagnosis"] = df_diag
    
    # 8. Fact_Patient_Visits (Relational Normalization: Drop denormalized columns)
    print("Processing Fact_Patient_Visits...")
    df_visits = pd.read_excel(xls, "Fact_Patient_Visits")
    df_visits.columns = [clean_column_name(c) for c in df_visits.columns]
    # Convert timestamps
    for date_col in ["arrival_datetime", "triage_datetime", "treatment_start_datetime", "discharge_datetime"]:
        df_visits[date_col] = pd.to_datetime(df_visits[date_col], errors="coerce")
    # Enforce booleans
    for bool_col in ["icu_required_flag", "mortality_flag", "readmission_30_days_flag", "complaint_flag", "ambulance_arrival_flag"]:
        df_visits[bool_col] = df_visits[bool_col].astype(bool)
    # RENAME diagnosis_category to avoid conflict, matching the standard naming
    # Normalize: Drop redundant columns already in dim_hospital
    df_visits = df_visits.drop(columns=["hospital_name", "latitude", "longitude"], errors="ignore")
    data_dict["fact_patient_visits"] = df_visits
    
    # 9. Fact_Staffing (Relational Normalization: Drop denormalized columns)
    print("Processing Fact_Staffing...")
    df_staffing = pd.read_excel(xls, "Fact_Staffing")
    df_staffing.columns = [clean_column_name(c) for c in df_staffing.columns]
    df_staffing["shift_date"] = pd.to_datetime(df_staffing["shift_date"]).dt.date
    # Normalize: Drop redundant columns already in dim_hospital
    df_staffing = df_staffing.drop(columns=["hospital_name", "latitude", "longitude"], errors="ignore")
    data_dict["fact_staffing"] = df_staffing
    
    # 10. Fact_Financials (Relational Normalization: Drop denormalized columns)
    print("Processing Fact_Financials...")
    df_financials = pd.read_excel(xls, "Fact_Financials")
    df_financials.columns = [clean_column_name(c) for c in df_financials.columns]
    df_financials["expansion_projects_flag"] = df_financials["expansion_projects_flag"].astype(bool)
    # Normalize: Drop redundant columns already in dim_hospital
    df_financials = df_financials.drop(columns=["hospital_name", "latitude", "longitude"], errors="ignore")
    data_dict["fact_financials"] = df_financials
    
    # 11. Vocabulary (Data Dictionary mapping)
    print("Processing Vocabulary...")
    df_vocab = pd.read_excel(xls, "Vocabulary")
    # Drop first row because it contains standard column headers
    if "Unnamed: 1" in df_vocab.columns or df_vocab.iloc[0, 0] == "Table":
        df_vocab = df_vocab.iloc[1:]
    
    df_vocab.columns = ["table_name", "column_name", "data_type", "description", "uk_context", "notes"]
    df_vocab = df_vocab.dropna(subset=["table_name", "column_name"])
    
    # Clean the textual elements
    df_vocab["table_name"] = df_vocab["table_name"].apply(clean_column_name)
    df_vocab["column_name"] = df_vocab["column_name"].apply(clean_column_name)
    data_dict["data_dictionary"] = df_vocab
    
    print("All sheets successfully parsed and normalized in-memory!")
    return data_dict

def migrate_to_database(data_dict):
    if not DATABASE_URL:
        print("\n[ERROR] DATABASE_URL environment variable is missing or empty.")
        print("Please configure it in a .env file under hospital-flow-analytics/backend/ in this format:")
        print("DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres\n")
        return False
        
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    # Order matters: Dimensions must be loaded first due to relational constraints
    tables_order = [
        "dim_region",
        "dim_hospital",
        "dim_department",
        "dim_date",
        "dim_patient",
        "dim_doctor",
        "dim_diagnosis",
        "fact_patient_visits",
        "fact_staffing",
        "fact_financials",
        "data_dictionary"
    ]
    
    start_time = time.time()
    
    with engine.begin() as conn:
        print("\n--- Phase 1: Uploading Cleaned Data Tables ---")
        for table_name in tables_order:
            df = data_dict[table_name]
            print(f"Uploading {table_name} ({len(df)} rows)...")
            # Drop existing tables cleanly to allow clean rebuilds
            df.to_sql(table_name, conn, if_exists="replace", index=False)
            print(f"[OK] Table {table_name} uploaded successfully.")
            
        print("\n--- Phase 2: Enforcing Relational Constraints (DDL) ---")
        
        # 1. Primary Keys
        print("Setting Primary Keys...")
        conn.execute(text("ALTER TABLE dim_region ADD PRIMARY KEY (region_id);"))
        conn.execute(text("ALTER TABLE dim_hospital ADD PRIMARY KEY (hospital_id);"))
        conn.execute(text("ALTER TABLE dim_department ADD PRIMARY KEY (department_id);"))
        conn.execute(text("ALTER TABLE dim_date ADD PRIMARY KEY (date_key);"))
        conn.execute(text("ALTER TABLE dim_patient ADD PRIMARY KEY (patient_id);"))
        conn.execute(text("ALTER TABLE dim_doctor ADD PRIMARY KEY (doctor_id);"))
        conn.execute(text("ALTER TABLE dim_diagnosis ADD PRIMARY KEY (diagnosis_id);"))
        
        conn.execute(text("ALTER TABLE fact_patient_visits ADD PRIMARY KEY (visit_id);"))
        conn.execute(text("ALTER TABLE fact_staffing ADD PRIMARY KEY (shift_id);"))
        conn.execute(text("ALTER TABLE fact_financials ADD PRIMARY KEY (financial_record_id);"))
        
        # Unique constraints required for FK references
        conn.execute(text("ALTER TABLE dim_date ADD CONSTRAINT uq_date_full UNIQUE (full_date);"))
        
        # 2. Foreign Keys
        print("Enforcing Foreign Key Constraints...")
        conn.execute(text("ALTER TABLE dim_hospital ADD CONSTRAINT fk_hospital_region FOREIGN KEY (region_id) REFERENCES dim_region(region_id);"))
        conn.execute(text("ALTER TABLE dim_doctor ADD CONSTRAINT fk_doctor_hospital FOREIGN KEY (primary_hospital_id) REFERENCES dim_hospital(hospital_id);"))
        
        conn.execute(text("ALTER TABLE fact_patient_visits ADD CONSTRAINT fk_visits_patient FOREIGN KEY (patient_id) REFERENCES dim_patient(patient_id);"))
        conn.execute(text("ALTER TABLE fact_patient_visits ADD CONSTRAINT fk_visits_hospital FOREIGN KEY (hospital_id) REFERENCES dim_hospital(hospital_id);"))
        conn.execute(text("ALTER TABLE fact_patient_visits ADD CONSTRAINT fk_visits_department FOREIGN KEY (department_id) REFERENCES dim_department(department_id);"))
        conn.execute(text("ALTER TABLE fact_patient_visits ADD CONSTRAINT fk_visits_doctor FOREIGN KEY (doctor_id) REFERENCES dim_doctor(doctor_id);"))
        conn.execute(text("ALTER TABLE fact_patient_visits ADD CONSTRAINT fk_visits_diagnosis FOREIGN KEY (diagnosis_category) REFERENCES dim_diagnosis(diagnosis_id);"))
        
        conn.execute(text("ALTER TABLE fact_staffing ADD CONSTRAINT fk_staffing_hospital FOREIGN KEY (hospital_id) REFERENCES dim_hospital(hospital_id);"))
        conn.execute(text("ALTER TABLE fact_staffing ADD CONSTRAINT fk_staffing_department FOREIGN KEY (department_id) REFERENCES dim_department(department_id);"))
        conn.execute(text("ALTER TABLE fact_staffing ADD CONSTRAINT fk_staffing_date FOREIGN KEY (shift_date) REFERENCES dim_date(full_date);"))
        
        conn.execute(text("ALTER TABLE fact_financials ADD CONSTRAINT fk_financials_hospital FOREIGN KEY (hospital_id) REFERENCES dim_hospital(hospital_id);"))
        
        # 3. High Performance Indexes (for FastAPI aggregations)
        print("Creating performance indexes...")
        conn.execute(text("CREATE INDEX idx_visits_hospital ON fact_patient_visits(hospital_id);"))
        conn.execute(text("CREATE INDEX idx_visits_arrival ON fact_patient_visits(arrival_datetime);"))
        conn.execute(text("CREATE INDEX idx_visits_readmitted ON fact_patient_visits(readmission_30_days_flag);"))
        conn.execute(text("CREATE INDEX idx_staffing_hospital_date ON fact_staffing(hospital_id, shift_date);"))
        conn.execute(text("CREATE INDEX idx_financials_hospital ON fact_financials(hospital_id);"))
        
        print("[OK] Constraints & performance indexes generated successfully!")
        
        print("\n--- Phase 3: Post-Migration Integrity Checks ---")
        
        # Row counts validation
        print("Validating row counts...")
        res_v = conn.execute(text("SELECT COUNT(*) FROM fact_patient_visits;")).scalar()
        res_s = conn.execute(text("SELECT COUNT(*) FROM fact_staffing;")).scalar()
        res_f = conn.execute(text("SELECT COUNT(*) FROM fact_financials;")).scalar()
        
        print(f"  - Visits in DB: {res_v} (Expected: 9994)")
        print(f"  - Shifts in DB: {res_s} (Expected: 9919)")
        print(f"  - Financials in DB: {res_f} (Expected: 264)")
        
        # Key analytical metric check: global readmission rate
        readmit_rate = conn.execute(text("""
            SELECT ROUND(
                (COUNT(CASE WHEN readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*),
                2
            ) AS rate FROM fact_patient_visits;
        """)).scalar()
        print(f"  - Calculated global 30-day readmission rate: {readmit_rate}% (Expected benchmark: ~17%)")

    elapsed_time = time.time() - start_time
    print(f"\n[FINISHED] Migration fully completed in {elapsed_time:.2f} seconds!")
    return True

if __name__ == "__main__":
    try:
        data = load_and_clean_sheets()
        success = migrate_to_database(data)
        if success:
            print("\n[SUCCESS] Relational hospital database successfully migrated and indexed on Supabase PostgreSQL!")
        else:
            print("\n[WARNING] Migration aborted or failed. Please check instructions above.")
    except Exception as e:
        print(f"\n[ERROR] Critical migration failure: {e}")
        import traceback
        traceback.print_exc()
