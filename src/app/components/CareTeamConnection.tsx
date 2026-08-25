import { User, Mail, Phone, MessageSquare, Video, Calendar, Stethoscope, UserPlus } from "lucide-react";

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  email: string;
  phone: string;
  availability: string;
  photo?: string;
  lastContact?: string;
}

export function CareTeamConnection() {
  const careTeam: CareTeamMember[] = [
    {
      id: "1",
      name: "Dr. Arun Mehta",
      role: "Nephrologist",
      specialty: "Kidney Disease & Dialysis",
      email: "dr.mehta@kmcri.com",
      phone: "Contact via portal",
      availability: "Mon-Fri",
      lastContact: "Recently"
    },
    {
      id: "2",
      name: "Priya Sharma, RN",
      role: "Dialysis Nurse",
      specialty: "Hemodialysis Specialist",
      email: "p.sharma@kmcri.com",
      phone: "Contact via portal",
      availability: "Mon-Sat",
      lastContact: "Recently"
    },
    {
      id: "3",
      name: "Rahul Verma",
      role: "Care Coordinator",
      specialty: "Patient Services",
      email: "r.verma@kmcri.com",
      phone: "Contact via portal",
      availability: "Mon-Fri",
      lastContact: "Recently"
    },
    {
      id: "4",
      name: "Dr. Kavita Reddy",
      role: "Vascular Surgeon",
      specialty: "Access Management",
      email: "dr.reddy@kmcri.com",
      phone: "Contact via portal",
      availability: "Tue-Thu"
    },
    {
      id: "5",
      name: "Meera Nair, RD",
      role: "Renal Dietitian",
      specialty: "Nutritional Counseling",
      email: "m.nair@kmcri.com",
      phone: "Contact via portal",
      availability: "Mon-Fri",
      lastContact: "Recently"
    },
    {
      id: "6",
      name: "Vikram Singh, LCSW",
      role: "Social Worker",
      specialty: "Patient Support Services",
      email: "v.singh@kmcri.com",
      phone: "Contact via portal",
      availability: "Mon-Fri"
    },
  ];

  const recentMessages = [
    {
      from: "Dr. Arun Mehta",
      message: "Your recent lab results look good. Let's discuss at your next appointment.",
      time: "Recently",
      unread: true
    },
    {
      from: "Priya Sharma, RN",
      message: "Reminder: Please bring your medications list to tomorrow's session.",
      time: "Recently",
      unread: false
    },
    {
      from: "Rahul Verma",
      message: "Your transportation for next week's appointments has been confirmed.",
      time: "Recently",
      unread: false
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Care Team Connection</h1>
        <p className="text-blue-100">
          Connect with your KMC-RI Hospital healthcare providers and support team
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center">
          <MessageSquare className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Send Message</h3>
          <p className="text-sm text-gray-600">Contact your care team</p>
        </button>

        <button className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center">
          <Video className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Video Call</h3>
          <p className="text-sm text-gray-600">Schedule telehealth</p>
        </button>

        <button className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center">
          <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Book Consult</h3>
          <p className="text-sm text-gray-600">Schedule appointment</p>
        </button>

        <button className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center">
          <UserPlus className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Add Member</h3>
          <p className="text-sm text-gray-600">Invite care provider</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Care Team Members */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Care Team</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {careTeam.map((member) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.role}</p>
                      {member.specialty && (
                        <p className="text-xs text-gray-500 mt-1">{member.specialty}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span>{member.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Stethoscope className="w-4 h-4 text-blue-600" />
                      <span className="text-xs">{member.availability}</span>
                    </div>
                  </div>

                  {member.lastContact && (
                    <p className="text-xs text-gray-500 mb-3">
                      Last contact: {member.lastContact}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      Message
                    </button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Messages</h2>
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>

            <div className="space-y-4">
              {recentMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border ${
                    msg.unread ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{msg.from}</p>
                    {msg.unread && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{msg.message}</p>
                  <p className="text-xs text-gray-500">{msg.time}</p>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
              View All Messages
            </button>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upcoming with Team</h2>
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">Dr. Arun Mehta</p>
                <p className="text-xs text-gray-600 mt-1">Consultation - Upcoming</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">Meera Nair, RD</p>
                <p className="text-xs text-gray-600 mt-1">Nutrition Review - Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}