import { Activity, Calendar, TrendingUp, FileText, Droplet, Heart } from "lucide-react";

interface HealthRecord {
  date: string;
  type: string;
  description: string;
  status: "completed" | "scheduled" | "pending";
}

interface VitalReading {
  name: string;
  value: string;
  unit: string;
  status: "normal" | "attention" | "critical";
  icon: typeof Droplet;
}

export function PersonalHealthTimeline() {
  const healthRecords: HealthRecord[] = [
    {
      date: "2024-12-20",
      type: "Hemodialysis Treatment",
      description: "Session completed successfully. Fluid removal within target range",
      status: "completed"
    },
    {
      date: "2024-12-18",
      type: "Lab Results",
      description: "Blood work analysis - Results reviewed with care team",
      status: "completed"
    },
    {
      date: "2024-12-15",
      type: "Hemodialysis Treatment",
      description: "Session completed. Minor adjustment to dialysate flow",
      status: "completed"
    },
    {
      date: "2024-12-28",
      type: "Hemodialysis Treatment",
      description: "Scheduled session at KMC-RI Dialysis Center",
      status: "scheduled"
    },
    {
      date: "2024-12-13",
      type: "Consultation",
      description: "Nephrology consultation with Dr. Smith - Treatment plan reviewed",
      status: "completed"
    },
    {
      date: "2025-01-05",
      type: "Lab Work",
      description: "Comprehensive metabolic panel scheduled",
      status: "scheduled"
    },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const vitalReadings: VitalReading[] = [
    { name: "Blood Pressure", value: "Normal", unit: "", status: "attention", icon: Heart },
    { name: "Creatinine", value: "Monitored", unit: "", status: "attention", icon: Droplet },
    { name: "Potassium", value: "Normal", unit: "", status: "normal", icon: Activity },
    { name: "Hemoglobin", value: "Normal", unit: "", status: "normal", icon: Droplet },
  ];

  const statusColors = {
    completed: "bg-green-100 text-green-800",
    scheduled: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800"
  };

  const vitalStatusColors = {
    normal: "bg-green-100 text-green-800",
    attention: "bg-yellow-100 text-yellow-800",
    critical: "bg-red-100 text-red-800"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Personal Health Timeline</h1>
        <p className="text-blue-100">
          Track your treatment history and monitor your health progress
        </p>
      </div>

      {/* Current Vitals */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Latest Vital Readings</h2>
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {vitalReadings.map((vital) => {
            const Icon = vital.icon;
            return (
              <div key={vital.name} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${vitalStatusColors[vital.status]}`}>
                    {vital.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">{vital.name}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vital.value} <span className="text-sm font-normal text-gray-600">{vital.unit}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">Note:</span> Your blood pressure is slightly elevated. 
            Discuss with your care team at your next appointment.
          </p>
        </div>
      </div>

      {/* Treatment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Total Treatments</h3>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">Multiple</p>
          <p className="text-sm text-gray-600 mt-1">This year</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Treatment Adherence</h3>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">Excellent</p>
          <p className="text-sm text-gray-600 mt-1">Great compliance</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Avg. Session Duration</h3>
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">Target</p>
          <p className="text-sm text-gray-600 mt-1">Within target range</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Medical History Timeline</h2>
          <Activity className="w-5 h-5 text-blue-600" />
        </div>

        <div className="space-y-6">
          {healthRecords.map((record, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${
                  record.status === 'completed' ? 'bg-green-500' : 
                  record.status === 'scheduled' ? 'bg-blue-500' : 'bg-yellow-500'
                }`}></div>
                {index < healthRecords.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                )}
              </div>

              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{record.type}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(record.date).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[record.status]}`}>
                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                  </span>
                </div>
                <p className="text-gray-700">{record.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download Records */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Medical Records</h3>
            <p className="text-sm text-gray-600">Download your complete health records and treatment history</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Download Records
          </button>
        </div>
      </div>
    </div>
  );
}