import { Calendar, Activity, Clock, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Appointment } from "./AppointmentCard";

interface SmartBookingDashboardProps {
  appointments: Appointment[];
  onBookAppointment: () => void;
  onViewAllAppointments: () => void;
}

export function SmartBookingDashboard({ 
  appointments, 
  onBookAppointment, 
  onViewAllAppointments 
}: SmartBookingDashboardProps) {
  const upcomingAppointments = appointments.filter(apt => apt.status === "upcoming");
  const nextAppointment = upcomingAppointments[0];
  
  // Calculate stats
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(apt => apt.status === "completed").length;
  const upcomingCount = upcomingAppointments.length;
  const completionRate = totalAppointments > 0 
    ? Math.round((completedAppointments / totalAppointments) * 100) 
    : 0;

  const stats = [
    { 
      label: "Total Appointments", 
      value: totalAppointments, 
      icon: Calendar, 
      color: "bg-blue-100 text-blue-600" 
    },
    { 
      label: "Upcoming", 
      value: upcomingCount, 
      icon: Clock, 
      color: "bg-green-100 text-green-600" 
    },
    { 
      label: "Completed", 
      value: completedAppointments, 
      icon: CheckCircle2, 
      color: "bg-purple-100 text-purple-600" 
    },
    { 
      label: "Completion Rate", 
      value: `${completionRate}%`, 
      icon: TrendingUp, 
      color: "bg-orange-100 text-orange-600" 
    },
  ];

  const recentActivity = [
    { 
      action: "Appointment Reminder", 
      description: "Your next dialysis session is coming up soon", 
      time: "Recently",
      type: "reminder"
    },
    { 
      action: "Lab Results Available", 
      description: "New blood work results are ready to view", 
      time: "Recently",
      type: "info"
    },
    { 
      action: "Care Team Message", 
      description: "Dr. Smith sent you a message about treatment plan", 
      time: "Recently",
      type: "message"
    },
  ];

  const quickActions = [
    { label: "Book Appointment", action: onBookAppointment, color: "bg-blue-600 hover:bg-blue-700" },
    { label: "View All Appointments", action: onViewAllAppointments, color: "bg-gray-600 hover:bg-gray-700" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Smart Booking Dashboard</h1>
        <p className="text-blue-100">
          Welcome back to KMC-RI Hospital Dialysis Slot Manager! Here's an overview of your dialysis care schedule.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Appointment Card */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Next Appointment</h2>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>

          {nextAppointment ? (
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Treatment Type</p>
                  <p className="text-lg font-semibold text-gray-900">{nextAppointment.dialysisType}</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Confirmed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(nextAppointment.appointmentDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Time</p>
                  <p className="font-medium text-gray-900">{nextAppointment.appointmentTime}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="font-medium text-gray-900">{nextAppointment.location}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>Remember to arrive 15 minutes early</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No upcoming appointments scheduled</p>
              <button
                onClick={onBookAppointment}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Book Your Next Appointment
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className={`w-full px-4 py-3 text-white rounded-lg transition-colors ${action.color}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <Activity className="w-5 h-5 text-blue-600" />
        </div>

        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div key={index} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{activity.action}</p>
                <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming This Week */}
      {upcomingCount > 1 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Upcoming This Week ({upcomingCount - 1} more)
          </h2>
          <div className="space-y-3">
            {upcomingAppointments.slice(1, 4).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {new Date(apt.appointmentDate).getDate()}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(apt.appointmentDate).toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{apt.dialysisType}</p>
                    <p className="text-sm text-gray-600">{apt.appointmentTime} • {apt.location}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}