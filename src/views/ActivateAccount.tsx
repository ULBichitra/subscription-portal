import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Building, 
  Mail, 
  Shield, 
  ArrowLeft,
  User,
  Check
} from 'lucide-react';
import { validateInvitation, activateInvitation } from '../services/api';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  subscription_manager: 'Subscription Manager',
  distributor_admin: 'Distributor Admin',
  hospital_admin: 'Hospital Admin',
  field_support: 'Field Support',
};

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const ActivateAccount: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invitedUser, setInvitedUser] = useState<{
    username: string;
    email?: string | null;
    role: string;
    customer_id?: string | null;
  } | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordCriteria = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { label: 'Special character (!@#$%^&*...)', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const isPasswordValid = passwordCriteria.every(c => c.met);

  // Validate invitation on mount
  useEffect(() => {
    let isMounted = true;

    const checkToken = async () => {
      if (!token.trim()) {
        setValidationError('Missing invitation token. Please check the activation link provided by your administrator.');
        setIsValidating(false);
        return;
      }

      try {
        const res = await validateInvitation(token.trim());
        if (isMounted) {
          if (res.ack && res.user) {
            setInvitedUser(res.user);
            const defaultUname = res.user.username && !res.user.username.includes('@')
              ? res.user.username
              : (res.user.email ? res.user.email.split('@')[0] : (res.user.username ? res.user.username.split('@')[0] : ''));
            setUsername(defaultUname.replace(/[^a-zA-Z0-9_-]/g, ''));
          } else {
            setValidationError(res.message || 'Invitation token is invalid or has expired.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err.response?.data?.message || err.response?.data?.detail || 'Invitation token is invalid or has expired.';
          setValidationError(msg);
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Google Identity Services integration
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !invitedUser) return;

    const handleGoogleResponse = async (response: any) => {
      if (!response.credential) return;
      setFormError('');
      setIsSubmitting(true);
      try {
        await activateInvitation({
          token: token.trim(),
          google_credential: response.credential,
        });
        navigate('/dashboard');
      } catch (err: any) {
        const msg = err.response?.data?.message || err.response?.data?.detail || 'Google account activation failed.';
        setFormError(msg);
      } finally {
        setIsSubmitting(false);
      }
    };

    const initGIS = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
        });
        const container = document.getElementById('google-activate-btn-container');
        if (container) {
          window.google.accounts.id.renderButton(container, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGIS();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGIS;
      document.body.appendChild(script);
    }
  }, [invitedUser, token, navigate]);

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setFormError('Please choose a username.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanUsername)) {
      setFormError('Username must be 3-30 characters long and contain only letters, numbers, underscores, or hyphens (no "@").');
      return;
    }

    if (!isPasswordValid) {
      setFormError('Password must meet all security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await activateInvitation({
        token: token.trim(),
        password: password,
        username: cleanUsername,
      });
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Failed to activate account.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setFormError('Google Sign-In is not configured on this server. Please activate using a password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden font-sans p-4">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[150px] pointer-events-none" />

      <div className="glass-panel w-full max-w-lg p-8 relative z-10 animate-fade-in border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl bg-white/5">
        
        {/* Loading State */}
        {isValidating && (
          <div className="text-center py-12 space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-400 mx-auto" />
            <h3 className="text-xl font-semibold text-white">Validating Invitation</h3>
            <p className="text-gray-400 text-sm">Verifying cryptographic invitation token security...</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {!isValidating && validationError && (
          <div className="text-center space-y-6 py-4">
            <div className="inline-flex p-4 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Invitation Expired or Invalid</h2>
              <p className="text-gray-300 mt-2 text-sm leading-relaxed max-w-md mx-auto">
                {validationError}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/10 text-xs text-gray-400 text-left">
              <p className="font-semibold text-gray-300 mb-1">Common reasons:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The 24-hour invitation window has elapsed.</li>
                <li>The invitation has already been used to activate an account.</li>
                <li>The activation link is incomplete or malformed.</li>
              </ul>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        )}

        {/* Valid Invitation Form */}
        {!isValidating && !validationError && invitedUser && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/20 mb-3 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Activate Your Account</h2>
              <p className="text-gray-400 mt-1 text-sm">
                Set up your password to complete activation for CCP Portal.
              </p>
            </div>

            {/* Invited User Profile Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
              <div className="flex flex-col">
                <span className="text-gray-500 font-semibold uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Account
                </span>
                <span className="text-gray-200 font-medium truncate mt-0.5" title={invitedUser.email || invitedUser.username}>
                  {invitedUser.email || invitedUser.username}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 font-semibold uppercase flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Role
                </span>
                <span className="text-blue-300 font-medium mt-0.5">
                  {ROLE_LABELS[invitedUser.role] || invitedUser.role}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 font-semibold uppercase flex items-center gap-1">
                  <Building className="w-3 h-3" /> Facility
                </span>
                <span className="text-gray-200 font-medium font-mono mt-0.5">
                  {invitedUser.customer_id || 'GLOBAL'}
                </span>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Password Activation Form */}
            <form onSubmit={handleSubmitPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Choose Username *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. john_doe"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-white/10 rounded-xl bg-black/30 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  3–30 characters (alphanumeric, underscore, hyphen; no '@').
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  New Password (min 8 characters) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-10 py-2.5 text-sm border border-white/10 rounded-xl bg-black/30 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-black/25 border border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">
                    Password Requirements
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {passwordCriteria.map((c, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          c.met ? 'text-emerald-400' : 'text-gray-500'
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Confirm Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-white/10 rounded-xl bg-black/30 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isPasswordValid || password !== confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Activate Account & Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-900 px-3 text-gray-500 font-semibold tracking-wider">
                  Or activate with
                </span>
              </div>
            </div>

            {/* Google Activation Option */}
            <div id="google-activate-btn-container" className="flex justify-center">
              <button
                type="button"
                onClick={handleManualGoogleClick}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all duration-200 disabled:opacity-50"
              >
                <GoogleIcon className="w-5 h-5" />
                <span>Activate with Google</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Already have an activated account? Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivateAccount;
