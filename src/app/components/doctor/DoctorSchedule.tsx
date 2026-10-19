import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Settings, CheckCircle, X } from "lucide-react";
import type { DialysisSession } from "../../AdminApp";
import { addLocalDays, localDateKey, sessionsByWeekDate, sessionsForDate, weekDateKeys } from "../../lib/scheduleDateMapping.mjs";

interface DoctorScheduleProps {
  onNavigate: (view: string) => void;
  sessions: DialysisSession[];
}

type ViewMode = "daily" | "weekly";

const SLOTS = [
  { id: "S1", label: "Slot 1", time: "8:00 AM – 12:00 PM", short: "8:00–12:00" },
  { id: "S2", label: "Slot 2", time: "12:00 PM – 4:00 PM",  short: "12:00–16:00" },
  { id: "S3", label: "Slot 3", time: "4:00 PM – 8:00 PM",   short: "16:00–20:00" },
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TODAY_SESSIONS = [
  { id: "1",  slot: "S1", patient: "Rajesh Kumar",      machine: "M-01", unit: "Unit 1", status: "completed",   priority: "normal" },
  { id: "2",  slot: "S1", patient: "Meera Nair",         machine: "M-03", unit: "Unit 1", status: "completed",   priority: "normal" },
  { id: "3",  slot: "S1", patient: "Sanjay Gupta",       machine: "M-07", unit: "Unit 1", status: "completed",   priority: "normal" },
  { id: "4",  slot: "S1", patient: "Deepa Reddy",        machine: "M-11", unit: "Unit 1", status: "in-progress", priority: "high" },
  { id: "5",  slot: "S2", patient: "Vikram Singh",       machine: "M-02", unit: "Unit 1", status: "scheduled",   priority: "normal" },
  { id: "6",  slot: "S2", patient: "Priya Sharma",       machine: "M-05", unit: "Unit 1", status: "scheduled",   priority: "normal" },
  { id: "7",  slot: "S2", patient: "Arjun Desai",        machine: "M-09", unit: "Unit 1", status: "scheduled",   priority: "emergency" },
  { id: "8",  slot: "S3", patient: "Ananya Patel",       machine: "U2-M01", unit: "Unit 2", status: "pending",   priority: "normal" },
  { id: "9",  slot: "S3", patient: "Kavitha Subramanian", machine: "U2-M03", unit: "Unit 2", status: "scheduled", priority: "normal" },
];

const WEEKLY_DATA: Record<string, Record<string, string[]>> = {
  S1: {
    Mon: ["Rajesh Kumar", "Meera Nair"],
    Tue: ["Sanjay Gupta", "Deepa Reddy"],
    Wed: ["Rajesh Kumar", "Priya Sharma"],
    Thu: ["Vikram Singh"],
    Fri: ["Meera Nair", "Arjun Desai"],
    Sat: ["Ananya Patel"],
    Sun: [],
  },
  S2: {
    Mon: ["Priya Sharma", "Arjun Desai"],
    Tue: ["Kavitha Subramanian"],
    Wed: ["Sanjay Gupta"],
    Thu: ["Rajesh Kumar", "Deepa Reddy"],
    Fri: ["Vikram Singh", "Ananya Patel"],
    Sat: ["Meera Nair"],
    Sun: [],
  },
  S3: {
    Mon: ["Kavitha Subramanian"],
    Tue: ["Ananya Patel", "Vikram Singh"],
    Wed: ["Arjun Desai"],
    Thu: ["Priya Sharma"],
    Fri: ["Deepa Reddy"],
    Sat: [],
    Sun: [],
  },
};

function getStatusColor(status: string) {
  switch (status) {
    case "completed":   return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "in-progress": return "bg-blue-100 text-blue-700 border-blue-300";
    case "scheduled":   return "bg-violet-100 text-violet-700 border-violet-300";
    case "pending":     return "bg-amber-100 text-amber-700 border-amber-300";
    case "called":      return "bg-violet-100 text-violet-700 border-violet-300";
    case "cancelled":   return "bg-red-100 text-red-700 border-red-300";
    case "missed":      return "bg-red-100 text-red-700 border-red-300";
    default:            return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":   return <CheckCircle className="w-4 h-4" />;
    case "in-progress": return <Clock className="w-4 h-4 animate-pulse" />;
    case "cancelled":   return <X className="w-4 h-4" />;
    default:            return <Calendar className="w-4 h-4" />;
  }
}

export function DoctorSchedule({ onNavigate, sessions: apiSessions }: DoctorScheduleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [activeSlot, setActiveSlot] = useState<string>("all");
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const displayedDateKey = localDateKey(displayDate);
  const displayedWeek = weekDateKeys(displayDate);

  const sourceSessions = apiSessions.map(s => ({ id: s.id, date: s.date, slot: s.slot.replace("Slot ", "S"), patient: s.patientName, machine: s.machine, unit: s.unit==="U1"?"Unit 1":s.unit==="U2"?"Unit 2":s.unit, status: s.status === "Missed" ? "missed" : s.status === "Cancelled" ? "cancelled" : s.status === "Completed" ? "completed" : s.status === "Running" ? "in-progress" : s.status === "Called" ? "called" : s.status === "Waiting" ? "pending" : "scheduled", priority: s.slotType==="emergency"?"emergency":"normal" })).filter(s => s.slot === "S1" || s.slot === "S2" || s.slot === "S3");
  const dailySessions = sessionsForDate(sourceSessions, displayedDateKey);
  const weeklySessions = sessionsByWeekDate(sourceSessions, displayedWeek);
  const filteredSessions = activeSlot === "all" ? dailySessions : dailySessions.filter(s => s.slot === activeSlot);

  const stats = {
    completed: dailySessions.filter(s => s.status === "completed").length,
    inProgress: dailySessions.filter(s => s.status === "in-progress").length,
    scheduled: dailySessions.filter(s => s.status === "scheduled").length,
    pending: dailySessions.filter(s => s.status === "pending" || s.status === "called").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Dialysis Schedule</h1>
        <p className="text-blue-100 text-sm">Daily treatment sessions across all slots and units</p>
      </div>

      {/* Slot summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {SLOTS.map(slot => {
           const count = dailySessions.filter(s => s.slot === slot.id).length;
          return (
            <div key={slot.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{slot.label}</p>
              <p className="font-semibold text-slate-800 text-sm mb-2">{slot.time}</p>
              <p className="text-2xl font-bold text-blue-600">{count} <span className="text-sm font-medium text-slate-400">sessions</span></p>
            </div>
          );
        })}
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setDisplayDate(date => addLocalDays(date, viewMode === "weekly" ? -7 : -1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button onClick={() => setDisplayDate(new Date())} className="text-center">
              <p className="font-semibold text-gray-900">{displayedDateKey === localDateKey(new Date()) ? "Today" : displayedDateKey}</p>
              <p className="text-xs text-gray-500">Daily Dialysis Schedule</p>
            </button>
            <button onClick={() => setDisplayDate(date => addLocalDays(date, viewMode === "weekly" ? 7 : 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* View mode */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >Daily</button>
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "weekly" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >Weekly</button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3 text-xs">
            {[
              { label: "Completed",    value: stats.completed,  cls: "bg-emerald-100 text-emerald-700" },
              { label: "In Progress",  value: stats.inProgress, cls: "bg-blue-100 text-blue-700" },
              { label: "Scheduled",    value: stats.scheduled,  cls: "bg-violet-100 text-violet-700" },
              { label: "Pending",      value: stats.pending,    cls: "bg-amber-100 text-amber-700" },
            ].map(s => (
              <span key={s.label} className={`px-3 py-1 rounded-full font-semibold ${s.cls}`}>
                {s.label}: {s.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "daily" ? (
        <div className="space-y-4">
          {/* Slot filter tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveSlot("all")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                activeSlot === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >All Slots</button>
            {SLOTS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSlot(s.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  activeSlot === s.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {s.label} <span className="opacity-70 text-xs">({s.short})</span>
              </button>
            ))}
          </div>

          {/* Group by slot */}
          {SLOTS.filter(s => activeSlot === "all" || activeSlot === s.id).map(slot => {
            const sessions = filteredSessions.filter(sess => sess.slot === slot.id);
            if (sessions.length === 0 && activeSlot !== "all") return null;
            return (
              <div key={slot.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Slot header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-white/70" />
                    <div>
                      <span className="font-bold text-white">{slot.label}</span>
                      <span className="text-slate-300 text-sm ml-2">({slot.time})</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-300 font-semibold">{sessions.length} sessions</span>
                </div>

                {sessions.length === 0 ? (
                  <div className="px-5 py-6 text-center text-slate-400 text-sm">No sessions in this slot today.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        className={`px-5 py-4 border-l-4 hover:bg-slate-50 transition-all cursor-pointer ${
                          session.status === "completed"   ? "border-l-emerald-400" :
                          session.status === "in-progress" ? "border-l-blue-400" :
                          session.status === "scheduled"   ? "border-l-violet-400" :
                          session.status === "pending"     ? "border-l-amber-400" :
                          "border-l-gray-200"
                        }`}
                        onClick={() => onNavigate("doctor-patients")}
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg border ${getStatusColor(session.status)}`}>
                              {getStatusIcon(session.status)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800">{session.patient}</p>
                                {session.priority === "emergency" && (
                                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold">Emergency</span>
                                )}
                                {session.priority === "high" && (
                                  <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded-full font-bold">Priority</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                                <span className="flex items-center gap-1"><Settings className="w-3 h-3" />{session.machine}</span>
                                <span>{session.unit}</span>
                                <span>Duration: 4 hours</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(session.status)}`}>
                              {session.status.replace("-", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Weekly view */
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-3 px-4 text-left text-sm font-bold text-slate-600">Slot</th>
                 {WEEK_DAYS.map(d => (
                   <th key={d} className="py-3 px-3 text-center text-sm font-bold text-slate-600">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <tr key={slot.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-4 px-4 align-top">
                    <p className="font-bold text-slate-700 text-sm">{slot.label}</p>
                    <p className="text-slate-400 text-xs">{slot.time}</p>
                  </td>
                   {WEEK_DAYS.map((day, index) => {
                     const patients = weeklySessions[displayedWeek[index]].filter(s => s.slot === slot.id).map(s => s.patient);
                    return (
                      <td key={day} className="py-4 px-3 align-top">
                        <div className="space-y-1">
                          {patients.map((name, i) => (
                            <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-xs">
                              <p className="font-semibold text-blue-900 leading-tight">{name.split(" ")[0]}</p>
                            </div>
                          ))}
                          {patients.length === 0 && (
                            <div className="text-slate-200 text-xs text-center py-1">—</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View-only notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Read-only view.</span> Slot allocation and schedule modifications are managed by the Administrator Portal.
        </p>
      </div>
    </div>
  );
}
