import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LogOut, 
  User, 
  Bell, 
  Settings, 
  Key, 
  ChevronDown, 
  Search, 
  Lock, 
  Inbox, 
  ChevronRight,
  ShieldCheck,
  Menu
} from 'lucide-react';
import { logout, getPortalNotifications, type PortalNotification } from '../services/api';
import ChangePasswordModal from './ChangePasswordModal';
import PwaInstallPrompt from './PwaInstallPrompt';

interface HeaderProps {
  user: {
    username: string;
    role?: string;
    email?: string | null;
  };
  remainingSeconds?: number;
  onOpenCommandPalette?: () => void;
  onMobileMenuToggle?: () => void;
}

interface DemoLeadSummary {
  id: string;
  tracking_id?: string;
  hospital_name?: string;
  requester_name?: string;
  system?: string;
  status?: string;
  created_at?: string;
}

const INACTIVITY_TIMEOUT_SECONDS = 15 * 60; // 15-minute inactivity lock (FDA 21 CFR Part 11)

const Header: React.FC<HeaderProps> = ({ user, remainingSeconds: propRemainingSeconds, onOpenCommandPalette, onMobileMenuToggle }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [demoLeads, setDemoLeads] = useState<DemoLeadSummary[]>([]);
  const [pendingDemoCount, setPendingDemoCount] = useState<number>(0);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [localSecondsRemaining, setLocalSecondsRemaining] = useState<number>(INACTIVITY_TIMEOUT_SECONDS);

  const secondsRemaining = propRemainingSeconds !== undefined ? propRemainingSeconds : localSecondsRemaining;

  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const leadsRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const isPrivileged = user.role === 'superadmin' || user.role === 'subscription_manager';

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [navigate]);

  // 15-Minute Inactivity Auto-Lock Countdown (FDA 21 CFR Part 11) - Only run local fallback if not controlled by Layout
  useEffect(() => {
    if (propRemainingSeconds !== undefined) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_SECONDS - elapsed);
      setLocalSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        handleLogout();
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(timer);
    };
  }, [handleLogout, propRemainingSeconds]);

  // Load Clinical Demo Enquiries
  const loadDemoLeads = useCallback(() => {
    try {
      const raw = localStorage.getItem('univlabs_clinical_leads');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDemoLeads(parsed);
          const pending = parsed.filter((l: any) => {
            const s = (l.status || 'PENDING_REVIEW').toUpperCase();
            return s === 'PENDING_REVIEW' || s === 'PENDING';
          }).length;
          setPendingDemoCount(pending);
          return;
        }
      }
      setDemoLeads([]);
      setPendingDemoCount(0);
    } catch {
      setDemoLeads([]);
      setPendingDemoCount(0);
    }
  }, []);

  const fetchNotificationData = async () => {
    try {
      const notifs = await getPortalNotifications();
      if (Array.isArray(notifs) && notifs.length > 0) {
        setNotifications(notifs);
        const pending = notifs.filter(n => !n.read || n.type === 'REQUEST' || n.type?.includes('PENDING')).length;
        setPendingCount(pending || notifs.length);
      } else {
        setNotifications([]);
        setPendingCount(0);
      }
    } catch {
      setNotifications([]);
      setPendingCount(0);
    }
  };

  useEffect(() => {
    fetchNotificationData();
    loadDemoLeads();

    const interval = setInterval(() => {
      fetchNotificationData();
      loadDemoLeads();
    }, 15000);

    const onStorageOrCustom = () => loadDemoLeads();
    window.addEventListener('storage', onStorageOrCustom);
    window.addEventListener('univlabs:leads-updated', onStorageOrCustom);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorageOrCustom);
      window.removeEventListener('univlabs:leads-updated', onStorageOrCustom);
    };
  }, [loadDemoLeads]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(target)) {
        setBellOpen(false);
      }
      if (leadsRef.current && !leadsRef.current.contains(target)) {
        setLeadsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 gap-3 sm:gap-4">
      {/* Mobile Hamburger Drawer Trigger */}
      <button
        type="button"
        onClick={() => {
          if (onMobileMenuToggle) {
            onMobileMenuToggle();
          } else {
            window.dispatchEvent(new CustomEvent('portal:toggle-mobile-menu'));
          }
        }}
        className="md:hidden p-2 -ml-1 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl border border-zinc-800/60 transition-colors cursor-pointer flex-shrink-0"
        aria-label="Toggle navigation drawer"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search / Command Palette Trigger */}
      <div className="flex-1 max-w-md">
        <button
          type="button"
          onClick={() => {
            if (onOpenCommandPalette) {
              onOpenCommandPalette();
            } else {
              window.dispatchEvent(new CustomEvent('portal:open-command-palette'));
            }
          }}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-400 hover:text-white transition-all text-xs group cursor-pointer shadow-inner"
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
            <span className="text-zinc-400 group-hover:text-zinc-200">Search commands, towers, tickets...</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 shadow-xs">
              Ctrl
            </kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 shadow-xs">
              K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right HUD Strip */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <PwaInstallPrompt />

        {/* 15-Minute Inactivity Auto-Lock Countdown */}
        <div 
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono border transition-all ${
            secondsRemaining < 120 
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse' 
              : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
          }`}
          title="FDA 21 CFR Part 11 Session Security: 15-min Inactivity Auto-Lock"
        >
          <Lock className={`w-3.5 h-3.5 ${secondsRemaining < 120 ? 'text-amber-400' : 'text-zinc-400'}`} />
          <span className="font-semibold">{formatCountdown(secondsRemaining)}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest hidden md:inline">Auto-Lock</span>
        </div>

        {/* Clinical Demo Enquiries Alert Bell (SuperAdmins & Subscription Managers) */}
        {isPrivileged && (
          <div className="relative" ref={leadsRef}>
            <button
              type="button"
              onClick={() => setLeadsOpen(!leadsOpen)}
              className="relative p-2 rounded-xl text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-all border border-zinc-800/60 hover:border-emerald-500/40 focus:outline-none cursor-pointer"
              title="Clinical Demo Enquiries & Leads"
            >
              <Inbox className="w-5 h-5" />
              {pendingDemoCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-emerald-950 font-black text-[10px] flex items-center justify-center border-2 border-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse">
                  {pendingDemoCount > 9 ? '9+' : pendingDemoCount}
                </span>
              )}
            </button>

            {leadsOpen && (
              <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-xl shadow-2xl p-4 z-50 text-sm">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-semibold text-white">Clinical Demo Leads</h4>
                  </div>
                  {pendingDemoCount > 0 ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {pendingDemoCount} Pending
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      Up to date
                    </span>
                  )}
                </div>

                <div className="py-2 max-h-72 overflow-y-auto space-y-2">
                  {demoLeads.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No clinical demo inquiries recorded yet.
                    </div>
                  ) : (
                    demoLeads.slice(0, 6).map((lead) => {
                      const isPending = (lead.status || 'PENDING_REVIEW').toUpperCase() === 'PENDING_REVIEW';
                      return (
                        <div
                          key={lead.id || lead.tracking_id}
                          onClick={() => {
                            setLeadsOpen(false);
                            navigate('/requests?tab=leads');
                          }}
                          className="p-2.5 rounded-xl bg-zinc-950/50 hover:bg-zinc-800/60 border border-zinc-800/80 hover:border-emerald-500/40 transition-all text-xs cursor-pointer group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                              {lead.hospital_name || 'Hospital Inquiry'}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase ${
                              isPending 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {lead.status || 'PENDING_REVIEW'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                            <span>{lead.requester_name || 'Clinician'}</span>
                            <span className="text-zinc-500 font-mono text-[10px]">
                              {lead.system || 'Spectra ICG 4K'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800 text-center">
                  <Link
                    to="/requests?tab=leads"
                    onClick={() => setLeadsOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-1.5 px-3 rounded-lg hover:bg-emerald-500/10"
                  >
                    <span>Manage Demo Leads Queue</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Standard Operations Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen(!bellOpen)}
            className="text-zinc-400 hover:text-white transition-all relative p-2 rounded-xl border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 focus:outline-none cursor-pointer"
            title="Service Requests & Notifications"
          >
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-amber-950 font-black text-[10px] flex items-center justify-center border-2 border-zinc-950 shadow-sm animate-pulse">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-xl shadow-2xl p-4 z-50 text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" />
                  <h4 className="font-semibold text-white">Service Requests</h4>
                </div>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingCount} Pending
                  </span>
                )}
              </div>

              <div className="py-2 max-h-72 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No recent service requests.
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl bg-zinc-950/50 hover:bg-zinc-800/60 border border-zinc-800/80 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{n.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800 text-center">
                <Link
                  to="/requests"
                  onClick={() => setBellOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors py-1 px-3 rounded-lg hover:bg-blue-500/10"
                >
                  <span>View All Requests</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-zinc-800" />

        {/* User Profile Menu Popover */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800 transition-all text-left focus:outline-none cursor-pointer"
          >
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-white">{user.username}</span>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">{(user.role || 'user').replace('_', ' ')}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <User className="w-5 h-5 text-emerald-300" />
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${menuOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-xl shadow-2xl py-2 z-50 text-sm">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="font-semibold text-white truncate">{user.username}</p>
                {user.email && <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {(user.role || 'user').replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Part 11
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
                >
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <span>Account Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors text-left cursor-pointer"
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Change Password</span>
                </button>
              </div>

              <div className="border-t border-zinc-800 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};

export default Header;
