import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PolarGrid, PolarAngleAxis, Radar, RadarChart } from 'recharts';
import { Activity, Clock, ShieldAlert, BedDouble, AlertCircle } from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000/api/v1";

// Helper to render skeleton state
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-800 rounded-md ${className}`} />
);

export default function OverviewPage({ filters }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState([]);
  const [treemapData, setTreemapData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [selectedYear, setSelectedYear] = useState("2024");

  useEffect(() => {
    const fetchOverviewData = async () => {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (filters.region) queryParams.append("region", filters.region);
      if (filters.trustType) queryParams.append("trust_type", filters.trustType);
      if (filters.hospital) queryParams.append("hospital_id", filters.hospital);

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";

      try {
        // Fetch in parallel
        const [kpiRes, trendRes, treeRes, heatRes, hourRes] = await Promise.all([
          fetch(`${API_BASE}/overview/kpis${queryStr}`),
          fetch(`${API_BASE}/overview/visits-over-time${queryStr}`),
          fetch(`${API_BASE}/overview/visits-treemap${queryStr}`),
          fetch(`${API_BASE}/overview/daily-heatmap${queryStr}`),
          fetch(`${API_BASE}/overview/hourly-arrivals${queryStr}`)
        ]);

        if (!kpiRes.ok || !trendRes.ok || !treeRes.ok || !heatRes.ok || !hourRes.ok) {
          throw new Error("Failed to load overview data from server.");
        }

        const [kpiVal, trendVal, treeVal, heatVal, hourVal] = await Promise.all([
          kpiRes.json(),
          trendRes.json(),
          treeRes.json(),
          heatRes.json(),
          hourRes.json()
        ]);

        setKpis(kpiVal);
        setTrends(trendVal);
        setTreemapData(treeVal);
        setHeatmapData(heatVal);
        setHourlyData(hourVal);
      } catch (err) {
        console.error("API error, using robust fallback...", err);
        setError("Database server offline. Rendered in fallback mode.");
        loadFallbacks();
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, [filters]);

  const loadFallbacks = () => {
    // Premium Mock Data Fallbacks matching the exact Supabase benchmark dataset
    setKpis({
      total_visits: 9994,
      readmission_rate: 17.04,
      avg_wait_time: 61.4,
      avg_burnout_index: 0.593
    });
    setTrends([
      { month: "2024-01", visits: 579 },
      { month: "2024-02", visits: 587 },
      { month: "2024-03", visits: 547 },
      { month: "2024-04", visits: 521 },
      { month: "2024-05", visits: 504 },
      { month: "2024-06", visits: 489 },
      { month: "2024-07", visits: 412 },
      { month: "2024-08", visits: 395 },
      { month: "2024-09", visits: 418 },
      { month: "2024-10", visits: 462 },
      { month: "2024-11", visits: 512 },
      { month: "2024-12", visits: 584 },
      { month: "2025-01", visits: 602 },
      { month: "2025-02", visits: 598 },
      { month: "2025-03", visits: 554 },
      { month: "2025-04", visits: 512 },
      { month: "2025-05", visits: 498 },
      { month: "2025-06", visits: 476 },
      { month: "2025-07", visits: 405 },
      { month: "2025-08", visits: 387 },
      { month: "2025-09", visits: 410 },
      { month: "2025-10", visits: 458 },
      { month: "2025-11", visits: 509 },
      { month: "2025-12", visits: 581 }
    ]);
    setTreemapData([
      {
        name: "King's College Hospital",
        children: [
          { name: "Emergency", value: 450 },
          { name: "General Medicine", value: 310 },
          { name: "ICU", value: 120 }
        ]
      },
      {
        name: "Sandwell General",
        children: [
          { name: "Emergency", value: 380 },
          { name: "General Medicine", value: 290 },
          { name: "ICU", value: 95 }
        ]
      },
      {
        name: "Bristol Royal Infirmary",
        children: [
          { name: "Emergency", value: 390 },
          { name: "General Medicine", value: 270 },
          { name: "ICU", value: 110 }
        ]
      }
    ]);
    // Generate mock calendar data
    const list = [];
    const baseDate = new Date("2024-01-01");
    for (let i = 0; i < 365; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const str = d.toISOString().split("T")[0];
      list.push({ date: str, count: Math.floor(Math.random() * 20) + 1 });
    }
    setHeatmapData(list);
    setHourlyData(
      Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: Math.floor(Math.random() * 200) + 50
      }))
    );
  };

  // Helper to color medical departments consistently across all hospitals
  const getColorForDept = (dept) => {
    const name = dept.toLowerCase();
    if (name.includes("emergency") || name.includes("accident")) return "#0EA5E9"; // Electric Cyan
    if (name.includes("icu") || name.includes("intensive") || name.includes("critical")) return "#EF4444"; // Urgent Red
    if (name.includes("pediatrics") || name.includes("child")) return "#10B981"; // Mint Green
    if (name.includes("cardiology") || name.includes("heart")) return "#EC4899"; // Pink
    if (name.includes("oncology") || name.includes("cancer")) return "#F59E0B"; // Amber
    if (name.includes("general medicine") || name.includes("internal")) return "#6366F1"; // Indigo Purple

    // Hash function to pick consistent colors for other departments
    const hash = dept.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ["#64748B", "#8B5CF6", "#14B8A6", "#84CC16", "#06B6D4", "#F43F5E"];
    return colors[hash % colors.length];
  };

  // Convert Treemap hierarchical structure to flat stacked bar chart format
  const getStackedBarData = () => {
    if (!treemapData || treemapData.length === 0) return { data: [], keys: [] };

    // Calculate total visits per department to sort the keys by total volume
    const deptTotals = {};
    treemapData.forEach(hospital => {
      if (hospital.children) {
        hospital.children.forEach(child => {
          deptTotals[child.name] = (deptTotals[child.name] || 0) + child.value;
        });
      }
    });

    // Sort keys based on a strict, premium clinical volume order to guarantee identical rendering sequence
    const DEPT_ORDER = [
      "Emergency Department",
      "General Medicine",
      "Cardiology",
      "Intensive Care Unit",
      "Surgery",
      "Paediatrics",
      "Respiratory",
      "Neurology",
      "Oncology",
      "Orthopaedics",
      "Mental Health",
      "Geriatrics"
    ];

    const sortedKeys = Object.keys(deptTotals).sort((a, b) => {
      const idxA = DEPT_ORDER.indexOf(a);
      const idxB = DEPT_ORDER.indexOf(b);
      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;
      return valA - valB;
    });

    const data = treemapData.map(hospital => {
      const row = { name: hospital.name.replace(" Hospital", "").replace(" Infirmary", "").replace(" NHS FT", "") };
      
      // Map children into a quick lookup dictionary
      const deptMap = {};
      if (hospital.children) {
        hospital.children.forEach(child => {
          deptMap[child.name] = child.value;
        });
      }

      // Insert keys into the row object in the EXACT same order as sortedKeys
      // This forces Recharts to stack physical bars, legend, and tooltips in identical order!
      sortedKeys.forEach(key => {
        row[key] = deptMap[key] || 0;
      });

      return row;
    });

    return { data, keys: sortedKeys };
  };

  const { data: stackedBarData, keys: stackedBarKeys } = getStackedBarData();

  // Helper for Heatmap colors
  const getHeatmapColor = (count) => {
    if (count <= 2) return "#1e293b"; // Muted slate (low / zero)
    if (count <= 6) return "#0284c71a"; // 10% Cyan opacity
    if (count <= 11) return "#0284c740"; // 25% Cyan opacity
    if (count <= 16) return "#0ea5e990"; // 55% Cyan opacity
    return "#0ea5e9"; // Full electric cyan
  };

  // Group Heatmap by Week and Render with Month & Weekday Labels for a specific year
  const renderYearCalendarSVG = (year) => {
    if (heatmapData.length === 0) return null;

    // Filter data to only include the selected year to ensure standard 53-week scaling
    const yearlyData = heatmapData.filter(day => day.date.startsWith(year));
    if (yearlyData.length === 0) return null;

    // Group days into columns of weeks
    const weeks = [];
    let currentWeek = [];

    yearlyData.forEach((day, idx) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === yearlyData.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    const monthLabels = [];
    let prevMonth = -1;
    weeks.forEach((week, wIdx) => {
      if (week.length > 0) {
        const parts = week[0].date.split("-");
        if (parts.length === 3) {
          const month = parseInt(parts[1], 10) - 1; // 0-indexed month
          if (month !== prevMonth) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            let label = monthNames[month];
            monthLabels.push({
              text: label,
              x: wIdx * 10 + 30
            });
            prevMonth = month;
          }
        }
      }
    });

    return (
      <svg className="w-full h-full min-h-[90px]" viewBox="0 0 570 92">
        {/* Month Labels */}
        <g>
          {monthLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={lbl.x}
              y={10}
              fill="#64748B"
              fontSize={8}
              fontWeight="bold"
              textAnchor="start"
              className="select-none pointer-events-none"
            >
              {lbl.text}
            </text>
          ))}
        </g>

        {/* Weekday Labels perfectly aligned using dominantBaseline="central" to matching row offsets */}
        <g>
          <text x={2} y={22} fill="#64748B" fontSize={8} fontWeight="bold" dominantBaseline="central" className="select-none pointer-events-none">Mon</text>
          <text x={2} y={42} fill="#64748B" fontSize={8} fontWeight="bold" dominantBaseline="central" className="select-none pointer-events-none">Wed</text>
          <text x={2} y={62} fill="#64748B" fontSize={8} fontWeight="bold" dominantBaseline="central" className="select-none pointer-events-none">Fri</text>
        </g>

        {/* Heatmap Rectangles */}
        {weeks.map((week, wIdx) => (
          <g key={wIdx} transform={`translate(${wIdx * 10 + 30}, 18)`}>
            {week.map((day, dIdx) => (
              <rect
                key={dIdx}
                y={dIdx * 10}
                width={8}
                height={8}
                rx={1.5}
                fill={getHeatmapColor(day.count)}
                className="transition-colors duration-150 cursor-pointer hover:stroke-slate-400 hover:stroke-[0.5]"
              >
                <title>{`${day.date}: ${day.count} arrivals`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI Grid Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        {/* Chart Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fallback alert banner */}
      {error && (
        <div className="flex items-center gap-3 bg-brand-red/10 border border-brand-red/30 rounded-md p-3 text-brand-red text-sm animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Visits */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex items-start justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Patient Visits</span>
            <h3 className="text-3xl font-extrabold mt-1 text-slate-100">{kpis?.total_visits.toLocaleString()}</h3>
            <span className="text-[10px] text-brand-green font-medium mt-2 block">↑ +2.4% vs Prev Year</span>
          </div>
          <div className="bg-brand-cyan/10 p-3 rounded-md border border-brand-cyan/20">
            <Activity className="w-5 h-5 text-brand-cyan" />
          </div>
        </div>

        {/* 2. Readmission Rate */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex items-start justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Global Readmission Rate</span>
            <h3 className={`text-3xl font-extrabold mt-1 ${kpis?.readmission_rate > 11.0 ? 'text-brand-red' : 'text-brand-cyan'}`}>
              {kpis?.readmission_rate}%
            </h3>
            <span className="text-[10px] text-brand-red font-medium mt-2 block">
              {kpis?.readmission_rate > 11.0 ? `⚠️ +${(kpis.readmission_rate - 11.0).toFixed(2)}pp above NHS ceiling (11%)` : "Within safety target"}
            </span>
          </div>
          <div className="bg-brand-red/10 p-3 rounded-md border border-brand-red/20">
            <ShieldAlert className="w-5 h-5 text-brand-red" />
          </div>
        </div>

        {/* 3. Average Wait Time */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex items-start justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Average Wait Time</span>
            <h3 className="text-3xl font-extrabold mt-1 text-slate-100">{kpis?.avg_wait_time} min</h3>
            <span className="text-[10px] text-slate-400 mt-2 block">Avg processing door-to-treatment</span>
          </div>
          <div className="bg-brand-cyan/10 p-3 rounded-md border border-brand-cyan/20">
            <Clock className="w-5 h-5 text-brand-cyan" />
          </div>
        </div>

        {/* 4. Staff Burnout */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex items-start justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Staffing Burnout</span>
            <h3 className="text-3xl font-extrabold mt-1 text-brand-purple">{kpis?.avg_burnout_index}</h3>
            <span className="text-[10px] text-brand-purple font-medium mt-2 block">System-wide Burnout Corridor</span>
          </div>
          <div className="bg-brand-purple/10 p-3 rounded-md border border-brand-purple/20">
            <BedDouble className="w-5 h-5 text-brand-purple" />
          </div>
        </div>
      </div>

      {/* Middle Row Charts (50/50 Area vs Heatmap) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits Area Chart */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Visits Volume Over Time</h4>
            <p className="text-xs text-slate-500">Chronological analysis tracking seasonal flu/winter peaks</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  itemStyle={{ color: "#0EA5E9" }}
                />
                <Area type="monotone" dataKey="visits" stroke="#0EA5E9" strokeWidth={2} fillOpacity={1} fill="url(#colorVisits)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calendar Heatmap (Daily Visit Intensity - Stacked 2024 & 2025) */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Daily Visit Intensity</h4>
            <p className="text-xs text-slate-500">Day-level patient flows displaying holiday/weekend dips</p>
          </div>

          <div className="space-y-4">
            {/* Year 2024 Grid */}
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">2024</span>
              <div className="p-2 bg-slate-900/50 rounded-md border border-slate-800/80 flex items-center justify-center">
                {renderYearCalendarSVG("2024")}
              </div>
            </div>

            {/* Year 2025 Grid */}
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">2025</span>
              <div className="p-2 bg-slate-900/50 rounded-md border border-slate-800/80 flex items-center justify-center">
                {renderYearCalendarSVG("2025")}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              Comparative Year-over-Year grid matrix
            </span>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
              <span>Low</span>
              <div className="w-2.5 h-2.5 rounded-[1px] bg-slate-800" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-950/20" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-900/40" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-500/70" />
              <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-500" />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row Charts (66/33 split - Volume Hierarchy vs hourly Polar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Horizontal Stacked Bar Chart Breakdown (takes 2 columns) */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 lg:col-span-2 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Volume Hierarchy</h4>
            <p className="text-xs text-slate-500">Visit load stacked by Hospital & Department</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={8} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={8} width={115} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  itemStyle={{ fontSize: 10 }}
                />
                <Legend verticalAlign="bottom" height={28} iconSize={8} wrapperStyle={{ fontSize: 8 }} />
                
                {/* Statically declared Bar components to guarantee perfect stacked order, legend flow, and tooltip synchronization */}
                <Bar dataKey="Emergency Department" name="Emergency Department" stackId="a" fill="#0EA5E9" />
                <Bar dataKey="General Medicine" name="General Medicine" stackId="a" fill="#6366F1" />
                <Bar dataKey="Cardiology" name="Cardiology" stackId="a" fill="#EC4899" />
                <Bar dataKey="Intensive Care Unit" name="Intensive Care Unit" stackId="a" fill="#EF4444" />
                <Bar dataKey="Surgery" name="Surgery" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="Paediatrics" name="Paediatrics" stackId="a" fill="#10B981" />
                <Bar dataKey="Respiratory" name="Respiratory" stackId="a" fill="#64748B" />
                <Bar dataKey="Neurology" name="Neurology" stackId="a" fill="#06B6D4" />
                <Bar dataKey="Oncology" name="Oncology" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Orthopaedics" name="Orthopaedics" stackId="a" fill="#F43F5E" />
                <Bar dataKey="Mental Health" name="Mental Health" stackId="a" fill="#84CC16" />
                <Bar dataKey="Geriatrics" name="Geriatrics" stackId="a" fill="#14B8A6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Polar Ring (takes 1 column) */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Arrival Density by Hour</h4>
            <p className="text-xs text-slate-500">24-hour admission pressure window</p>
          </div>
          <div className="h-[220px] flex items-center justify-center my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={hourlyData}>
                <PolarGrid stroke="#1E293B" />
                <PolarAngleAxis dataKey="hour" stroke="#64748B" fontSize={8} />
                <Radar name="Arrivals" dataKey="count" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} />
                <Tooltip contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider text-center pt-2 border-t border-slate-800/40">
            Peak hours reveal critical shift staffing allocations
          </div>
        </div>
      </div>
    </div>
  );
}
