import React, { useState } from "react";
import type { AdminPrescription, RxNotification, Patient, Machine, DialysisSession } from "./AdminApp";
import { DoctorAuthPortal, DoctorData } from "./components/doctor/DoctorAuthPortal";
import { DoctorHomePage } from "./components/doctor/DoctorHomePage";
import { DoctorSchedule } from "./components/doctor/DoctorSchedule";
import { PatientProfiles } from "./components/doctor/PatientProfiles";
import { ClinicalNotes } from "./components/doctor/ClinicalNotes";
import { DoctorAnalytics } from "./components/doctor/DoctorAnalytics";
import { DoctorPrescription } from "./components/doctor/DoctorPrescription";
import { DoctorViralStatus } from "./components/doctor/DoctorViralStatus";
import { DoctorTreatmentProgress } from "./components/doctor/DoctorTreatmentProgress";
import { logoutStaff } from "./lib/appointmentApi";
import { loadStaffData, type StaffAnalytics } from "./lib/staffApi";
import {
  Stethoscope,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Home,
  Menu,
  X,
  LogOut,
  User,
  Pill,
  FlaskConical,
  BarChart2
} from "lucide-react";

type DoctorView =
  | "home"
  | "schedule"
  | "patients"
  | "notes"
  | "analytics"
  | "prescription"
  | "viral-status"
  | "treatment-progress";

export default function DoctorApp({
  prescriptions,
  setPrescriptions,
  addRxNotification,
}: {
  prescriptions: AdminPrescription[];
  setPrescriptions: React.Dispatch<React.SetStateAction<AdminPrescription[]>>;
  addRxNotification: (n: Omit<RxNotification, "id" | "read">) => void;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState<DoctorData | null>(null);
  const [view, setView] = useState<DoctorView>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<DialysisSession[]>([]);
  const [analytics, setAnalytics] = useState<StaffAnalytics | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const handleAuthenticate = async (doctorData: DoctorData) => {
    setStaffLoading(true); setStaffError(null);
    try {
      const data = await loadStaffData();
      setPatients(data.patients); setMachines(data.machines); setSessions(data.sessions);
      setAnalytics(data.analytics); setPrescriptions(data.prescriptions);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Staff records could not be loaded.");
    } finally { setStaffLoading(false); }
    setCurrentDoctor(doctorData);
    setIsAuthenticated(true);
    setView("home");
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      await logoutStaff();
      setIsAuthenticated(false);
      setCurrentDoctor(null);
      setView("home");
    }
  };

  const handleNavigate = (newView: string) => {
    // Redirect removed pages to home
    const removed = ["approvals", "dashboard", "machines"];
    setView((removed.includes(newView) ? "home" : newView) as DoctorView);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { label: "Home",          view: "home",               icon: Home,         show: true },
    { label: "Schedule",      view: "schedule",            icon: Calendar,     show: true },
    { label: "Patients",      view: "patients",            icon: Users,        show: true },
    { label: "Notes",         view: "notes",               icon: FileText,     show: true },
    { label: "Analytics",     view: "analytics",           icon: TrendingUp,   show: true },
    { label: "Prescriptions", view: "prescription",        icon: Pill,         show: true },
    { label: "Viral Status",  view: "viral-status",        icon: FlaskConical, show: true },
    { label: "Progress",      view: "treatment-progress",  icon: BarChart2,    show: true },
  ];

  // Show auth portal if not authenticated
  if (!isAuthenticated) {
    return <DoctorAuthPortal onAuthenticate={handleAuthenticate} onBack={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer" 
              onClick={() => handleNavigate("home")}
            >
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-2 rounded-xl shadow-md">
                <Stethoscope className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-gray-900">KMC-RI Doctor Portal</h1>
                <p className="text-xs md:text-sm text-gray-600 hidden sm:block">Dialysis Department Management</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-2">
                {navItems.slice(0, 6).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNavigate(item.view)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        view === item.view
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* User Profile */}
              <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{currentDoctor?.name}</p>
                  <p className="text-xs text-gray-600">{currentDoctor?.specialty}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="lg:hidden mt-4 pb-4 border-t border-gray-200 pt-4">
              {/* User Profile Mobile */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{currentDoctor?.name}</p>
                  <p className="text-sm text-gray-600">{currentDoctor?.specialty}</p>
                  <p className="text-xs text-gray-500">{currentDoctor?.department}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNavigate(item.view)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        view === item.view
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={view === "home" ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {staffLoading && <p className="mx-4 mt-4 text-sm text-blue-700">Loading saved clinical records…</p>}
        {staffError && <p className="mx-4 mt-4 text-sm text-red-700">{staffError}</p>}
        {view === "home" && (
          <DoctorHomePage onNavigate={handleNavigate} />
        )}

        {view === "schedule" && (
          <DoctorSchedule onNavigate={handleNavigate} sessions={sessions} />
        )}

        {view === "patients" && (
          <PatientProfiles onNavigate={handleNavigate} patients={patients} sessions={sessions} />
        )}

        {view === "notes" && (
          <ClinicalNotes onNavigate={handleNavigate} patients={patients} />
        )}

        {view === "analytics" && (
          <DoctorAnalytics onNavigate={handleNavigate} prescriptions={prescriptions} patients={patients} machines={machines} sessions={sessions} analytics={analytics} />
        )}

        {view === "prescription" && (
          <DoctorPrescription
            onNavigate={handleNavigate}
            prescriptions={prescriptions}
            setPrescriptions={setPrescriptions}
            doctorName={currentDoctor?.name ?? ""}
            addRxNotification={addRxNotification}
          />
        )}

        {view === "viral-status" && (
          <DoctorViralStatus onNavigate={handleNavigate} patients={patients} />
        )}

        {view === "treatment-progress" && (
          <DoctorTreatmentProgress onNavigate={handleNavigate} patients={patients} sessions={sessions} prescriptions={prescriptions} />
        )}
      </main>

      {/* Footer */}
      {view !== "home" && (
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-gray-600 text-sm">
              <p className="mb-2">KMC-RI Hospital Dialysis Department - Healthcare Provider Portal</p>
              <p>For technical support: support@kmcri.com | Emergency: Contact Hospital Operations</p>
              <p className="text-xs text-gray-500 mt-2">
                Secure HIPAA-compliant platform • All access is logged and monitored
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}