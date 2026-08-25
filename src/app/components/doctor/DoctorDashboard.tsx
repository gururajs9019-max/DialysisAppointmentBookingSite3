import { Calendar, Users, Activity, AlertCircle, Clock, Settings, TrendingUp, FileText } from "lucide-react";

interface DoctorDashboardProps {
  onNavigate: (view: string) => void;
}

export function DoctorDashboard({ onNavigate }: DoctorDashboardProps) {
  const todayStats = {
    totalSessions: "Many sessions",
    completedSessions: "Multiple completed",
    upcomingSessions: "Several upcoming",
    emergencySlots: "Emergency slots",
    availableMachines: "Available",
    totalMachines: "Total machines",
    pendingApprovals: "Items pending",
    criticalAlerts: "Alerts"
  };

  const upcomingPatients = [
    { id: '1', name: 'Rajesh Kumar', time: 'Morning slot', machine: 'Machine-A', status: 'scheduled', priority: 'normal' },
    { id: '2', name: 'Priya Sharma', time: 'Mid-morning', machine: 'Machine-B', status: 'scheduled', priority: 'normal' },
    { id: '3', name: 'Vikram Singh', time: 'Late morning', machine: 'Machine-C', status: 'pending', priority: 'high' },
    { id: '4', name: 'Kavya Iyer', time: 'Afternoon slot', machine: 'Machine-D', status: 'scheduled', priority: 'emergency' },
  ];

  const recentAlerts = [
    { id: '1', type: 'emergency', message: 'Emergency booking request - Kavya Iyer', time: 'Recently', severity: 'high' },
    { id: '2', type: 'missed', message: 'Sanjay Gupta missed scheduled session', time: 'Recently', severity: 'medium' },
    { id: '3', type: 'machine', message: 'Machine requires maintenance', time: 'Recently', severity: 'low' },
  ];

  const quickActions = [
    { icon: Calendar, label: 'View Schedule', view: 'schedule', color: 'bg-blue-500' },
    { icon: Users, label: 'Patient Profiles', view: 'patients', color: 'bg-green-500' },
    { icon: Activity, label: 'Machines', view: 'machines', color: 'bg-purple-500' },
    { icon: FileText, label: 'Clinical Notes', view: 'notes', color: 'bg-orange-500' },
    { icon: AlertCircle, label: 'Approvals', view: 'approvals', color: 'bg-red-500' },
    { icon: TrendingUp, label: 'Analytics', view: 'analytics', color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 md:p-8 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Doctor Dashboard</h1>
        <p className="text-blue-100">KMC-RI Dialysis Department - Command Center</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Sessions</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{todayStats.totalSessions}</p>
          <p className="text-sm text-gray-500 mt-1">Today's schedule</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Completed</span>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{todayStats.completedSessions}</p>
          <p className="text-sm text-gray-500 mt-1">{todayStats.upcomingSessions} upcoming</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Available Machines</span>
            <Settings className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{todayStats.availableMachines}/{todayStats.totalMachines}</p>
          <p className="text-sm text-gray-500 mt-1">Operational status</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Pending Items</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{todayStats.pendingApprovals}</p>
          <p className="text-sm text-gray-500 mt-1">{todayStats.criticalAlerts} critical alerts</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.view}
                onClick={() => onNavigate(action.view)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <div className={`${action.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 text-center">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Next Sessions</h2>
            <button
              onClick={() => onNavigate('schedule')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {upcomingPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onNavigate('patients')}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    {patient.priority === 'emergency' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                        Emergency
                      </span>
                    )}
                    {patient.priority === 'high' && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                        Priority
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {patient.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Settings className="w-4 h-4" />
                      {patient.machine}
                    </span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  patient.status === 'scheduled' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {patient.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Alerts</h2>
            <button
              onClick={() => onNavigate('approvals')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'high' 
                    ? 'bg-red-50 border-red-500' 
                    : alert.severity === 'medium'
                    ? 'bg-orange-50 border-orange-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    alert.severity === 'high' 
                      ? 'text-red-600' 
                      : alert.severity === 'medium'
                      ? 'text-orange-600'
                      : 'text-yellow-600'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{alert.message}</p>
                    <p className="text-xs text-gray-600 mt-1">{alert.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}