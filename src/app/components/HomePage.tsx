import { Calendar, Clock, MapPin, Shield, Heart, Users, ChevronRight, LayoutDashboard, Activity, MessageSquare, AlertCircle, UserPlus, Sparkles } from "lucide-react";

interface HomePageProps {
  onViewAppointments: () => void;
  onNavigate: (view: string) => void;
}

export function HomePage({ onViewAppointments, onNavigate }: HomePageProps) {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-24 overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in">
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/30">
                <Sparkles className="w-4 h-4" />
                KMC-RI Hospital
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Dialysis Slot Manager
            </h1>
            <p className="text-2xl mb-4 text-blue-50 font-medium">
              Smart Booking System
            </p>
            <p className="text-xl mb-10 text-blue-100 leading-relaxed">
              Access your dialysis care information and connect with your healthcare team at KMC-RI Hospital. 
              View your appointments, track your health progress, and stay informed about your treatment journey.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onViewAppointments}
                className="group flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all shadow-2xl hover:shadow-white/20 hover:scale-105 transform"
              >
                <Calendar className="w-5 h-5" />
                View My Appointments
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Comprehensive Care Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage your dialysis care in one place
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <button
              onClick={() => onNavigate('dashboard')}
              className="card-hover bg-white rounded-2xl shadow-lg p-8 text-left group border border-gray-100 hover:border-blue-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-50"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                    <LayoutDashboard className="w-8 h-8 text-white" />
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Smart Dashboard</h3>
                <p className="text-gray-600 leading-relaxed">
                  View your upcoming appointments, treatment stats, and quick actions in one place
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('timeline')}
              className="card-hover bg-white rounded-2xl shadow-lg p-8 text-left group border border-gray-100 hover:border-purple-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-bl-full opacity-50"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Health Timeline</h3>
                <p className="text-gray-600 leading-relaxed">
                  Track your treatment history, vitals, and health progress over time
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('careteam')}
              className="card-hover bg-white rounded-2xl shadow-lg p-8 text-left group border border-gray-100 hover:border-orange-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-50 to-transparent rounded-bl-full opacity-50"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Care Team</h3>
                <p className="text-gray-600 leading-relaxed">
                  Connect with your doctors, nurses, and care coordinators directly
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Us?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We provide comprehensive dialysis care with a focus on patient comfort and clinical excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Expert Care</h3>
              <p className="text-gray-600">
                Board-certified nephrologists and experienced nursing staff dedicated to your health.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Flexible Scheduling</h3>
              <p className="text-gray-600">
                Multiple time slots available to fit your lifestyle and treatment needs.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Patient-Centered</h3>
              <p className="text-gray-600">
                Comfortable treatment rooms and personalized care plans for every patient.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Comprehensive dialysis treatment options tailored to your medical needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hemodialysis</h3>
              <p className="text-gray-600">
                In-center hemodialysis with the latest technology and continuous monitoring 
                by our medical team.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Peritoneal Dialysis</h3>
              <p className="text-gray-600">
                Training and support for peritoneal dialysis, offering more flexibility 
                and independence.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Home Hemodialysis</h3>
              <p className="text-gray-600">
                Comprehensive training and ongoing support for patients choosing home-based treatment.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Consultation Services</h3>
              <p className="text-gray-600">
                Initial consultations, treatment planning, and ongoing care management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Location</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              KMCRI Hospital - Conveniently located to serve you
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-blue-50 rounded-lg p-8 text-center">
              <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">KMCRI Hospital</h3>
              <p className="text-gray-700 mb-4">Dialysis & Nephrology Department</p>
              <p className="text-gray-600 mb-6">
                State-of-the-art dialysis center with expert medical professionals
              </p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <MapPin className="w-5 h-5" />
                Get Directions
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Access Your Health Information</h2>
          <p className="text-xl text-blue-100 mb-8">
            View your appointments, track your health timeline, and connect with your care team.
          </p>
          <button
            onClick={onViewAppointments}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
          >
            <Calendar className="w-5 h-5" />
            View My Appointments
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 mb-1">Important Information</h3>
                <div className="text-sm text-yellow-700">
                  <p>For medical emergencies, call 911 immediately. This booking system is for scheduled appointments only and should not be used for urgent medical situations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}