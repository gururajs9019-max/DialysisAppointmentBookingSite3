import { useState } from "react";
import { Stethoscope, Heart, ArrowRight, Shield, Sparkles } from "lucide-react";

interface PortalSelectorProps {
  onSelectPortal: (portal: "patient" | "doctor" | "admin") => void;
}

export function PortalSelector({ onSelectPortal }: PortalSelectorProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="glass-effect border-b border-white/20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center gap-4">
            <div className="bg-white/20 backdrop-blur-lg p-4 rounded-2xl shadow-2xl border border-white/30">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">KMC-RI Hospital</h1>
              <p className="text-blue-100 flex items-center gap-2 justify-center">
                <Sparkles className="w-4 h-4" />
                Dialysis Department
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
            Welcome to KMC-RI
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
            Select your portal to access the dialysis management system
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-8">
          {/* Patient Portal */}
          <button
            onClick={() => onSelectPortal("patient")}
            className="card-hover group bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 text-left relative overflow-hidden border-2 border-transparent hover:border-green-200"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-xl group-hover:scale-110 transition-transform">
                  <Heart className="w-12 h-12 text-white" />
                </div>
                <ArrowRight className="w-8 h-8 text-gray-400 group-hover:text-green-600 group-hover:translate-x-2 transition-all" />
              </div>

              <h3 className="text-3xl font-bold text-gray-900 mb-4">Patient Portal</h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                View appointments, track your health timeline, and connect with your care team.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                  <span>View appointments</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                  <span>Track health records and vitals</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                  <span>Connect with care team</span>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-700 uppercase tracking-wide">For Patients</span>
                  <span className="px-5 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg group-hover:shadow-xl transition-shadow">
                    Enter Portal →
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Doctor Portal */}
          <button
            onClick={() => onSelectPortal("doctor")}
            className="card-hover group bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 text-left relative overflow-hidden border-2 border-transparent hover:border-blue-200"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl shadow-xl group-hover:scale-110 transition-transform">
                  <Stethoscope className="w-12 h-12 text-white" />
                </div>
                <ArrowRight className="w-8 h-8 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-2 transition-all" />
              </div>

              <h3 className="text-3xl font-bold text-gray-900 mb-4">Doctor Portal</h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Comprehensive dialysis department management for healthcare providers.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                  <span>Patient profiles & medical records</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                  <span>Schedule & session management</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                  <span>Machine allocation & monitoring</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                  <span>Analytics & reporting</span>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">For Healthcare Providers</span>
                  <span className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg group-hover:shadow-xl transition-shadow">
                    Enter Portal →
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Admin Portal - Full Width Below */}
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => onSelectPortal("admin")}
            className="card-hover group w-full bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 text-left relative overflow-hidden border-2 border-transparent hover:border-purple-200"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex items-center gap-6 flex-1">
                  <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-5 rounded-2xl shadow-xl group-hover:scale-110 transition-transform">
                    <Shield className="w-12 h-12 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-gray-900 mb-3">Administrator Portal</h3>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      Manage patient bookings and appointments for the dialysis department.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-8 h-8 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-2 transition-all hidden md:block" />
              </div>

              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50"></div>
                  <span className="text-sm">Book appointments</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50"></div>
                  <span className="text-sm">Manage schedules</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50"></div>
                  <span className="text-sm">Patient directory</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50"></div>
                  <span className="text-sm">Track appointments</span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">For Hospital Administrators</span>
                  <span className="px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold shadow-lg group-hover:shadow-xl transition-shadow">
                    Enter Portal →
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-20 text-center">
          <div className="glass-effect rounded-2xl p-8 max-w-3xl mx-auto border border-white/30 shadow-2xl">
            <h4 className="text-2xl font-bold text-white mb-4">Need Help?</h4>
            <p className="text-blue-100 mb-6 text-lg leading-relaxed">
              For technical support or assistance accessing your portal, please contact our support team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-blue-100">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                Email: support@kmcri.com
              </span>
              <span className="hidden sm:inline text-blue-300">•</span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                Emergency: Contact Hospital Operations
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="glass-effect border-t border-white/20 mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-blue-100">
            <p className="mb-2 font-medium">© 2026 KMC-RI Hospital. All rights reserved.</p>
            <p className="text-sm text-blue-200 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              Secure, HIPAA-compliant healthcare platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}