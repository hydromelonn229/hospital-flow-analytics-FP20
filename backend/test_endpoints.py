import urllib.request
import json
import time
import sys

# Ensure stdout prints properly on Windows terminal cp1252/UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

# List of all 12+ highly specialized endpoints from our v2 design
endpoints = [
    "/",
    "/api/v1/overview/kpis",
    "/api/v1/overview/visits-over-time",
    "/api/v1/overview/visits-treemap",
    "/api/v1/overview/daily-heatmap",
    "/api/v1/overview/hourly-arrivals",
    "/api/v1/hospitals/outliers?period=H1",
    "/api/v1/hospitals/bump-rankings",
    "/api/v1/hospitals/H07/sankey-flow",
    "/api/v1/hospitals/H07/severity-weekday-wait",
    "/api/v1/analytics/radar-profiles",
    "/api/v1/analytics/diverging-wait",
    "/api/v1/analytics/regional-choropleth",
    "/api/v1/analytics/burnout-financials",
    "/api/v1/analytics/financial-waterfall",
    "/api/v1/analytics/absences-overtime",
    "/api/v1/analytics/satisfaction-burnout-slope",
    "/api/v1/analytics/cfo-alerts"
]

print("==============================================================")
print("🚀 STARTING E2E INTEGRATION CHECKS FOR ALL 12+ V2 API ENDPOINTS 🚀")
print("==============================================================")
print("Waiting 3 seconds to ensure Uvicorn backend loop is online...\n")
time.sleep(3)

failed = False

for endpoint in endpoints:
    url = f"{BASE_URL}{endpoint}"
    print(f"HTTP GET -> {url}")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            payload = json.loads(body)
            
            print(f"  [STATUS] {status} OK")
            
            # Print specific structures to verify their D3 / Recharts compatibility
            if endpoint == "/":
                print(f"  [RESULT] Status: {payload['status']} | App Name: {payload['project']}")
            elif endpoint == "/api/v1/overview/kpis":
                print(f"  [RESULT] KPIs: Visits={payload['total_visits']} | Readmit={payload['readmission_rate']}% | Wait={payload['avg_wait_time']} mins | Burnout={payload['avg_burnout_index']}")
            elif "visits-over-time" in endpoint:
                print(f"  [RESULT] Area Trend: Loaded {len(payload)} monthly slots. Sample: {payload[0]}")
            elif "visits-treemap" in endpoint:
                print(f"  [RESULT] Treemap Hierarchy: Loaded {len(payload)} hospital parent folders. Sample: {payload[0]['name']} has {len(payload[0]['children'])} department elements.")
            elif "daily-heatmap" in endpoint:
                print(f"  [RESULT] Calendar Heatmap: Loaded {len(payload)} day-level nodes. Sample: {payload[0]}")
            elif "hourly-arrivals" in endpoint:
                print(f"  [RESULT] Polar Hourly arrivals: Loaded {len(payload)} hour nodes. Peak check: {payload[0]}")
            elif "outliers?period=H1" in endpoint:
                print(f"  [RESULT] YoY Slider outliers: Loaded {len(payload)} rows. Sandwell H07 Check: {next((h for h in payload if h['hospital_id'] == 'H07'), {}).get('hospital_name')}")
            elif "bump-rankings" in endpoint:
                print(f"  [RESULT] Bump Chart partitions: Loaded {len(payload)} ranking items. Sample: Month={payload[0]['month']} Hospital={payload[0]['hospital_name']} Rank={payload[0]['rank']}")
            elif "sankey-flow" in endpoint:
                print(f"  [RESULT] Sankey Structure: nodes_count={len(payload['nodes'])} | links_count={len(payload['links'])} | Link Sample: {payload['links'][0]}")
            elif "severity-weekday-wait" in endpoint:
                print(f"  [RESULT] Heatmap Grid: Loaded {len(payload)} cells. Cell sample: Severity={payload[0]['severity']} | Weekday={payload[0]['weekday']} | Wait={payload[0]['avg_wait']} mins")
            elif "radar-profiles" in endpoint:
                print(f"  [RESULT] Radar Performance Matrix: Loaded {len(payload)} axes. Axis sample: {payload[0]}")
            elif "diverging-wait" in endpoint:
                print(f"  [RESULT] Diverging comparison: Loaded {len(payload)} rows. Sample divergence: {payload[0]['hospital_name']} has {payload[0]['divergence']} mins shift")
            elif "regional-choropleth" in endpoint:
                print(f"  [RESULT] Choropleth map: Loaded {len(payload)} UK regions. Sample: {payload[0]}")
            elif "burnout-financials" in endpoint:
                print(f"  [RESULT] Finance bubble: Loaded {len(payload)} monthly bubble nodes. Sample bubble volume size: {payload[0]['visit_count']} visits")
            elif "financial-waterfall" in endpoint:
                print(f"  [RESULT] Finance waterfall bridge: Loaded {len(payload)} stages. Bridge stages: {[s['name'] for s in payload]}")
            elif "absences-overtime" in endpoint:
                print(f"  [RESULT] Absences/Overtime correlation: Loaded {len(payload)} monthly nodes. Sample: {payload[0]}")
            elif "satisfaction-burnout-slope" in endpoint:
                print(f"  [RESULT] Burnout monthly trend: Loaded {len(payload)} month/hospital records. Sample: {payload[0]['hospital_name']} (Month {payload[0]['month']} Burnout: {payload[0]['burnout']})")
            elif "cfo-alerts" in endpoint:
                print(f"  [RESULT] Dynamic CFO Anomaly Panel: Triggered {len(payload)} dynamic threshold alerts. Anomaly sample: {payload[0]['hospital_name'] if len(payload) > 0 else 'None'} -> {payload[0]['message'] if len(payload) > 0 else 'All parameters within normal thresholds.'}")
            print("-" * 70)
            
    except Exception as e:
        print(f"  [ERROR] Request failed: {e}")
        print("-" * 70)
        failed = True

if failed:
    print("\n❌ v2 API Integration tests failed. Please verify database availability or SQL syntax errors.")
    sys.exit(1)
else:
    print("\n✨ SUCCESS! All 12+ specialized v2 analytical endpoints verified cleanly with 200 OK payloads! Ready for React! ✨")
    sys.exit(0)
