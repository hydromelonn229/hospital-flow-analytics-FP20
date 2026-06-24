import React, { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, Legend } from 'recharts';
import { Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-800 rounded-md ${className}`} />
);

const cleanHospitalName = (name) => {
  if (!name) return "";
  return name
    .replace(/\s+NHS\s+Foundation\s+Trust/gi, "")
    .replace(/\s+NHS\s+FT/gi, "")
    .replace(/\s+NHS\s+Trust/gi, "")
    .replace(/\s+University\s+Hospital/gi, "")
    .replace(/\s+Hospitals/gi, "")
    .replace(/\s+Hospital/gi, "")
    .replace(/\s+Infirmary/gi, "")
    .replace(/Nuffield Health/gi, "Nuffield")
    .replace(/University College London/gi, "UCL")
    .replace(/Leeds General/gi, "Leeds Gen")
    .replace(/Alder Hey Children's/gi, "Alder Hey Childrens")
    .replace(/Harrogate District/gi, "Harrogate Dist")
    .trim();
};

export default function SectorPage({ filters }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data States
  const [radarData, setRadarData] = useState([]);
  const [divergingData, setDivergingData] = useState([]);
  const [regionData, setRegionData] = useState([]);
  const [tableData, setTableData] = useState([]);
  
  // Table state
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("readmission_rate");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchSectorData = async () => {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      if (filters.region) queryParams.append("region", filters.region);
      if (filters.trustType) queryParams.append("trust_type", filters.trustType);
      if (filters.hospital) queryParams.append("hospital_id", filters.hospital);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";
      
      try {
        const [radarRes, divRes, regRes, tblRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/radar-profiles${queryStr}`),
          fetch(`${API_BASE}/analytics/diverging-wait${queryStr}`),
          fetch(`${API_BASE}/analytics/regional-choropleth${queryStr}`),
          fetch(`${API_BASE}/hospitals/outliers${queryStr}`) // Fetch full details ledger
        ]);

        if (!radarRes.ok || !divRes.ok || !regRes.ok || !tblRes.ok) {
          throw new Error("Failed to load sector comparison indicators.");
        }

        const [radarVal, divVal, regVal, tblVal] = await Promise.all([
          radarRes.json(),
          divRes.json(),
          regRes.json(),
          tblRes.json()
        ]);

        setRadarData(radarVal);
        setDivergingData(divVal.map(row => ({
          ...row,
          hospital_name: cleanHospitalName(row.hospital_name)
        })));
        setRegionData(regVal);
        
        const tblValMapped = tblVal.map(row => {
          const isPrivate = row.nhs_trust_type === "Independent / Private";
          
          let calculatedStress = row.staffing_stress;
          const burnout = row.avg_burnout_index;
          const waitTime = row.avg_wait_time;
          const readmissionRate = row.readmission_rate;
          
          if (burnout !== undefined && burnout !== null) {
            const readmissionFraction = readmissionRate / 100;
            const score =
              (burnout > 0.62 ? 2 : burnout > 0.60 ? 1 : 0) +
              (waitTime > 90 ? 2 : waitTime > 60 ? 1 : 0) +
              (readmissionFraction > 0.19 ? 2 : readmissionFraction > 0.15 ? 1 : 0);

            if (score >= 5) calculatedStress = "CRITICAL";
            else if (score >= 3) calculatedStress = "HIGH";
            else if (score >= 1) calculatedStress = "MODERATE";
            else calculatedStress = "LOW";
          }
          
          return {
            ...row,
            private: isPrivate,
            staffing_stress: calculatedStress
          };
        });
        setTableData(tblValMapped);
      } catch (err) {
        console.error("API error, using robust fallback...", err);
        setError("Database server offline. Rendered in fallback mode.");
        loadFallbacks();
      } finally {
        setLoading(false);
      }
    };

    fetchSectorData();
  }, [filters]);

  const loadFallbacks = () => {
    setRadarData([
      { subject: "Wait Time (min)", NHS: 56.7, Private: 102.3 },
      { subject: "Satisfaction (%)", NHS: 64.2, Private: 88.5 },
      { subject: "Burnout Index", NHS: 0.612, Private: 0.385 },
      { subject: "Readmissions (%)", NHS: 17.5, Private: 4.8 },
      { subject: "Profit Margin (%)", NHS: 0.0, Private: 28.5 },
      { subject: "ICU Admits (%)", NHS: 14.8, Private: 8.2 }
    ]);
    
    setDivergingData([
      { hospital_name: cleanHospitalName("Nuffield Woking Hospital"), private: true, divergence: 45.8, avg_wait_time: 107.2 },
      { hospital_name: cleanHospitalName("Spire Manchester Hospital"), private: true, divergence: 38.6, avg_wait_time: 100.0 },
      { hospital_name: cleanHospitalName("King's College Hospital"), private: false, divergence: -32.7, avg_wait_time: 28.7 },
      { hospital_name: cleanHospitalName("Sandwell General Hospital"), private: false, divergence: 13.9, avg_wait_time: 75.3 }
    ]);
    
    setRegionData([
      { region_id: "R01", region_name: "Greater London", readmission_rate: 16.8, avg_wait_time: 68.2 },
      { region_id: "R02", region_name: "South East England", readmission_rate: 14.5, avg_wait_time: 59.4 },
      { region_id: "R03", region_name: "Midlands", readmission_rate: 20.8, avg_wait_time: 78.5 }
    ]);

    setTableData([
      { hospital_id: "H01", hospital_name: "King's College Hospital NHS FT", nhs_trust_type: "NHS Foundation Trust", city: "London", total_visits: 890, readmission_rate: 14.2, avg_wait_time: 28.7, avg_satisfaction: 64.2, staffing_stress: "MODERATE", private: false },
      { hospital_id: "H02", hospital_name: "Nuffield Health Woking Hospital", nhs_trust_type: "Independent / Private", city: "Woking", total_visits: 340, readmission_rate: 4.5, avg_wait_time: 107.2, avg_satisfaction: 91.0, staffing_stress: "LOW", private: true },
      { hospital_id: "H07", hospital_name: "Sandwell General Hospital", nhs_trust_type: "NHS Trust", city: "West Bromwich", total_visits: 985, readmission_rate: 21.8, avg_wait_time: 75.3, avg_satisfaction: 48.2, staffing_stress: "HIGH", private: false }
    ]);
  };

  const getReadmissionColorClass = (rate) => {
    const allRates = tableData.map(h => h.readmission_rate);
    if (allRates.length === 0) return "text-slate-300 font-medium";
    const avg = allRates.reduce((a, b) => a + b, 0) / allRates.length;
    if (rate > avg + 0.8) return "text-brand-red font-extrabold";
    if (rate < avg - 0.8) return "text-brand-green font-extrabold";
    return "text-slate-300 font-medium";
  };

  // Sort helper
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getSortedData = () => {
    let filtered = tableData.filter(h => 
      h.hospital_name.toLowerCase().includes(search.toLowerCase()) || 
      h.city.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  };

  const renderSortArrow = (field) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-[250px]" />
      </div>
    );
  }

  const sortedData = getSortedData();

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-brand-red/10 border border-brand-red/30 rounded-md p-3 text-brand-red text-sm animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Row: Radar Performance Profile (55%) & Sector Performance Gap (45%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6">
        {/* Left Column: Radar Chart */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">NHS vs. Private Hospital Performance Profiles</h4>
            <p className="text-xs text-slate-500">Overlay comparing sector averages across 6 critical operational dimensions</p>
          </div>
          <div className="h-[280px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                <PolarGrid stroke="#1E293B" />
                <PolarAngleAxis dataKey="subject" stroke="#64748B" fontSize={9} fontWeight="bold" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#1E293B" fontSize={8} />
                
                {/* NHS Trace in Cyan */}
                <Radar name="NHS Public Averages" dataKey="NHS" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.15} />
                
                {/* Private Trace in Purple */}
                <Radar name="Private Averages" dataKey="Private" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} />
                
                <Tooltip contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }} />
                <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Dumbbell Chart */}
        <SectorDumbbellChart />
      </div>

      {/* Middle Row Grid (50/50 Diverging Wait vs Regional Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diverging Wait time */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-200 text-sm tracking-wide">Wait Time Divergence from Network Average</h4>
              <p className="text-xs text-slate-500">Hospitals extending right (above target wait time of 61.4m) expose the private sector paradox</p>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] font-bold self-start sm:self-auto shrink-0">
              <div className="flex items-center gap-1.5 text-[#0EA5E9]">
                <span className="text-[12px]">●</span>
                <span>NHS / Public Sector</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#6366F1]">
                <span className="text-[12px]">●</span>
                <span>Private Sector</span>
              </div>
            </div>
          </div>
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divergingData} layout="vertical" margin={{ top: 25, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={9} />
                <YAxis dataKey="hospital_name" type="category" stroke="#64748B" fontSize={9} width={115} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#131926", borderColor: "#1E293B", color: "#F8FAFC" }}
                  formatter={(value) => [`${value} mins`, "Variance"]}
                />
                <ReferenceLine 
                  x={0} 
                  stroke="#475569" 
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{ 
                    value: 'Average Waiting Time', 
                    fill: '#94A3B8', 
                    position: 'top', 
                    fontSize: 9, 
                    fontWeight: 'bold',
                    offset: 8
                  }} 
                />
                <Bar dataKey="divergence">
                  {divergingData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.private ? "#6366F1" : "#0EA5E9"} // Private in Purple, NHS in Blue
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* UK Regional performance dashboard grid */}
        <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Regional Network Performance</h4>
            <p className="text-xs text-slate-500">Comparative regional breakdown of clinical readmissions and wait times</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {regionData.map(reg => (
              <div key={reg.region_id} className="bg-slate-900 border border-slate-800 p-3 rounded-md flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200">{reg.region_name}</span>
                  <span className="text-[9px] text-slate-500 font-bold tracking-widest">{reg.region_id}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Readmit Rate</span>
                    <span className={`text-sm font-extrabold ${reg.readmission_rate > 17.0 ? 'text-brand-red' : 'text-brand-green'}`}>
                      {reg.readmission_rate}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Avg Wait</span>
                    <span className="text-sm font-extrabold text-brand-cyan">
                      {Math.round(reg.avg_wait_time)}m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Full Width Sortable ledger table */}
      <div className="bg-brand-card border border-slate-800 rounded-md p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-200 text-sm tracking-wide">Facility Comparison Ledger</h4>
            <p className="text-xs text-slate-500">Comprehensive sortable record database of clinical flow indices</p>
          </div>
          
          {/* Search box */}
          <div className="relative max-w-xs self-start sm:self-auto w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-500" />
            </span>
            <input
              type="text"
              placeholder="Search hospital or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-md pl-9 pr-4 py-2 w-full focus:outline-none focus:border-brand-cyan"
            />
          </div>
        </div>

        {/* High Density Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-md bg-slate-900/20 font-sans">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-[10px] text-slate-500 uppercase font-bold tracking-wider select-none">
                <th onClick={() => handleSort("hospital_name")} className="px-4 py-3 cursor-pointer hover:text-slate-300 transition-colors">
                  Hospital {renderSortArrow("hospital_name")}
                </th>
                <th onClick={() => handleSort("city")} className="px-4 py-3 cursor-pointer hover:text-slate-300 transition-colors">
                  City {renderSortArrow("city")}
                </th>
                <th onClick={() => handleSort("private")} className="px-4 py-3 cursor-pointer hover:text-slate-300 transition-colors">
                  Sector {renderSortArrow("private")}
                </th>
                <th onClick={() => handleSort("total_visits")} className="px-4 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors">
                  Visits {renderSortArrow("total_visits")}
                </th>
                <th onClick={() => handleSort("readmission_rate")} className="px-4 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors">
                  Readmit Rate {renderSortArrow("readmission_rate")}
                </th>
                <th onClick={() => handleSort("avg_wait_time")} className="px-4 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors">
                  Avg Wait {renderSortArrow("avg_wait_time")}
                </th>
                <th onClick={() => handleSort("avg_satisfaction")} className="px-4 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors">
                  Satisfaction {renderSortArrow("avg_satisfaction")}
                </th>
                <th onClick={() => handleSort("staffing_stress")} className="px-4 py-3 cursor-pointer hover:text-slate-300 transition-colors">
                  Stress {renderSortArrow("staffing_stress")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {sortedData.length > 0 ? (
                sortedData.map((row) => (
                  <tr key={row.hospital_id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">{row.hospital_name}</td>
                    <td className="px-4 py-3 text-slate-400">{row.city}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold ${row.private ? 'bg-brand-purple/10 text-brand-purple' : 'bg-brand-cyan/10 text-brand-cyan'}`}>
                        {row.private ? "Private" : "NHS"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-medium">{row.total_visits.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right ${getReadmissionColorClass(row.readmission_rate)}`}>
                      {row.readmission_rate}%
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-200">{Math.round(row.avg_wait_time)} min</td>
                    <td className="px-4 py-3 text-right text-brand-green font-bold">{row.avg_satisfaction}%</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        row.staffing_stress === 'CRITICAL' ? 'text-brand-red animate-pulse' :
                        row.staffing_stress === 'HIGH' ? 'text-brand-red' :
                        row.staffing_stress === 'MODERATE' ? 'text-slate-400' :
                        'text-brand-green'
                      }`}>
                        {row.staffing_stress}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-semibold">
                    No matching hospital records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectorDumbbellChart() {
  const [hoveredRow, setHoveredRow] = useState(null);
  
  const data = [
    { metric: "Wait Time", nhs: 57.4, pvt: 78.0, min: 45, max: 90, unit: "min", paradox: true },
    { metric: "Readmission Rate", nhs: 17.1, pvt: 16.8, min: 16.5, max: 17.4, unit: "%", paradox: false },
    { metric: "Satisfaction", nhs: 62.4, pvt: 62.3, min: 62.0, max: 62.7, unit: "%", paradox: false },
    { metric: "Burnout Index", nhs: 0.594, pvt: 0.592, min: 0.588, max: 0.598, unit: "index", paradox: false },
    { metric: "ICU Rate", nhs: 16.4, pvt: 16.6, min: 16.0, max: 17.0, unit: "%", paradox: false },
    { metric: "Profit Margin", nhs: 22.1, pvt: 28.4, min: 20.0, max: 30.0, unit: "%", paradox: false }
  ];

  const getDeltaSymbol = (diff) => {
    if (diff > 0) return "+";
    if (diff < 0) return "−"; // True typographer minus sign
    return "";
  };

  const getDeltaText = (row) => {
    const diff = row.pvt - row.nhs;
    const absDiff = Math.abs(diff).toFixed(row.metric === "Burnout Index" ? 3 : 1);
    const unit = row.unit === "index" ? " index" : ` ${row.unit}`;
    if (row.metric === "Wait Time") {
      return `+20.6 min above NHS`;
    }
    if (diff > 0) {
      return `+${absDiff}${unit} above NHS`;
    } else if (diff < 0) {
      return `-${absDiff}${unit} below NHS`;
    }
    return `No gap`;
  };

  const getRowPositions = (row) => {
    const range = row.max - row.min;
    const nhsPct = range > 0 ? ((row.nhs - row.min) / range) * 100 : 50;
    const pvtPct = range > 0 ? ((row.pvt - row.min) / range) * 100 : 50;
    return { nhsPct, pvtPct };
  };

  return (
    <div className="bg-brand-card border border-slate-800 rounded-md p-6 flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div>
          <h4 className="font-bold text-slate-200 text-sm tracking-wide">Sector Performance Gap</h4>
          <p className="text-xs text-slate-500">NHS vs Private averages across 6 operational dimensions</p>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-bold self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-[#0EA5E9]">
            <span className="text-[12px]">●</span>
            <span>NHS Average</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#6366F1]">
            <span className="text-[12px]">●</span>
            <span>Private Average</span>
          </div>
        </div>
      </div>

      {/* 6 Rows Stacked */}
      <div className="flex-1 flex flex-col justify-between py-1 space-y-1">
        {data.map((row, idx) => {
          const { nhsPct, pvtPct } = getRowPositions(row);
          const isHovered = hoveredRow === idx;
          const labelUnit = row.unit === "index" ? "" : row.unit;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredRow(idx)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                backgroundColor: row.paradox ? '#EF444408' : isHovered ? '#1E293B' : 'transparent'
              }}
              className="flex items-center h-[44px] w-full px-3 rounded-md transition-all duration-150 relative"
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 bg-[#131926] border border-slate-800 rounded-md px-3 py-1.5 shadow-xl pointer-events-none flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-slate-200">
                  <span className="font-bold text-slate-100">{row.metric}:</span>
                  <span className="text-[#0EA5E9]">NHS {row.nhs}{labelUnit}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-[#6366F1]">Private {row.pvt}{labelUnit}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-brand-red font-bold">{getDeltaText(row)}</span>
                </div>
              )}

              {/* Metric Label */}
              <div 
                className={`text-xs font-bold w-[130px] shrink-0 transition-colors duration-150 ${
                  row.paradox ? 'text-[#F8FAFC]' : 'text-[#64748B]'
                }`}
              >
                {row.metric} {row.unit !== "index" && `(${row.unit})`}
              </div>

              {/* Dumbbell Track */}
              <div className="flex-1 h-8 relative ml-4 mr-3">
                {/* Baseline track line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-[#2D3748] -translate-y-1/2" />

                {/* Connecting Line between dots */}
                <div
                  style={{
                    left: `${Math.min(nhsPct, pvtPct)}%`,
                    width: `${Math.abs(nhsPct - pvtPct)}%`,
                    background: 'linear-gradient(to right, #0EA5E9, #6366F1)'
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 rounded-full ${
                    row.paradox ? 'h-[3px]' : 'h-[2px]'
                  }`}
                />

                {/* NHS Dot */}
                <div
                  style={{
                    left: `calc(${nhsPct}% - ${row.paradox ? '6.5px' : '5px'})`,
                    width: row.paradox ? '13px' : '10px',
                    height: row.paradox ? '13px' : '10px',
                    transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
                    transition: 'transform 150ms ease'
                  }}
                  className="absolute top-1/2 rounded-full bg-[#0EA5E9] shadow-sm z-10 cursor-pointer"
                  title={`NHS: ${row.nhs}`}
                />

                {/* Private Dot */}
                <div
                  style={{
                    left: `calc(${pvtPct}% - ${row.paradox ? '6.5px' : '5px'})`,
                    width: row.paradox ? '13px' : '10px',
                    height: row.paradox ? '13px' : '10px',
                    transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
                    transition: 'transform 150ms ease'
                  }}
                  className="absolute top-1/2 rounded-full bg-[#6366F1] shadow-sm z-10 cursor-pointer"
                  title={`Private: ${row.pvt}`}
                />
              </div>

              {/* Value columns flanking the dots */}
              <div className="flex items-center gap-3 shrink-0 justify-end w-48 pl-2">
                <div className="flex flex-col items-end justify-center w-28">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-extrabold text-[#0EA5E9]">
                      {row.nhs}{row.unit === "index" ? "" : row.unit}
                    </span>
                    <span className="text-[#334155] text-[10px] select-none">|</span>
                    <span className="text-[11px] font-extrabold text-[#6366F1]">
                      {row.pvt}{row.unit === "index" ? "" : row.unit}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-bold mt-0.5 ${
                      row.paradox ? 'text-[#EF4444]' : 'text-[#64748B]'
                    }`}
                  >
                    Δ {getDeltaSymbol(row.pvt - row.nhs)}{Math.abs(row.pvt - row.nhs).toFixed(row.metric === "Burnout Index" ? 3 : 1)}{row.unit === "index" ? "" : row.unit}
                  </span>
                </div>
                
                {/* Paradox Badge */}
                {row.paradox ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20 animate-pulse shrink-0 tracking-wide">
                    PARADOX
                  </span>
                ) : (
                  <span className="w-[53px] shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
