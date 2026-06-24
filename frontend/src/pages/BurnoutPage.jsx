import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell, Legend } from 'recharts';
import { AlertCircle, FileText, CheckCircle2, TrendingUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-800 rounded-md ${className}`} />
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#131926] border border-slate-800 rounded-md p-3 shadow-xl text-xs space-y-1">
        <p className="font-bold text-slate-200">{data.hospital_name}</p>
        <p className="text-[#0EA5E9]">Burnout Index: <span className="font-semibold">{data.avg_burnout ? data.avg_burnout.toFixed(3) : 0}</span></p>
        <p className="text-[#6366F1]">Profit Margin: <span className="font-semibold">{data.profit_margin_pct ? data.profit_margin_pct.toFixed(2) : 0}%</span></p>
        <p className="text-slate-400">Visits: <span className="font-semibold">{data.visit_count ? data.visit_count.toLocaleString() : 0}</span></p>
      </div>
    );
  }
  return null;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BurnoutPage({ filters }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data States
  const [bubbleData, setBubbleData] = useState([]);
  const [waterfallData, setWaterfallData] = useState([]);
  const [absencesData, setAbsencesData] = useState([]);
  const [slopeData, setSlopeData] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const SlopeLabel = (props) => {
    const { x, y, stroke, index, hospitalId } = props;
    if (index === 11) { // Month 12 (Dec) endpoint
      return (
        <text
          x={x}
          y={y}
          dx={6}
          dy={3}
          fill={stroke || "#94A3B8"}
          fontSize={8.5}
          fontWeight="bold"
          textAnchor="start"
        >
          {hospitalId}
        </text>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchBurnoutData = async () => {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (filters.region) queryParams.append("region", filters.region);
      if (filters.trustType) queryParams.append("trust_type", filters.trustType);
      if (filters.hospital) queryParams.append("hospital_id", filters.hospital);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";

      try {
        const [bubbleRes, waterRes, absRes, slopeRes, alertRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/burnout-financials${queryStr}`),
          fetch(`${API_BASE}/analytics/financial-waterfall${queryStr}`),
          fetch(`${API_BASE}/analytics/absences-overtime${queryStr}`),
          fetch(`${API_BASE}/analytics/satisfaction-burnout-slope${queryStr}`),
          fetch(`${API_BASE}/analytics/cfo-alerts${queryStr}`)
        ]);

        if (!bubbleRes.ok || !waterRes.ok || !absRes.ok || !slopeRes.ok || !alertRes.ok) {
          throw new Error("Failed to load burnout or financial aggregates.");
        }

        const [bubbleVal, waterVal, absVal, slopeVal, alertVal] = await Promise.all([
          bubbleRes.json(),
          waterRes.json(),
          absRes.json(),
          slopeRes.json(),
          alertRes.json()
        ]);

        setBubbleData(bubbleVal);
        setWaterfallData(waterVal);
        setAbsencesData(absVal);
        setSlopeData(slopeVal);
        setAlerts(alertVal);
      } catch (err) {
        console.error("API error, using robust fallback...", err);
        setError("Database server offline. Rendered in fallback mode.");
        loadFallbacks();
      } finally {
        setLoading(false);
      }
    };

    fetchBurnoutData();
  }, [filters]);

  const loadFallbacks = () => {
    setBubbleData([
      { hospital_name: "Bristol Royal Infirmary", avg_burnout: 0.635, profit_margin_pct: 13.8, visit_count: 10192 },
      { hospital_name: "Sandwell General", avg_burnout: 0.640, profit_margin_pct: 17.5, visit_count: 9800 },
      { hospital_name: "King's College Hospital", avg_burnout: 0.587, profit_margin_pct: 22.0, visit_count: 12500 }
    ]);

    setWaterfallData([
      { name: "Total Revenue", value: 110059257.0 },
      { name: "Base Staffing Costs", value: -4643854.0 },
      { name: "General Ops Costs", value: -74448406.0 },
      { name: "ICU Department Costs", value: -5653563.0 },
      { name: "Net Profit Margin", value: 25313434.0 }
    ]);

    setAbsencesData([
      { month: 1, absences: 450, overtime_hours: 320.0 },
      { month: 2, absences: 420, overtime_hours: 310.0 },
      { month: 3, absences: 380, overtime_hours: 290.0 },
      { month: 4, absences: 300, overtime_hours: 240.0 },
      { month: 5, absences: 280, overtime_hours: 230.0 },
      { month: 6, absences: 260, overtime_hours: 220.0 },
      { month: 7, absences: 270, overtime_hours: 225.0 },
      { month: 8, absences: 290, overtime_hours: 240.0 },
      { month: 9, absences: 310, overtime_hours: 260.0 },
      { month: 10, absences: 390, overtime_hours: 295.0 },
      { month: 11, absences: 430, overtime_hours: 315.0 },
      { month: 12, absences: 470, overtime_hours: 330.0 }
    ]);

    const fallbackSlope = [];
    for (let m = 1; m <= 12; m++) {
      fallbackSlope.push({
        hospital_id: "H11",
        hospital_name: "Bristol Royal Infirmary",
        month: m,
        burnout: 0.587 + (m * 0.0015)
      });
      fallbackSlope.push({
        hospital_id: "H01",
        hospital_name: "King's College Hospital",
        month: m,
        burnout: 0.580 + (Math.sin(m) * 0.003)
      });
    }
    setSlopeData(fallbackSlope);

    setAlerts([
      {
        hospital_id: "H11",
        hospital_name: "Bristol Royal Infirmary",
        type: "FINANCIAL_SQUEEZE",
        severity: "WARNING",
        message: "Sustainability Alert: Bristol Royal Infirmary profit margin sits at 13.8%, violating the 15.0% board sustainability floor."
      },
      {
        hospital_id: "H11",
        hospital_name: "Bristol Royal Infirmary",
        type: "CRITICAL_BURNOUT",
        severity: "CRITICAL",
        message: "Action Required: Bristol Royal Infirmary staffing burnout index has reached 0.635, crossing the 0.630 safety limit."
      },
      {
        hospital_id: "H07",
        hospital_name: "Sandwell General Hospital",
        type: "READMISSION_SPIKE",
        severity: "WARNING",
        message: "Readmission Alert: Sandwell General Hospital 30-day readmission rate sits at 18.2%, exceeding the 11.0% NHS ceiling."
      },
      {
        hospital_id: "H03",
        hospital_name: "Royal Cornwall Hospital",
        type: "STAFFING_STRESS",
        severity: "WARNING",
        message: "Staffing Alert: Royal Cornwall Hospital staffing stress has reached HIGH due to long wait times and rising clinician fatigue."
      }
    ]);
  };

  // Helper to compile Recharts floating Waterfall data
  const getWaterfallChartData = () => {
    let runningSum = 0;
    return waterfallData.map((stage, idx) => {
      const val = stage.value;
      let open = runningSum;
      let close = runningSum + val;

      if (idx === 0 || idx === waterfallData.length - 1) {
        // First & last are solid standing bars starting from 0
        open = 0;
        close = val;
      }

      runningSum += val;

      // We return [open, close] for Recharts floating/stacked bars representation
      return {
        name: stage.name,
        displayValue: val,
        range: [open, close],
        isPositive: val >= 0
      };
    });
  };

  // Compile Slope Data for Recharts Line Chart mapping
  const getSlopeChartData = () => {
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      name: monthNames[i],
    }));

    slopeData.forEach(item => {
      const monthIdx = item.month - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        monthlyData[monthIdx][item.hospital_name] = item.burnout;
      }
    });

    return monthlyData;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
        <Skeleton className="h-[250px]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
      </div>
    );
  }

  const waterfallChartData = getWaterfallChartData();
  const slopeChartData = getSlopeChartData();
  const uniqueHospitals = Array.from(
    new Map(slopeData.map(h => [h.hospital_id, h])).values()
  );

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-brand-red/10 border border-brand-red/30 rounded-md p-3 text-brand-red text-sm animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Row Grid (50/50 Bubble Correlation vs Waterfall Bridge) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bubble Chart */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Burnout Index vs. Net Profit Margin</h4>
            <p className="text-xs text-slate-500">Bubble size = Patient Volume. Red highlight isolates Bristol Royal (H11) bottleneck</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 15, bottom: 10, left: -10 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="avg_burnout" name="Burnout Index" stroke="#64748B" fontSize={9} domain={[0.50, 0.66]} tickFormatter={(val) => val.toFixed(2)} />
                <YAxis type="number" dataKey="profit_margin_pct" name="Profit Margin" stroke="#64748B" fontSize={9} unit="%" domain={[10, 22]} />
                <ZAxis type="number" dataKey="visit_count" range={[100, 1000]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={<CustomTooltip />}
                />

                {/* Visual Legend explaining standard vs warning colors */}
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={24}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 9, fontWeight: 'bold', color: '#94A3B8', marginTop: -10 }}
                />

                {/* Standard Bubble traces */}
                <Scatter
                  name="Standard Network Hospitals"
                  data={bubbleData.filter(h => h.hospital_name !== "Bristol Royal Infirmary")}
                  fill="#0EA5E9"
                  fillOpacity={0.6}
                />

                {/* Highlighted Warning Bubble H11 */}
                <Scatter
                  name="Outlier Hospital (Bristol Royal H11)"
                  data={bubbleData.filter(h => h.hospital_name === "Bristol Royal Infirmary")}
                  fill="#EF4444"
                  fillOpacity={0.95}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waterfall Cost Bridge */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Revenue to Net Margin Waterfall Bridge</h4>
            <p className="text-xs text-slate-500">Exposing monthly operational budget leaks and base staffing expenditures</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallChartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={8} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={8} tickFormatter={(val) => `£${(val / 1e6).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  formatter={(value, name, props) => [`£${(props.payload.displayValue).toLocaleString()}`, "Value"]}
                />

                {/* Floating Waterfall Bars */}
                <Bar dataKey="range">
                  {waterfallChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 || index === waterfallChartData.length - 1 ? "#0EA5E9" : "#EF4444"} // Blue for ends, Red for leaks
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Middle Row: Stacked Bar + Line (Absences vs Overtime) */}
      <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
        <div>
          <h4 className="font-bold text-slate-200 text-sm tracking-wide">Monthly Absence and Overtime Hours Trend</h4>
          <p className="text-xs text-slate-500">Observing relationships between staffing outages (Bars) and overtime stress triggers (Line)</p>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={absencesData} margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="#64748B" fontSize={9} tickFormatter={(val) => monthNames[val - 1] || val} />
              <YAxis stroke="#64748B" fontSize={9} />
              <Tooltip contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }} />

              {/* Stacked Absences */}
              <Bar dataKey="absences" fill="#0EA5E9" stackId="a" fillOpacity={0.8} />

              {/* Overtime line */}
              <Bar dataKey="overtime_hours" fill="#EF4444" stackId="a" fillOpacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row Grid (50/50 Slope Chart vs CFO Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Slope Chart */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Burnout Index Monthly Trend (Jan ➔ Dec)</h4>
            <p className="text-xs text-slate-500">Tracking chronological staff stress elevation or mitigation paths across 12 months</p>
          </div>
          <div className="h-[280px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slopeChartData} margin={{ top: 20, right: 65, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} fontWeight="bold" />
                <YAxis stroke="#64748B" fontSize={9} domain={['dataMin - 0.005', 'dataMax + 0.005']} tickFormatter={(val) => val.toFixed(2)} />
                <Tooltip contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }} />

                {/* Connecting lines for each hospital */}
                {uniqueHospitals.map((h, idx) => {
                  const isBristol = h.hospital_name === "Bristol Royal Infirmary";
                  return (
                    <Line
                      key={h.hospital_id || idx}
                      type="monotone"
                      dataKey={h.hospital_name}
                      stroke={isBristol ? "#EF4444" : "#0EA5E9"} // Bristol highlighted in warning red
                      strokeWidth={isBristol ? 3.5 : 1}
                      strokeOpacity={isBristol ? 1.0 : 0.3}
                      dot={isBristol ? { r: 4 } : false}
                      label={<SlopeLabel hospitalId={h.hospital_id} />}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CFO Dynamic Recommendation Panel */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Dynamic Board Advisory Alerts</h4>
            <p className="text-xs text-slate-500">Real-time alerts triggered dynamically by actual database thresholds</p>
          </div>

          <div className="space-y-3 my-auto pt-2">
            {(!filters.hospital || filters.hospital === "all") && alerts.length > 0 ? (
              // Summary view for all hospitals matching the filtered alert card design
              <div className="bg-brand-red/10 border border-brand-red/35 p-3 rounded-md flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Alert Summary (All Hospitals)
                  </span>
                  <div className="mt-1 space-y-1">
                    {(() => {
                      const typeMap = {
                        CRITICAL_BURNOUT: "Staffing stress",
                        FINANCIAL_SQUEEZE: "Financial squeeze",
                        READMISSION_SPIKE: "Readmission spike",
                        STAFFING_STRESS: "Staffing stress",
                      };
                      const summary = {};
                      alerts.forEach((a) => {
                        const label = typeMap[a.type] || a.type.replace("_", " ");
                        if (!summary[label]) summary[label] = [];
                        summary[label].push(a.hospital_name);
                      });
                      return Object.entries(summary).map(([label, names]) => (
                        <p key={label} className="text-[11px] text-slate-400 leading-relaxed">
                          <span className="font-bold text-slate-200 mr-1">{label}:</span> {names.join(", ")}
                        </p>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            ) : alerts.length > 0 ? (
              alerts.map((al, idx) => (
                <div key={idx} className="bg-brand-red/10 border border-brand-red/35 p-3 rounded-md flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      {al.type.replace("_", " ")}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {al.message}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-brand-green/10 border border-brand-green/35 p-3 rounded-md flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Operational Status Clear
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    All hospitals currently operating within normal parameters.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-md flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-red shrink-0" />
            <span className="text-[10px] text-[#EF4444] font-bold uppercase tracking-wider">
              Advisory Level: Board-Action Critical
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
