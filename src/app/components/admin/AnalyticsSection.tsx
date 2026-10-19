import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  FlaskConical, HeartPulse, Cpu, Calendar, Activity, Users,
  ChevronDown, Info, TrendingUp, SkipForward, Beaker,
} from "lucide-react";
import type { AdminPrescription, Patient, Machine, DialysisSession } from "../../AdminApp";
import { clinicalValue, recorded, investigationStats, investigationPaths } from "../../../../shared/clinical-data.mjs";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalyticsCategory = "clinical" | "viral" | "prescription" | "dialysis" | "outcomes" | "machines" | "missed-slots" | "additional";
type DateRange = "today" | "week" | "month" | "3months" | "year" | "custom";
type UnitFilter = "all" | "U1" | "U2";

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTIGATION_OPTIONS = [
  "All Clinical Investigations",
  "CBC",
  "Serum Ferritin",
  "Serum Calcium",
  "Thyroid Profile",
  "2D Echo",
  "EF",
  "Serum Phosphorous",
  "Renal Function Test",
];

const PIE_COLORS = ["#2563eb", "#7c3aed", "#dc2626", "#d97706", "#059669", "#0891b2", "#9333ea", "#64748b"];

const CATEGORY_TABS: { id: AnalyticsCategory; label: string; icon: React.ReactNode }[] = [
  { id: "clinical",      label: "Clinical Investigation",   icon: <FlaskConical className="w-4 h-4" /> },
  { id: "viral",         label: "Viral Status",             icon: <Activity className="w-4 h-4" /> },
  { id: "prescription",  label: "Prescription",             icon: <Calendar className="w-4 h-4" /> },
  { id: "dialysis",      label: "Dialysis",                 icon: <HeartPulse className="w-4 h-4" /> },
  { id: "outcomes",      label: "Patient Outcomes",         icon: <Users className="w-4 h-4" /> },
  { id: "machines",      label: "Machine Utilization",      icon: <Cpu className="w-4 h-4" /> },
  { id: "missed-slots",  label: "Missed Slots",             icon: <SkipForward className="w-4 h-4" /> },
  { id: "additional",    label: "Additional Clinical",      icon: <Beaker className="w-4 h-4" /> },
];

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const ring = color === "blue" ? "border-l-blue-500" : color === "green" ? "border-l-green-500" : color === "violet" ? "border-l-violet-500" : color === "red" ? "border-l-red-500" : color === "amber" ? "border-l-amber-500" : "border-l-slate-400";
  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${ring} p-4 shadow-sm`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function NoDataNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-700">{message}</p>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; fill?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      {label && <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.fill ?? "#2563eb" }}>
          {p.name ? `${p.name}: ` : ""}{p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Category panels ──────────────────────────────────────────────────────────

function ClinicalInvestigationPanel({ patients }: { patients: Patient[] }) {
  const [selectedInvestigation, setSelectedInvestigation] = useState("All Clinical Investigations");
  const total = patients.length;

  const stats = investigationStats(patients, selectedInvestigation);
  const countParam = (path: string) => patients.filter(p => recorded(clinicalValue(p,path))).length;
  const numericStats = (path: string) => {
    const values = patients.map(p=>clinicalValue(p,path)).filter(v=>recorded(v)&&Number.isFinite(Number(v))).map(Number);
    return { count: values.length, average: values.length ? (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1) : "N/A",
      min: values.length?Math.min(...values):"N/A", max: values.length?Math.max(...values):"N/A" };
  };
  const mcvStats = numericStats("cbc.mcv");
  const recordedCount = stats.recorded;
  const pct = total > 0 ? Math.round((recordedCount / total) * 100) : 0;

  const renderInvestigationDetail = () => {
    if (selectedInvestigation === "All Clinical Investigations") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={total} color="blue" />
            <StatCard label="With Investigation Data" value={recordedCount} sub={`${pct}% complete`} color="green" />
            <StatCard label="Without Investigation Data" value={stats.missing} sub={`${100-pct}% pending`} color="amber" />
            <StatCard label="Overall Completion" value={`${pct}%`} color="slate" />
          </div>
          {!recordedCount && <NoDataNote message="No investigation values have been recorded for these patients." />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {["CBC (Hb, TLC, PLT, MCV)", "Serum Ferritin", "Serum Calcium", "Thyroid Profile (T3, T4, TSH)", "2D Echo", "EF (%)", "Serum Phosphorous", "Renal Function Test"].map(inv => (
              <div key={inv} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3">{inv}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Recorded</span>
                  <span className="font-bold text-slate-800">{investigationStats(patients, Object.keys(investigationPaths)[["CBC (Hb, TLC, PLT, MCV)", "Serum Ferritin", "Serum Calcium", "Thyroid Profile (T3, T4, TSH)", "2D Echo", "EF (%)", "Serum Phosphorous", "Renal Function Test"].indexOf(inv)]).recorded} / {total}</span>
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${investigationStats(patients, Object.keys(investigationPaths)[["CBC (Hb, TLC, PLT, MCV)", "Serum Ferritin", "Serum Calcium", "Thyroid Profile (T3, T4, TSH)", "2D Echo", "EF (%)", "Serum Phosphorous", "Renal Function Test"].indexOf(inv)]).percentage}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Based on saved patient investigations</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (selectedInvestigation === "CBC") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Patients with CBC" value={stats.recorded} sub={`${stats.recorded} of ${total}`} color="blue" />
            <StatCard label="Pending" value={stats.missing} color="amber" />
            <StatCard label="Completion" value={`${pct}%`} color="slate" />
            <StatCard label="Parameters" value={4} sub="Hb, TLC, PLT, MCV" color="violet" />
          </div>
          {!recordedCount && <NoDataNote message="No CBC values are recorded for these patients." />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["Hb (Haemoglobin)", "TLC (Leukocyte Count)", "PLT (Platelet Count)", "MCV (Mean Corpuscular Vol.)"].map(param => (
              <div key={param} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-700 mb-2">{param}</p>
                <p className="text-xl font-bold text-slate-800">{countParam(`cbc.${param.split(" ")[0].toLowerCase()}`)}</p>
                <p className="text-xs text-slate-400 mt-0.5">of {total} recorded</p>
              </div>
            ))}
          </div>
          {/* MCV numeric analytics */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">MCV — Numeric Analytics</h4>
            <p className="text-xs text-slate-400 italic mb-3">MCV analytics use only actual recorded numeric values. No values are generated.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Patients with MCV" value={mcvStats.count} color="blue" />
              <StatCard label="Average MCV" value={mcvStats.average} color="slate" />
              <StatCard label="Minimum MCV" value={mcvStats.min} color="slate" />
              <StatCard label="Maximum MCV" value={mcvStats.max} color="slate" />
            </div>
          </div>
        </div>
      );
    }

    if (selectedInvestigation === "EF") {
      return (
        <div className="space-y-4">
          {!recordedCount && <NoDataNote message="No EF values have been recorded. Only saved numeric values are used for averages." />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Patients with EF Recorded" value={stats.recorded} color="blue" />
            <StatCard label="Average EF" value={stats.average ?? "N/A"} color="slate" />
            <StatCard label="Minimum EF" value={stats.minimum ?? "N/A"} color="slate" />
            <StatCard label="Maximum EF" value={stats.maximum ?? "N/A"} color="slate" />
          </div>
        </div>
      );
    }

    if (selectedInvestigation === "Thyroid Profile") {
      return (
        <div className="space-y-4">
          {!recordedCount && <NoDataNote message="No thyroid profile values are recorded for these patients." />}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {["T3", "T4", "TSH"].map(param => (
              <div key={param} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-2">{param}</p>
                <p className="text-xs text-slate-500">Recorded: <span className="font-bold text-slate-800">{countParam(`thyroidProfile.${param.toLowerCase()}`)} of {total}</span></p>
                <p className="text-xs text-slate-500">Completed: <span className="font-bold text-slate-800">{total ? Math.round(countParam(`thyroidProfile.${param.toLowerCase()}`)/total*100):0}%</span></p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (selectedInvestigation === "Renal Function Test") {
      return (
        <div className="space-y-4">
          {!recordedCount && <NoDataNote message="No renal function test values are recorded for these patients." />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["Urea", "Serum Creatinine"].map(param => (
              <div key={param} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-2">{param}</p>
                <p className="text-xs text-slate-500">Recorded: <span className="font-bold text-slate-800">{countParam(param === "Urea" ? "rft.urea" : "rft.creatinine")} of {total}</span></p>
                <p className="text-xs text-slate-500">Completed: <span className="font-bold text-slate-800">{total ? Math.round(countParam(param === "Urea" ? "rft.urea" : "rft.creatinine")/total*100):0}%</span></p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Serum Ferritin, Serum Calcium, 2D Echo, Serum Phosphorous → Yes/No/Total/Percentage
    return (
      <div className="space-y-4">
        {!recordedCount && <NoDataNote message={`No ${selectedInvestigation} data is recorded for these patients.`} />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Yes (Recorded)" value={stats.recorded} color="green" />
          <StatCard label="No (Not Recorded)" value={stats.missing} color="red" />
          <StatCard label="Total Recorded" value={stats.recorded} sub={`${stats.recorded} of ${total}`} color="blue" />
          <StatCard label="Percentage Recorded" value={`${pct}%`} color="violet" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Clinical Investigation Analytics" sub="Investigation data from patient records" />
      <div className="relative inline-block w-full sm:w-72">
        <select
          value={selectedInvestigation}
          onChange={e => setSelectedInvestigation(e.target.value)}
          className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {INVESTIGATION_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {renderInvestigationDetail()}
    </div>
  );
}

function ViralStatusPanel({ patients }: { patients: Patient[] }) {
  const total = patients.length;

  const counts = useMemo(() => {
    const hbsag = patients.filter(p => p.viralStatus.hepatitisB === "Positive").length;
    const hcv = patients.filter(p => p.viralStatus.hepatitisC === "Positive").length;
    const hiv = patients.filter(p => p.viralStatus.hiv === "Positive").length;
    const awaiting = patients.filter(p =>
      p.viralStatus.hepatitisB === "Awaiting Report" ||
      p.viralStatus.hepatitisC === "Awaiting Report" ||
      p.viralStatus.hiv === "Awaiting Report"
    ).length;
    const unknown = patients.filter(p =>
      !["Positive", "Negative", "Awaiting Report"].includes(p.viralStatus.hepatitisB) ||
      !["Positive", "Negative", "Awaiting Report"].includes(p.viralStatus.hepatitisC) ||
      !["Positive", "Negative", "Awaiting Report"].includes(p.viralStatus.hiv)
    ).length;
    // Negative = all three Negative
    const negative = patients.filter(p =>
      p.viralStatus.hepatitisB === "Negative" &&
      p.viralStatus.hepatitisC === "Negative" &&
      p.viralStatus.hiv === "Negative"
    ).length;

    return { hbsag, hcv, hiv, awaiting, unknown, negative };
  }, [patients]);

  const tableRows = [
    { label: "Negative (All Clear)", count: counts.negative, color: "#059669" },
    { label: "HBsAg",                count: counts.hbsag,    color: "#d97706" },
    { label: "HCV",                  count: counts.hcv,      color: "#7c3aed" },
    { label: "HIV",                  count: counts.hiv,      color: "#dc2626" },
    { label: "Awaiting Report",      count: counts.awaiting, color: "#0891b2" },
    { label: "Unknown",              count: counts.unknown,  color: "#64748b" },
  ].filter(r => r.count > 0);

  const pieData = tableRows.map(r => ({ name: r.label, value: r.count, color: r.color }));

  return (
    <div className="space-y-6">
      <SectionHeader title="Viral Status Analytics" sub="Distribution of registered patients by viral status" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Patients" value={total} color="blue" />
        <StatCard label="Negative" value={counts.negative} color="green" />
        <StatCard label="HBsAg" value={counts.hbsag} color="amber" />
        <StatCard label="HCV" value={counts.hcv} color="violet" />
        <StatCard label="HIV" value={counts.hiv} color="red" />
        <StatCard label="Awaiting / Unknown" value={counts.awaiting + counts.unknown} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Viral Status Distribution</h4>
          {total === 0 ? (
            <p className="text-sm text-slate-400">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val} patient${val !== 1 ? "s" : ""}`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Viral Status Summary</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Viral Status</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Patients</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{row.count}</td>
                    <td className="py-2.5 text-right text-slate-500">
                      {total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-slate-400">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrescriptionPanel({ prescriptions }: { prescriptions: AdminPrescription[] }) {
  const total = prescriptions.length;

  const weeklyDist = useMemo(() => {
    const counts: Record<string, number> = {};
    prescriptions.forEach(rx => {
      const key = rx.dialysisRx.weeklySessionsCount;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const labels = ["1 Session / Week","2 Sessions / Week","3 Sessions / Week","4 Sessions / Week","5 Sessions / Week","6 Sessions / Week","7 Sessions / Week"];
    return labels.map(l => ({ name: l.replace(" / Week", "/Wk"), value: counts[l] ?? 0 }));
  }, [prescriptions]);

  const daysDist = useMemo(() => {
    const counts: Record<string, number> = {};
    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(d => { counts[d] = 0; });
    prescriptions.forEach(rx => {
      rx.dialysisRx.dialysisDays.forEach(d => { counts[d] = (counts[d] ?? 0) + 1; });
    });
    return ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => ({
      name: d.substring(0, 3), value: counts[d],
    }));
  }, [prescriptions]);

  const durationDist = useMemo(() => {
    const counts: Record<string, number> = {};
    ["2 Hours","3 Hours","4 Hours","5 Hours"].forEach(d => { counts[d] = 0; });
    prescriptions.forEach(rx => { counts[rx.dialysisRx.duration] = (counts[rx.dialysisRx.duration] ?? 0) + 1; });
    return ["2 Hours","3 Hours","4 Hours","5 Hours"].map(d => ({ name: d.replace(" Hours", "h"), value: counts[d] }));
  }, [prescriptions]);

  const slotDist = useMemo(() => {
    const counts: Record<string, number> = { "8:00 AM – 12:00 PM": 0, "12:00 PM – 4:00 PM": 0, "4:00 PM – 8:00 PM": 0 };
    prescriptions.forEach(rx => { counts[rx.dialysisRx.slot] = (counts[rx.dialysisRx.slot] ?? 0) + 1; });
    return [
      { name: "8 AM–12 PM", value: counts["8:00 AM – 12:00 PM"] },
      { name: "12–4 PM",    value: counts["12:00 PM – 4:00 PM"] },
      { name: "4–8 PM",     value: counts["4:00 PM – 8:00 PM"] },
    ];
  }, [prescriptions]);

  if (total === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Prescription Analytics" sub="Dialysis prescription distribution" />
        <NoDataNote message="No prescriptions recorded." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Prescription Analytics" sub={`Based on ${total} active prescription${total !== 1 ? "s" : ""}`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Sessions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Weekly Dialysis Sessions</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyDist} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Weekly Sessions" fill="#2563eb" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Dialysis Days */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Dialysis Days Distribution</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daysDist} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Days Distribution" fill="#7c3aed" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Duration */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Session Duration</h4>
          <div className="space-y-3">
            {durationDist.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-12">{d.name}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: total > 0 ? `${Math.max((d.value / total) * 100, d.value > 0 ? 8 : 0)}%` : "0%" }}
                  >
                    {d.value > 0 && <span className="text-xs font-bold text-white">{d.value}</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{total > 0 ? `${Math.round((d.value / total) * 100)}%` : "0%"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slot Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Slot Distribution</h4>
          <div className="space-y-3">
            {slotDist.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-20">{s.name}</span>
                <div className="flex-1 h-6 rounded-full overflow-hidden bg-slate-100">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{
                      width: total > 0 ? `${Math.max((s.value / total) * 100, s.value > 0 ? 8 : 0)}%` : "0%",
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  >
                    {s.value > 0 && <span className="text-xs font-bold text-white">{s.value}</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{total > 0 ? `${Math.round((s.value / total) * 100)}%` : "0%"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DialysisPanel({ sessions, unitFilter }: { sessions: DialysisSession[]; unitFilter: UnitFilter }) {
  const [trendView] = useState<"daily" | "weekly" | "monthly">("daily");

  const filtered = useMemo(() =>
    unitFilter === "all" ? sessions : sessions.filter(s => s.unit === unitFilter),
    [sessions, unitFilter]
  );

  const total = filtered.length;
  const completed = filtered.filter(s => s.attendance === "Completed").length;
  const missed = filtered.filter(s => s.attendance === "Missed").length;
  const cancelled = filtered.filter(s => s.attendance === "Cancelled").length;
  const ongoing = filtered.filter(s => s.status === "Running").length;
  const waiting = filtered.filter(s => s.status === "Waiting").length;

  const slotUtil = useMemo(() => {
    const slot1 = filtered.filter(s => s.slot === "Slot 1").length;
    const slot2 = filtered.filter(s => s.slot === "Slot 2").length;
    const slot3 = filtered.filter(s => s.slot === "Slot 3").length;
    return [
      { name: "8 AM – 12 PM", value: slot1, slot: "Slot 1" },
      { name: "12 PM – 4 PM", value: slot2, slot: "Slot 2" },
      { name: "4 PM – 8 PM",  value: slot3, slot: "Slot 3" },
    ];
  }, [filtered]);

  const attendanceData = [
    { name: "Completed", value: completed, color: "#059669" },
    { name: "Ongoing",   value: ongoing,   color: "#2563eb" },
    { name: "Waiting",   value: waiting,   color: "#d97706" },
    { name: "Missed",    value: missed,    color: "#dc2626" },
    { name: "Cancelled", value: cancelled, color: "#64748b" },
  ].filter(d => d.value > 0);

  const avgPerDay = total > 0 ? (total / 1).toFixed(1) : "0";
  const avgPerWeek = total > 0 ? (total * 7).toFixed(1) : "0";
  const avgPerMonth = total > 0 ? (total * 30).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <SectionHeader title="Dialysis Analytics" sub="Session-level dialysis statistics" />

      {/* Session overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Scheduled" value={total} color="blue" />
        <StatCard label="Completed"        value={completed} color="green" />
        <StatCard label="Ongoing"          value={ongoing} color="blue" />
        <StatCard label="Waiting"          value={waiting} color="amber" />
        <StatCard label="Missed"           value={missed} color="red" />
        <StatCard label="Cancelled"        value={cancelled} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Session Attendance</h4>
          {total === 0 ? (
            <p className="text-sm text-slate-400">No session data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={attendanceData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value">
                  {attendanceData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} session${v !== 1 ? "s" : ""}`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Slot utilization */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Slot Utilization</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={slotUtil} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Sessions" fill="#7c3aed" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current dialysis + averages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Current Dialysis Status</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Patients undergoing dialysis</span>
              <span className="text-sm font-bold text-blue-700">{ongoing}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Patients waiting</span>
              <span className="text-sm font-bold text-amber-600">{waiting}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Sessions completed today</span>
              <span className="text-sm font-bold text-green-600">{completed}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Average Session Volumes</h4>
          <p className="text-xs text-slate-400 mb-3 italic">Projected from current session data</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Average sessions / day</span>
              <span className="text-sm font-bold text-slate-800">{avgPerDay}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Average sessions / week (projected)</span>
              <span className="text-sm font-bold text-slate-800">{avgPerWeek}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Average sessions / month (projected)</span>
              <span className="text-sm font-bold text-slate-800">{avgPerMonth}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomesPanel({ patients }: { patients: Patient[] }) {
  const total = patients.length;

  const counts = useMemo(() => ({
    Active:        patients.filter(p => p.treatmentStatus === "Active").length,
    Transplanted:  patients.filter(p => p.treatmentStatus === "Transplanted").length,
    Expired:       patients.filter(p => p.treatmentStatus === "Expired").length,
    Shifted:       patients.filter(p => ["Shifted","Transferred"].includes(p.treatmentStatus)).length,
    Discontinued:  patients.filter(p => ["Discontinued","Temporarily inactive","Screening ended"].includes(p.treatmentStatus)).length,
  }), [patients]);

  const rows = [
    { label: "Active",                            count: counts.Active,       color: "#059669" },
    { label: "Transplanted",                      count: counts.Transplanted, color: "#2563eb" },
    { label: "Transferred to Another Centre",     count: counts.Shifted,      color: "#d97706" },
    { label: "Deceased",                          count: counts.Expired,      color: "#dc2626" },
    { label: "Inactive / Discontinued",           count: counts.Discontinued, color: "#64748b" },
  ];

  const pieData = rows.filter(r => r.count > 0).map(r => ({ name: r.label, value: r.count, color: r.color }));

  return (
    <div className="space-y-6">
      <SectionHeader title="Patient Outcomes" sub="Current treatment status distribution across all registered patients" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Patients"   value={total} color="blue" />
        <StatCard label="Active"           value={counts.Active} color="green" />
        <StatCard label="Transplanted"     value={counts.Transplanted} color="blue" />
        <StatCard label="Transferred"      value={counts.Shifted} color="amber" />
        <StatCard label="Deceased"         value={counts.Expired} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Outcome Distribution</h4>
          {total === 0 ? (
            <p className="text-sm text-slate-400">No patient data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value">
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} patient${v !== 1 ? "s" : ""}`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Patient Outcomes Summary</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outcome</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Count</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{row.count}</td>
                    <td className="py-2.5 text-right text-slate-500">
                      {total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MachinesPanel({ machines, sessions, isAdmin }: { machines: Machine[]; sessions: DialysisSession[]; isAdmin?: boolean }) {
  const [unitView, setUnitView] = useState<"all" | "U1" | "U2">("all");

  const filtered = useMemo(() =>
    unitView === "all" ? machines : machines.filter(m => m.unit === unitView),
    [machines, unitView]
  );

  const total = filtered.length;
  const available   = filtered.filter(m => m.status === "available").length;
  const inUse       = filtered.filter(m => m.status === "in-use").length;
  const maintenance = filtered.filter(m => m.status === "maintenance").length;
  const disabled    = filtered.filter(m => m.status === "disabled").length;
  const scheduled   = filtered.filter(m => m.status === "scheduled").length;
  const utilPct = total > 0 ? Math.round((inUse / total) * 100) : 0;

  const u1 = machines.filter(m => m.unit === "U1");
  const u2 = machines.filter(m => m.unit === "U2");

  const unitStats = (ms: Machine[]) => ({
    total: ms.length,
    inUse: ms.filter(m => m.status === "in-use").length,
    available: ms.filter(m => m.status === "available").length,
    maintenance: ms.filter(m => m.status === "maintenance").length,
    disabled: ms.filter(m => m.status === "disabled").length,
  });
  const u1s = unitStats(u1);
  const u2s = unitStats(u2);

  // By category
  const categories = useMemo(() => {
    const catMap: Record<string, { total: number; inUse: number; available: number; maintenance: number }> = {};
    filtered.forEach(m => {
      if (!catMap[m.category]) catMap[m.category] = { total: 0, inUse: 0, available: 0, maintenance: 0 };
      catMap[m.category].total++;
      if (m.status === "in-use") catMap[m.category].inUse++;
      if (m.status === "available") catMap[m.category].available++;
      if (m.status === "maintenance") catMap[m.category].maintenance++;
    });
    return Object.entries(catMap).map(([cat, stats]) => ({
      category: cat,
      ...stats,
      utilPct: stats.total > 0 ? Math.round((stats.inUse / stats.total) * 100) : 0,
    }));
  }, [filtered]);

  const slotUtil = useMemo(() => {
    const filteredSessions = unitView === "all" ? sessions : sessions.filter(s => s.unit === unitView);
    return [
      { name: "8 AM – 12 PM", value: filteredSessions.filter(s => s.slot === "Slot 1").length },
      { name: "12 PM – 4 PM", value: filteredSessions.filter(s => s.slot === "Slot 2").length },
      { name: "4 PM – 8 PM",  value: filteredSessions.filter(s => s.slot === "Slot 3").length },
    ];
  }, [sessions, unitView]);

  const statusData = [
    { name: "Available",    value: available,   color: "#059669" },
    { name: "In Use",       value: inUse,       color: "#2563eb" },
    { name: "Maintenance",  value: maintenance, color: "#d97706" },
    { name: "Scheduled",    value: scheduled,   color: "#7c3aed" },
    { name: "Disabled",     value: disabled,    color: "#dc2626" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Machine Utilization" sub="Dialysis machine status and capacity analytics" />

      {isAdmin && (
        <div className="flex gap-2">
          {(["all", "U1", "U2"] as const).map(u => (
            <button
              key={u}
              onClick={() => setUnitView(u)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${unitView === u ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              {u === "all" ? "All Units" : u === "U1" ? "Unit 1" : "Unit 2"}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Machines" value={total} color="blue" />
        <StatCard label="Available"      value={available} color="green" sub={`${total > 0 ? Math.round((available / total) * 100) : 0}% of total`} />
        <StatCard label="In Use"         value={inUse} color="blue" sub={`${utilPct}% utilization`} />
        <StatCard label="Maintenance"    value={maintenance} color="amber" />
        <StatCard label="Disabled"       value={disabled} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Machine Status Distribution</h4>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={85} innerRadius={48} dataKey="value">
                {statusData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} machine${v !== 1 ? "s" : ""}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Slot utilization from sessions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Machine Utilization by Slot</h4>
          <p className="text-xs text-slate-400 mb-3">Sessions per slot (from session records)</p>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={slotUtil} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Sessions" fill="#2563eb" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Unit-wise breakdown */}
      {isAdmin && unitView === "all" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[{ label: "Unit 1", s: u1s }, { label: "Unit 2", s: u2s }].map(({ label, s }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">{label}</h4>
              <div className="space-y-2.5">
                {[
                  { k: "Total Machines", v: s.total },
                  { k: "In Use",         v: s.inUse },
                  { k: "Available",      v: s.available },
                  { k: "Maintenance",    v: s.maintenance },
                  { k: "Disabled",       v: s.disabled },
                ].map(({ k, v }) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-semibold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Machine type table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Machine Type Analytics</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Machine Type</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">In Use</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Available</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Maintenance</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilization %</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.category} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-medium text-slate-700">{cat.category}</td>
                  <td className="py-2.5 text-right text-slate-700">{cat.total}</td>
                  <td className="py-2.5 text-right text-blue-700 font-semibold">{cat.inUse}</td>
                  <td className="py-2.5 text-right text-green-700">{cat.available}</td>
                  <td className="py-2.5 text-right text-amber-700">{cat.maintenance}</td>
                  <td className="py-2.5 text-right">
                    <span className={`font-semibold ${cat.utilPct >= 80 ? "text-red-600" : cat.utilPct >= 50 ? "text-amber-600" : "text-green-600"}`}>
                      {cat.utilPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Missed Slots Panel ──────────────────────────────────────────────────────

function MissedSlotsPanel({ sessions, allSessions, dateRange }: { sessions: DialysisSession[]; allSessions: DialysisSession[]; dateRange: string }) {
  const missedReasonOptions = ["Went to another dialysis centre", "Expired", "Hospitalized", "Personal reason", "No transport", "Family emergency", "Other"];

  const missed = sessions.filter(s => s.attendance === "Missed");
  const allMissed = allSessions.filter(s => s.attendance === "Missed");
  const total = sessions.length;
  const totalMissed = missed.length;
  const todayMissed = allSessions.filter(s => s.attendance === "Missed" && s.date === "Today").length;
  const recentMissed = allMissed.length;
  const missPct = total > 0 ? Math.round((totalMissed / total) * 100) : 0;

  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    missedReasonOptions.forEach(r => { counts[r] = 0; });
    counts["Not Recorded"] = 0;
    allMissed.forEach(s => {
      const r = s.missedReason || "Not Recorded";
      counts[r] = (counts[r] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([reason, count]) => ({ reason, count }));
  }, [allMissed]);

  const otherRows = allMissed.filter(s => s.missedReason === "Other" && s.missedReasonOther);

  return (
    <div className="space-y-6">
      <SectionHeader title="Missed Slot Analytics" sub="Based on actual missed session records" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Missed (filtered)" value={totalMissed} color="red" />
        <StatCard label="Missed Today" value={todayMissed} color="amber" />
        <StatCard label="Total in Database" value={recentMissed} color="blue" />
        <StatCard label="Miss Rate" value={`${missPct}%`} sub={`${totalMissed} of ${total} sessions`} color="red" />
      </div>

      {allMissed.length === 0 ? (
        <NoDataNote message="No missed session records found." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reasons chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Missed Slot Reasons</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reasonCounts} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={140} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Missed" fill="#dc2626" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Reasons table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Reason Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Reason</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Count</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  {reasonCounts.map(r => (
                    <tr key={r.reason} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 text-slate-700">{r.reason}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">{r.count}</td>
                      <td className="py-2.5 text-right text-slate-500">{allMissed.length > 0 ? `${Math.round((r.count / allMissed.length) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Other reasons detail table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Custom "Other" Reason Details</h4>
        {otherRows.length === 0 ? (
          <p className="text-sm text-slate-400">No custom "Other" reasons recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Patient</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Explanation</th>
                </tr>
              </thead>
              <tbody>
                {otherRows.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 text-slate-600">{s.date}</td>
                    <td className="py-2.5 text-slate-700 font-medium">{s.patientName}</td>
                    <td className="py-2.5 text-slate-600 italic">{s.missedReasonOther}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Missed Slot Trend</h4>
        <p className="text-xs text-slate-400 mb-4 italic">Based on available session date records</p>
        {(() => {
          const dateCounts: Record<string, number> = {};
          allMissed.forEach(s => { dateCounts[s.date] = (dateCounts[s.date] ?? 0) + 1; });
          const trendData = Object.entries(dateCounts).map(([date, count]) => ({ date, count }));
          if (trendData.length === 0) return <p className="text-sm text-slate-400">No trend data available.</p>;
          return (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Missed" fill="#dc2626" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Additional Clinical Analytics Panel ─────────────────────────────────────

type ClinicalCategory = "comorbidities" | "lft" | "access";

function AdditionalClinicalPanel({ patients }: { patients: Patient[] }) {
  const [category, setCategory] = useState<ClinicalCategory>("comorbidities");
  const total = patients.length;
  const lftStats = investigationStats(patients,"LFT");
  const lftPaths = ["lft.totalProtein","lft.albumin","lft.totalBilirubin","lft.directBilirubin","lft.ast","lft.alt","lft.alp"];
  const lftCount = (index: number) => patients.filter(p=>recorded(clinicalValue(p,lftPaths[index]))).length;
  const hasAccess = (p: Patient, key: string) => {
    const v = p.medicalInfo?.[key];
    return recorded(v) && !["no","false","none","not applicable"].includes(String(v).toLowerCase());
  };
  const accessCounts = ["avFistula","permacath","temporaryCatheter"].map(key=>patients.filter(p=>hasAccess(p,key)).length);
  const withAccess = patients.filter(p=>["avFistula","permacath","temporaryCatheter"].some(k=>hasAccess(p,k))).length;

  const comorbStats = useMemo(() => {
    const hasHT = patients.filter(p => p.comorbidities.toLowerCase().includes("hypertension")).length;
    const hasDM = patients.filter(p =>
      p.comorbidities.toLowerCase().includes("diabetes") ||
      p.comorbidities.toLowerCase().includes("diabetic")
    ).length;
    const hasBoth = patients.filter(p =>
      p.comorbidities.toLowerCase().includes("hypertension") &&
      (p.comorbidities.toLowerCase().includes("diabetes") || p.comorbidities.toLowerCase().includes("diabetic"))
    ).length;
    const hasNone = patients.filter(p => !p.comorbidities || p.comorbidities.trim() === "").length;
    const hasAny = total - hasNone;

    // Count all unique comorbidities from strings
    const comorbMap: Record<string, number> = {};
    patients.forEach(p => {
      if (!p.comorbidities) return;
      p.comorbidities.split(",").forEach(c => {
        const clean = c.trim();
        if (clean) comorbMap[clean] = (comorbMap[clean] ?? 0) + 1;
      });
    });

    return { hasHT, hasDM, hasBoth, hasNone, hasAny, comorbMap };
  }, [patients]);

  const renderContent = () => {
    if (category === "comorbidities") {
      const rows = Object.entries(comorbStats.comorbMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count, color: PIE_COLORS[Object.keys(comorbStats.comorbMap).indexOf(label) % PIE_COLORS.length] }));
      const pieData = rows.slice(0, 8).map(r => ({ name: r.label, value: r.count, color: r.color }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={total} color="blue" />
            <StatCard label="With Comorbidities" value={comorbStats.hasAny} sub={total > 0 ? `${Math.round((comorbStats.hasAny/total)*100)}%` : "—"} color="violet" />
            <StatCard label="Without Comorbidities" value={comorbStats.hasNone} color="green" />
            <StatCard label="With Hypertension" value={comorbStats.hasHT} color="amber" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Hypertension Only" value={comorbStats.hasHT - comorbStats.hasBoth} color="amber" />
            <StatCard label="Diabetes Only" value={comorbStats.hasDM - comorbStats.hasBoth} color="red" />
            <StatCard label="Both HT + Diabetes" value={comorbStats.hasBoth} color="violet" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Comorbidity Distribution</h4>
              {rows.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={48} dataKey="value">
                      {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} patient${v !== 1 ? "s" : ""}`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Comorbidity Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Comorbidity</th>
                      <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Patients</th>
                      <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.label} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-700">{r.label}</td>
                        <td className="py-2 text-right font-semibold text-slate-800">{r.count}</td>
                        <td className="py-2 text-right text-slate-500">{total > 0 ? `${Math.round((r.count/total)*100)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (category === "lft") {
      const lftParams = ["Total Protein", "Albumin", "Total Bilirubin (TB)", "Direct Bilirubin (DB)", "AST", "ALT", "ALP"];
      return (
        <div className="space-y-4">
          {!lftStats.recorded && <NoDataNote message="No liver function test values are recorded for these patients." />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Patients with LFT" value={lftStats.recorded} color="blue" />
            <StatCard label="Pending / Not Recorded" value={lftStats.missing} color="amber" />
            <StatCard label="Completion %" value={`${lftStats.percentage}%`} color="slate" />
            <StatCard label="Total Parameters" value={lftParams.length} color="violet" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">LFT Parameter Availability</h4>
            <div className="space-y-3">
              {lftParams.map((param,index) => (
                <div key={param} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-44 shrink-0">{param}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total?lftCount(index)/total*100:0}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 w-16 text-right">{lftCount(index)} / {total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Access
    return (
      <div className="space-y-4">
        {!withAccess && <NoDataNote message="No dialysis access details are recorded for these patients." />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total with Access" value={withAccess} sub={`${withAccess} of ${total}`} color="blue" />
          <StatCard label="AVF" value={accessCounts[0]} color="green" />
          <StatCard label="Permacath" value={accessCounts[1]} color="violet" />
          <StatCard label="Temp Catheter" value={accessCounts[2]} color="amber" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Access Type Distribution</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Access Type</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Patients</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {["AVF", "Permacath (Tunnelled)", "Temporary Catheter", "Not Recorded"].map((type, i) => (
                  <tr key={type} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 text-slate-700">{type}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">{i === 3 ? total-withAccess : accessCounts[i]}</td>
                    <td className="py-2.5 text-right text-slate-500">{total?Math.round((i===3?total-withAccess:accessCounts[i])/total*100):0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const catLabel = category === "comorbidities" ? "All Comorbidities" : category === "lft" ? "All LFT" : "Access";

  return (
    <div className="space-y-6">
      <SectionHeader title="Additional Clinical Analytics" sub="Comorbidity, LFT, and Access analytics" />
      <div className="relative inline-block w-full sm:w-64">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as ClinicalCategory)}
          className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="comorbidities">All Comorbidities</option>
          <option value="lft">All LFT</option>
          <option value="access">Access</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      <div className="bg-white/60 rounded-xl p-1">
        <p className="text-xs text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">{catLabel}</p>
      </div>
      {renderContent()}
    </div>
  );
}

// ─── Main AnalyticsSection ────────────────────────────────────────────────────

interface AnalyticsSectionProps {
  patients: Patient[];
  machines: Machine[];
  sessions: DialysisSession[];
  prescriptions: AdminPrescription[];
  isAdmin?: boolean;
}

export function AnalyticsSection({ patients, machines, sessions, prescriptions, isAdmin }: AnalyticsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategory>("clinical");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Date filter for sessions (relative string dates)
  const filteredSessions = useMemo(() => {
    let s = sessions;
    if (unitFilter !== "all") s = s.filter(sess => sess.unit === unitFilter);
    const end=new Date(),start=new Date();
    if(dateRange==="week") start.setDate(start.getDate()-((start.getDay()+6)%7));
    if(dateRange==="month") start.setDate(1);
    if(dateRange==="3months") start.setMonth(start.getMonth()-3);
    if(dateRange==="year") {start.setMonth(0);start.setDate(1);}
    const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const from=dateRange==="custom"?customFrom:key(start),to=dateRange==="custom"?customTo:key(end);
    return s.filter(sess=>(!from||sess.date>=from)&&(!to||sess.date<=to));
  }, [sessions, unitFilter, dateRange, customFrom, customTo]);

  const filteredPatients = useMemo(() => {
    if(unitFilter==="all") return patients;
    const ids=new Set(filteredSessions.map(s=>s.patientId));
    return patients.filter(p=>ids.has(p.id));
  }, [patients, filteredSessions, unitFilter]);
  const filteredMachines = useMemo(() =>
    unitFilter === "all" ? machines : machines.filter(m => m.unit === unitFilter),
    [machines, unitFilter]
  );

  const renderCategory = () => {
    switch (activeCategory) {
      case "clinical":      return <ClinicalInvestigationPanel patients={filteredPatients} />;
      case "viral":         return <ViralStatusPanel patients={filteredPatients} />;
      case "prescription":  return <PrescriptionPanel prescriptions={prescriptions} />;
      case "dialysis":      return <DialysisPanel sessions={filteredSessions} unitFilter={unitFilter} />;
      case "outcomes":      return <OutcomesPanel patients={filteredPatients} />;
      case "machines":      return <MachinesPanel machines={filteredMachines} sessions={filteredSessions} isAdmin={isAdmin} />;
      case "missed-slots":  return <MissedSlotsPanel sessions={filteredSessions} allSessions={sessions} dateRange={dateRange} />;
      case "additional":    return <AdditionalClinicalPanel patients={filteredPatients} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="w-6 h-6 text-blue-200" />
          <h2 className="text-2xl font-bold">Analytics</h2>
        </div>
        <p className="text-blue-100 text-sm">Read-only analytics computed from existing patient, session, prescription, and machine records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {dateRange==="custom" && <>
          <label className="text-sm text-slate-600">From <input aria-label="Analytics from date" type="date" value={customFrom} max={customTo||undefined} onChange={e=>setCustomFrom(e.target.value)} className="border rounded-xl p-2 bg-white" /></label>
          <label className="text-sm text-slate-600">To <input aria-label="Analytics to date" type="date" value={customTo} min={customFrom||undefined} onChange={e=>setCustomTo(e.target.value)} className="border rounded-xl p-2 bg-white" /></label>
        </>}
        <div className="relative">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as DateRange)}
            className="appearance-none bg-white border border-slate-300 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {isAdmin && (
          <div className="relative">
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value as UnitFilter)}
              className="appearance-none bg-white border border-slate-300 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Units</option>
              <option value="U1">Unit 1</option>
              <option value="U2">Unit 2</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        {dateRange !== "month" && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Date filter applies where session dates are available
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              activeCategory === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 min-h-96">
        {renderCategory()}
      </div>
    </div>
  );
}
