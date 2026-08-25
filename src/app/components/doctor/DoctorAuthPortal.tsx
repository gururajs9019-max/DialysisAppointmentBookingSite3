import { useState } from "react";
import { Stethoscope, Mail, Lock, User, Building, ClipboardCheck, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";

export interface DoctorData {
  name: string;
  email: string;
  specialty: string;
  department: string;
  licenseNumber: string;
}

interface DoctorAuthPortalProps {
  onAuthenticate: (doctorData: DoctorData) => void;
  onBack?: () => void;
}

export function DoctorAuthPortal({ onAuthenticate, onBack }: DoctorAuthPortalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    specialty: "",
    department: "",
    licenseNumber: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const doctorData: DoctorData = {
      name: formData.name || "Dr. Rajesh Verma",
      email: formData.email,
      specialty: formData.specialty || "Nephrology",
      department: formData.department || "Dialysis Department",
      licenseNumber: formData.licenseNumber || "KMC-NEP",
    };
    
    onAuthenticate(doctorData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-lg transition-all border border-white/20"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back to Portal Selection</span>
          <span className="sm:hidden">Back</span>
        </button>
      )}
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden lg:block text-white space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
              <Stethoscope className="w-16 h-16 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">KMC-RI Hospital</h1>
              <p className="text-xl text-blue-100">Dialysis Department Portal</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Healthcare Provider Access</h2>
            <p className="text-lg text-blue-100">
              Comprehensive dialysis management system for medical professionals
            </p>
          </div>

          <div className="space-y-4 pt-8">
            <div className="flex items-start gap-3">
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Patient Management</h3>
                <p className="text-blue-100">Access comprehensive patient profiles and medical records</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Treatment Tracking</h3>
                <p className="text-blue-100">Monitor dialysis sessions and patient outcomes</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Resource Management</h3>
                <p className="text-blue-100">Allocate machines and manage department operations</p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/20">
            <p className="text-sm text-blue-200">
              Secure, HIPAA-compliant platform for healthcare professionals
            </p>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
          {/* Logo for mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-3 rounded-xl">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">KMC-RI Hospital</h1>
              <p className="text-sm text-gray-600">Doctor Portal</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? "Doctor Login" : "Doctor Registration"}
            </h2>
            <p className="text-gray-600">
              {isLogin 
                ? "Access your healthcare provider account" 
                : "Create your healthcare provider account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
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
                    onChange={handleChange}
                    placeholder="Dr. Rajesh Verma"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

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
                  onChange={handleChange}
                  placeholder="doctor@kmcri.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialty
                  </label>
                  <select
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!isLogin}
                  >
                    <option value="">Select specialty...</option>
                    <option value="Nephrology">Nephrology</option>
                    <option value="Internal Medicine">Internal Medicine</option>
                    <option value="Critical Care">Critical Care</option>
                    <option value="General Practice">General Practice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="e.g., Dialysis Department"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={!isLogin}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medical License Number
                  </label>
                  <div className="relative">
                    <ClipboardCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      placeholder="e.g., KMC-NEP-2024"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Remember me</span>
                </label>
                <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-lg shadow-lg hover:shadow-xl"
            >
              {isLogin ? "Login to Portal" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {isLogin ? "Register here" : "Login here"}
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This portal is for authorized healthcare providers only. All access is logged and monitored for security purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}