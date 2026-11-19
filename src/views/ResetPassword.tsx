import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  ShieldCheck,
  Check
} from 'lucide-react';
import { confirmPasswordReset } from '../services/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const passwordCriteria = [
    { label: '8+ characters', met: newPassword.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(newPassword) },
    { label: 'Number (0-9)', met: /[0-9]/.test(newPassword) },
    { label: 'Special character (!@#$%^&*...)', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const isPasswordValid = passwordCriteria.every(c => c.met);

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [tokenParam]);

  useEffect(() => {
    if (isSuccess && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isSuccess && countdown === 0) {
      navigate('/login');
    }
  }, [isSuccess, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token.trim()) {
      setErrorMessage('Reset token is missing. Please use the reset link provided by your administrator.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must meet all security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmPasswordReset(token.trim(), newPassword);
      if (res.ack) {
        setIsSuccess(true);
      } else {
        setErrorMessage(res.message || 'Failed to reset password. The token may be invalid or expired.');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to reset password. The link may have expired or already been used.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-gray-400 mt-2">
            Configure a new secure password for your administrative portal account.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden">
          {isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Password Reset Complete!</h3>
              <p className="text-sm text-gray-300">
                Your password has been successfully updated. Redirecting to login in <span className="font-bold text-blue-400">{countdown}</span> seconds...
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all"
                >
                  Proceed to Login Now
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {!tokenParam && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    placeholder="Paste your reset token"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Visual Checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-black/25 border border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">
                    Password Requirements
                  </span>
                  <div className="space-y-1">
                    {passwordCriteria.map((c, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 text-xs transition-colors ${
                          c.met ? 'text-emerald-400' : 'text-gray-400'
                        }`}
                      >
                        {c.met ? (
                          <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600 ml-1 mr-1 flex-shrink-0" />
                        )}
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isPasswordValid || newPassword !== confirmPassword || (!tokenParam && !token.trim())}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Resetting Password...' : 'Confirm Password Reset'}</span>
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
