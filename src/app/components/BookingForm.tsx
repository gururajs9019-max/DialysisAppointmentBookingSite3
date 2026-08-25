import { useForm } from "react-hook-form";
import { Calendar, Clock, User, Phone, Mail, FileText } from "lucide-react";

export interface BookingFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  medicalId: string;
  appointmentDate: string;
  appointmentTime: string;
  dialysisType: string;
  notes: string;
}

interface BookingFormProps {
  onSubmit: (data: BookingFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export function BookingForm({ onSubmit, onCancel, isSubmitting = false, submitError }: BookingFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<BookingFormData>();

  const dialysisTypes = [
    "Hemodialysis",
    "Peritoneal Dialysis",
    "Home Hemodialysis",
    "Consultation"
  ];

  const timeSlots = [
    "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM",
    "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
    "04:00 PM", "05:00 PM"
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-8">
      {/* Patient Information Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Patient Information</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="firstName" className="block mb-2 text-gray-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              {...register("firstName", { required: "First name is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Rajesh"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="block mb-2 text-gray-700">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              {...register("lastName", { required: "Last name is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="dateOfBirth" className="block mb-2 text-gray-700">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              id="dateOfBirth"
              type="date"
              {...register("dateOfBirth", { required: "Date of birth is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.dateOfBirth && (
              <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="medicalId" className="block mb-2 text-gray-700">
              Medical ID / Patient Number <span className="text-red-500">*</span>
            </label>
            <input
              id="medicalId"
              type="text"
              {...register("medicalId", { required: "Medical ID is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="MID-123456"
            />
            {errors.medicalId && (
              <p className="mt-1 text-sm text-red-600">{errors.medicalId.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <Phone className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="phone" className="block mb-2 text-gray-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              {...register("phone", { 
                required: "Phone number is required",
                pattern: {
                  value: /^[0-9\-\+\(\)\s]+$/,
                  message: "Please enter a valid phone number"
                }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(555) 123-4567"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block mb-2 text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              {...register("email", { 
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Please enter a valid email address"
                }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="patient@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointment Details Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Appointment Details</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="appointmentDate" className="block mb-2 text-gray-700">
              Preferred Date <span className="text-red-500">*</span>
            </label>
            <input
              id="appointmentDate"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              {...register("appointmentDate", { required: "Appointment date is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.appointmentDate && (
              <p className="mt-1 text-sm text-red-600">{errors.appointmentDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="appointmentTime" className="block mb-2 text-gray-700">
              Preferred Time <span className="text-red-500">*</span>
            </label>
            <select
              id="appointmentTime"
              {...register("appointmentTime", { required: "Appointment time is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a time</option>
              {timeSlots.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            {errors.appointmentTime && (
              <p className="mt-1 text-sm text-red-600">{errors.appointmentTime.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="dialysisType" className="block mb-2 text-gray-700">
              Dialysis Type <span className="text-red-500">*</span>
            </label>
            <select
              id="dialysisType"
              {...register("dialysisType", { required: "Dialysis type is required" })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select dialysis type</option>
              {dialysisTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.dialysisType && (
              <p className="mt-1 text-sm text-red-600">{errors.dialysisType.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="block mb-2 text-gray-700">
              Additional Notes
            </label>
            <textarea
              id="notes"
              {...register("notes")}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Please include any specific requirements, concerns, or questions..."
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      {submitError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Booking was not saved.</strong> {submitError}
        </div>
      )}
      <div className="flex gap-4 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isSubmitting ? "Saving…" : "Book Appointment"}
        </button>
      </div>
    </form>
  );
}