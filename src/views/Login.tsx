import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Info,
  ArrowLeft,
  Shield,
  ShieldCheck,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { login, loginWithGoogle, requestForgotPassword } from '../services/api';

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

interface SurgicalNode {
  id: string;
  hospital: string;
  ot: string;
  model: string;
  ping: number;
  x: number;
  y: number;
}

const surgicalNodes: SurgicalNode[] = [
  {
    id: 'node-1',
    hospital: 'Apollo Chennai',
    ot: 'OR-04',
    model: 'Spectra ICG 4K',
    ping: 12,
    x: 18,
    y: 20,
  },
  {
    id: 'node-2',
    hospital: 'AIIMS New Delhi',
    ot: 'OT-12',
    model: 'Lumina 4K UHD',
    ping: 18,
    x: 82,
    y: 18,
  },
  {
    id: 'node-3',
    hospital: 'Fortis Gurgaon',
    ot: 'OT-02',
    model: 'SurgiStart HD',
    ping: 15,
    x: 18,
    y: 78,
  },
  {
    id: 'node-4',
    hospital: 'Manipal Bengaluru',
    ot: 'OT-07',
    model: 'Spectra ICG 4K',
    ping: 9,
    x: 82,
    y: 78,
  },
  {
    id: 'node-5',
    hospital: 'Lilavati Mumbai',
    ot: 'OR-05',
    model: 'Lumina 4K UHD',
    ping: 21,
    x: 50,
    y: 10,
  },
];

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mtlsPing, setMtlsPing] = useState(12);

  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      await requestForgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Failed to dispatch reset link.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    const pingTimer = setInterval(() => {
      setMtlsPing(Math.floor(11 + Math.random() * 4));
    }, 4000);
    return () => clearInterval(pingTimer);
  }, []);

  const notice = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'server_restarted') {
      return {
        type: 'warning',
        message: 'Server has restarted. Active session context was cleared for compliance. Please sign in again.',
      };
    }
    if (reason === 'session_expired') {
      return {
        type: 'info',
        message: 'Your session has expired. Please sign in again.',
      };
    }
    if (reason === 'idle_timeout') {
      return {
        type: 'info',
        message: 'You were signed out after 15 minutes of inactivity for FDA 21 CFR Part 11 clinical security compliance.',
      };
    }
    return null;
  }, [location.search]);

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : '/dashboard';
  }, [location.search]);

  const handleGoogleCredentialResponse = async (credential: string) => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate(redirectTarget);
    } catch (err: any) {
      const status = err.response?.status;
      const reasonCode = err.response?.data?.reason_code;
      const detail = err.response?.data?.message || err.response?.data?.detail;

      if (
        status === 403 &&
        (reasonCode === 'ACCOUNT_NOT_REGISTERED' || detail?.includes('not authorized') || detail?.includes('not registered'))
      ) {
        setError('Your Google account is not registered. Please contact your administrator for an invitation.');
      } else {
        setError(detail || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const onGoogleCallback = (response: any) => {
      if (response?.credential) {
        handleGoogleCredentialResponse(response.credential);
      }
    };

    const initGIS = () => {
      if (window.google?.accounts?.id && !(window as any).__gsi_init__) {
        (window as any).__gsi_init__ = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: onGoogleCallback,
        });
        const container = document.getElementById('google-login-btn-container');
        if (container) {
          window.google.accounts.id.renderButton(container, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'signin_with',
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
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await login(username, password);
      navigate(redirectTarget);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication rejected. Verify credentials or role clearance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In client ID is not configured on this server. Please use institutional credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* 1. All-User Scope Top Header Banner */}
      <header className="w-full bg-zinc-950 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-300 relative z-30 shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs tracking-wider shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold">mTLS ACTIVE</span>
          </div>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <p className="font-medium text-zinc-200 tracking-wide text-xs truncate">
            UnivLabs Unified Clinical Gateway &mdash; Authorized Access for Hospital Administrators, Operating Surgeons, Biomedical Engineers, Regional Distributors, QA Officers &amp; UnivLabs Personnel
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-3 font-mono text-xs text-zinc-400 shrink-0 pl-4">
          <span className="text-zinc-500">GATEWAY ID:</span>
          <span className="text-emerald-400 font-medium">UL-GATEWAY-21CFR11</span>
        </div>
      </header>

      {/* 2. Main Split-Screen Architecture */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Section: Connected Surgical Infrastructure */}
        <section className="lg:col-span-6 xl:col-span-7 flex flex-col justify-between p-6 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-zinc-800/80 relative overflow-hidden bg-zinc-950/60">
          {/* Subtle Ambient Lighting */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />

          {/* Top Indicators & Badges */}
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Live mTLS latency ping indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-xs font-mono text-emerald-400 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-zinc-300">mTLS Gateway:</span>
                <span className="font-semibold text-emerald-400">Connected</span>
                <span className="text-zinc-600">&middot;</span>
                <span className="font-bold text-white">{mtlsPing}ms</span>
                <span className="text-zinc-600">&middot;</span>
                <span className="text-zinc-400">TLS 1.3</span>
              </div>

              {/* Regulatory compliance badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-300 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-zinc-200">FDA 21 CFR Part 11 / HIPAA Cryptographic Identity Gateway</span>
              </div>
            </div>

            {/* UnivLabs Official Motto & Surgical Intelligence Showcase */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-emerald-400 font-mono uppercase tracking-widest mb-3">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>SURGICAL VISION ARCHITECTURE</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Precision Endoscopy Powered by Surgical Freedom
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
                Hardware-enforced zero-trust access uniting Spectra ICG 4K, Lumina 4K UHD, and SurgiStart operating suites across regional hospital networks.
              </p>
            </div>
          </div>

          {/* Luminous Animated Node Mesh */}
          <div className="my-8 relative min-h-[340px] rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 overflow-hidden backdrop-blur-sm">
            {/* Grid Backdrop Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a15_1px,transparent_1px),linear-gradient(to_bottom,#27272a15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Vector Connector Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {surgicalNodes.map((node) => (
                <line
                  key={`line-${node.id}`}
                  x1="50"
                  y1="48"
                  x2={node.x}
                  y2={node.y}
                  stroke="#10b981"
                  strokeWidth="0.4"
                  strokeDasharray="2,2"
                  strokeOpacity="0.4"
                />
              ))}
              <circle cx="50" cy="48" r="22" stroke="#06b6d4" strokeWidth="0.3" strokeDasharray="3,3" strokeOpacity="0.3" fill="none" />
              <circle cx="50" cy="48" r="38" stroke="#10b981" strokeWidth="0.2" strokeDasharray="4,4" strokeOpacity="0.2" fill="none" />
            </svg>

            {/* Central Gateway Relay Hub */}
            <div
              className="absolute z-20 flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950 border border-emerald-500/50 shadow-lg shadow-emerald-950/60 -translate-x-1/2 -translate-y-1/2"
              style={{ left: '50%', top: '48%' }}
            >
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 mb-1">
                <Server className="w-4 h-4" />
                <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-40" />
              </div>
              <span className="font-mono text-xs font-bold text-white tracking-wide">UnivLabs Gateway Relay</span>
              <span className="font-mono text-xs text-emerald-400">mTLS Root &middot; Online</span>
            </div>

            {/* Floating Connected Hospital Nodes */}
            {surgicalNodes.map((node) => (
              <div
                key={node.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-105"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-emerald-500/40 shadow-md backdrop-blur-md min-w-[140px]">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-medium text-xs text-zinc-200 truncate">{node.hospital}</span>
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  </div>
                  <div className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                    <span>{node.ot}</span>
                    <span className="text-emerald-400 font-semibold">{node.ping}ms</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-0.5 truncate">
                    {node.model}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Security / Architecture Telemetry Ledger */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>SURGICAL FLEET</span>
              </div>
              <p className="text-lg font-bold text-white mt-1">48 Towers</p>
              <p className="text-xs text-emerald-400 font-mono">100% In-Sync</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>OFFLINE GRACE</span>
              </div>
              <p className="text-lg font-bold text-white mt-1">16 Hours</p>
              <p className="text-xs text-cyan-400 font-mono">Fail-Safe Active</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>CIPHER SUITE</span>
              </div>
              <p className="text-lg font-bold text-white mt-1">AES-256</p>
              <p className="text-xs text-purple-400 font-mono">GCM Encrypted</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>AUDIT TRAIL</span>
              </div>
              <p className="text-lg font-bold text-white mt-1">Part 11</p>
              <p className="text-xs text-emerald-400 font-mono">Cryptographic</p>
            </div>
          </div>
        </section>

        {/* Right Section: Authentication Cockpit */}
        <section className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center items-center p-6 sm:p-10 relative bg-[#09090b]">
          {/* Subtle Ambient Lighting Right */}
          <div className="absolute top-1/4 right-10 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="w-full max-w-md relative z-10 space-y-6">
            {/* Back Button linking to '/' */}
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors group"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>&larr; Back to UnivLabs Pay-Per-Minute Overview</span>
              </Link>
            </div>

            {/* Glassmorphic Login Card */}
            <div className="p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
              {/* UnivLabs Shield Emblem */}
              <div className="text-center mb-6">
                <div className="relative inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-950 border border-emerald-500/30 shadow-lg shadow-emerald-950/50 mb-3">
                  <Shield className="w-8 h-8 text-emerald-400" />
                  <div className="absolute inset-0 rounded-2xl border border-emerald-400/20 animate-pulse pointer-events-none" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Clinical Identity Cockpit</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Authenticate with institutional credentials, hardware token or SSO
                </p>
              </div>

              {/* Status / Compliance Notice */}
              {notice && (
                <div
                  className={`mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                    notice.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}
                >
                  {notice.type === 'warning' ? (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{notice.message}</span>
                </div>
              )}

              {/* Error Notice */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Username / Institutional ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-zinc-700 rounded-xl bg-zinc-950 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="e.g. superadmin or surgeon@hospital.org"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Cryptographic Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotOpen(true);
                        setForgotSuccess(false);
                        setForgotError('');
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-2.5 border border-zinc-700 rounded-xl bg-zinc-950 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating Identity...</span>
                    </>
                  ) : (
                    <span>Sign In to Gateway</span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-3 text-zinc-500 font-mono tracking-wider">
                    Institutional SSO
                  </span>
                </div>
              </div>

              {/* Google Sign-In */}
              <div id="google-login-btn-container" className="flex justify-center">
                <button
                  type="button"
                  onClick={handleManualGoogleClick}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>{isGoogleLoading ? 'Connecting...' : 'Sign in with Google Workspace'}</span>
                </button>
              </div>
            </div>

            {/* Regulatory Footer */}
            <div className="text-center space-y-1">
              <p className="text-xs text-zinc-500">
                Protected Closed System under FDA 21 CFR Part 11 &amp; HIPAA Cryptographic Gateway.
              </p>
              <p className="text-xs text-zinc-600 font-mono">
                SHA-256 Signature Verification &middot; Ephemeral Session Keys
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Reset Account Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 text-center py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Reset Link Dispatched</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    If <strong className="text-white">{forgotEmail}</strong> is registered in UnivLabs system, a secure 1-hour password reset link has been dispatched to your email address.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enter your registered institutional email or administrator username. We will send you an authorized link to reset your credentials.
                </p>

                {forgotError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="doctor@hospital.org"
                    required
                    className="block w-full px-3.5 py-2.5 border border-zinc-700 rounded-xl bg-zinc-950 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Dispatching...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
