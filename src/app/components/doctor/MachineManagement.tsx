import { useState } from "react";
import { Settings, CheckCircle, AlertCircle, XCircle, Wrench, Clock, Activity } from "lucide-react";

interface MachineManagementProps {
  onNavigate: (view: string) => void;
}

type MachineStatus = "available" | "in-use" | "maintenance" | "blocked";

interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
  currentPatient?: string;
  sessionEnd?: string;
  nextMaintenance: string;
  totalSessions: string;
  lastService: string;
  location: string;
}

export function MachineManagement({ onNavigate }: MachineManagementProps) {
  const [machines] = useState<Machine[]>([
    {
      id: 'M-01',
      name: 'Machine 01',
      status: 'in-use',
      currentPatient: 'Sanjay Gupta',
      sessionEnd: 'Afternoon',
      nextMaintenance: 'Upcoming',
      totalSessions: 'Extensive use',
      lastService: 'Recently',
      location: 'Bay A'
    },
    {
      id: 'M-02',
      name: 'Machine 02',
      status: 'available',
      nextMaintenance: 'Soon',
      totalSessions: 'Heavy use',
      lastService: 'Recently',
      location: 'Bay A'
    },
    {
      id: 'M-03',
      name: 'Machine 03',
      status: 'available',
      nextMaintenance: 'Later this week',
      totalSessions: 'Moderate use',
      lastService: 'Recently',
      location: 'Bay A'
    },
    {
      id: 'M-04',
      name: 'Machine 04',
      status: 'maintenance',
      nextMaintenance: 'In Progress',
      totalSessions: 'Very high use',
      lastService: 'Today',
      location: 'Bay B'
    },
    {
      id: 'M-05',
      name: 'Machine 05',
      status: 'in-use',
      currentPatient: 'Priya Sharma',
      sessionEnd: 'Midday',
      nextMaintenance: 'This week',
      totalSessions: 'Regular use',
      lastService: 'Recently',
      location: 'Bay B'
    },
    {
      id: 'M-06',
      name: 'Machine 06',
      status: 'available',
      nextMaintenance: 'This week',
      totalSessions: 'Heavy use',
      lastService: 'Recently',
      location: 'Bay B'
    },
    {
      id: 'M-07',
      name: 'Machine 07',
      status: 'in-use',
      currentPatient: 'Deepa Reddy',
      sessionEnd: 'Midday',
      nextMaintenance: 'Soon',
      totalSessions: 'Moderate use',
      lastService: 'Recently',
      location: 'Bay C'
    },
    {
      id: 'M-08',
      name: 'Machine 08',
      status: 'blocked',
      nextMaintenance: 'Later',
      totalSessions: 'Regular use',
      lastService: 'Recently',
      location: 'Bay C'
    },
    {
      id: 'M-09',
      name: 'Machine 09',
      status: 'available',
      nextMaintenance: 'Upcoming',
      totalSessions: 'Extensive use',
      lastService: 'Recently',
      location: 'Bay C'
    },
    {
      id: 'M-10',
      name: 'Machine 10',
      status: 'in-use',
      currentPatient: 'Rajesh Kumar',
      sessionEnd: 'Late afternoon',
      nextMaintenance: 'Later this week',
      totalSessions: 'Heavy use',
      lastService: 'Recently',
      location: 'Bay D'
    },
    {
      id: 'M-11',
      name: 'Machine 11',
      status: 'available',
      nextMaintenance: 'This week',
      totalSessions: 'Moderate use',
      lastService: 'Recently',
      location: 'Bay D'
    },
    {
      id: 'M-12',
      name: 'Machine 12',
      status: 'available',
      nextMaintenance: 'Later',
      totalSessions: 'Regular use',
      lastService: 'Recently',
      location: 'Bay D'
    },
  ]);

  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case 'available': return 'border-green-300 bg-green-50';
      case 'in-use': return 'border-blue-300 bg-blue-50';
      case 'maintenance': return 'border-yellow-300 bg-yellow-50';
      case 'blocked': return 'border-red-300 bg-red-50';
    }
  };

  const getStatusIcon = (status: MachineStatus) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in-use': return <Activity className="w-5 h-5 text-blue-600" />;
      case 'maintenance': return <Wrench className="w-5 h-5 text-yellow-600" />;
      case 'blocked': return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusText = (status: MachineStatus) => {
    switch (status) {
      case 'available': return 'Available';
      case 'in-use': return 'In Use';
      case 'maintenance': return 'Maintenance';
      case 'blocked': return 'Blocked';
    }
  };

  const statusCounts = {
    available: machines.filter(m => m.status === 'available').length,
    inUse: machines.filter(m => m.status === 'in-use').length,
    maintenance: machines.filter(m => m.status === 'maintenance').length,
    blocked: machines.filter(m => m.status === 'blocked').length,
  };

  const selectedMachineData = selectedMachine 
    ? machines.find(m => m.id === selectedMachine)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Machine Management</h1>
        <p className="text-blue-100">Real-time dialysis machine availability and allocation</p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Available</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{statusCounts.available}</p>
          <p className="text-sm text-gray-500 mt-1">Ready for use</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">In Use</span>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{statusCounts.inUse}</p>
          <p className="text-sm text-gray-500 mt-1">Active sessions</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Maintenance</span>
            <Wrench className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{statusCounts.maintenance}</p>
          <p className="text-sm text-gray-500 mt-1">Under service</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Blocked</span>
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{statusCounts.blocked}</p>
          <p className="text-sm text-gray-500 mt-1">Reserved/blocked</p>
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {machines.map((machine) => (
          <div
            key={machine.id}
            onClick={() => setSelectedMachine(machine.id)}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
              getStatusColor(machine.status)
            } ${selectedMachine === machine.id ? 'ring-4 ring-blue-500' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(machine.status)}
                <h3 className="font-semibold text-gray-900">{machine.name}</h3>
              </div>
              <Settings className="w-4 h-4 text-gray-400" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium text-gray-900">{getStatusText(machine.status)}</span>
              </div>

              {machine.currentPatient && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Patient:</span>
                    <span className="font-medium text-gray-900 truncate ml-2">{machine.currentPatient}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Ends:</span>
                    <span className="font-medium text-gray-900">{machine.sessionEnd}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Location:</span>
                <span className="font-medium text-gray-900">{machine.location}</span>
              </div>

              <div className="pt-2 border-t border-gray-300">
                <p className="text-xs text-gray-600">Next maintenance: {machine.nextMaintenance}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Machine Details Modal */}
      {selectedMachineData && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedMachineData.name}</h2>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedMachineData.status)}
                <span className="font-medium text-gray-700">{getStatusText(selectedMachineData.status)}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedMachine(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Machine Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Machine ID:</span>
                  <span className="font-medium text-gray-900">{selectedMachineData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">{selectedMachineData.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sessions:</span>
                  <span className="font-medium text-gray-900">{selectedMachineData.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Service:</span>
                  <span className="font-medium text-gray-900">{selectedMachineData.lastService}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next Maintenance:</span>
                  <span className="font-medium text-gray-900">{selectedMachineData.nextMaintenance}</span>
                </div>
              </div>
            </div>

            {selectedMachineData.currentPatient && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Current Session</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Patient:</span>
                    <span className="font-medium text-gray-900">{selectedMachineData.currentPatient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Session Ends:</span>
                    <span className="font-medium text-gray-900">{selectedMachineData.sessionEnd}</span>
                  </div>
                  <button className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    Monitor Session
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedMachineData.status === 'available' && (
              <>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  Assign Patient
                </button>
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                  Block for Emergency
                </button>
                <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">
                  Schedule Maintenance
                </button>
              </>
            )}
            {selectedMachineData.status === 'blocked' && (
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                Unblock Machine
              </button>
            )}
            {selectedMachineData.status === 'in-use' && (
              <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">
                Reassign Machine
              </button>
            )}
            {selectedMachineData.status === 'maintenance' && (
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                Mark as Operational
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Wrench className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-2">Schedule Maintenance</h3>
              <p className="text-sm text-yellow-800 mb-4">
                Block a machine for scheduled maintenance or emergency repairs
              </p>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">
                Schedule Now
              </button>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">Emergency Allocation</h3>
              <p className="text-sm text-red-800 mb-4">
                Override current allocation for emergency patient requirements
              </p>
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                Emergency Override
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}