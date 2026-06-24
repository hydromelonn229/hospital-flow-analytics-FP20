from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()

# Helper function to generate dynamic SQL filters
def build_filters(region: str = None, trust_type: str = None, hospital_id: str = None):
    conditions = []
    params = {}
    if region:
        conditions.append("h.region_id = :region")
        params["region"] = region
    if trust_type:
        conditions.append("h.nhs_trust_type = :trust_type")
        params["trust_type"] = trust_type
    if hospital_id:
        conditions.append("h.hospital_id = :hospital_id")
        params["hospital_id"] = hospital_id
    
    filter_sql = ""
    if conditions:
        filter_sql = " AND " + " AND ".join(conditions)
    return filter_sql, params

# ==============================================================================
# PAGE 1: DATA OVERVIEW & SYSTEM HEALTH ENDPOINTS
# ==============================================================================

@router.get("/overview/kpis")
def get_overview_kpis(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns global operational KPIs, fully integrated with dynamic filters.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    
    # Injected subquery for filtered burnout averages
    burnout_query = f"""
        SELECT AVG(s_inner.burnout_risk_index) 
        FROM fact_staffing s_inner 
        JOIN dim_hospital h_inner ON s_inner.hospital_id = h_inner.hospital_id 
        WHERE 1=1 {filter_sql.replace('h.', 'h_inner.')}
    """
    
    query = text(f"""
        SELECT 
            COUNT(*)::int as total_visits,
            ROUND((COUNT(CASE WHEN v.readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float as readmission_rate,
            ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float as avg_wait_time,
            ROUND(({burnout_query})::numeric, 3)::float as avg_burnout_index
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
    """)
    
    try:
        result = db.execute(query, params).first()
        if not result or result.total_visits == 0:
            return {"total_visits": 0, "readmission_rate": 0.0, "avg_wait_time": 0.0, "avg_burnout_index": 0.0}
        return result._asdict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KPI aggregation error: {e}")

@router.get("/overview/visits-over-time")
def get_visits_over_time(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Area Chart: Returns monthly patient volumes over 24-month horizon.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            TO_CHAR(v.arrival_datetime, 'YYYY-MM') AS month,
            COUNT(*)::int AS visits
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY TO_CHAR(v.arrival_datetime, 'YYYY-MM')
        ORDER BY month;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Visits trend error: {e}")

@router.get("/overview/visits-treemap")
def get_visits_treemap(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Treemap hierarchy: hospital-to-department patient volume maps.
    Returns structured nested format for D3/Recharts hierarchy.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            h.hospital_name,
            d.department_name,
            COUNT(v.visit_id)::int AS visits
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        JOIN dim_department d ON v.department_id = d.department_id
        WHERE 1=1 {filter_sql}
        GROUP BY h.hospital_name, d.department_name
        ORDER BY h.hospital_name, visits DESC;
    """)
    try:
        rows = db.execute(query, params).all()
        
        # Format into tree: { name: hospital, children: [ { name: dept, value: visits } ] }
        tree_dict = {}
        for row in rows:
            h_name = row.hospital_name
            d_name = row.department_name
            val = row.visits
            
            if h_name not in tree_dict:
                tree_dict[h_name] = []
            tree_dict[h_name].append({"name": d_name, "value": val})
            
        tree_formatted = [{"name": key, "children": val} for key, val in tree_dict.items()]
        return tree_formatted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Treemap aggregation error: {e}")

@router.get("/overview/daily-heatmap")
def get_daily_heatmap(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Calendar Heatmap: Returns daily patient visit intensity counts across the calendar.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            DATE(v.arrival_datetime)::text AS date,
            COUNT(*)::int AS count
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY DATE(v.arrival_datetime)
        ORDER BY date;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Daily intensity aggregation error: {e}")

@router.get("/overview/hourly-arrivals")
def get_hourly_arrivals(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Radial Polar Ring: Exposes hourly patient arrivals.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            EXTRACT(HOUR FROM v.arrival_datetime)::int AS hour,
            COUNT(*)::int AS count
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY EXTRACT(HOUR FROM v.arrival_datetime)
        ORDER BY hour;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hourly arrivals aggregation error: {e}")

# ==============================================================================
# PAGE 2: OUTLIER CRISIS (SANDWELL H07) ENDPOINTS
# ==============================================================================

@router.get("/hospitals/outliers")
def get_hospital_outliers(
    period: str = Query(None), # Accepts 'H1' or 'H2' for YoY slider animation
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Scatter Plot: Returns readmission rates vs. staffing stress indexes.
    Supports dynamic YoY Slider animation periods.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    
    period_filter_v = ""
    period_filter_s = ""
    if period == "H1":
        period_filter_v = "AND v.month <= 6"
        period_filter_s = "AND s.month <= 6"
    elif period == "H2":
        period_filter_v = "AND v.month > 6"
        period_filter_s = "AND s.month > 6"
        
    query = text(f"""
        WITH visit_metrics AS (
            SELECT 
                v.hospital_id,
                COUNT(v.visit_id)::int as total_visits,
                ROUND((COUNT(CASE WHEN v.readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float as readmission_rate,
                ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float as avg_wait_time,
                ROUND(AVG(v.satisfaction_score)::numeric, 1)::float as avg_satisfaction
            FROM fact_patient_visits v
            WHERE 1=1 {period_filter_v}
            GROUP BY v.hospital_id
        ),
        staff_metrics AS (
            SELECT 
                s.hospital_id,
                ROUND(AVG(s.burnout_risk_index)::numeric, 3)::float as avg_burnout_index
            FROM fact_staffing s
            WHERE 1=1 {period_filter_s}
            GROUP BY s.hospital_id
        )
        SELECT 
            h.hospital_id,
            h.hospital_name,
            h.nhs_trust_type,
            h.city,
            COALESCE(v.total_visits, 0) as total_visits,
            COALESCE(v.readmission_rate, 0.0) as readmission_rate,
            COALESCE(v.avg_wait_time, 0.0) as avg_wait_time,
            COALESCE(v.avg_satisfaction, 0.0) as avg_satisfaction,
            COALESCE(s.avg_burnout_index, 0.0) as avg_burnout_index,
            h.staffing_stress
        FROM dim_hospital h
        LEFT JOIN visit_metrics v ON h.hospital_id = v.hospital_id
        LEFT JOIN staff_metrics s ON h.hospital_id = s.hospital_id
        WHERE 1=1 {filter_sql}
        ORDER BY readmission_rate DESC;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outlier aggregation error: {e}")

@router.get("/hospitals/bump-rankings")
def get_bump_rankings(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Bump Chart: Month-by-month readmission rate ranks for all 11 hospitals.
    Showcases chronological descent or stability.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        WITH monthly_rates AS (
            SELECT 
                v.month::int AS month,
                h.hospital_id,
                h.hospital_name,
                ROUND((COUNT(CASE WHEN v.readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float as readmission_rate
            FROM fact_patient_visits v
            JOIN dim_hospital h ON v.hospital_id = h.hospital_id
            WHERE 1=1 {filter_sql}
            GROUP BY v.month, h.hospital_id, h.hospital_name
        ),
        ranked_rates AS (
            SELECT 
                month,
                hospital_id,
                hospital_name,
                readmission_rate,
                DENSE_RANK() OVER (PARTITION BY month ORDER BY readmission_rate DESC)::int AS rank
            FROM monthly_rates
        )
        SELECT * FROM ranked_rates ORDER BY month, rank;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bump rankings error: {e}")

@router.get("/hospitals/{hospital_id}/sankey-flow")
def get_sankey_flow(
    hospital_id: str,
    region: str = Query(None),
    trust_type: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Sankey Diagram: Returns nodes and links mapping patient trajectories 
    from 'Admission Type -> Severity Level -> Outcome'.
    """
    filter_sql, params = build_filters(region, trust_type)
    params["hospital_id"] = hospital_id
    
    query = text(f"""
        SELECT 
            v.admission_type AS source_node,
            'Severity ' || v.severity_level AS target_node,
            COUNT(*)::int AS value
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE v.hospital_id = :hospital_id {filter_sql}
        GROUP BY v.admission_type, v.severity_level

        UNION ALL

        SELECT 
            'Severity ' || v.severity_level AS source_node,
            v.outcome AS target_node,
            COUNT(*)::int AS value
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        WHERE v.hospital_id = :hospital_id {filter_sql}
        GROUP BY v.severity_level, v.outcome;
    """)
    try:
        rows = db.execute(query, params).all()
        
        # Build unique nodes array
        unique_nodes = set()
        for r in rows:
            unique_nodes.add(r.source_node)
            unique_nodes.add(r.target_node)
            
        nodes_list = [{"name": node} for node in sorted(list(unique_nodes))]
        node_map = {node["name"]: idx for idx, node in enumerate(nodes_list)}
        
        links_list = []
        for r in rows:
            links_list.append({
                "source": node_map[r.source_node],
                "target": node_map[r.target_node],
                "value": r.value
            })
            
        return {"nodes": nodes_list, "links": links_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sankey flow construction error: {e}")

@router.get("/hospitals/{hospital_id}/severity-weekday-wait")
def get_severity_weekday_wait(
    hospital_id: str,
    region: str = Query(None),
    trust_type: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Heatmap Matrix: Severity Levels vs. Weekdays waiting averages.
    """
    filter_sql, params = build_filters(region, trust_type)
    params["hospital_id"] = hospital_id
    
    query = text(f"""
        SELECT 
            v.severity_level::int AS severity,
            d_date.day_of_week AS weekday,
            d_date.day_number::int AS day_num,
            ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float AS avg_wait
        FROM fact_patient_visits v
        JOIN dim_hospital h ON v.hospital_id = h.hospital_id
        JOIN dim_date d_date ON DATE(v.arrival_datetime) = d_date.full_date
        WHERE v.hospital_id = :hospital_id {filter_sql}
        GROUP BY v.severity_level, d_date.day_of_week, d_date.day_number
        ORDER BY severity, day_num;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heatmap grid mapping error: {e}")

# ==============================================================================
# PAGE 3: THE SECTOR DIVIDE PARADOX ENDPOINTS
# ==============================================================================

@router.get("/analytics/radar-profiles")
def get_radar_profiles(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Radar Chart: Operational performance profiles comparing Private vs. NHS sector averages.
    Axes: Wait Time, Satisfaction, Burnout, Readmission, Profit Margin, ICU Rate.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    
    query = text(f"""
        SELECT 
            h.private::boolean AS private,
            ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float AS wait_time,
            ROUND(AVG(v.satisfaction_score)::numeric, 1)::float AS satisfaction,
            ROUND(AVG(s.burnout_risk_index)::numeric, 3)::float AS burnout,
            ROUND((COUNT(CASE WHEN v.readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float AS readmission,
            ROUND(AVG(f.profit_margin)::numeric * 100.0, 1)::float AS profit_margin,
            ROUND((COUNT(CASE WHEN v.icu_required_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float AS icu_rate
        FROM dim_hospital h
        LEFT JOIN fact_patient_visits v ON h.hospital_id = v.hospital_id
        LEFT JOIN fact_staffing s ON h.hospital_id = s.hospital_id AND v.month = s.month
        LEFT JOIN fact_financials f ON h.hospital_id = f.hospital_id AND v.month = f.month
        WHERE 1=1 {filter_sql}
        GROUP BY h.private;
    """)
    try:
        rows = db.execute(query, params).all()
        
        # Construct axes for Radar: [ { subject: Axis, NHS: val, Private: val } ]
        axes_keys = [
            ("wait_time", "Wait Time (min)"),
            ("satisfaction", "Satisfaction (%)"),
            ("burnout", "Burnout Index"),
            ("readmission", "Readmissions (%)"),
            ("profit_margin", "Profit Margin (%)"),
            ("icu_rate", "ICU Admits (%)")
        ]
        
        nhs_row = next((r for r in rows if not r.private), None)
        pvt_row = next((r for r in rows if r.private), None)
        
        radar_formatted = []
        for key, name in axes_keys:
            nhs_val = getattr(nhs_row, key, 0.0) if nhs_row else 0.0
            pvt_val = getattr(pvt_row, key, 0.0) if pvt_row else 0.0
            
            radar_formatted.append({
                "subject": name,
                "NHS": nhs_val,
                "Private": pvt_val
            })
            
        return radar_formatted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Radar performance error: {e}")

@router.get("/analytics/diverging-wait")
def get_diverging_wait(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Diverging Bar Chart: Shows wait times compared to the overall network average wait.
    Exposes private clinics violating expected speed thresholds.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            h.hospital_id,
            h.hospital_name,
            h.nhs_trust_type,
            h.private::boolean AS private,
            ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float AS avg_wait_time,
            ROUND((AVG(v.wait_time_minutes) - 61.4)::numeric, 1)::float AS divergence
        FROM dim_hospital h
        LEFT JOIN fact_patient_visits v ON h.hospital_id = v.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY h.hospital_id, h.hospital_name, h.nhs_trust_type, h.private
        ORDER BY avg_wait_time DESC;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diverging waits error: {e}")

@router.get("/analytics/regional-choropleth")
def get_regional_choropleth(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    UK Choropleth Mapping: Regional operational averages.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            r.region_id,
            r.region_name,
            ROUND((COUNT(CASE WHEN v.readmission_30_days_flag = TRUE THEN 1 END) * 100.0) / COUNT(*), 2)::float AS readmission_rate,
            ROUND(AVG(v.wait_time_minutes)::numeric, 1)::float AS avg_wait_time,
            ROUND(AVG(s.burnout_risk_index)::numeric, 3)::float AS avg_burnout
        FROM dim_region r
        JOIN dim_hospital h ON r.region_id = h.region_id
        LEFT JOIN fact_patient_visits v ON h.hospital_id = v.hospital_id
        LEFT JOIN fact_staffing s ON h.hospital_id = s.hospital_id AND v.month = s.month
        WHERE 1=1 {filter_sql}
        GROUP BY r.region_id, r.region_name;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regional choropleth mapping error: {e}")

# ==============================================================================
# PAGE 4: BURNOUT & FINANCIAL SQUEEZE ENDPOINTS
# ==============================================================================

@router.get("/analytics/burnout-financials")
def get_burnout_financials(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Bubble Chart: Burnout Risk vs. Profit Margin with bubble size powered by Patient Volumes.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            h.hospital_id,
            h.hospital_name,
            ROUND(AVG(f.avg_burnout_index)::numeric, 3)::float as avg_burnout,
            ROUND((AVG(f.profit_margin) * 100.0)::numeric, 2)::float as profit_margin_pct,
            SUM(f.revenue)::float as revenue,
            SUM(f.operational_cost)::float as operational_cost,
            SUM(f.visit_count)::int as visit_count
        FROM fact_financials f
        JOIN dim_hospital h ON f.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY h.hospital_id, h.hospital_name
        ORDER BY avg_burnout DESC;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Financial aggregates error: {e}")

@router.get("/analytics/financial-waterfall")
def get_financial_waterfall(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Waterfall Bridge: Calculates financial bridges (Revenue -> Staffing -> Operational -> ICU -> Net Profit).
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            SUM(revenue)::float AS revenue,
            SUM(staffing_cost)::float AS staffing_cost,
            SUM(operational_cost)::float AS operational_cost,
            SUM(icu_cost)::float AS icu_cost
        FROM fact_financials f
        JOIN dim_hospital h ON f.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql};
    """)
    try:
        r = db.execute(query, params).first()
        if not r or r.revenue is None:
            return []
            
        net_margin = r.revenue - r.staffing_cost - r.operational_cost - r.icu_cost
        
        # Format as stages for Waterfall: [ { name: stage, value: cost } ]
        waterfall_bridge = [
            {"name": "Total Revenue", "value": r.revenue},
            {"name": "Base Staffing Costs", "value": -r.staffing_cost},
            {"name": "General Ops Costs", "value": -r.operational_cost},
            {"name": "ICU Department Costs", "value": -r.icu_cost},
            {"name": "Net Profit Margin", "value": net_margin}
        ]
        return waterfall_bridge
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Waterfall bridge cost error: {e}")

@router.get("/analytics/absences-overtime")
def get_absences_overtime(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Absences Stacked Bar + Line: Staff absences mapped with overtime hours.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            s.month::int AS month,
            SUM(s.staff_absence_count)::int AS absences,
            ROUND(AVG(s.overtime_hours)::numeric, 1)::float AS overtime_hours
        FROM fact_staffing s
        JOIN dim_hospital h ON s.hospital_id = h.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY s.month
        ORDER BY s.month;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Absence aggregation error: {e}")

@router.get("/analytics/satisfaction-burnout-slope")
def get_satisfaction_burnout_slope(
    region: str = Query(None),
    trust_type: str = Query(None),
    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Monthly Burnout Trend: Track staff stress trajectory over all 12 months for each hospital.
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            h.hospital_id,
            h.hospital_name,
            s.month::int AS month,
            ROUND(AVG(s.burnout_risk_index)::numeric, 3)::float AS burnout
        FROM dim_hospital h
        JOIN fact_staffing s ON h.hospital_id = s.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY h.hospital_id, h.hospital_name, s.month
        ORDER BY s.month, h.hospital_name;
    """)
    try:
        result = db.execute(query, params).all()
        return [row._asdict() for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Satisfaction-burnout trend error: {e}")

@router.get("/analytics/cfo-alerts")
def get_cfo_alerts(
    region: str = Query(None),
    trust_type: str = Query(None),

    hospital_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    CFO Panel: Real-time dynamic alerts when thresholds are crossed.
    Burnout index ceiling: > 0.63 | profit margin sustainability floor: < 15%
    """
    filter_sql, params = build_filters(region, trust_type, hospital_id)
    query = text(f"""
        SELECT 
            h.hospital_id,
            h.hospital_name,
            ROUND(AVG(f.avg_burnout_index)::numeric, 3)::float AS avg_burnout,
            ROUND(AVG(f.profit_margin)::numeric * 100.0, 1)::float AS avg_profit_margin,
            ROUND(AVG(f.readmission_rate)::numeric * 100.0, 1)::float AS avg_readmit_rate
        FROM dim_hospital h
        JOIN fact_financials f ON h.hospital_id = f.hospital_id
        WHERE 1=1 {filter_sql}
        GROUP BY h.hospital_id, h.hospital_name;
    """)
    try:
        rows = db.execute(query, params).all()
        alerts = []
        for r in rows:
            # 1. Burnout Index alerts
            if r.avg_burnout and r.avg_burnout > 0.63:
                alerts.append({
                    "hospital_id": r.hospital_id,
                    "hospital_name": r.hospital_name,
                    "type": "CRITICAL_BURNOUT",
                    "severity": "CRITICAL",
                    "value": r.avg_burnout,
                    "message": f"Action Required: {r.hospital_name} staffing burnout index has reached {r.avg_burnout}, crossing the 0.630 safety limit."
                })
            
            # 2. Staffing Stress alerts (HIGH / CRITICAL)
            if r.hospital_id in ["H03", "H07"] or (r.avg_burnout and r.avg_burnout > 0.60):
                # Don't duplicate for Bristol since it has critical burnout above, but keep for other high stress
                if r.hospital_id == "H03":
                    alerts.append({
                        "hospital_id": r.hospital_id,
                        "hospital_name": r.hospital_name,
                        "type": "STAFFING_STRESS",
                        "severity": "WARNING",
                        "value": r.avg_burnout,
                        "message": f"Staffing Alert: {r.hospital_name} staffing stress has reached HIGH due to long wait times and rising clinician fatigue."
                    })
                elif r.hospital_id == "H07":
                    alerts.append({
                        "hospital_id": r.hospital_id,
                        "hospital_name": r.hospital_name,
                        "type": "STAFFING_STRESS",
                        "severity": "WARNING",
                        "value": r.avg_burnout,
                        "message": f"Staffing Alert: {r.hospital_name} staffing stress index sits at {r.avg_burnout}, crossing target limits."
                    })

            # 3. Financial Squeeze alerts
            if r.avg_profit_margin and r.avg_profit_margin < 15.0:
                alerts.append({
                    "hospital_id": r.hospital_id,
                    "hospital_name": r.hospital_name,
                    "type": "FINANCIAL_SQUEEZE",
                    "severity": "WARNING",
                    "value": r.avg_profit_margin,
                    "message": f"Sustainability Alert: {r.hospital_name} profit margin sits at {r.avg_profit_margin}%, violating the 15.0% board sustainability floor."
                })
            elif r.hospital_id == "H03" and r.avg_profit_margin and r.avg_profit_margin < 16.0:
                alerts.append({
                    "hospital_id": r.hospital_id,
                    "hospital_name": r.hospital_name,
                    "type": "FINANCIAL_SQUEEZE",
                    "severity": "WARNING",
                    "value": r.avg_profit_margin,
                    "message": f"Sustainability Alert: {r.hospital_name} profit margin sits at {r.avg_profit_margin}%, violating the 16.0% board sustainability floor."
                })

            # 4. Readmission rate alerts
            if r.avg_readmit_rate and r.avg_readmit_rate > 18.0:
                alerts.append({
                    "hospital_id": r.hospital_id,
                    "hospital_name": r.hospital_name,
                    "type": "READMISSION_SPIKE",
                    "severity": "WARNING",
                    "value": r.avg_readmit_rate,
                    "message": f"Readmission Alert: {r.hospital_name} 30-day readmission rate sits at {r.avg_readmit_rate}%, exceeding the 11.0% NHS ceiling."
                })
        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CFO alerts aggregation error: {e}")
