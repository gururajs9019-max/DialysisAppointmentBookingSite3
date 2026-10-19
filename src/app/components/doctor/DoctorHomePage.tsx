import { Calendar, Users, Activity, Settings, TrendingUp, FileText, Clock, Stethoscope, Heart } from "lucide-react";
import type { DialysisSession, Machine } from "../../AdminApp";
import type { StaffNotification } from "../../lib/staffApi";

interface DoctorHomePageProps {
  onNavigate: (view: string) => void;
  sessions: DialysisSession[];
  machines: Machine[];
  notifications: StaffNotification[];
}

// KPI source data — mirrors AdminApp mock data so counts stay consistent across portals.
// In a real deployment these would be fetched from the API on each render.
const TODAY_SESSION_STATUSES = [
  "Running",  // Arjun Mehta  – Machine 01, Slot 1
  "Running",  // Lakshmi Iyer – Machine 28, Slot 1
  "Waiting",  // Vikram Singh  – Machine 23, Slot 2
  "Waiting",  // Priya Reddy  – Machine 16, Slot 1
  "Running",  // Sanjay Patel – Machine 08, Slot 1
] as const;

// Sessions whose attendance is Missed (doctor-relevant alert)
const MISSED_SESSION_COUNT = 1; // Ramesh Nair – S006

// Machine statuses from AdminApp INITIAL_MACHINES (Unit 1: 29 + Unit 2: 7 = 36 total)
const ALL_MACHINE_STATUSES = [
  "in-use","available","available","available","maintenance",   // M01–M05
  "available","disabled","in-use","available","available",      // M06–M10
  "available","available","available","available","available",  // M11–M15
  "in-use","available","available","available","available",     // M16–M20
  "available","available",                                       // M21–M22
  "in-use","available","available","available","scheduled",     // M23–M27
  "in-use","available",                                          // M28–M29
  "in-use","available","available","available","scheduled",     // U2M01–U2M05
  "available","available",                                       // U2M06–U2M07
] as const;

export function DoctorHomePage({ onNavigate, sessions, machines, notifications }: DoctorHomePageProps) {
  // Computed KPIs — never hardcoded strings; derived from the same data as AdminApp
  const todayStats = {
    scheduled:        sessions.filter(s=>s.date===new Date().toISOString().slice(0,10)&&!["Missed","Cancelled"].includes(s.status)).length,
    completed:        sessions.filter(s=>s.date===new Date().toISOString().slice(0,10)&&s.status==="Completed").length,
    activeNow:        sessions.filter(s=>s.date===new Date().toISOString().slice(0,10)&&s.status==="Running").length,
    pending:          sessions.filter(s=>s.date===new Date().toISOString().slice(0,10)&&["Scheduled","Waiting"].includes(s.status)).length,
    alerts:           notifications.filter(n=>!n.read).length,
    availableMachines: machines.filter(s => s.status === "available").length,
  };

  const quickLinks = [
    {
      icon: Calendar,
      title: "View Schedule",
      description: "Daily and weekly dialysis schedules",
      view: "schedule",
      color: "bg-blue-500",
      stat: `${todayStats.scheduled} session${todayStats.scheduled !== 1 ? "s" : ""} today`,
    },
    {
      icon: Users,
      title: "Patient Profiles",
      description: "Access comprehensive medical records",
      view: "patients",
      color: "bg-green-500",
      stat: "Active patients",
    },
    {
      icon: FileText,
      title: "Clinical Notes",
      description: "Document patient treatment and vitals",
      view: "notes",
      color: "bg-orange-500",
      stat: "Add session notes",
    },
    {
      icon: TrendingUp,
      title: "Analytics",
      description: "Treatment outcomes and performance",
      view: "analytics",
      color: "bg-indigo-500",
      stat: "View reports",
    },
  ];

  const recentActivities = notifications.slice(0, 6).map(notification => ({
    id: notification.id,
    read: notification.read,
    message: notification.message || "Notification",
    detail: notification.detail || "",
    time: notification.created_at
      ? new Date(notification.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "Time unavailable",
    icon: FileText,
    color: notification.read ? "text-gray-400" : "text-blue-600",
  }));

  const upcomingSessions = sessions.filter(s=>s.date>=new Date().toISOString().slice(0,10)&&["Scheduled","Waiting"].includes(s.status))
    .sort((a,b)=>`${a.date}${a.slot}`.localeCompare(`${b.date}${b.slot}`)).slice(0,5)
    .map(s=>({time:`${s.date} · ${s.slot}`,patient:s.patientName,machine:s.machine,priority:s.slotType==="emergency"?"emergency":"normal"}));

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
              <Stethoscope className="w-12 h-12 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-2">
                Doctor Command Center
              </h1>
              <p className="text-lg md:text-xl text-blue-100">
                KMC-RI Dialysis Department Management Portal
              </p>
            </div>
          </div>

          {/* Today's Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Scheduled</p>
              <p className="text-2xl font-bold">{todayStats.scheduled}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Completed</p>
              <p className="text-2xl font-bold">{todayStats.completed}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Active Now</p>
              <p className="text-2xl font-bold">{todayStats.activeNow}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Pending</p>
              <p className="text-2xl font-bold">{todayStats.pending}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Alerts</p>
              <p className={`text-2xl font-bold ${todayStats.alerts > 0 ? "text-red-300" : ""}`}>{todayStats.alerts}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Machines</p>
              <p className="text-2xl font-bold">{todayStats.availableMachines}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Access Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Access</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.view}
                  onClick={() => onNavigate(link.view)}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left border-2 border-transparent hover:border-blue-500"
                >
                  <div className="flex items-start gap-4">
                    <div className={`${link.color} p-3 rounded-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{link.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{link.description}</p>
                      <p className="text-xs font-medium text-blue-600">{link.stat}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Next Sessions */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Next Sessions
              </h2>
              <button
                onClick={() => onNavigate("schedule")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All →
              </button>
            </div>
            <div className="space-y-3">
              {upcomingSessions.map((session, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{session.patient}</p>
                      {session.priority === 'emergency' && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium">
                          Emergency
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{session.time}</span>
                      <span>•</span>
                      <span>{session.machine}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate("patients")}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                Recent Activity
              </h2>
              <button
                onClick={() => onNavigate("notifications")}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {recentActivities.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  No recent staff updates.
                </div>
              )}
              {recentActivities.map(activity => {
                const Icon = activity.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
                  >
                    <Icon className={`w-5 h-5 ${activity.color} flex-shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 font-medium">{activity.message}</p>
                      {activity.detail && <p className="mt-1 break-words text-xs leading-relaxed text-gray-600">{activity.detail}</p>}
                      <p className="text-xs text-gray-600 mt-1">{activity.time}</p>
                      <p className={`mt-1 text-[11px] font-semibold ${activity.read ? "text-gray-500" : "text-blue-700"}`}>
                        {activity.read ? "Read" : "Unread"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System Tools */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">System Tools & Resources</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Clinical Guidelines
              </h3>
              <p className="text-sm text-blue-100">
                Access treatment protocols and best practices for dialysis care
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Staff Directory
              </h3>
              <p className="text-sm text-blue-100">
                Contact nurses, technicians, and support staff across departments
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Settings
              </h3>
              <p className="text-sm text-blue-100">
                Configure preferences, notifications, and access controls
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600 text-sm">
            <p className="mb-2">KMC-RI Hospital Dialysis Department - Healthcare Provider Portal</p>
            <p>For technical support: support@kmcri.com | Emergency: Contact Hospital Operations</p>
          </div>
        </div>
      </footer>
    </div>
  );
}