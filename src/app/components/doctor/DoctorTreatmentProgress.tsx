import { useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp, Heart, Droplets, FileText, Edit3, FlaskConical } from "lucide-react";
import type { Patient, DialysisSession, AdminPrescription } from "../../AdminApp";

interface DoctorTreatmentProgressProps {
  onNavigate: (view: string) => void;
  patients: Patient[];
  sessions: DialysisSession[];
  prescriptions: AdminPrescription[];
}

type ProgressStatus = "On Target" | "Needs Attention" | "Critical" | "Monitoring";

interface TreatmentProgress {
  patientId: string;
  patientName: string;
  diagnosis: string;
  totalSessions: number;
  completedSessions: number;
  missedSessions: number;
  adherenceRate: number;
  progressStatus: ProgressStatus;
  ktV: string;
  urr: string;
  hb: string;
  bp: string;
  weightTrend: "Stable" | "Increasing" | "Decreasing";
  accessType: string;
  accessCondition: "Good" | "Concerns" | "Critical";
  recentComplication: string;
  clinicalSummary: string;
  flags: string[];
}

const PROGRESS_DATA: TreatmentProgress[] = [
  {
    patientId: "KMCRI-2024-001", patientName: "Rajesh Kumar",
    diagnosis: "CKD Stage 5 — Diabetic Nephropathy",
    totalSessions: 24, completedSessions: 22, missedSessions: 2,
    adherenceRate: 92,
    progressStatus: "On Target",
    ktV: "1.4 (target ≥1.2)", urr: "68% (target ≥65%)", hb: "10.8 g/dL",
    bp: "Well controlled", weightTrend: "Stable",
    accessType: "AV Fistula (Left arm)", accessCondition: "Good",
    recentComplication: "None",
    clinicalSummary: "Patient progressing well. Dialysis adequacy at target. Anaemia partially corrected. Continue current prescription.",
    flags: [],
  },
  {
    patientId: "KMCRI-2024-002", patientName: "Priya Sharma",
    diagnosis: "ESRD — Hypertensive Nephrosclerosis",
    totalSessions: 18, completedSessions: 16, missedSessions: 2,
    adherenceRate: 89,
    progressStatus: "Needs Attention",
    ktV: "1.1 (below target)", urr: "59% (below target)", hb: "9.2 g/dL",
    bp: "Intermittently elevated", weightTrend: "Increasing",
    accessType: "Tunnelled CVC (Right IJV)", accessCondition: "Concerns",
    recentComplication: "Intradialytic hypotension — 2 episodes",
    clinicalSummary: "Dialysis adequacy below target. Blood flow limited by CVC. Review access urgently. Erythropoietin dose may need escalation.",
    flags: ["Adequacy below target", "CVC patency concern", "Repeated hypotension"],
  },
  {
    patientId: "KMCRI-2024-003", patientName: "Vikram Singh",
    diagnosis: "CKD Stage 5 — Diabetic Nephropathy",
    totalSessions: 30, completedSessions: 24, missedSessions: 6,
    adherenceRate: 80,
    progressStatus: "Needs Attention",
    ktV: "1.2 (borderline)", urr: "63% (borderline)", hb: "9.8 g/dL",
    bp: "Borderline high", weightTrend: "Increasing",
    accessType: "AV Fistula (Left arm)", accessCondition: "Good",
    recentComplication: "Missed sessions — non-adherence",
    clinicalSummary: "Multiple missed sessions. Counselled regarding risks of missed dialysis. Fistula functional but blood flow suboptimal. Phosphate management needs review.",
    flags: ["Poor adherence — 6 missed sessions", "Borderline adequacy", "Phosphate elevated"],
  },
  {
    patientId: "KMCRI-2024-004", patientName: "Meera Nair",
    diagnosis: "ESRD — Hypertensive Nephrosclerosis",
    totalSessions: 48, completedSessions: 47, missedSessions: 1,
    adherenceRate: 98,
    progressStatus: "On Target",
    ktV: "1.5 (excellent)", urr: "72% (excellent)", hb: "11.4 g/dL",
    bp: "Well controlled", weightTrend: "Stable",
    accessType: "AV Fistula (Right arm)", accessCondition: "Good",
    recentComplication: "None",
    clinicalSummary: "Excellent adherence and dialysis adequacy. Haemoglobin at target. Continue current plan. Hepatitis B management ongoing.",
    flags: ["HBsAg positive — isolation machine required"],
  },
  {
    patientId: "KMCRI-2024-005", patientName: "Sanjay Gupta",
    diagnosis: "CKD Stage 5 — Polycystic Kidney Disease",
    totalSessions: 12, completedSessions: 11, missedSessions: 1,
    adherenceRate: 92,
    progressStatus: "Monitoring",
    ktV: "1.3 (on target)", urr: "66% (on target)", hb: "10.2 g/dL",
    bp: "Controlled", weightTrend: "Stable",
    accessType: "Tunnelled CVC (Right SCV)", accessCondition: "Good",
    recentComplication: "HIV result pending — monitoring",
    clinicalSummary: "New patient, early in treatment. Access functional. HIV status pending. All other parameters satisfactory for treatment duration.",
    flags: ["HIV result pending — reassign machine if positive"],
  },
  {
    patientId: "KMCRI-2024-006", patientName: "Deepa Reddy",
    diagnosis: "CKD Stage 5 — Focal Segmental Glomerulosclerosis",
    totalSessions: 36, completedSessions: 34, missedSessions: 2,
    adherenceRate: 94,
    progressStatus: "On Target",
    ktV: "1.4 (good)", urr: "69% (good)", hb: "10.6 g/dL",
    bp: "Well controlled", weightTrend: "Stable",
    accessType: "AV Fistula (Left arm)", accessCondition: "Good",
    recentComplication: "None",
    clinicalSummary: "Stable progress. Dialysis adequacy maintained. Plan to review membrane upgrade at next session.",
    flags: [],
  },
];

function ProgressStatusBadge({ status }: { status: ProgressStatus }) {
  const map: Record<ProgressStatus, { cls: string; icon: React.ReactNode }> = {
    "On Target":       { cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    "Needs Attention": { cls: "bg-amber-100 text-amber-700",     icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    Critical:          { cls: "bg-red-100 text-red-700",         icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    Monitoring:        { cls: "bg-blue-100 text-blue-700",       icon: <Activity className="w-3.5 h-3.5" /> },
  };
  const { cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      {icon} {status}
    </span>
  );
}

function WeightTrendIcon({ trend }: { trend: TreatmentProgress["weightTrend"] }) {
  if (trend === "Stable")     return <Minus className="w-4 h-4 text-slate-400" />;
  if (trend === "Increasing") return <TrendingUp className="w-4 h-4 text-red-500" />;
  return <TrendingDown className="w-4 h-4 text-emerald-500" />;
}

function AdherenceBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? "bg-emerald-500" : rate >= 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{rate}%</span>
    </div>
  );
}

const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(", ") : "Not available";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${displayValue(item)}`).join(" · ") || "Not available";
  return String(value);
};

const fieldValue = (record: Record<string, unknown> | undefined, ...keys: string[]) =>
  displayValue(keys.map(key => record?.[key]).find(value => value !== null && value !== undefined && value !== ""));

export function DoctorTreatmentProgress({ onNavigate, patients, sessions, prescriptions }: DoctorTreatmentProgressProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const data: TreatmentProgress[] = patients.map(patient => {
    const own = sessions.filter(s => s.patientId === patient.id);
    const completed = own.filter(s => s.attendance === "Completed").length, missed = own.filter(s => s.attendance === "Missed").length;
    const total = own.length, adherenceRate = total ? Math.round(completed / total * 100) : 0;
    const progressStatus: ProgressStatus = missed > 2 || adherenceRate < 80 ? "Needs Attention" : total === 0 ? "Monitoring" : "On Target";
    return { patientId: patient.uhid, patientName: patient.name, diagnosis: patient.primaryDisease, totalSessions: total, completedSessions: completed,
      missedSessions: missed, adherenceRate, progressStatus, ktV: "Not recorded", urr: "Not recorded", hb: "Not recorded", bp: "Not recorded",
      weightTrend: "Stable", accessType: "Not recorded", accessCondition: "Good", recentComplication: missed ? `${missed} missed session(s)` : "None",
      clinicalSummary: patient.remarks || "No clinical summary recorded.", flags: missed ? [`${missed} missed session(s)`] : [] };
  });
  const filtered = data.filter(p => {
    const matchSearch = p.patientName.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || p.progressStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const summary = {
    total:         data.length,
    onTarget:      data.filter(p => p.progressStatus === "On Target").length,
    needsAttention: data.filter(p => p.progressStatus === "Needs Attention").length,
    monitoring:    data.filter(p => p.progressStatus === "Monitoring").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Treatment Progress</h1>
        <p className="text-blue-100 text-sm">Track clinical outcomes and dialysis adequacy for all patients</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Patients",    value: summary.total,          cls: "bg-slate-50 text-slate-700" },
          { label: "On Target",         value: summary.onTarget,       cls: "bg-emerald-50 text-emerald-700" },
          { label: "Needs Attention",   value: summary.needsAttention, cls: "bg-amber-50 text-amber-700" },
          { label: "Monitoring",        value: summary.monitoring,     cls: "bg-blue-50 text-blue-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center ${s.cls}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Flags alert */}
       {data.some(p => p.flags.length > 0) && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900 mb-2">Active Clinical Flags</p>
              <div className="space-y-1">
                 {data.filter(p => p.flags.length > 0).map(p =>
                  p.flags.map((flag, i) => (
                    <p key={`${p.patientId}-${i}`} className="text-sm text-red-800">
                      <strong>{p.patientName}:</strong> {flag}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", "On Target", "Needs Attention", "Monitoring", "Critical"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Patient cards */}
      <div className="space-y-4">
        {filtered.map(p => {
          const isExpanded = expanded === p.patientId;
          const patient = patients.find(item => item.uhid === p.patientId);
          const prescription = patient ? prescriptions.find(item => item.patientId === patient.id) : undefined;
          const medicalInfo = patient?.medicalInfo || {};
          const investigations = patient?.investigations || {};
          return (
            <div key={p.patientId}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                p.progressStatus === "Needs Attention" ? "border-amber-200" :
                p.progressStatus === "Critical" ? "border-red-300" :
                "border-slate-100"
              }`}
            >
              {/* Card header row */}
              <button className="w-full text-left p-5" onClick={() => setExpanded(isExpanded ? null : p.patientId)}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      p.progressStatus === "On Target" ? "bg-emerald-100" :
                      p.progressStatus === "Needs Attention" ? "bg-amber-100" :
                      "bg-blue-100"
                    }`}>
                      <Activity className={`w-5 h-5 ${
                        p.progressStatus === "On Target" ? "text-emerald-600" :
                        p.progressStatus === "Needs Attention" ? "text-amber-600" :
                        "text-blue-600"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-bold text-slate-800">{p.patientName}</p>
                        <ProgressStatusBadge status={p.progressStatus} />
                        {p.flags.length > 0 && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {p.flags.length} flag{p.flags.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{p.patientId} · {p.diagnosis}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Quick adherence bar */}
                    <div className="hidden md:block w-36">
                      <p className="text-[10px] text-slate-400 font-semibold mb-1">Adherence</p>
                      <AdherenceBar rate={p.adherenceRate} />
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 px-5 pb-5">
                  {/* Session stats */}
                  <div className="mt-4 grid grid-cols-3 md:grid-cols-5 gap-3 mb-5">
                    {[
                      { label: "Total Sessions",     value: p.totalSessions },
                      { label: "Completed",          value: p.completedSessions },
                      { label: "Missed",             value: p.missedSessions },
                      { label: "Adherence Rate",     value: `${p.adherenceRate}%` },
                      { label: "Access Type",        value: p.accessType },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                        <p className="text-sm font-bold text-slate-700">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Patient and medical detail */}
                  {patient && (
                    <>
                      <div className="mb-5">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Patient Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            ["UHID", patient.uhid], ["Age / Gender", `${patient.age} yrs · ${patient.gender}`],
                            ["Blood Group", patient.bloodGroup], ["Nephrologist", patient.treatingNephrologist],
                            ["Primary Disease", patient.primaryDisease], ["Viral Status", `HBsAg: ${patient.viralStatus.hepatitisB} · HCV: ${patient.viralStatus.hepatitisC} · HIV: ${patient.viralStatus.hiv}`],
                            ["Dialysis Days", patient.dialysisDays.join(", ") || "Not available"], ["Treatment Status", patient.treatmentStatus],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className="text-xs font-semibold text-slate-700">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mb-5">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5 text-blue-600" /> Medical Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            ["Comorbidities", patient.comorbidities], ["Dialysis Access", fieldValue(medicalInfo, "dialysisAccess", "access", "accessType")],
                            ["CBC", fieldValue(investigations, "cbc", "CBC")], ["Renal Function Test", fieldValue(investigations, "rft", "renalFunctionTest", "RFT")],
                            ["LFT", fieldValue(investigations, "lft", "LFT")], ["Serum Calcium", fieldValue(investigations, "serumCalcium", "calcium")],
                            ["Serum Phosphorous", fieldValue(investigations, "serumPhosphorous", "phosphorous", "phosphorus")], ["Serum Ferritin", fieldValue(investigations, "serumFerritin", "ferritin")],
                            ["Thyroid Profile", fieldValue(investigations, "thyroidProfile", "thyroid")], ["2D Echo", fieldValue(investigations, "twoDEcho", "echo2d", "echo")],
                            ["Ejection Fraction", fieldValue(investigations, "ejectionFraction", "ef")], ["OPD / IPD", fieldValue(medicalInfo, "opdIpd", "opd_ipd")],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className="text-xs font-semibold text-slate-700">{value || "Not available"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Dialysis prescription */}
                  <div className="mb-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-600" /> Dialysis Prescription</h3>
                      {prescription && <button onClick={() => onNavigate("prescription")} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"><Edit3 className="w-3.5 h-3.5" /> Edit Prescription</button>}
                    </div>
                    {!prescription ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">No dialysis prescription created yet.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            ["Weekly Sessions", prescription.dialysisRx.weeklySessionsCount], ["Dialysis Days", prescription.dialysisRx.dialysisDays.join(", ")],
                            ["Slot", prescription.dialysisRx.slot], ["Duration", prescription.dialysisRx.duration],
                            ["Blood Flow", prescription.dialysisRx.bloodFlow], ["Dialysate Flow", prescription.dialysisRx.dialysateFlow],
                            ["Dialyzer", prescription.dialysisRx.membrane], ["Dry Weight", prescription.dialysisRx.dryWeight],
                            ["Anticoagulation", prescription.dialysisRx.anticoagulation],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className="text-xs font-semibold text-blue-900">{value || "Not available"}</p>
                            </div>
                          ))}
                        </div>
                        {prescription.medications.length > 0 && (
                          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-500"><th className="text-left px-3 py-2">Medication</th><th className="text-left px-3 py-2">Dose</th><th className="text-left px-3 py-2">Frequency</th><th className="text-left px-3 py-2">Route</th></tr></thead>
                              <tbody>{prescription.medications.map((med, index) => <tr key={index} className="border-t border-slate-50"><td className="px-3 py-2 font-semibold text-slate-700">{med.name}</td><td className="px-3 py-2">{med.dose}</td><td className="px-3 py-2">{med.frequency}</td><td className="px-3 py-2">{med.route}</td></tr>)}</tbody>
                            </table>
                          </div>
                        )}
                        <p className="mt-3 text-xs text-slate-500">Created by {prescription.createdBy || prescription.updatedBy} ({prescription.createdByRole || prescription.updatedByRole}) · Last edited by {prescription.updatedBy} ({prescription.updatedByRole})</p>
                      </>
                    )}
                  </div>

                  {/* Clinical parameters */}
                  <div className="mb-5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Clinical Parameters</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Kt/V (Adequacy)</p>
                        <p className="font-bold text-blue-800 text-sm">{p.ktV}</p>
                      </div>
                      <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-3">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">URR</p>
                        <p className="font-bold text-violet-800 text-sm">{p.urr}</p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5" /> Haemoglobin
                        </p>
                        <p className="font-bold text-red-800 text-sm">{p.hb}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Droplets className="w-2.5 h-2.5" /> Weight Trend
                        </p>
                        <p className="font-bold text-slate-700 text-sm flex items-center gap-1">
                          <WeightTrendIcon trend={p.weightTrend} /> {p.weightTrend}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Access condition */}
                  <div className={`flex gap-2 items-start rounded-xl px-4 py-3 mb-4 ${
                    p.accessCondition === "Good" ? "bg-emerald-50 border border-emerald-200" :
                    p.accessCondition === "Concerns" ? "bg-amber-50 border border-amber-200" :
                    "bg-red-50 border border-red-200"
                  }`}>
                    {p.accessCondition === "Good"
                      ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                    <p className="text-sm text-slate-700">
                      <strong>Vascular Access:</strong> {p.accessType} — condition: <strong>{p.accessCondition}</strong>
                      {p.accessCondition !== "Good" && ". Review urgently."}
                    </p>
                  </div>

                  {/* Complications */}
                  {p.recentComplication !== "None" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800"><strong>Recent complication:</strong> {p.recentComplication}</p>
                    </div>
                  )}

                  {/* Clinical summary */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Summary</p>
                    <p className="text-sm text-slate-700">{p.clinicalSummary}</p>
                  </div>

                  {/* Flags */}
                  {p.flags.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                      <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1.5">Active Flags</p>
                      <ul className="space-y-1">
                        {p.flags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />{flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold">
                      View Full History
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold">
                      Add Clinical Note
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No patients found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
