# Code Blue: Emergency Operations & Patient Flow Analytics
## Executive Dashboard & Clinical Intelligence Portal

Code Blue is a high-density clinical operations dashboard designed for healthcare executives, clinicians, and financial managers. The platform correlates patient visit data, clinician staffing stress, and institutional expenditures to expose system bottlenecks, clinician burnout patterns, and financial vulnerabilities across 11 hospital facilities.

---

## 📊 Data Source & Database Schema

The analytics engine is powered by a normalized **Supabase PostgreSQL** cloud database (hosted on AWS). The data originates from structured clinical and financial audits, mapped into a relational star schema:

### 1. Dimensional Lookup Layer
- **`dim_hospital`**: Mapped details of the 11 facilities, separating **NHS Trust / Public** facilities from **Private** hospitals.
- **`dim_region`**: UK region lookups for choropleth mapping.
- **`dim_department`**: Tracks clinical departments (Emergency, ICU, Outpatients, etc.).
- **`dim_date`**: Calendar date table to format months and weekday labels.

### 2. Transactional Fact Layer
- **`fact_patient_visits`**: Details individual patient wait times, arrival dates, severity levels (1 to 5), admission outcomes, and 30-day readmissions.
- **`fact_staffing`**: Monthly metrics tracking absence counts, overtime hours, and clinician burnout risk index.
- **`fact_financials`**: Monthly ledger detailing revenues, staffing costs, operational costs, overtime premiums, and net margins.

### 🔄 Data Migration & ETL Pipeline
Ingestion and schema normalization from the source Excel document (`Code Blue — Emergency Operations & Patient Flow Analytics_C38.xlsx`) to the PostgreSQL Supabase cloud cluster is fully automated via our Python ETL script ([migration_script.py](file:///d:/SideProjects/Heathcarte%20Analytics%20FP20/hospital-flow-analytics/backend/migration_script.py)):
- **Column Cleansing**: Normalizes headers into Postgres-compatible `snake_case` formats.
- **Relational Integrity**: Normalizes flat spreadsheet data into structured dimensions and transactional fact records.
- **Database Optimizations**: Generates primary/foreign key mappings and indexing on heavily queried search columns to guarantee sub-second dashboard performance.

---

## 🎨 Dashboard Pages & Visualizations

The React client divides analytics into four executive tabs:

### 1. Page 1: System Health & Overview
*Primary Focus: Network baseline clinical capacities and temporal volume surges.*
- **KPI Metrics**: Total Visits, Network Readmission Rate, Average Wait Time, Bed Capacity.
- **Monthly Visits Trend (Area Chart)**: Tracks patient volumes to expose seasonal pressure points.
- **Department Volumes (Treemap)**: Multi-level hierarchy displaying hospital size vs. inner-department loads.
- **Daily Heatmap (Calendar Grid)**: Plots daily patient visit counts to expose holiday and weekend spikes.
- **Arrival Distribution (Polar Chart)**: 24-hour radial clock showing arrival peaks.

### 2. Page 2: YoY Trajectory Shift
*Primary Focus: Chronological shifts between H1 (Months 1–6) and H2 (Months 7–12).*
- **YoY Scatter Plot**: Maps readmission rate against staffing stress, highlighted with quadrant lines for the NHS 11% readmission target and burnout limit.
- **Monthly Readmissions (High-Density Line Chart)**: Tracks monthly trends. Highlights the deteriorating path of H07 Sandwell General in warning red against thin baseline network lines.
- **Patient Flow Path (Sankey Diagram)**: Renders `Admission Type ➔ Severity Level ➔ Outcome` paths to isolate readmissions and AMA discharges.
- **Wait Time Matrix (Grid Heatmap)**: Crosses day-of-week with severity level average wait times to uncover capacity issues.

### 3. Page 3: Sector Divide Paradox
*Primary Focus: Comparing NHS/Public vs. Private sector performance metrics.*
- **Performance Profile (6-Axis Radar Chart)**: Overlays averages for Wait Time, Burnout, Readmissions, Satisfaction, Bed Capacity, and Profit Margins.
- **Wait Time Divergence (Diverging Bar Chart)**: Extends bars left (below target) or right (above target) relative to the 61.4-min average.
- **UK Region choropleth (Geospatial Map)**: Shakes out geographic readmission distributions.
- **Facility Reference (Sortable Table)**: Tabulates bed counts, wait times, stress indices, and margins.

### 4. Page 4: Burnout & Financial Squeeze
*Primary Focus: Clinician fatigue feedback loops and operational deficit leaks.*
- **Deficit Highlight Banner**: Red warning banner drawing immediate attention to H11 Bristol Royal.
- **Burnout vs. Profit Margin (Bubble Chart)**: Aggregated hospital averages, bubble sizes representing patient volumes.
- **Waterfall Cost Bridge**: Step-down bridge subtracting staffing, operational, and ICU costs from total revenue.
- **Absences & Overtime (Combo Bar Chart)**: Overlays monthly staff absence totals with average overtime hours.
- **12-Month Burnout Trend (Line Chart)**: Traces monthly burnout. Blurs standard lines (`opacity: 0.3`, `dots: hidden`) to isolate the critical trajectory of H11 Bristol Royal.
- **Advisory Alerts Panel**: Context-aware recommendations triggered by live database thresholds.

---

## 💡 Key Analytical Insights & Findings

### 🕵️ Finding 1: H07 Sandwell General Trajectory Shift
The YoY trajectory animation on Page 2 exposes **Sandwell General (H07)** as the system's primary operational bottleneck.
- **Burnout & Readmissions**: Sandwell sits deep inside the scatter plot's "Danger Zone," exhibiting the highest readmission rate (**21.8%**), violating the NHS 11% ceiling.
- **Wait Times Grid**: The wait times heatmap shows severe weekend delays, with wait times exceeding 85 minutes for high-severity cases on Saturday and Sunday nights, indicating weekend staffing deficits.

### 🔍 Finding 2: The Private Sector Wait Time Paradox
Page 3 debunks the assumption that private sector hospitals provide faster patient flow.
- **Wait Time Divergence**: Private facilities like **Spire Manchester (H08)** and **Nuffield Health (H02)** run long average wait times (up to 107 minutes).
- **The Paradox**: Despite these long wait times, these private hospitals maintain low clinician fatigue and high patient satisfaction. They have abundant bed capacity but choose to run at a lower throughput rate compared to high-volume NHS facilities.

### 🔴 Finding 3: H11 Bristol Royal Financial Deficit
The Page 4 metrics highlight **Bristol Royal (H11)** as the network's most critical financial risk.
- **Negative Profit Margin**: Out of all 11 hospitals, **Bristol Royal is the only facility operating with a negative profit margin** (average of **-1.5%**).
- **Vicious Cycle**: The Waterfall Bridge and Bubble chart reveal that Bristol's deficit is driven by high base staffing costs and steep overtime premium payouts to cover gaps caused by high staff burnout.

### 🔄 Finding 4: The Absence-Overtime Burnout Loop
Analyzing the Absences and Overtime combo chart reveals a clear operational dependency.
- **Vicious Cycle**: High staff absence counts directly correlate with immediate spikes in average overtime hours for the remaining staff in subsequent weeks. This indicates that staff shortages are being covered by extending shifts, which triggers further burnout and drives future absences.

### 📅 Finding 5: Seasonal Volume Swings
The Area Chart and Calendar Heatmap on Page 1 expose massive seasonal swings.
- **Winter Pressures**: Patient visit volumes surge by **35%** during the winter months (November to January) due to seasonal illnesses. This volume peak corresponds with the network-wide spike in clinician absences and wait times.

---

## ⚡ Execution & Startup Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- Active PostgreSQL Database (Supabase)

### 1. Start backend server
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
The FastAPI backend will start running on [http://127.0.0.1:8000](http://127.0.0.1:8000). Interactive Swagger documentation is available at `/docs`.

### 2. Start frontend client
```bash
cd frontend
npm install
npm run dev
```
The React development server will boot on [http://localhost:5173/](http://localhost:5173/).
