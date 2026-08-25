import { Users, UserPlus, Share2, Bell, Shield, Calendar, FileText, Settings } from "lucide-react";

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  email: string;
  phone: string;
  accessLevel: "full" | "limited" | "view-only";
  addedDate: string;
  preferredContact: "email" | "sms" | "portal";
  notificationsEnabled: boolean;
}

interface SharedUpdate {
  type: string;
  message: string;
  date: string;
  sharedWith: string[];
}

export function FamilyCareCoordination() {
  const familyMembers: FamilyMember[] = [
    {
      id: "1",
      name: "Lakshmi Patel",
      relation: "Spouse",
      email: "lakshmi.p@email.com",
      phone: "Contact via portal",
      accessLevel: "full",
      preferredContact: "email",
      notificationsEnabled: true
    },
    {
      id: "2",
      name: "Arjun Patel",
      relation: "Son",
      email: "arjun.p@email.com",
      phone: "Contact via portal",
      accessLevel: "full",
      preferredContact: "sms",
      notificationsEnabled: true
    },
    {
      id: "3",
      name: "Priya Patel",
      relation: "Daughter",
      email: "priya.p@email.com",
      phone: "Contact via portal",
      accessLevel: "limited",
      preferredContact: "email",
      notificationsEnabled: false
    },
  ];

  const sharedDocuments = [
    {
      id: "1",
      title: "Monthly Treatment Summary",
      type: "Medical Report",
      date: "Recently",
      sharedWith: ["Lakshmi Patel", "Arjun Patel"]
    },
    {
      id: "2",
      title: "Medication Schedule Update",
      type: "Care Plan",
      date: "Recently",
      sharedWith: ["Lakshmi Patel"]
    },
    {
      id: "3",
      title: "Upcoming Appointment Details",
      type: "Schedule",
      date: "Recently",
      sharedWith: ["Lakshmi Patel", "Priya Patel"]
    },
  ];

  const accessLevelColors = {
    "full": "bg-green-100 text-green-800",
    "limited": "bg-blue-100 text-blue-800",
    "view-only": "bg-gray-100 text-gray-800"
  };

  const permissions = {
    "full": ["View all medical records", "Receive all updates", "Schedule appointments", "Contact care team"],
    "limited": ["View appointments", "Receive appointment reminders", "View treatment summaries"],
    "view-only": ["View appointment schedule only", "No medical information access"]
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Family Care Coordination</h1>
        <p className="text-blue-100">
          Share your care information and coordinate with family members and caregivers
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Family Members</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{familyMembers.length}</p>
          <p className="text-sm text-gray-600 mt-1">Connected caregivers</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Shared Updates</h3>
            <Share2 className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{sharedDocuments.length}</p>
          <p className="text-sm text-gray-600 mt-1">This week</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">Enabled</p>
          <p className="text-sm text-gray-600 mt-1">Auto-updates active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Family Members List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Connected Family & Caregivers</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            </div>

            <div className="space-y-4">
              {familyMembers.map((member) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.relation}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${accessLevelColors[member.accessLevel]}`}>
                            {member.accessLevel.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Access
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-gray-700">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">Email</p>
                      <p className="text-gray-900">{member.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Phone</p>
                      <p className="text-gray-900">{member.phone}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Permissions:</p>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {permissions[member.accessLevel].map((perm, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm">
                      Edit Access
                    </button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Updates Shared */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-6">
              <Share2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Recent Shared Updates</h2>
            </div>

            <div className="space-y-4">
              {sharedDocuments.map((update, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {update.type}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(update.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-900 mb-3">{update.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users className="w-3 h-3" />
                    <span>Shared with: {update.sharedWith.join(", ")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Settings & Actions */}
        <div className="space-y-4">
          {/* Sharing Settings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Sharing Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Auto-share appointments</p>
                  <p className="text-xs text-gray-600">Notify family of new appointments</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Share lab results</p>
                  <p className="text-xs text-gray-600">Allow viewing of test results</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Treatment summaries</p>
                  <p className="text-xs text-gray-600">Send session completion updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Emergency notifications</p>
                  <p className="text-xs text-gray-600">Instant alerts for urgent matters</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center gap-3">
                <Calendar className="w-5 h-5" />
                <span>Share Upcoming Appointments</span>
              </button>
              <button className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <span>Generate Care Summary</span>
              </button>
              <button className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center gap-3">
                <Bell className="w-5 h-5" />
                <span>Manage Notifications</span>
              </button>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-900 text-sm mb-1">Privacy & Security</h4>
                <p className="text-xs text-yellow-800">
                  All shared information is encrypted and only accessible to authorized family members. 
                  You can revoke access at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}