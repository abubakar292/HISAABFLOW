import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

const errorMessages: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Try again.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
  'auth/network-request-failed': 'Check your internet connection.',
  'auth/popup-blocked': 'Please allow popups for Google Sign-In in your browser.',
  'auth/popup-closed-by-user': 'Google Sign-In popup was closed before completing.',
  'auth/cancelled-popup-request': 'Google Sign-In process was cancelled.',
  'auth/operation-not-allowed': 'Sign-in method is not enabled.',
  'auth/unauthorized-domain': 'This domain is not authorized in Firebase Console.',
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, signUp, signInGoogle } = useAuth();
  const navigate = useNavigate();

  const handlePostLoginRedirect = (userEmail: string) => {
    const clean = userEmail.toLowerCase().trim();
    if (clean === 'threadsandtailsshop@gmail.com' || clean === 'admin@hisaabflow.com' || localStorage.getItem('master_admin_session') === 'true') {
      navigate('/super-admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (isLogin) {
        await signIn(cleanEmail, password);
      } else {
        await signUp(name.trim(), cleanEmail, password);
      }
      handlePostLoginRedirect(cleanEmail);
    } catch (err: any) {
      setError(errorMessages[err.code] || err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInGoogle();
      const currentEmail = (window as any)._lastGoogleEmail || '';
      handlePostLoginRedirect(currentEmail);
    } catch (err: any) {
      setError(errorMessages[err.code] || err.message || 'Google sign-in failed.');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{ background: 'radial-gradient(circle at center, #23122A 0%, #15091B 60%, #0A030E 100%)' }}
    >
      {/* Background Plum Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#522D60]/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md p-2 relative z-10"
      >
        <div className="rounded-3xl bg-white border border-gray-100 shadow-[0_20px_60px_rgba(82,45,96,0.25)] p-6 sm:p-8">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-gray-100 p-2 mb-3 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="HISAABFLOW" 
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              HISAABFLOW
            </h2>
            <p className="text-[#522D60] font-bold text-xs uppercase tracking-widest mt-1">
              Shop Management & POS
            </p>
          </div>

          {/* Clean Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 border border-gray-200/80">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isLogin ? 'bg-[#522D60] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !isLogin ? 'bg-[#522D60] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-rose-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-semibold text-gray-700 block">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Usman Afridi"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] outline-none transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-[#522D60] hover:bg-[#42244D] text-white border-none shadow-md cursor-pointer font-bold py-2.5 rounded-xl"
                size="lg"
                isLoading={loading}
              >
                {isLogin ? 'Sign In to Workspace' : 'Create Account'}
              </Button>
            </div>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <button
            type="button"
            className="w-full mt-4 flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
            onClick={handleGoogleSignIn}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </motion.div>
    </div>
  );
}
