# Implementation Plan: Code Blue — Emergency Operations & Patient Flow Analytics (v2)

## Tech Stack

- **Frontend:** React + Recharts + D3 (for Sankey & calendar heatmap)
- **Backend:** FastAPI
- **Database:** Supabase (PostgreSQL)
- **Component library:** shadcn/ui
- **Additional libraries:** `d3-sankey`, `react-calendar-heatmap`, `react-simple-maps` (choropleth)

---

## Theme & Design Tokens

A custom dark mode layout with a professional healthcare palette.

- **Background:** Deep Navy `#0A0E1A`
- **Card surface:** Solid Slate `#131926` with `0.5px` semi-transparent borders (no glassmorphism — solid surfaces only for data legibility)
- **NHS primary / info:** Electric Cyan `#0EA5E9`
- **Warning / outlier:** Crimson Red `#EF4444`
- **Private sector:** Indigo Purple `#6366F1`
- **Neutral baseline / target lines:** Slate Grey `#64748B`
- **Positive / benchmark met:** Mint Green `#10B981`
- **Typography:** Inter (Google Fonts)
- **Transitions:** `duration-300 ease-out` for hover states, tab shifts, and chart renders

---

## Global Navigation & Filter Ribbon

Every page features a top-floating unified executive navigation bar containing:

- **Dashboard title:** CODE BLUE: Emergency Operations & Patient Flow Analytics
- **Global KPI ribbon** (4 cards):
  - Total Visits: 9,994 (with YoY trend indicator)
  - Readmission Rate: 17.04% (red alarm — +6.04pp above NHS 11% benchmark)
  - Avg Wait Time: 61.4 min
  - Staff Burnout Index: 0.59 average
- **Filter dropdowns:** Region and NHS/Private Trust Type — passed as query params to FastAPI (not client-side filtered)
- **Skeleton loaders:** All chart panels display skeleton states while API calls are in flight

---

## Architecture Notes

- Supabase holds raw tables as imported from the Excel file
- FastAPI handles all aggregations (monthly rollups, per-hospital groupings, burnout averages) — raw rows are never sent to the frontend
- Global filters pass as query params to every FastAPI endpoint
- React renders only what FastAPI returns

---

## Page 1: Data Overview & System Health

**Core message:** Establishes the clinical and operational baseline landscape across all 11 hospitals — patient volumes, physical capacity, and temporal pressure patterns.

### Layout

**Top row — 4 KPI cards:**
Total Visits · Readmission Rate (vs target) · Avg Wait Time · Total Bed Capacity

**Middle row — 60/40 split:**

| Panel | Chart | Description |
|---|---|---|
| Left (60%) | Area chart — visits over time | Monthly patient volume across the full date range. Highlights seasonal spikes (winter flu peaks). |
| Right (40%) | Treemap — visit volume by hospital + department | Replaces the flat horizontal bar chart. Block size = hospital visit total; inner tiles = department breakdown. Shows two levels of hierarchy at once. |

**Bottom row — full width, 2 panels:**

| Panel | Chart | Description |
|---|---|---|
| Left (50%) | Calendar heatmap — daily visit intensity | Day-level visit count across the full year, coloured by intensity. Reveals weekend dips, holiday spikes, and day-of-week patterns that monthly rollups hide. |
| Right (50%) | Radial / polar chart — arrivals by hour of day | 24-hour ring showing which hours see the most arrivals. Exposes hidden overnight pressure and peak shift windows. |

**Data sources:** `Fact_Patient_Visits[Arrival_DateTime]`, `Dim_Hospital[Total_Beds, ICU_Beds]`, `Dim_Department[Department_Name]`

---

## Page 2: The Outlier Crisis — H07 Sandwell General

**Core message:** Spotlights the 17.04% global readmission rate and isolates Sandwell General (H07) as the critical failure anchor — highest readmission rate (21.8%), CRITICAL staffing stress, and a deteriorating operational trajectory.

### Layout

**Interactive control header:**
- YoY toggle/slider: animates between H1 and H2 of the year, shifting bubble positions in the scatter plot to show how the crisis evolved over time

**Top row — 60/40 split:**

| Panel | Chart | Description |
|---|---|---|
| Left (60%) | Scatter plot — readmission rate vs staffing stress | All 11 hospitals plotted. H07 sits in the top-right "Danger Zone" in Warning Red. Quadrant lines mark NHS readmission target (11%) and burnout threshold. |
| Right (40%) | Bump chart — hospital readmission rankings over time | Replaces the single-hospital line chart. Shows how every hospital's readmission rank changed month-to-month. H07 visibly sinks while others hold or improve. Far more dramatic than a single trend line. |

**Bottom row — full width, 2 panels:**

| Panel | Chart | Description |
|---|---|---|
| Left (55%) | Sankey diagram — H07 patient flow | `Admission Type → Severity Level → Outcome`. Visually exposes how many Emergency + Critical patients flow into Readmission and AMA outcomes. No other chart type tells this story. Built with `d3-sankey`. |
| Right (45%) | Heatmap — severity × day of week (H07) | Grid of Severity (rows) vs Day of Week (columns), coloured by avg wait time. Reveals whether H07's crisis is concentrated on specific day/severity combinations. |

**Data sources:** `Fact_Patient_Visits`, `Fact_Staffing[Burnout_Risk_Index]`, `Dim_Hospital`

---

## Page 3: The Sector Divide Paradox — NHS vs Private

**Core message:** Debunks the assumption that private hospitals provide faster patient flow. Nuffield Health (H02) and Spire Manchester (H08) maintain low staff stress yet suffer from some of the highest average wait times in the network (107 min peak).

### Layout

**Top row — full width:**

| Panel | Chart | Description |
|---|---|---|
| Full width | Radar chart — hospital performance profile | Each hospital plotted across 6 axes: Wait Time, Satisfaction, Burnout, Readmission, Profit Margin, ICU Rate. NHS vs Private hospitals show completely different profile shapes. Two overlaid traces (NHS average vs Private average) tell the sector story at a glance. |

**Middle row — 50/50 split:**

| Panel | Chart | Description |
|---|---|---|
| Left (50%) | Diverging bar — wait time vs NHS benchmark | Replaces half of the original dual-axis chart. Each hospital bar extends left (below target) or right (above). Private hospitals exceeding the target despite low burnout become immediately visible as paradoxical. |
| Right (50%) | UK choropleth map — regional performance | UK regions coloured by avg readmission rate. Shows whether the crisis is geographically concentrated or systemic across the network. Built with `react-simple-maps` using `Dim_Region` coordinates. |

**Bottom row — full width:**

| Panel | Chart | Description |
|---|---|---|
| Full width | Sortable data table | Dense comparison ledger: facility type, bed count, wait times, staffing stress, satisfaction, profit margin. Search + sort via shadcn/ui. This is the reference layer — the visual argument is made above it. |

**Data sources:** `Dim_Hospital[NHS_Trust_Type, Latitude, Longitude]`, `Fact_Patient_Visits`, `Fact_Financials`, `Dim_Region`

---

## Page 4: Burnout & Financial Squeeze

**Core message:** All 11 hospitals cluster within a narrow burnout corridor (0.585–0.639). Bristol Royal (H11) is the worst-case anchor — peak burnout index meets a 14.2% profit margin, the lowest in the network.

### Layout

**Top row — 50/50 split:**

| Panel | Chart | Description |
|---|---|---|
| Left (50%) | Bubble chart — burnout index vs profit margin | Monthly financial records. X-axis = burnout index, Y-axis = profit margin. Shaded diagonal band = the systemic burnout corridor. Bristol Royal (H11) isolated at bottom-right. Bubble size = visit volume (adds a third dimension vs the original plan). |
| Right (50%) | Waterfall chart — revenue to net margin bridge | Start from total revenue, subtract staffing cost, operational cost, overtime premium, arriving at net margin per hospital. Shows exactly where money is leaking — far more actionable for a CFO than a trend line. |

**Middle row — full width:**

| Panel | Chart | Description |
|---|---|---|
| Full width | Stacked bar + line — staff absence & overtime | Monthly absence count stacked by hospital (coloured by department type), with overtime hours overlaid as a line. Shows whether absences drive overtime or vice versa — the chicken-and-egg of burnout. |

**Bottom row — 50/50 split:**

| Panel | Chart | Description |
|---|---|---|
| Left (50%) | Slope chart — satisfaction vs burnout (H1 → H2) | Replaces the dual trend line. Two vertical axes representing H1 and H2 of the year. Each hospital is a line connecting its two data points. Hospitals where burnout rose AND satisfaction fell slope down-right — visually damning. |
| Right (50%) | CFO recommendation panel | Dynamic callout card driven by actual data. Flags hospitals where current trajectory crosses critical thresholds (e.g. burnout > 0.63 or margin < 15%). Not static copy. |

**Data sources:** `Fact_Financials[Revenue, Operational_Cost, Profit_Margin]`, `Fact_Staffing[Burnout_Risk_Index, Staff_Absence_Count, Overtime_Hours]`

---

## Chart Library Reference

| Chart type | Library | Page |
|---|---|---|
| Area, bar, scatter, radar, bubble, slope, waterfall, stacked bar | Recharts | All |
| Sankey diagram | `d3-sankey` | Page 2 |
| Calendar heatmap | `react-calendar-heatmap` | Page 1 |
| Choropleth map | `react-simple-maps` | Page 3 |
| Treemap | Recharts `Treemap` component | Page 1 |
| Sortable data table | shadcn/ui `DataTable` | Page 3 |

---

## Verification Plan

### Automated checks
- **Responsive scaling:** Layouts hold from 1920×1080 down to 1366×768 without overlap
- **Component rendering:** All Recharts + D3 components render correctly from FastAPI payloads without runtime errors
- **Filter propagation:** Region and Trust Type dropdowns pass query params to FastAPI and all charts on the active page update accordingly

### Manual checks
- Navigate all four pages and verify cross-page filter state persists via global ribbon
- Test YoY toggle on Page 2 — scatter plot bubble positions animate smoothly
- Test Sankey on Page 2 at multiple filter states (region, trust type)
- Verify skeleton loaders appear on all chart panels during API calls
- Confirm CFO panel on Page 4 reflects live data thresholds, not hardcoded copy
