import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from 'recharts';
import { AlertTriangle, HelpCircle, Activity } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

// Simple Skeleton Helper
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-800 rounded-md ${className}`} />
);

export default function OutlierPage({ filters }) {
  const [loading, setLoading] = useState(true);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("H1"); // YoY Toggle: H1 vs H2
  const [scatterData, setScatterData] = useState([]);
  const [bumpData, setBumpData] = useState([]);
  const [sankeyData, setSankeyData] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);

  const prevFiltersRef = useRef(filters);

  useEffect(() => {
    const isFilterChange = JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters);
    prevFiltersRef.current = filters;

    const fetchOutlierData = async () => {
      const fullReload = loading || isFilterChange;
      if (fullReload) {
        setLoading(true);
      } else {
        setScatterLoading(true);
      }
      setError(null);
      
      // Filters for network-wide comparative charts (Outliers Scatter & Bump Line)
      const networkParams = new URLSearchParams();
      networkParams.append("period", period);
      if (filters.region) networkParams.append("region", filters.region);
      if (filters.trustType) networkParams.append("trust_type", filters.trustType);
      
      const networkQueryStr = `?${networkParams.toString()}`;

      // Filters for specific hospital-level detailed charts (Sankey & Heatmap)
      const pageFilters = new URLSearchParams();
      if (filters.region) pageFilters.append("region", filters.region);
      if (filters.trustType) pageFilters.append("trust_type", filters.trustType);
      if (filters.hospital) pageFilters.append("hospital_id", filters.hospital);

      const hospitalId = filters.hospital || "H07";
      
      try {
        if (fullReload) {
          const [scatterRes, bumpRes, sankeyRes, heatRes] = await Promise.all([
            fetch(`${API_BASE}/hospitals/outliers${networkQueryStr}`),
            fetch(`${API_BASE}/hospitals/bump-rankings?${networkParams.toString()}`),
            fetch(`${API_BASE}/hospitals/${hospitalId}/sankey-flow?${pageFilters.toString()}`),
            fetch(`${API_BASE}/hospitals/${hospitalId}/severity-weekday-wait?${pageFilters.toString()}`)
          ]);

          if (!scatterRes.ok || !bumpRes.ok || !sankeyRes.ok || !heatRes.ok) {
            throw new Error("Failed to load clinical outlier metrics.");
          }

          const [scatterVal, bumpVal, sankeyVal, heatVal] = await Promise.all([
            scatterRes.json(),
            bumpRes.json(),
            sankeyRes.json(),
            heatRes.json()
          ]);

          setScatterData(scatterVal);
          setBumpData(bumpVal);
          setSankeyData(sankeyVal);
          setHeatmapData(heatVal);
        } else {
          // Local/isolated fetch for scatter data only on period change
          const scatterRes = await fetch(`${API_BASE}/hospitals/outliers${networkQueryStr}`);
          if (!scatterRes.ok) {
            throw new Error("Failed to load clinical outlier metrics.");
          }
          const scatterVal = await scatterRes.json();
          setScatterData(scatterVal);
        }
      } catch (err) {
        console.error("API error, using robust fallback...", err);
        setError("Database server offline. Rendered in fallback mode.");
        loadFallbacks();
      } finally {
        setLoading(false);
        setScatterLoading(false);
      }
    };

    fetchOutlierData();
  }, [filters, period]);

  const loadFallbacks = () => {
    // Dynamic Scatter Data Fallback mapping YoY slider H1 vs H2
    if (period === "H1") {
      setScatterData([
        { hospital_id: "H01", hospital_name: "King's College Hospital", readmission_rate: 14.2, avg_burnout_index: 0.52, total_visits: 890, staffing_stress: "MODERATE" },
        { hospital_id: "H07", hospital_name: "Sandwell General Hospital", readmission_rate: 20.1, avg_burnout_index: 0.64, total_visits: 910, staffing_stress: "HIGH" },
        { hospital_id: "H11", hospital_name: "Bristol Royal Infirmary", readmission_rate: 13.5, avg_burnout_index: 0.62, total_visits: 850, staffing_stress: "HIGH" },
        { hospital_id: "H02", hospital_name: "Nuffield Woking Hospital", readmission_rate: 4.5, avg_burnout_index: 0.35, total_visits: 340, staffing_stress: "LOW" }
      ]);
    } else {
      setScatterData([
        { hospital_id: "H01", hospital_name: "King's College Hospital", readmission_rate: 14.5, avg_burnout_index: 0.54, total_visits: 920, staffing_stress: "MODERATE" },
        { hospital_id: "H07", hospital_name: "Sandwell General Hospital", readmission_rate: 21.8, avg_burnout_index: 0.72, total_visits: 985, staffing_stress: "HIGH" }, // Worsened!
        { hospital_id: "H11", hospital_name: "Bristol Royal Infirmary", readmission_rate: 14.2, avg_burnout_index: 0.66, total_visits: 890, staffing_stress: "HIGH" },
        { hospital_id: "H02", hospital_name: "Nuffield Woking Hospital", readmission_rate: 4.8, avg_burnout_index: 0.38, total_visits: 360, staffing_stress: "LOW" }
      ]);
    }

    const fallbackHospitals = [
      { id: "H07", name: "Sandwell General Hospital", base: 20.0, trend: [0.3, -0.4, 0.5, -0.8, 0.2, -0.1, -1.2, 1.1, 1.5, 2.0, 3.8, -0.5] },
      { id: "H01", name: "King's College Hospital", base: 14.0, trend: [0.1, 0.3, -0.2, 0.4, -0.1, 0.2, 0.3, -0.1, 0.2, 0.4, -0.1, 0.3] },
      { id: "H11", name: "Bristol Royal Infirmary", base: 13.5, trend: [0.2, -0.1, 0.3, -0.3, 0.4, -0.2, 0.1, 0.2, -0.1, 0.3, -0.2, 0.1] },
      { id: "H02", name: "Nuffield Woking Hospital", base: 4.5, trend: [0.0, 0.1, -0.1, 0.0, 0.2, -0.2, 0.1, 0.0, 0.1, -0.1, 0.0, 0.1] }
    ];

    const generatedBumpData = [];
    for (let m = 1; m <= 12; m++) {
      fallbackHospitals.forEach(h => {
        const rate = parseFloat((h.base + h.trend[m - 1]).toFixed(2));
        generatedBumpData.push({
          month: m,
          hospital_id: h.id,
          hospital_name: h.name,
          readmission_rate: rate,
          rank: 0
        });
      });
    }
    setBumpData(generatedBumpData);

    setSankeyData({
      nodes: [
        { name: "Emergency" }, { name: "Urgent" }, { name: "Elective" },
        { name: "Severity 1" }, { name: "Severity 2" }, { name: "Severity 3" }, { name: "Severity 4" }, { name: "Severity 5" },
        { name: "Discharged" }, { name: "Deceased" }, { name: "Readmitted" }
      ],
      links: [
        { source: 0, target: 4, value: 120 }, { source: 1, target: 5, value: 95 },
        { source: 4, target: 8, value: 85 }, { source: 4, target: 10, value: 35 },
        { source: 5, target: 8, value: 65 }, { source: 5, target: 9, value: 30 }
      ]
    });

    setHeatmapData([
      { severity: 1, weekday: "Monday", avg_wait: 82.8 },
      { severity: 2, weekday: "Monday", avg_wait: 75.4 },
      { severity: 5, weekday: "Sunday", avg_wait: 105.2 }
    ]);
  };

  // NATIVE PURE REACT-SVG SANKEY ENGINE
  const renderSankeySVG = () => {
    if (!sankeyData || sankeyData.nodes.length === 0) return null;

    const width = 600;
    const height = 240;
    const nodeWidth = 14;
    const nodePadding = 12;

    // 1. Assign columns (stages) to nodes based on name
    const cols = [[], [], []];
    sankeyData.nodes.forEach((node, idx) => {
      const n = { ...node, index: idx, value: 0 };
      if (n.name.startsWith("Severity")) {
        cols[1].push(n);
      } else if (["Discharged", "Deceased", "Readmitted", "Transfer", "Referred", "AMA"].includes(n.name)) {
        cols[2].push(n);
      } else {
        cols[0].push(n);
      }
    });

    // 2. Sum incoming/outgoing values to set node sizes
    sankeyData.links.forEach(link => {
      sankeyData.nodes[link.source].value = (sankeyData.nodes[link.source].value || 0) + link.value;
      sankeyData.nodes[link.target].value = (sankeyData.nodes[link.target].value || 0) + link.value;
    });

    // Apply values to our columns
    cols.forEach(col => {
      col.forEach(n => {
        n.value = sankeyData.nodes[n.index].value || 5; // Default minimum weight
      });
    });

    // 3. Compute vertical spacing & positions
    const colX = [40, 280, 520];
    const nodePos = {};

    cols.forEach((col, colIdx) => {
      const x = colX[colIdx];
      const totalVal = col.reduce((sum, n) => sum + n.value, 0);
      const availableHeight = height - (col.length - 1) * nodePadding - 30;
      
      let currentY = 15;
      col.forEach(node => {
        const h = totalVal > 0 ? (node.value / totalVal) * availableHeight : availableHeight / col.length;
        const nodeHeight = Math.max(h, 4); // Minimum height

        nodePos[node.index] = {
          x,
          y: currentY,
          w: nodeWidth,
          h: nodeHeight,
          name: node.name,
          sourceYOut: currentY, // Flow offsets
          targetYIn: currentY
        };
        currentY += nodeHeight + nodePadding;
      });
    });

    // 4. Generate Link Beziers
    const links = sankeyData.links.map((link, idx) => {
      const src = nodePos[link.source];
      const tgt = nodePos[link.target];
      if (!src || !tgt) return null;

      const linkHeight = (link.value / sankeyData.nodes[link.source].value) * src.h;
      
      const y0 = src.sourceYOut + linkHeight / 2;
      src.sourceYOut += linkHeight; // Offset next link

      const y1 = tgt.targetYIn + linkHeight / 2;
      tgt.targetYIn += linkHeight;

      const x0 = src.x + nodeWidth;
      const x1 = tgt.x;

      // Curve path
      const dx = (x1 - x0) / 2;
      const path = `M ${x0} ${y0 - linkHeight/2} 
                    C ${x0 + dx} ${y0 - linkHeight/2}, ${x1 - dx} ${y1 - linkHeight/2}, ${x1} ${y1 - linkHeight/2}
                    L ${x1} ${y1 + linkHeight/2}
                    C ${x1 - dx} ${y1 + linkHeight/2}, ${x0 + dx} ${y0 + linkHeight/2}, ${x0} ${y0 + linkHeight/2} Z`;

      const isWarning = tgt.name === "Readmitted" || tgt.name === "Deceased";

      return (
        <path
          key={idx}
          d={path}
          fill={isWarning ? "#EF4444" : "#0EA5E9"}
          fillOpacity={0.15}
          className="hover:fill-opacity-40 transition-all duration-150"
        >
          <title>{`${src.name} ➔ ${tgt.name}: ${link.value} patients`}</title>
        </path>
      );
    });

    return (
      <svg className="w-full h-full min-h-[220px]" viewBox={`0 0 ${width} ${height}`}>
        {/* Draw Links */}
        <g>{links}</g>
        
        {/* Draw Nodes */}
        <g>
          {Object.entries(nodePos).map(([idx, pos]) => {
            const isOutlierNode = pos.name === "Readmitted" || pos.name === "Deceased";
            return (
              <g key={idx}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={1.5}
                  fill={isOutlierNode ? "#EF4444" : "#0EA5E9"}
                  className="stroke-slate-950 stroke-[0.5]"
                />
                <text
                  x={pos.x < 300 ? pos.x + pos.w + 6 : pos.x - 6}
                  y={pos.y + pos.h / 2 + 3}
                  textAnchor={pos.x < 300 ? "start" : "end"}
                  fill="#94A3B8"
                  fontSize={8}
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {pos.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  // Grid Heatmap color levels
  const getGridHeatmapColor = (wait) => {
    if (!wait) return "#1e293b";
    if (wait < 50) return "#0284c71a";
    if (wait < 75) return "#0284c750";
    if (wait < 95) return "#ef444430"; // Alert levels starting
    return "#ef444490"; // Warning Alert Red
  };

  // Group Heatmap for rendering
  const renderSeverityHeatmap = () => {
    const severities = [5, 4, 3, 2, 1];
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // Map data
    const gridMap = {};
    heatmapData.forEach(cell => {
      gridMap[`${cell.severity}-${cell.weekday}`] = cell.avg_wait;
    });

    return (
      <div className="space-y-1.5 font-sans">
        {/* Weekday headers */}
        <div className="grid grid-cols-8 gap-1 text-[9px] text-slate-500 font-bold text-center uppercase tracking-wider">
          <div className="text-left">Severity</div>
          {weekdays.map(w => <div key={w}>{w.substring(0, 3)}</div>)}
        </div>
        
        {/* Grid rows */}
        {severities.map(sev => (
          <div key={sev} className="grid grid-cols-8 gap-1 items-center">
            <div className="text-[10px] text-slate-400 font-bold pr-1">Level {sev}</div>
            {weekdays.map(day => {
              const val = gridMap[`${sev}-${day}`];
              return (
                <div
                  key={day}
                  style={{ backgroundColor: getGridHeatmapColor(val) }}
                  className="h-7 rounded-[2px] flex items-center justify-center text-[10px] font-extrabold text-slate-100 cursor-pointer hover:border hover:border-slate-500 transition-all duration-150"
                  title={`${day} - Severity ${sev}: ${val ? `${val} min wait` : "No data"}`}
                >
                  {val ? `${Math.round(val)}m` : "-"}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Group raw flat bumpData by month and extract readmission_rate per hospital ID
  const getPivotedLineData = () => {
    const monthMap = {};
    bumpData.forEach(item => {
      const m = item.month;
      if (!monthMap[m]) {
        monthMap[m] = { month: m };
      }
      monthMap[m][item.hospital_id] = item.readmission_rate;
    });
    return Object.values(monthMap).sort((a, b) => a.month - b.month);
  };

  const pivotedLineData = getPivotedLineData();

  const getHospitalName = (id) => {
    const nameMap = {
      H01: "King's College Hospital",
      H02: "Nuffield Health Woking",
      H03: "Royal Cornwall Hospital",
      H04: "UCL Hospitals",
      H05: "Alder Hey Children's",
      H06: "Norfolk & Norwich",
      H07: "Sandwell General (H07)",
      H08: "Spire Manchester",
      H09: "Leeds General",
      H10: "Harrogate District",
      H11: "Bristol Royal"
    };
    return nameMap[id] || id;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-[360px]" />
          <Skeleton className="lg:col-span-2 h-[360px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-[250px]" />
          <Skeleton className="lg:col-span-2 h-[250px]" />
        </div>
      </div>
    );
  }

  const highlightedId = filters.hospital || "H07";
  const standardIds = ["H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10", "H11"].filter(id => id !== highlightedId);

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-brand-red/10 border border-brand-red/30 rounded-md p-3 text-brand-red text-sm animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Row Grid (Balanced 50/50 Scatter vs Line Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter Plot */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-200 text-sm tracking-wide">Chronological Shift: Readmissions vs Staff Stress</h4>
              <p className="text-xs text-slate-500">
                {highlightedId === "H07" 
                  ? "Tracking the H1 to H2 shift in staff burnout and readmission rates" 
                  : `Tracking YoY shift in burnout and readmissions for ${getHospitalName(highlightedId)}`}
              </p>
            </div>
            
            {/* YoY Toggle inside Scatter card header */}
            <div className="flex items-center gap-2">
              {scatterLoading && (
                <span className="text-[10px] text-brand-cyan animate-pulse font-medium">
                  Updating...
                </span>
              )}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-1 self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setPeriod("H1")}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all duration-200 ${period === "H1" ? "bg-brand-cyan text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                >
                  H1 (M1–6)
                </button>
                <button
                  onClick={() => setPeriod("H2")}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all duration-200 ${period === "H2" ? "bg-brand-red text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
                >
                  H2 (M7–12)
                </button>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 20, bottom: 35, left: 55 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="avg_burnout_index" 
                  name="Burnout Index" 
                  stroke="#64748B" 
                  fontSize={10} 
                  domain={[0.55, 0.65]} 
                  tickCount={6} 
                  label={{ value: 'Staff Burnout Risk Index', fill: '#94A3B8', position: 'insideBottom', offset: -2, fontSize: 9, fontWeight: 'bold' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="readmission_rate" 
                  name="Readmission Rate" 
                  stroke="#64748B" 
                  fontSize={10} 
                  unit="%" 
                  domain={[10, 22]} 
                  label={{ value: '30-Day Readmission Rate', fill: '#94A3B8', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, offset: -40, fontSize: 9, fontWeight: 'bold' }}
                />
                <ZAxis type="number" dataKey="total_visits" range={[100, 1000]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  itemStyle={{ fontSize: 11 }}
                />
                
                {/* Visual Legend explaining standard vs warning colors */}
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  height={24} 
                  iconSize={8} 
                  wrapperStyle={{ fontSize: 9, fontWeight: 'bold', color: '#94A3B8', marginTop: -10 }} 
                />
                
                {/* Benchmark Lines positioned cleanly at start/end areas away from data clusters */}
                <ReferenceLine y={11.0} stroke="#64748B" strokeDasharray="4 4" label={{ value: 'NHS Target: 11%', fill: '#64748B', position: 'insideTopLeft', offset: 10, fontSize: 9 }} />
                <ReferenceLine x={0.60} stroke="#64748B" strokeDasharray="4 4" label={{ value: 'Burnout Threshold', fill: '#64748B', position: 'insideTopRight', offset: 10, fontSize: 9 }} />
                
                {/* Glowing Warning Red Outlier H07 */}
                <Scatter
                  name={highlightedId === "H07" ? "Outlier Hospital (Sandwell H07)" : `Selected Hospital (${getHospitalName(highlightedId)})`}
                  data={scatterData.filter(h => h.hospital_id === highlightedId)}
                  fill="#EF4444"
                  fillOpacity={0.9}
                  className="animate-pulse"
                />
                
                {/* Standard Blue Bubbles */}
                <Scatter
                  name={filters.hospital ? "Other Network Hospitals" : "Standard Network Hospitals"}
                  data={scatterData.filter(h => h.hospital_id !== highlightedId)}
                  fill="#0EA5E9"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Readmission Escalation Line Chart */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Monthly Readmission Escalation</h4>
            <p className="text-xs text-slate-500">
              {highlightedId === "H07"
                ? "Monthly readmission trend for Sandwell General (H07) compared to network baseline"
                : `Monthly readmission trend for ${getHospitalName(highlightedId)} compared to network baseline`}
            </p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pivotedLineData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} domain={[10, 22]} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  itemStyle={{ fontSize: 10 }}
                  formatter={(value, name) => {
                    return [`${value}%`, getHospitalName(name)];
                  }}
                />
                
                {/* Dynamic custom legend representing standard vs focused highlights */}
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  height={24} 
                  iconSize={8} 
                  wrapperStyle={{ fontSize: 9, fontWeight: 'bold', color: '#94A3B8', marginTop: -10 }}
                  payload={[
                    { value: highlightedId === "H07" ? "Outlier Hospital (Sandwell H07)" : `Selected Hospital (${getHospitalName(highlightedId)})`, type: "line", id: "highlight", color: "#EF4444" },
                    { value: filters.hospital ? "Other Network Hospitals" : "Standard Network Hospitals", type: "line", id: "standard", color: "#334155" }
                  ]}
                />

                {/* Clinical safety target reference line */}
                <ReferenceLine y={11.0} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'NHS Target: 11%', fill: '#EF4444', fillOpacity: 0.7, position: 'insideTopLeft', offset: 10, fontSize: 8 }} />

                {/* Standard network hospitals drawn in thin, background-muted slate */}
                {standardIds.map(id => (
                  <Line 
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    stroke="#334155"
                    strokeWidth={1}
                    strokeOpacity={0.4}
                    dot={false}
                    activeDot={false}
                  />
                ))}

                {/* Sandwell General highlighted in bright glowing warnings red */}
                <Line
                  type="monotone"
                  dataKey={highlightedId}
                  name={highlightedId}
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ fill: '#EF4444', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row Grid (55/45 Sankey vs Grid Heatmap) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sankey Flow */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 lg:col-span-3 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">
              {getHospitalName(highlightedId)} Patient Trajectory Flow
            </h4>
            <p className="text-xs text-slate-500">Sankey diagram showing Admission Type ➔ Severity Level ➔ Outcome path</p>
          </div>
          <div className="p-2 bg-slate-900/40 rounded-md border border-slate-800/80 flex items-center justify-center">
            {renderSankeySVG()}
          </div>
        </div>

        {/* Heatmap severity wait */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 lg:col-span-2 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">
              {highlightedId} Wait Time Bottlenecks
            </h4>
            <p className="text-xs text-slate-500">Wait times crossed by Severity Level vs. Weekday</p>
          </div>
          <div className="p-1.5 bg-slate-900/30 rounded-md border border-slate-800/50">
            {renderSeverityHeatmap()}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[8px] text-slate-500 font-bold px-1 uppercase tracking-wider">
            <span>Fast (&lt;50m)</span>
            <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-950/20" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-sky-500/30" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-[1px] bg-red-500/60" />
            <span>Slow (&gt;95m)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
