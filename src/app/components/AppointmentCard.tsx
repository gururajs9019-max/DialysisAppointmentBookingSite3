import { Calendar, Clock, MapPin, FileText, User, Phone } from "lucide-react";
import { BookingFormData } from "./BookingForm";

export interface Appointment extends BookingFormData {
  id: string;
  status: "upcoming" | "completed" | "cancelled";
  createdAt: Date;
  location: string; // Add location to Appointment interface
  patientName?: string; // Optional patient name for admin view
  patientMRN?: string; // Optional MRN for admin view
}

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  showPatientInfo?: boolean; // Flag to show patient info in admin view
}

export function AppointmentCard({ appointment, onCancel, showPatientInfo = false }: AppointmentCardProps) {
  const statusColors = {
    upcoming: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800"
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          {showPatientInfo && appointment.patientName ? (
            <>
              <h3 className="text-xl font-semibold text-gray-900">
                {appointment.patientName}
              </h3>
              <p className="text-gray-600 text-sm mt-1">{appointment.patientMRN}</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-gray-900">
                {appointment.firstName} {appointment.lastName}
              </h3>
              <p className="text-gray-600 text-sm mt-1">ID: {appointment.medicalId}</p>
            </>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[appointment.status]}`}>
          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 text-gray-700">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>{new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>{appointment.appointmentTime}</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>{appointment.location}</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>{appointment.dialysisType}</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>{appointment.phone}</span>
        </div>

        {appointment.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Notes:</span> {appointment.notes}
            </p>
          </div>
        )}
      </div>

      {appointment.status === "upcoming" && onCancel && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => onCancel(appointment.id)}
            className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            Cancel Appointment
          </button>
        </div>
      )}
    </div>
  );
}