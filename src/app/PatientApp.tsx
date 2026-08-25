import { useState, useMemo } from "react";
import { PatientAuthPortal, PatientData } from "./components/PatientAuthPortal";
import {
  LayoutDashboard, Calendar, Clock, Bell, FileText, User, LogOut,
  Menu, X, ChevronRight, CheckCircle, AlertTriangle, Activity,
  HeartPulse, FlaskConical, Shield, Stethoscope, Info, ChevronDown,
  ChevronUp, MessageSquare, Send, RefreshCw, Download, Heart
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientView =
  | "dashboard" | "sessions" | "history" | "notifications"
  | "reports" | "profile" | "request";

type SessionStatus = "Upcoming" | "Running" | "Completed" | "Missed" | "Cancelled";
type ViralStatus = "Positive" | "Negative" | "Unknown" | "Awaiting Report";

interface DialysisSession {
  id: string;
  date: string;
  slot: string;
  slotTime: string;
  machine: string;
  unit: string;
  doctor: string;
  duration: string;
  status: SessionStatus;
  notes: string;
  attendance: "Completed" | "Missed" | "Cancelled" | "Pending";
}

interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface MedicalReport {
  id: string;
  title: string;
  date: string;
  doctor: string;
  category: string;
  summary: string;
}

interface AppointmentRequest {
  id: string;
  preferredSlot: string;
  preferredDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedDate: string;
  responseNote: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SESSIONS: DialysisSession[] = [
  {
    id: "DS001", date: "Today", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 01", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Running", notes: "Session in progress. BP stable.",
    attendance: "Pending"
  },
  {
    id: "DS002", date: "Upcoming", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 01", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Upcoming", notes: "",
    attendance: "Pending"
  },
  {
    id: "DS003", date: "Upcoming", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 01", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Upcoming", notes: "",
    attendance: "Pending"
  },
  {
    id: "DS004", date: "Recently", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 01", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Completed", notes: "Session completed without issues.",
    attendance: "Completed"
  },
  {
    id: "DS005", date: "Recently", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 03", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Completed", notes: "Slight discomfort reported, resolved.",
    attendance: "Completed"
  },
  {
    id: "DS006", date: "Previously", slot: "Slot 3", slotTime: "4:00 PM – 8:00 PM",
    machine: "Machine 06", unit: "Unit 1", doctor: "Dr. Anita Krishnamurthy",
    duration: "4 hours", status: "Missed", notes: "Patient did not attend.",
    attendance: "Missed"
  },
  {
    id: "DS007", date: "Previously", slot: "Slot 1", slotTime: "8:00 AM – 12:00 PM",
    machine: "Machine 01", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Completed", notes: "Session uneventful.",
    attendance: "Completed"
  },
  {
    id: "DS008", date: "Previously", slot: "Slot 2", slotTime: "12:00 PM – 4:00 PM",
    machine: "Machine 02", unit: "Unit 1", doctor: "Dr. Suresh Pillai",
    duration: "4 hours", status: "Completed", notes: "Good session. Weight reduced.",
    attendance: "Completed"
  },
];

const NOTIFICATIONS: Notification[] = [
  {
    id: "N001", type: "info", title: "Session Reminder",
    message: "Your next dialysis session is scheduled for tomorrow morning, Slot 1 (8:00 AM – 12:00 PM) at Machine 01, Unit 1.",
    time: "Recently", read: false
  },
  {
    id: "N002", type: "success", title: "Viral Report Updated",
    message: "Your latest viral panel results have been updated. HBsAg: Negative, HCV: Negative, HIV: Negative. All clear — no changes to your machine assignment.",
    time: "Recently", read: false
  },
  {
    id: "N003", type: "warning", title: "Missed Session Alert",
    message: "You missed your scheduled dialysis session. Missing sessions can affect your treatment outcomes. Please contact the hospital to reschedule.",
    time: "Previously", read: false
  },
  {
    id: "N004", type: "info", title: "Doctor's Note",
    message: "Dr. Suresh Pillai has left a clinical note on your latest session. Please check your Medical Reports section.",
    time: "Previously", read: true
  },
  {
    id: "N005", type: "success", title: "Appointment Request Approved",
    message: "Your slot change request has been reviewed and approved. Your updated schedule is now reflected in Your Sessions.",
    time: "Previously", read: true
  },
];

const REPORTS: MedicalReport[] = [
  {
    id: "R001", title: "Dialysis Adequacy Report — Recent",
    date: "Recently", doctor: "Dr. Suresh Pillai",
    category: "Dialysis", summary: "Kt/V adequacy at target levels. Urea reduction ratio satisfactory. Continue current prescription."
  },
  {
    id: "R002", title: "Viral Panel — HBsAg, HCV, HIV",
    date: "Recently", doctor: "Dr. Anita Krishnamurthy",
    category: "Viral Status", summary: "All viral markers negative. No isolation requirements. Standard machine assignment maintained."
  },
  {
    id: "R003", title: "Blood Investigation — Haematology",
    date: "Previously", doctor: "Dr. Suresh Pillai",
    category: "Lab Results", summary: "Haemoglobin below target range. Erythropoietin dose adjusted. Iron supplementation initiated."
  },
  {
    id: "R004", title: "Clinical Review — Monthly",
    date: "Previously", doctor: "Dr. Suresh Pillai",
    category: "Clinical", summary: "Patient tolerating dialysis well. Blood pressure managed with current medication. Weight gain between sessions within acceptable range."
  },
];

const REQUESTS: AppointmentRequest[] = [
  {
    id: "REQ001", preferredSlot: "Slot 2 (12:00 PM – 4:00 PM)",
    preferredDate: "Next week", reason: "Slot 1 conflicts with personal commitments temporarily.",
    status: "Approved", submittedDate: "Recently",
    responseNote: "Approved for next week. Slot 2 on Machine 04 confirmed."
  },
  {
    id: "REQ002", preferredSlot: "Slot 1 (8:00 AM – 12:00 PM)",
    preferredDate: "This week", reason: "Returning to regular schedule.",
    status: "Pending", submittedDate: "Recently",
    responseNote: ""
  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ViralChip({ label, status }: { label: string; status: ViralStatus }) {
  const map: Record<ViralStatus, string> = {
    Positive: "bg-red-100 text-red-700 border-red-200",
    Negative: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Unknown:  "bg-gray-100 text-gray-500 border-gray-200",
    "Awaiting Report": "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16">{label}</span>
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>{status}</span>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { cls: string; dot: string }> = {
    Upcoming:  { cls: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
    Running:   { cls: "bg-blue-100 text-blue-700",    dot: "bg-blue-500 animate-pulse" },
    Completed: { cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    Missed:    { cls: "bg-red-100 text-red-700",      dot: "bg-red-500" },
    Cancelled: { cls: "bg-gray-100 text-gray-500",    dot: "bg-gray-400" },
  };
  const { cls, dot } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status}
    </span>
  );
}

function AttendanceBadge({ attendance }: { attendance: DialysisSession["attendance"] }) {
  const map = {
    Completed: "bg-emerald-100 text-emerald-700",
    Missed:    "bg-red-100 text-red-700",
    Cancelled: "bg-gray-100 text-gray-500",
    Pending:   "bg-amber-100 text-amber-700",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[attendance]}`}>{attendance}</span>;
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function PatientDashboard({
  sessions, notifications, onNavigate, patientData,
}: {
  sessions: DialysisSession[]; notifications: Notification[];
  onNavigate: (v: PatientView) => void; patientData: PatientData;
}) {
  const upcoming = sessions.filter(s => s.status === "Upcoming" || s.status === "Running");
  const completed = sessions.filter(s => s.attendance === "Completed").length;
  const missed    = sessions.filter(s => s.attendance === "Missed").length;
  const unread    = notifications.filter(n => !n.read).length;
  const nextSession = upcoming[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Welcome back</p>
            <h2 className="text-2xl font-bold mb-1">{patientData.name}</h2>
            <p className="text-blue-100 text-sm">KMC-RI Dialysis Centre · Patient Portal</p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Upcoming Sessions", value: upcoming.length, icon: <Calendar className="w-5 h-5 text-violet-600" />, color: "bg-violet-50" },
          { label: "Completed Sessions", value: completed, icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, color: "bg-emerald-50" },
          { label: "Missed Sessions",    value: missed,    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,   color: "bg-red-50" },
          { label: "Unread Alerts",      value: unread,    icon: <Bell className="w-5 h-5 text-amber-600" />,          color: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800 leading-none mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Next session card */}
      {nextSession && (
        <SectionCard className="border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                {nextSession.status === "Running" ? "Currently Active" : "Next Session"}
              </p>
              <h3 className="text-lg font-bold text-slate-800">{nextSession.slot}</h3>
              <p className="text-slate-500 text-sm">{nextSession.slotTime}</p>
            </div>
            <SessionStatusBadge status={nextSession.status} />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              { label: "Date",    value: nextSession.date },
              { label: "Machine", value: nextSession.machine },
              { label: "Unit",    value: nextSession.unit },
              { label: "Doctor",  value: nextSession.doctor },
              { label: "Duration", value: nextSession.duration },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="font-semibold text-slate-700 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "My Sessions",      view: "sessions" as PatientView,  icon: <Calendar className="w-5 h-5" />,  color: "bg-blue-600 text-white hover:bg-blue-700" },
          { label: "Dialysis History", view: "history" as PatientView,   icon: <Activity className="w-5 h-5" />,  color: "bg-slate-700 text-white hover:bg-slate-800" },
          { label: "Medical Reports",  view: "reports" as PatientView,   icon: <FileText className="w-5 h-5" />,  color: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
          { label: "Request Slot",     view: "request" as PatientView,   icon: <MessageSquare className="w-5 h-5" />, color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200" },
        ]).map(a => (
          <button key={a.label} onClick={() => onNavigate(a.view)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold text-sm transition-all ${a.color}`}>
            {a.icon}<span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Viral status snapshot */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-600" /> Viral Status
          </h3>
          <button onClick={() => onNavigate("reports")}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
            View Reports <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2">
          <ViralChip label="HBsAg" status="Negative" />
          <ViralChip label="HCV" status="Negative" />
          <ViralChip label="HIV" status="Negative" />
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
          <Info className="w-3 h-3" /> Last updated: Recently
        </p>
      </SectionCard>

      {/* Recent notifications */}
      {notifications.filter(n => !n.read).length > 0 && (
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Unread Notifications
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            </h3>
            <button onClick={() => onNavigate("notifications")}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {notifications.filter(n => !n.read).slice(0, 2).map(n => (
              <div key={n.id} className={`p-3 rounded-xl text-sm ${
                n.type === "warning" ? "bg-amber-50 border border-amber-200" :
                n.type === "success" ? "bg-emerald-50 border border-emerald-200" :
                "bg-blue-50 border border-blue-200"
              }`}>
                <p className="font-semibold text-slate-800 mb-0.5">{n.title}</p>
                <p className="text-slate-600 text-xs line-clamp-2">{n.message}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── My Sessions (Upcoming) ───────────────────────────────────────────────────

function MySessionsSection({ sessions }: { sessions: DialysisSession[] }) {
  const upcoming = sessions.filter(s => s.status === "Upcoming" || s.status === "Running");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">My Sessions</h2>
        <p className="text-slate-500 text-sm mt-1">Your scheduled dialysis appointments</p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900 mb-0.5">View-only schedule</p>
          <p className="text-xs text-blue-700">Your sessions are managed by the hospital administrator. To request a slot change, use the Request Slot section.</p>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <SectionCard className="text-center py-14">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No upcoming sessions</p>
          <p className="text-slate-400 text-sm mt-1">Contact the hospital to schedule your next dialysis session.</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {upcoming.map((session, idx) => (
            <div key={session.id}
              className={`bg-white rounded-2xl border-2 shadow-sm p-5 ${
                session.status === "Running" ? "border-blue-400 shadow-blue-100" : "border-slate-100"
              }`}>
              {session.status === "Running" && (
                <div className="flex items-center gap-2 mb-3 text-xs text-blue-700 font-bold bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full w-fit">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Session In Progress
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-slate-800 text-base">{session.slot}</p>
                    {idx === 0 && session.status !== "Running" && (
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Next up</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {session.slotTime}
                  </p>
                </div>
                <SessionStatusBadge status={session.status} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Date",     value: session.date },
                  { label: "Machine",  value: session.machine },
                  { label: "Unit",     value: session.unit },
                  { label: "Doctor",   value: session.doctor },
                  { label: "Duration", value: session.duration },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{item.label}</p>
                    <p className="font-semibold text-slate-700 text-sm mt-0.5 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session schedule info */}
      <SectionCard>
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" /> Dialysis Slot Schedule
        </h3>
        <div className="space-y-2">
          {[
            { slot: "Slot 1", time: "8:00 AM – 12:00 PM" },
            { slot: "Slot 2", time: "12:00 PM – 4:00 PM" },
            { slot: "Slot 3", time: "4:00 PM – 8:00 PM" },
          ].map(s => (
            <div key={s.slot} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="font-semibold text-slate-700 text-sm">{s.slot}</span>
              <span className="text-slate-500 text-sm">{s.time}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Each session is approximately 4 hours. Arrive 15 minutes early.</p>
      </SectionCard>
    </div>
  );
}

// ─── Dialysis History ─────────────────────────────────────────────────────────

function DialysisHistorySection({ sessions }: { sessions: DialysisSession[] }) {
  const history = sessions.filter(s => s.status === "Completed" || s.status === "Missed" || s.status === "Cancelled");
  const [filterStatus, setFilterStatus] = useState("All");

  const filtered = filterStatus === "All" ? history
    : history.filter(s => s.attendance === filterStatus);

  const stats = {
    total:    history.length,
    completed: history.filter(s => s.attendance === "Completed").length,
    missed:    history.filter(s => s.attendance === "Missed").length,
    adherence: history.length > 0
      ? Math.round((history.filter(s => s.attendance === "Completed").length / history.length) * 100)
      : 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dialysis History</h2>
        <p className="text-slate-500 text-sm mt-1">Complete record of all your past sessions</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions",  value: stats.total,     cls: "bg-slate-50 text-slate-700" },
          { label: "Completed",       value: stats.completed, cls: "bg-emerald-50 text-emerald-700" },
          { label: "Missed",          value: stats.missed,    cls: "bg-red-50 text-red-700" },
          { label: "Adherence Rate",  value: `${stats.adherence}%`, cls: "bg-blue-50 text-blue-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center ${s.cls}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["All", "Completed", "Missed", "Cancelled"].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterStatus === f ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} records</span>
      </div>

      {/* Session list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <SectionCard className="text-center py-12">
            <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No records found.</p>
          </SectionCard>
        )}
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-slate-800">{s.slot} — {s.date}</p>
                <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" /> {s.slotTime}
                </p>
              </div>
              <AttendanceBadge attendance={s.attendance} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { label: "Machine",  value: s.machine },
                { label: "Unit",     value: s.unit },
                { label: "Doctor",   value: s.doctor },
                { label: "Duration", value: s.duration },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-slate-400 font-semibold">{item.label}</p>
                  <p className="text-slate-700 font-medium mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            {s.notes && (
              <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                {s.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsSection({ notifications: initial }: { notifications: Notification[] }) {
  const [notifs, setNotifs] = useState(initial);
  const unread = notifs.filter(n => !n.read).length;

  const typeConfig: Record<Notification["type"], { cls: string; icon: React.ReactNode }> = {
    info:    { cls: "border-blue-200 bg-blue-50",     icon: <Info className="w-5 h-5 text-blue-600" /> },
    warning: { cls: "border-amber-200 bg-amber-50",   icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
    success: { cls: "border-emerald-200 bg-emerald-50", icon: <CheckCircle className="w-5 h-5 text-emerald-600" /> },
    error:   { cls: "border-red-200 bg-red-50",       icon: <AlertTriangle className="w-5 h-5 text-red-600" /> },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Notifications</h2>
          <p className="text-slate-500 text-sm mt-1">Hospital alerts and updates about your treatment</p>
        </div>
        {unread > 0 && (
          <button onClick={() => setNotifs(p => p.map(n => ({ ...n, read: true })))}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> Mark All Read
          </button>
        )}
      </div>

      {unread > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">You have <strong>{unread}</strong> unread notification{unread !== 1 ? "s" : ""}.</p>
        </div>
      )}

      <div className="space-y-3">
        {notifs.map(n => {
          const cfg = typeConfig[n.type];
          return (
            <div key={n.id} className={`flex gap-4 p-4 rounded-2xl border-2 transition-all ${cfg.cls} ${n.read ? "opacity-60" : ""}`}>
              <div className="shrink-0 mt-0.5">{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-slate-800">{n.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                    <span className="text-xs text-slate-400">{n.time}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{n.message}</p>
              </div>
              {!n.read && (
                <button onClick={() => setNotifs(p => p.map(x => x.id === n.id ? { ...x, read: true } : x))}
                  className="shrink-0 text-xs text-slate-400 hover:text-slate-600 underline self-start">
                  Dismiss
                </button>
              )}
            </div>
          );
        })}
        {notifs.length === 0 && (
          <SectionCard className="text-center py-12">
            <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No notifications.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ─── Medical Reports ──────────────────────────────────────────────────────────

function MedicalReportsSection({ reports }: { reports: MedicalReport[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("All");
  const categories = ["All", ...Array.from(new Set(reports.map(r => r.category)))];

  const filtered = filterCat === "All" ? reports : reports.filter(r => r.category === filterCat);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Medical Reports</h2>
        <p className="text-slate-500 text-sm mt-1">Clinical reports and lab results from your care team</p>
      </div>

      {/* Viral status card */}
      <SectionCard className="border-l-4 border-l-violet-500">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-600" /> Viral Status Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <ViralChip label="HBsAg" status="Negative" />
          <ViralChip label="HCV" status="Negative" />
          <ViralChip label="HIV" status="Negative" />
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
          <Info className="w-3 h-3" /> Viral status determines your machine assignment. All results negative — standard machine.
        </p>
      </SectionCard>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterCat === c ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>{c}</button>
        ))}
      </div>

      {/* Report cards */}
      <div className="space-y-3">
        {filtered.map(r => {
          const isExpanded = expanded === r.id;
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button className="w-full text-left p-5" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-slate-800">{r.title}</p>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{r.category}</span>
                    </div>
                    <p className="text-xs text-slate-400">{r.date} · {r.doctor}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <FileText className="w-4 h-4 text-slate-300" />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">{r.summary}</p>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                      <Download className="w-3.5 h-3.5" /> Download Report
                    </button>
                    <span className="text-slate-200">|</span>
                    <p className="text-xs text-slate-400">Reported by {r.doctor}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection({ patientData }: { patientData: PatientData }) {
  const profileItems = [
    { label: "Full Name",         value: patientData.name },
    { label: "Patient ID (UHID)", value: "KMCRI-2024-001" },
    { label: "Blood Group",       value: "B+" },
    { label: "Age",               value: "45 years" },
    { label: "Gender",            value: "Male" },
    { label: "Primary Disease",   value: "Chronic Kidney Disease Stage 5" },
    { label: "Cause",             value: "Diabetic Nephropathy" },
    { label: "Treating Doctor",   value: "Dr. Suresh Pillai" },
    { label: "Dialysis Started",  value: "Recently" },
    { label: "Mobile",            value: "Contact via portal" },
    { label: "Emergency Contact", value: "Contact via portal" },
    { label: "Insurance",         value: "Star Health" },
  ];

  const scheduleInfo = [
    { label: "Current Schedule", value: "Slot 1 — Monday, Wednesday, Friday" },
    { label: "Time",             value: "8:00 AM – 12:00 PM" },
    { label: "Machine",          value: "Machine 01" },
    { label: "Unit",             value: "Unit 1" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>
        <p className="text-slate-500 text-sm mt-1">Your registered medical profile at KMC-RI Hospital</p>
      </div>

      {/* Avatar card */}
      <SectionCard>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shrink-0">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">{patientData.name}</h3>
            <p className="text-slate-500 text-sm">KMCRI-2024-001 · Dialysis Patient</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">B+</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Profile details */}
      <SectionCard>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" /> Personal & Medical Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y divide-slate-50">
          {profileItems.map(item => (
            <div key={item.label} className="flex items-start justify-between py-3 px-1 gap-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 mt-0.5">{item.label}</span>
              <span className="text-sm text-slate-700 font-medium text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Schedule */}
      <SectionCard>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-600" /> Dialysis Schedule
        </h3>
        <div className="space-y-3">
          {scheduleInfo.map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-500 font-medium">{item.label}</span>
              <span className="text-sm font-bold text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Viral profile */}
      <SectionCard>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-600" /> Viral Profile
        </h3>
        <div className="space-y-3">
          <ViralChip label="HBsAg" status="Negative" />
          <ViralChip label="HCV" status="Negative" />
          <ViralChip label="HIV" status="Negative" />
        </div>
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex gap-2 items-start">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800">All viral markers negative. Standard Negative machine assignment. No isolation required.</p>
        </div>
      </SectionCard>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">Profile details can only be updated by hospital administration. Contact the dialysis centre for corrections.</p>
      </div>
    </div>
  );
}

// ─── Request Slot ─────────────────────────────────────────────────────────────

function RequestSlotSection({ requests: initial }: { requests: AppointmentRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slot: "", date: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);

  const SLOTS = [
    "Slot 1 (8:00 AM – 12:00 PM)",
    "Slot 2 (12:00 PM – 4:00 PM)",
    "Slot 3 (4:00 PM – 8:00 PM)",
  ];

  const handleSubmit = () => {
    if (!form.slot || !form.date || !form.reason.trim()) return;
    const newReq: AppointmentRequest = {
      id: `REQ${Date.now()}`, preferredSlot: form.slot, preferredDate: form.date,
      reason: form.reason, status: "Pending", submittedDate: "Just now", responseNote: "",
    };
    setRequests(p => [newReq, ...p]);
    setForm({ slot: "", date: "", reason: "" });
    setShowForm(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const statusConfig: Record<AppointmentRequest["status"], { cls: string; label: string }> = {
    Pending:  { cls: "bg-amber-100 text-amber-700 border-amber-200",   label: "Pending Review" },
    Approved: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Approved" },
    Rejected: { cls: "bg-red-100 text-red-700 border-red-200",         label: "Rejected" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Request Slot Change</h2>
          <p className="text-slate-500 text-sm mt-1">Submit a request to change your dialysis slot or schedule</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
          <MessageSquare className="w-4 h-4" /> New Request
        </button>
      </div>

      {submitted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-semibold">Your request has been submitted. The hospital team will review and respond shortly.</p>
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <SectionCard>
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" /> New Slot Request
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Preferred Slot *</label>
              <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                <option value="">Select a slot…</option>
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Preferred Date / Period *</label>
              <input type="text" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                placeholder="e.g. Next Monday, From next week, Temporarily…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reason for Request *</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Please explain why you need a slot change…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>Note:</strong> Slot changes are subject to machine availability and approval by the hospital administrator. Your current schedule remains active until a new one is confirmed.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={handleSubmit} disabled={!form.slot || !form.date || !form.reason.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Submit Request
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Request history */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Your Requests</h3>
        {requests.length === 0 && (
          <SectionCard className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No slot requests submitted yet.</p>
          </SectionCard>
        )}
        {requests.map(r => {
          const cfg = statusConfig[r.status];
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800">{r.preferredSlot}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Submitted: {r.submittedDate} · For: {r.preferredDate}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>{cfg.label}</span>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 mb-2">{r.reason}</p>
              {r.responseNote && (
                <div className={`flex gap-2 items-start px-3 py-2 rounded-xl border text-xs ${r.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>Hospital response:</strong> {r.responseNote}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main PatientApp ──────────────────────────────────────────────────────────

export default function PatientApp() {
  const [authed, setAuthed]       = useState(false);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [view, setView]           = useState<PatientView>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localNotifs, setLocalNotifs] = useState(NOTIFICATIONS);

  const unread = localNotifs.filter(n => !n.read).length;

  if (!authed) {
    return <PatientAuthPortal onAuthenticate={d => { setPatientData(d); setAuthed(true); }}
      onBack={() => window.location.reload()} />;
  }

  const navItems: { view: PatientView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { view: "dashboard",      label: "Dashboard",          icon: <LayoutDashboard className="w-4 h-4" /> },
    { view: "sessions",       label: "My Sessions",        icon: <Calendar className="w-4 h-4" /> },
    { view: "history",        label: "Dialysis History",   icon: <Activity className="w-4 h-4" /> },
    { view: "notifications",  label: "Notifications",      icon: <Bell className="w-4 h-4" />, badge: unread > 0 ? unread : undefined },
    { view: "reports",        label: "Medical Reports",    icon: <FileText className="w-4 h-4" /> },
    { view: "profile",        label: "My Profile",         icon: <User className="w-4 h-4" /> },
    { view: "request",        label: "Request Slot",       icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const viewLabels: Record<PatientView, string> = {
    dashboard: "Dashboard", sessions: "My Sessions", history: "Dialysis History",
    notifications: "Notifications", reports: "Medical Reports", profile: "My Profile",
    request: "Request Slot",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-white border-r border-slate-100 flex flex-col shadow-xl z-50">
            <SidebarContent navItems={navItems} view={view} setView={v => { setView(v); setSidebarOpen(false); }}
              patientData={patientData} onLogout={() => { setAuthed(false); setPatientData(null); }} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 h-screen sticky top-0 bg-white border-r border-slate-100 flex-col shadow-sm">
        <SidebarContent navItems={navItems} view={view} setView={setView}
          patientData={patientData} onLogout={() => { setAuthed(false); setPatientData(null); }} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between px-4 md:px-6 py-3.5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="font-bold text-slate-800 text-base leading-none">{viewLabels[view]}</h1>
                <p className="text-slate-400 text-xs mt-0.5">Patient Portal · KMC-RI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView("notifications")}
                className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl w-full mx-auto">
          {view === "dashboard" && (
            <PatientDashboard sessions={SESSIONS} notifications={localNotifs}
              onNavigate={setView} patientData={patientData!} />
          )}
          {view === "sessions" && <MySessionsSection sessions={SESSIONS} />}
          {view === "history" && <DialysisHistorySection sessions={SESSIONS} />}
          {view === "notifications" && (
            <NotificationsSection notifications={localNotifs} />
          )}
          {view === "reports" && <MedicalReportsSection reports={REPORTS} />}
          {view === "profile" && <ProfileSection patientData={patientData!} />}
          {view === "request" && <RequestSlotSection requests={REQUESTS} />}
        </main>
      </div>
    </div>
  );
}

// ─── Sidebar Content (shared) ─────────────────────────────────────────────────

function SidebarContent({
  navItems, view, setView, patientData, onLogout,
}: {
  navItems: { view: PatientView; label: string; icon: React.ReactNode; badge?: number }[];
  view: PatientView;
  setView: (v: PatientView) => void;
  patientData: PatientData | null;
  onLogout: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">KMC-RI Hospital</p>
            <p className="text-blue-200 text-[10px] mt-0.5">Dialysis Centre</p>
          </div>
        </div>
        {patientData && (
          <div className="bg-white/10 rounded-xl px-3 py-2">
            <p className="text-white text-xs font-semibold">{patientData.name}</p>
            <p className="text-blue-200 text-[10px]">Patient · KMCRI-2024-001</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(item => {
          const isActive = view === item.view;
          return (
            <button key={item.view} onClick={() => setView(item.view)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}>
              <div className="flex items-center gap-3">{item.icon}<span>{item.label}</span></div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <HeartPulse className="w-3 h-3" />
          <span>View-only patient portal</span>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors font-medium">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </>
  );
}
