import { CheckCircle, Calendar, Clock, MapPin, FileText, Mail, Phone } from "lucide-react";
import { Appointment } from "./AppointmentCard";

interface ConfirmationScreenProps {
  appointment: Appointment;
  onDone: () => void;
}

export function ConfirmationScreen({ appointment, onDone }: ConfirmationScreenProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Appointment Confirmed!
          </h2>
          <p className="text-gray-600">
            Your dialysis appointment has been successfully scheduled.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Appointment Details</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-medium text-gray-900">{appointment.appointmentTime}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-medium text-gray-900">{appointment.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Treatment Type</p>
                <p className="font-medium text-gray-900">{appointment.dialysisType}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Patient Information</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium text-gray-900">
                {appointment.firstName} {appointment.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Medical ID:</span>
              <span className="font-medium text-gray-900">{appointment.medicalId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date of Birth:</span>
              <span className="font-medium text-gray-900">
                {new Date(appointment.dateOfBirth).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">What's Next?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>A confirmation email has been sent to <span className="font-medium">{appointment.email}</span></span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>You will receive a reminder call 24 hours before your appointment</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>Please arrive 15 minutes early to complete any necessary paperwork</span>
            </li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">Important:</span> If you need to cancel or reschedule, 
            please call us at least 24 hours in advance at (555) 123-4567.
          </p>
        </div>

        <button
          onClick={onDone}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
