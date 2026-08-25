import { useState } from "react";
import { Lock, UserCog, Shield, ArrowLeft } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { loginStaff } from "../../lib/appointmentApi";

export interface AdminData {
  username: string;
  name: string;
}

interface AdminAuthPortalProps {
  onAuthenticate: (adminData: AdminData) => Promise<void> | void;
  onBack?: () => void;
}

export function AdminAuthPortal({ onAuthenticate, onBack }: AdminAuthPortalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const user = await loginStaff("admin", username, password);
      await onAuthenticate({ username: user.username || username, name: user.name });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
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

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white">KMC-RI Hospital</h1>
              <p className="text-purple-100">Administrator Portal</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-full shadow-lg">
              <UserCog className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Administrator Login</h2>
            <p className="text-gray-600">Access the booking management system</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-5 h-5" />
                  Sign In
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-900">Use your hospital-issued administrator credentials.</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-purple-100 text-sm">
            Secure access for authorized hospital administrators only
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-sm border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-purple-100 text-sm">
            <p className="mb-2">© 2026 KMC-RI Hospital. All rights reserved.</p>
            <p className="text-xs text-purple-200">
              Secure, HIPAA-compliant healthcare platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}