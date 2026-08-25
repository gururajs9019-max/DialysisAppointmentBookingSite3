import { useState } from "react";
import { CheckCircle, XCircle, Clock, AlertCircle, User, Calendar, Edit } from "lucide-react";

interface SlotApprovalsProps {
  onNavigate: (view: string) => void;
}

interface SlotRequest {
  id: string;
  patientName: string;
  patientId: string;
  requestedDate: string;
  requestedTime: string;
  preferredMachine?: string;
  duration: string;
  priority: 'normal' | 'high' | 'emergency';
  reason: string;
  requestedOn: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  medicalNotes?: string;
}

export function SlotApprovals({ onNavigate }: SlotApprovalsProps) {
  const [requests] = useState<SlotRequest[]>([
    {
      id: '1',
      patientName: 'Ananya Patel',
      patientId: 'P-008',
      requestedDate: 'Tomorrow',
      requestedTime: 'Afternoon slot',
      preferredMachine: 'Machine-A',
      duration: 'Shorter duration',
      priority: 'normal',
      reason: 'Missed previous session due to transportation issue',
      requestedOn: 'Recently',
      status: 'pending'
    },
    {
      id: '2',
      patientName: 'Arjun Desai',
      patientId: 'P-007',
      requestedDate: 'Tomorrow',
      requestedTime: 'Late morning',
      duration: 'Standard duration',
      priority: 'emergency',
      reason: 'Acute fluid overload, requires immediate dialysis',
      medicalNotes: 'Patient presenting with respiratory distress and peripheral edema. Last session was several days ago.',
      requestedOn: 'Recently',
      status: 'pending'
    },
    {
      id: '3',
      patientName: 'Rahul Verma',
      patientId: 'P-009',
      requestedDate: 'Upcoming',
      requestedTime: 'Mid morning',
      preferredMachine: 'Machine-B',
      duration: 'Standard duration',
      priority: 'high',
      reason: 'Schedule change request - travel conflict',
      requestedOn: 'Recently',
      status: 'pending'
    },
    {
      id: '4',
      patientName: 'Deepa Reddy',
      patientId: 'P-004',
      requestedDate: 'Tomorrow',
      requestedTime: 'Afternoon slot',
      duration: 'Standard duration',
      priority: 'normal',
      reason: 'Reschedule from morning to afternoon',
      requestedOn: 'Recently',
      status: 'pending'
    },
    {
      id: '5',
      patientName: 'Vikram Singh',
      patientId: 'P-003',
      requestedDate: 'Upcoming',
      requestedTime: 'Midday',
      duration: 'Standard duration',
      priority: 'normal',
      reason: 'Regular slot request',
      requestedOn: 'Recently',
      status: 'pending'
    },
  ]);

  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'Emergency';
      case 'high': return 'High Priority';
      case 'normal': return 'Normal';
      default: return priority;
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const emergencyRequests = pendingRequests.filter(r => r.priority === 'emergency');
  const highPriorityRequests = pendingRequests.filter(r => r.priority === 'high');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Slot Approvals</h1>
        <p className="text-blue-100">Review and manage appointment requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Pending</span>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{pendingRequests.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Emergency</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{emergencyRequests.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">High Priority</span>
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{highPriorityRequests.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Action Required</span>
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{pendingRequests.length}</p>
        </div>
      </div>

      {/* Emergency Alerts */}
      {emergencyRequests.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">
                {emergencyRequests.length} Emergency Request{emergencyRequests.length > 1 ? 's' : ''} Require Immediate Attention
              </h3>
              <p className="text-sm text-red-800">
                Please review and process emergency slot requests as soon as possible
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {pendingRequests.sort((a, b) => {
          const priorityOrder = { emergency: 0, high: 1, normal: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }).map((request) => (
          <div
            key={request.id}
            className={`bg-white rounded-lg shadow-md overflow-hidden border-l-4 ${
              request.priority === 'emergency' 
                ? 'border-red-500' 
                : request.priority === 'high'
                ? 'border-orange-500'
                : 'border-blue-500'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {getPriorityLabel(request.priority)}
                    </span>
                    <span className="text-sm text-gray-600">Requested {request.requestedOn}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {request.patientName}
                  </h3>
                  <p className="text-sm text-gray-600">Patient ID: {request.patientId}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      <strong>Date:</strong> {request.requestedDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      <strong>Time:</strong> {request.requestedTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="text-sm">
                      <strong>Duration:</strong> {request.duration}
                    </span>
                  </div>
                  {request.preferredMachine && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="text-sm">
                        <strong>Preferred Machine:</strong> {request.preferredMachine}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Reason:</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {request.reason}
                  </p>
                </div>
              </div>

              {request.medicalNotes && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900 mb-1">Medical Notes:</p>
                  <p className="text-sm text-yellow-800">{request.medicalNotes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {/* Approve logic */}}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => {/* Modify logic */}}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Modify & Approve
                </button>
                <button
                  onClick={() => {/* Reject logic */}}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => onNavigate('doctor-patients')}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  <User className="w-4 h-4" />
                  View Patient Profile
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingRequests.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">All caught up!</p>
          <p className="text-gray-500 mt-2">No pending slot requests at this time</p>
        </div>
      )}
    </div>
  );
}