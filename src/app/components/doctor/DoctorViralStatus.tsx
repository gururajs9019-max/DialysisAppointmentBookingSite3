import { useState } from "react";
import { FlaskConical, Search, AlertTriangle, CheckCircle, Clock, RefreshCw, Info, ChevronDown, ChevronUp, Shield } from "lucide-react";

interface DoctorViralStatusProps {
  onNavigate: (view: string) => void;
}

type ViralResult = "Positive" | "Negative" | "Pending" | "Unknown";

interface ViralPanel {
  patientId: string;
  patientName: string;
  hbsAg: ViralResult;
  hcv: ViralResult;
  hiv: ViralResult;
  lastTested: string;
  nextDue: string;
  machineCategory: string;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  notes: string;
  pendingReview: boolean;
}

const VIRAL_DATA: ViralPanel[] = [
  {
    patientId: "KMCRI-2024-001", patientName: "Rajesh Kumar",
    hbsAg: "Negative", hcv: "Negative", hiv: "Negative",
    lastTested: "Recently", nextDue: "Upcoming",
    machineCategory: "Negative", riskLevel: "Low",
    notes: "All markers clear. Continue standard machine assignment.",
    pendingReview: false,
  },
  {
    patientId: "KMCRI-2024-002", patientName: "Priya Sharma",
    hbsAg: "Negative", hcv: "Positive", hiv: "Negative",
    lastTested: "Recently", nextDue: "Upcoming",
    machineCategory: "HCV", riskLevel: "Medium",
    notes: "HCV positive — assigned to dedicated HCV machine. Antiviral therapy initiated. Repeat viral load at next review.",
    pendingReview: false,
  },
  {
    patientId: "KMCRI-2024-003", patientName: "Vikram Singh",
    hbsAg: "Negative", hcv: "Negative", hiv: "Negative",
    lastTested: "Previously", nextDue: "Overdue",
    machineCategory: "Negative", riskLevel: "Low",
    notes: "Testing overdue. Schedule repeat viral panel before next session.",
    pendingReview: true,
  },
  {
    patientId: "KMCRI-2024-004", patientName: "Meera Nair",
    hbsAg: "Positive", hcv: "Negative", hiv: "Negative",
    lastTested: "Recently", nextDue: "Upcoming",
    machineCategory: "HBsAg", riskLevel: "High",
    notes: "HBsAg positive — dedicated HBsAg machine mandatory. Hepatitis B treatment in progress. Monitor liver function.",
    pendingReview: false,
  },
  {
    patientId: "KMCRI-2024-005", patientName: "Sanjay Gupta",
    hbsAg: "Negative", hcv: "Negative", hiv: "Pending",
    lastTested: "Recently", nextDue: "Upcoming",
    machineCategory: "Negative",  riskLevel: "Medium",
    notes: "HIV result pending laboratory confirmation. Temporary standard machine — reassign immediately upon positive result.",
    pendingReview: true,
  },
  {
    patientId: "KMCRI-2024-006", patientName: "Deepa Reddy",
    hbsAg: "Negative", hcv: "Negative", hiv: "Negative",
    lastTested: "Previously", nextDue: "Upcoming",
    machineCategory: "Negative", riskLevel: "Low",
    notes: "All results normal. Routine follow-up.",
    pendingReview: false,
  },
];

function ViralBadge({ result }: { result: ViralResult }) {
  const map: Record<ViralResult, string> = {
    Positive: "bg-red-100 text-red-700 border-red-200",
    Negative: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Pending:  "bg-amber-100 text-amber-700 border-amber-200",
    Unknown:  "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[result]}`}>{result}</span>
  );
}

function RiskBadge({ level }: { level: ViralPanel["riskLevel"] }) {
  const map = {
    Low:      "bg-emerald-100 text-emerald-700",
    Medium:   "bg-amber-100 text-amber-700",
    High:     "bg-red-100 text-red-700",
    Critical: "bg-red-600 text-white",
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${map[level]}`}>{level} Risk</span>;
}

function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    "Negative": "bg-slate-100 text-slate-700",
    "HCV":      "bg-orange-100 text-orange-700",
    "HBsAg":    "bg-yellow-100 text-yellow-800",
    "HIV":      "bg-red-100 text-red-700",
    "RVD (HIV)": "bg-rose-100 text-rose-700",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${map[cat] || "bg-purple-100 text-purple-700"}`}>{cat}</span>;
}

export function DoctorViralStatus({ onNavigate: _onNavigate }: DoctorViralStatusProps) {
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const pendingCount = VIRAL_DATA.filter(d => d.pendingReview).length;
  const positiveCount = VIRAL_DATA.filter(d =>
    d.hbsAg === "Positive" || d.hcv === "Positive" || d.hiv === "Positive"
  ).length;

  const filtered = VIRAL_DATA.filter(d => {
    const matchSearch = d.patientName.toLowerCase().includes(search.toLowerCase()) ||
      d.patientId.toLowerCase().includes(search.toLowerCase());
    const matchRisk = filterRisk === "All" || d.riskLevel === filterRisk;
    return matchSearch && matchRisk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Viral Status Review</h1>
        <p className="text-blue-100 text-sm">Monitor and review viral panel results for all active dialysis patients</p>
      </div>

      {/* Alert banners */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex gap-3 items-center">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 font-semibold flex-1">
            <strong>{pendingCount}</strong> patient{pendingCount > 1 ? "s" : ""} require viral status review or have pending results.
          </p>
          <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2.5 py-1 rounded-full">Action required</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Patients",    value: VIRAL_DATA.length,   cls: "bg-slate-50 text-slate-700" },
          { label: "All Clear",         value: VIRAL_DATA.filter(d => d.riskLevel === "Low").length, cls: "bg-emerald-50 text-emerald-700" },
          { label: "Positive Markers",  value: positiveCount,       cls: "bg-red-50 text-red-700" },
          { label: "Pending Review",    value: pendingCount,        cls: "bg-amber-50 text-amber-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center ${s.cls}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

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
          {["All", "Low", "Medium", "High", "Critical"].map(r => (
            <button key={r} onClick={() => setFilterRisk(r)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                filterRisk === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}>{r}</button>
          ))}
        </div>
      </div>

      {/* Patient table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="bg-slate-50 px-5 py-3 grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">HBsAg</div>
          <div className="col-span-2">HCV</div>
          <div className="col-span-2">HIV</div>
          <div className="col-span-2">Machine</div>
          <div className="col-span-1"></div>
        </div>

        {filtered.map(d => {
          const isExpanded = expanded === d.patientId;
          return (
            <div key={d.patientId} className={`border-b border-slate-50 last:border-0 ${d.pendingReview ? "bg-amber-50/40" : ""}`}>
              <button
                className="w-full text-left px-5 py-4"
                onClick={() => setExpanded(isExpanded ? null : d.patientId)}
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      {d.pendingReview && <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0 animate-pulse" />}
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{d.patientName}</p>
                        <p className="text-xs text-slate-400">{d.patientId}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2"><ViralBadge result={d.hbsAg} /></div>
                  <div className="col-span-2"><ViralBadge result={d.hcv} /></div>
                  <div className="col-span-2"><ViralBadge result={d.hiv} /></div>
                  <div className="col-span-2"><CategoryBadge cat={d.machineCategory} /></div>
                  <div className="col-span-1 flex justify-end">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 bg-white">
                  <div className="mt-4 grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Risk Level</p>
                      <RiskBadge level={d.riskLevel} />
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Last Tested</p>
                      <p className="font-semibold text-slate-700 text-sm flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {d.lastTested}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 ${d.nextDue === "Overdue" ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Next Test Due</p>
                      <p className={`font-semibold text-sm flex items-center gap-1 ${d.nextDue === "Overdue" ? "text-red-700" : "text-slate-700"}`}>
                        <RefreshCw className="w-3.5 h-3.5" /> {d.nextDue}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {d.notes && (
                    <div className={`flex gap-2 items-start rounded-xl px-4 py-3 mb-4 ${
                      d.hbsAg === "Positive" || d.hcv === "Positive" || d.hiv === "Positive"
                        ? "bg-red-50 border border-red-200"
                        : d.pendingReview
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-emerald-50 border border-emerald-200"
                    }`}>
                      {d.hbsAg === "Positive" || d.hcv === "Positive" || d.hiv === "Positive" ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      ) : d.pendingReview ? (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm text-slate-700">{d.notes}</p>
                    </div>
                  )}

                  {/* Machine assignment info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-2 items-start mb-4">
                    <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      <strong>Machine Assignment:</strong> Patient is assigned to <strong>{d.machineCategory}</strong> category machine based on viral status.
                      {(d.hbsAg === "Positive" || d.hcv === "Positive" || d.hiv === "Positive") && (
                        <span className="text-red-700"> Dedicated isolation machine — do not reassign.</span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold">
                      <RefreshCw className="w-3.5 h-3.5" /> Order New Panel
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Reviewed
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No patients found matching your search.</p>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 items-start">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1">
          <p><strong>Machine assignment protocol:</strong> HBsAg+ → dedicated HBsAg machine · HCV+ → dedicated HCV machine · HIV+ → dedicated HIV or RVD machine · All negative → standard Negative machine.</p>
          <p>Viral panels must be repeated per protocol schedule. Overdue results require review before the next dialysis session.</p>
        </div>
      </div>
    </div>
  );
}
