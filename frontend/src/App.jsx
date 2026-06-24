import React, { useState, useEffect } from 'react';
import OverviewPage from './pages/OverviewPage';
import OutlierPage from './pages/OutlierPage';
import SectorPage from './pages/SectorPage';
import BurnoutPage from './pages/BurnoutPage';
import { Layers, Activity, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const REGIONS = [
  { id: "", name: "All Regions" },
  { id: "R01", name: "Greater London" },
  { id: "R02", name: "South East England" },
  { id: "R03", name: "South West England" },
  { id: "R04", name: "East of England" },
  { id: "R05", name: "Midlands" },
  { id: "R06", name: "North West England" }
];

const TRUST_TYPES = [
  { id: "", name: "All Sectors" },
  { id: "NHS Foundation Trust", name: "NHS Foundation Trust" },
  { id: "NHS Trust", name: "NHS Trust" },
  { id: "Independent / Private", name: "Private Facility" }
];

const HOSPITALS = [
  { id: "", name: "All Hospitals" },
  { id: "H01", name: "King's College Hospital" },
  { id: "H02", name: "Nuffield Health Woking" },
  { id: "H03", name: "Royal Cornwall Hospital" },
  { id: "H04", name: "UCL Hospitals" },
  { id: "H05", name: "Alder Hey Children's" },
  { id: "H06", name: "Norfolk & Norwich" },
  { id: "H07", name: "Sandwell General (H07)" },
  { id: "H08", name: "Spire Manchester" },
  { id: "H09", name: "Leeds General" },
  { id: "H10", name: "Harrogate District" },
  { id: "H11", name: "Bristol Royal" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Global Filters
  const [filters, setFilters] = useState({
    region: "",
    trustType: "",
    hospital: ""
  });

  // Global KPIs synchronized at header
  const [kpis, setKpis] = useState({
    total_visits: 9994,
    readmission_rate: 17.04,
    avg_wait_time: 61.4,
    avg_burnout_index: 0.59
  });

  useEffect(() => {
    const fetchGlobalKPIs = async () => {
      const queryParams = new URLSearchParams();
      if (filters.region) queryParams.append("region", filters.region);
      if (filters.trustType) queryParams.append("trust_type", filters.trustType);
      if (filters.hospital) queryParams.append("hospital_id", filters.hospital);
      
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : "";
      
      try {
        const res = await fetch(`${API_BASE}/overview/kpis${queryStr}`);
        if (res.ok) {
          const data = await res.json();
          setKpis(data);
        }
      } catch (err) {
        console.warn("Global KPI header using in-memory benchmarks.", err);
      }
    };
    
    fetchGlobalKPIs();
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewPage filters={filters} />;
      case "outliers":
        return <OutlierPage filters={filters} />;
      case "sector":
        return <SectorPage filters={filters} />;
      case "burnout":
        return <BurnoutPage filters={filters} />;
      default:
        return <OverviewPage filters={filters} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100 font-sans flex flex-col">
      {/* 1. unified Floating Executive Navigation Bar */}
      <header className="sticky top-0 z-50 bg-brand-bg/95 border-b border-slate-800/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-cyan/15 p-2 rounded-md border border-brand-cyan/20">
            <Cpu className="w-5 h-5 text-brand-cyan" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide uppercase text-slate-100">CODE BLUE</h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Emergency Operations & Patient Flow Analytics</p>
          </div>
        </div>

        {/* Global KPIs mini ribbon */}
        <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded-md">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Total Visits</span>
            <span className="text-xs font-black text-slate-100">{kpis.total_visits.toLocaleString()}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Readmit Rate</span>
            <span className={`text-xs font-black ${kpis.readmission_rate > 11.0 ? 'text-brand-red' : 'text-brand-cyan'}`}>
              {kpis.readmission_rate}%
            </span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Avg Wait</span>
            <span className="text-xs font-black text-brand-cyan">{Math.round(kpis.avg_wait_time)}m</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Burnout Index</span>
            <span className="text-xs font-black text-brand-purple">{kpis.avg_burnout_index}</span>
          </div>
        </div>

        {/* Dynamic Filter Ribbon */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          {/* Region Select */}
          <div className="flex flex-col w-full sm:w-36">
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange("region", e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:border-brand-cyan w-full"
            >
              {REGIONS.map(reg => (
                <option key={reg.id} value={reg.id}>{reg.name}</option>
              ))}
            </select>
          </div>

          {/* Trust Type Select */}
          <div className="flex flex-col w-full sm:w-36">
            <select
              value={filters.trustType}
              onChange={(e) => handleFilterChange("trustType", e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:border-brand-cyan w-full"
            >
              {TRUST_TYPES.map(trust => (
                <option key={trust.id} value={trust.id}>{trust.name}</option>
              ))}
            </select>
          </div>

          {/* Hospital Select */}
          <div className="flex flex-col w-full sm:w-48">
            <select
              value={filters.hospital}
              onChange={(e) => handleFilterChange("hospital", e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:border-brand-cyan w-full"
            >
              {HOSPITALS.map(hosp => (
                <option key={hosp.id} value={hosp.id}>{hosp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Tabs bar */}
      <nav className="bg-slate-900/40 border-b border-slate-800/40 px-6 py-2.5 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all duration-200 ${activeTab === "overview" ? "bg-brand-card text-brand-cyan border-b-2 border-brand-cyan" : "text-slate-400 hover:text-slate-200"}`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>System Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("outliers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all duration-200 ${activeTab === "outliers" ? "bg-brand-card text-brand-red border-b-2 border-brand-red" : "text-slate-400 hover:text-slate-200"}`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>YoY Trajectory Shift {filters.hospital ? `(${filters.hospital})` : "(H07)"}</span>
        </button>

        <button
          onClick={() => setActiveTab("sector")}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all duration-200 ${activeTab === "sector" ? "bg-brand-card text-brand-cyan border-b-2 border-brand-cyan" : "text-slate-400 hover:text-slate-200"}`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>The Sector Divide Paradox</span>
        </button>

        <button
          onClick={() => setActiveTab("burnout")}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all duration-200 ${activeTab === "burnout" ? "bg-brand-card text-brand-purple border-b-2 border-brand-purple" : "text-slate-400 hover:text-slate-200"}`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Burnout & Financial Squeeze</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {renderActivePage()}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 text-center py-4 text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
        Code Blue Platform © 2026 • Powered by Supabase & FastAPI
      </footer>
    </div>
  );
}
