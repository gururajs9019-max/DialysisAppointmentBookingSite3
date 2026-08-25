import { useState } from "react";
import { User, Lock, Mail, Phone, Stethoscope, Users, Building2, ArrowRight } from "lucide-react";

type AuthMode = "login" | "signup";
type UserRole = "patient" | "doctor";

interface AuthPortalProps {
  onAuthenticate: (userData: UserData) => void;
  roleSelection?: boolean; // New prop to control role selection display
  defaultRole?: UserRole; // Default role when roleSelection is false
}

export interface UserData {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  licenseNumber?: string;
  department?: string;
}

export function AuthPortal({ onAuthenticate, roleSelection = true, defaultRole = "patient" }: AuthPortalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>(roleSelection ? "patient" : defaultRole);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    specialty: "",
    licenseNumber: "",
    department: "",
    confirmPassword: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup" && formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // Mock authentication - in real app, this would call an API
    const userData: UserData = {
      id: Math.random().toString(36).substr(2, 9),
      role,
      name: formData.name || "User",
      email: formData.email,
      phone: formData.phone,
      ...(role === "doctor" && {
        specialty: formData.specialty,
        licenseNumber: formData.licenseNumber,
        department: formData.department
      })
    };

    onAuthenticate(userData);
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      name: "",
      phone: "",
      specialty: "",
      licenseNumber: "",
      department: "",
      confirmPassword: ""
    });
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    resetForm();
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    resetForm();
  };

  const doctorSpecialties = [
    "Nephrologist",
    "Vascular Surgeon",
    "Dialysis Nurse",
    "Renal Dietitian",
    "Care Coordinator",
    "General Physician"
  ];

  const departments = [
    "Nephrology",
    "Dialysis Unit",
    "Vascular Surgery",
    "Nutrition Services",
    "Patient Care"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <Building2 className="w-10 h-10 text-blue-600" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-white">Dialysis Slot Manager</h1>
              <p className="text-blue-100">A Smart Booking System for KMC-RI</p>
            </div>
          </div>
          <p className="text-blue-100 max-w-2xl mx-auto">
            Secure portal for patients and healthcare professionals
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className={roleSelection ? "grid md:grid-cols-2" : "max-w-md mx-auto"}>
            {/* Role Selection Sidebar */}
            {roleSelection && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 md:p-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Your Role</h2>
                
                <div className="space-y-4 mb-8">
                  {/* Patient Role */}
                  <button
                    onClick={() => switchRole("patient")}
                    className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                      role === "patient"
                        ? "border-blue-600 bg-white shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        role === "patient" ? "bg-blue-100" : "bg-gray-100"
                      }`}>
                        <Users className={`w-6 h-6 ${
                          role === "patient" ? "text-blue-600" : "text-gray-600"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Patient Portal</h3>
                        <p className="text-sm text-gray-600">
                          Book appointments, view treatment history, and manage your care
                        </p>
                      </div>
                      {role === "patient" && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Doctor Role */}
                  <button
                    onClick={() => switchRole("doctor")}
                    className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                      role === "doctor"
                        ? "border-blue-600 bg-white shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        role === "doctor" ? "bg-blue-100" : "bg-gray-100"
                      }`}>
                        <Stethoscope className={`w-6 h-6 ${
                          role === "doctor" ? "text-blue-600" : "text-gray-600"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Healthcare Provider</h3>
                        <p className="text-sm text-gray-600">
                          Access patient records, manage schedules, and coordinate care
                        </p>
                      </div>
                      {role === "doctor" && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Features List */}
                <div className="bg-white rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {role === "patient" ? "Patient Features" : "Provider Features"}
                  </h3>
                  <ul className="space-y-3">
                    {role === "patient" ? (
                      <>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Smart appointment booking and management</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Personal health timeline and records</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Direct communication with care team</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Family care coordination</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Emergency support and resources</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Patient record management system</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Schedule and appointment oversight</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Treatment tracking and analytics</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Secure patient communication</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                          <span>Team collaboration tools</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Auth Form */}
            <div className="p-8 md:p-12">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  {role === "patient" ? (
                    <Users className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Stethoscope className="w-6 h-6 text-blue-600" />
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">
                    {mode === "login" ? "Welcome Back" : "Create Account"}
                  </h2>
                </div>
                <p className="text-gray-600">
                  {mode === "login"
                    ? `Sign in to your ${role} account`
                    : `Register as a ${role === "patient" ? "new patient" : "healthcare provider"}`}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Signup Fields */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                {/* Doctor-specific fields for signup */}
                {mode === "signup" && role === "doctor" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specialty
                      </label>
                      <select
                        name="specialty"
                        value={formData.specialty}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select your specialty</option>
                        {doctorSpecialties.map(specialty => (
                          <option key={specialty} value={specialty}>{specialty}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select your department</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        License Number
                      </label>
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Medical license number"
                      />
                    </div>
                  </>
                )}

                {/* Patient phone for signup */}
                {mode === "signup" && role === "patient" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contact number"
                      />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                {/* Confirm Password for Signup */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>
                )}

                {/* Forgot Password Link */}
                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 mt-6"
                >
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Switch Mode */}
                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-gray-600">
                    {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                    <button
                      type="button"
                      onClick={switchMode}
                      className="ml-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {mode === "login" ? "Sign Up" : "Sign In"}
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-100">
          <p className="text-sm">
            By signing in, you agree to KMC-RI Hospital's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}