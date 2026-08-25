import { useState } from "react";
import { Search, User, Calendar, Activity, FileText, Heart, AlertTriangle, TrendingUp, Phone, Mail } from "lucide-react";
import type { Patient, DialysisSession } from "../../AdminApp";

interface PatientProfilesProps {
  onNavigate: (view: string) => void;
  patients: Patient[];
  sessions: DialysisSession[];
}

export function PatientProfiles({ onNavigate, patients: apiPatients, sessions }: PatientProfilesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const fallbackPatients = [
    {
      id: '1',
      name: 'Rajesh Kumar',
      age: 'Senior adult',
      phone: 'Contact via portal',
      email: 'patient@portal.com',
      diagnosis: 'Chronic Kidney Disease Stage 5',
      dialysisType: 'Hemodialysis',
      frequency: 'Regular schedule',
      lastSession: 'Recently',
      nextSession: 'Upcoming',
      adherence: 'Excellent',
      complications: 'None',
      vitals: { bp: 'Normal', hr: 'Normal', weight: 'Stable' },
      treatments: 'Regular treatments',
      status: 'active'
    },
    {
      id: '2',
      name: 'Priya Sharma',
      age: 'Senior adult',
      phone: 'Contact via portal',
      email: 'patient@portal.com',
      diagnosis: 'End-Stage Renal Disease',
      dialysisType: 'Hemodialysis',
      frequency: 'Regular schedule',
      lastSession: 'Recently',
      nextSession: 'Upcoming',
      adherence: 'Good',
      complications: 'Monitored',
      vitals: { bp: 'Elevated', hr: 'Normal', weight: 'Increasing' },
      treatments: 'Long-term care',
      status: 'active'
    },
    {
      id: '3',
      name: 'Vikram Singh',
      age: 'Middle-aged adult',
      phone: 'Contact via portal',
      email: 'patient@portal.com',
      diagnosis: 'Diabetic Nephropathy',
      dialysisType: 'Hemodialysis',
      frequency: 'Regular schedule',
      lastSession: 'Recently',
      nextSession: 'Upcoming',
      adherence: 'Fair',
      complications: 'Under observation',
      vitals: { bp: 'Normal', hr: 'Elevated', weight: 'Stable' },
      treatments: 'Ongoing treatments',
      status: 'priority'
    },
    {
      id: '4',
      name: 'Meera Nair',
      age: 'Elderly',
      phone: 'Contact via portal',
      email: 'patient@portal.com',
      diagnosis: 'Hypertensive Nephropathy',
      dialysisType: 'Hemodialysis',
      frequency: 'Regular schedule',
      lastSession: 'Recently',
      nextSession: 'Upcoming',
      adherence: 'Excellent',
      complications: 'None',
      vitals: { bp: 'Normal', hr: 'Normal', weight: 'Stable' },
      treatments: 'Extensive treatment history',
      status: 'active'
    },
  ];

  const patients = apiPatients.map(patient => ({
    id: patient.id, name: patient.name, age: String(patient.age || "—"), phone: patient.mobile || "Not recorded",
    email: "Not recorded", diagnosis: patient.primaryDisease || "Not recorded", dialysisType: "Hemodialysis",
    frequency: patient.dialysisDaysPerWeek ? `${patient.dialysisDaysPerWeek} sessions/week` : "Not recorded",
    lastSession: patient.lastDialysis || "Not recorded", nextSession: patient.currentSchedule || "Not scheduled",
    adherence: "See treatment progress", complications: patient.remarks || "None", vitals: { bp: "Not recorded", hr: "Not recorded", weight: "Not recorded" },
    treatments: sessions.filter(session => session.patientId === patient.id).length, status: patient.treatmentStatus === "Active" ? "active" : "priority",
  }));
  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPatientData = selectedPatient 
    ? patients.find(p => p.id === selectedPatient)
    : null;

  const recentSessions = [
    { date: 'Recently', duration: '4 hours', machine: 'M-03', complications: 'None', notes: 'Session completed without issues' },
    { date: 'Recently', duration: '4 hours', machine: 'M-05', complications: 'Minor', notes: 'Slight discomfort reported, monitored' },
    { date: 'Recently', duration: '3.5 hours', machine: 'M-03', complications: 'None', notes: 'Early termination per patient request' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Patient Profiles</h1>
        <p className="text-blue-100">Access comprehensive patient medical records</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name or diagnosis..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Patients</option>
              <option>Active</option>
              <option>Priority</option>
              <option>Completed</option>
            </select>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Types</option>
              <option>Hemodialysis</option>
              <option>Peritoneal</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Patients ({filteredPatients.length})
          </h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedPatient === patient.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                      {patient.status === 'priority' && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{patient.diagnosis}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{patient.age} years</span>
                      <span>{patient.treatments} sessions</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPatientData ? (
            <>
              {/* Patient Overview */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedPatientData.name}</h2>
                      <p className="text-gray-600">{selectedPatientData.diagnosis}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {selectedPatientData.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {selectedPatientData.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('doctor-notes')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Add Notes
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Adherence</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedPatientData.adherence}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Treatments</p>
                    <p className="text-2xl font-bold text-green-600">{selectedPatientData.treatments}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Frequency</p>
                    <p className="text-2xl font-bold text-purple-600">{selectedPatientData.frequency}</p>
                  </div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-600" />
                  Latest Vital Signs
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border-2 border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Blood Pressure</p>
                    <p className="text-xl font-bold text-gray-900">{selectedPatientData.vitals.bp}</p>
                  </div>
                  <div className="p-4 border-2 border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Heart Rate</p>
                    <p className="text-xl font-bold text-gray-900">{selectedPatientData.vitals.hr}</p>
                  </div>
                  <div className="p-4 border-2 border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Weight Trend</p>
                    <p className="text-xl font-bold text-gray-900">{selectedPatientData.vitals.weight}</p>
                  </div>
                </div>
              </div>

              {/* Treatment History */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Recent Dialysis Sessions
                </h3>
                <div className="space-y-3">
                  {recentSessions.map((session, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{session.date}</p>
                          <p className="text-sm text-gray-600">Duration: {session.duration} | Machine: {session.machine}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          session.complications === 'None'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {session.complications === 'None' ? 'No Complications' : 'Minor Issues'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{session.notes}</p>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium">
                  View Full History
                </button>
              </div>

              {/* Complications Alert */}
              {selectedPatientData.complications !== 'None' && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-2">Complications Status</h3>
                      <p className="text-sm text-yellow-800 mb-4">
                        {selectedPatientData.complications}
                      </p>
                      <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium text-sm">
                        View Details & Action Plan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a patient to view their profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}