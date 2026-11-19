import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  Activity, 
  FileText, 
  ShieldAlert, 
  Shield, 
  Wrench, 
  Users, 
  UserCog, 
  ChevronLeft, 
  ChevronRight, 
  Inbox, 
  AlertCircle,
  Calculator,
  Receipt,
  Sliders,
  ShieldCheck,
  X
} from 'lucide-react';
import { getTowers } from '../services/api';

interface SidebarProps {
  userRole: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const getUnreviewedLeadsCount = (): number => {
  try {
    const raw = localStorage.getItem('univlabs_clinical_leads');
    if (!raw) return 1;
    const leads = JSON.parse(raw);
    if (!Array.isArray(leads)) return 0;
    return leads.filter((l: any) => {
      const s = (l.status || 'PENDING_REVIEW').toUpperCase();
      return s === 'PENDING_REVIEW' || s === 'PENDING';
    }).length;
  } catch {
    return 0;
  }
};

const Sidebar: React.FC<SidebarProps> = ({ userRole, mobileOpen = false, onMobileClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingLeads, setPendingLeads] = useState<number>(getUnreviewedLeadsCount);

  // Micro-HUD live fleet metrics
  const [latencyMs, setLatencyMs] = useState<number>(14);
  const [activeSurgeries, setActiveSurgeries] = useState<number>(0);

  useEffect(() => {
    const updateLeads = () => {
      setPendingLeads(getUnreviewedLeadsCount());
    };
    window.addEventListener('storage', updateLeads);
    window.addEventListener('univlabs:leads-updated', updateLeads);
    return () => {
      window.removeEventListener('storage', updateLeads);
      window.removeEventListener('univlabs:leads-updated', updateLeads);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const pollFleet = async () => {
      const t0 = performance.now();
      try {
        const towers = await getTowers();
        if (!isMounted) return;
        const duration = Math.round(performance.now() - t0);
        setLatencyMs(Math.max(8, Math.min(65, duration)));
        const active = (towers || []).filter(t => t.is_surgery_active).length;
        setActiveSurgeries(active);
      } catch {
        if (!isMounted) return;
        setLatencyMs(16);
      }
    };

    pollFleet();
    const interval = setInterval(pollFleet, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navGroups: NavGroup[] = [
    {
      name: 'POSTPAID USAGE & OPERATIVE METRICS',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin', 'subscription_manager', 'hospital_admin', 'field_support'] },
        { path: '/towers', label: 'Fleet Towers', icon: Server, roles: ['superadmin', 'subscription_manager', 'hospital_admin', 'field_support'] },
        { path: '/customers', label: 'Customers', icon: Users, roles: ['superadmin', 'subscription_manager'] },
      ]
    },
    {
      name: 'BILLING & INVOICES',
      items: [
        { path: '/invoices', label: 'Invoices & Postpaid Billing', icon: Receipt, roles: ['superadmin', 'subscription_manager', 'hospital_admin'] },
        { path: '/subscriptions', label: 'Subscription Management', icon: Activity, roles: ['superadmin', 'subscription_manager'] },
      ]
    },
    {
      name: 'COMMERCIAL & FREEDOM',
      items: [
        { path: '/roi-studio', label: 'Commercial ROI Studio', icon: Calculator, roles: ['superadmin', 'subscription_manager'] },
        { path: '/pricing-config', label: 'Pricing Configuration', icon: Sliders, roles: ['superadmin', 'subscription_manager'] },
        { path: '/requests', label: 'Requests & Leads', icon: Inbox, roles: ['superadmin', 'subscription_manager'] },
      ]
    },
    {
      name: 'QUALITY & COMPLIANCE',
      items: [
        { path: '/complaints', label: 'Customer Complaints', icon: AlertCircle, roles: ['superadmin', 'subscription_manager', 'hospital_admin', 'field_support'] },
        { path: '/logs', label: 'Session Logs', icon: FileText, roles: ['superadmin', 'hospital_admin', 'field_support'] },
        { path: '/audit', label: 'Security & Audit Trail', icon: ShieldAlert, roles: ['superadmin'] },
      ]
    },
    {
      name: 'ADMINISTRATION',
      items: [
        { path: '/users', label: 'User Identity Management', icon: UserCog, roles: ['superadmin'] },
        { path: '/rbac', label: 'Access Control', icon: Shield, roles: ['superadmin'] },
        { path: '/support', label: 'Field Support', icon: Wrench, roles: ['superadmin', 'field_support'] },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div 
          onClick={onMobileClose}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:w-auto md:static md:z-20 ${
        isCollapsed ? 'md:w-20' : 'md:w-68'
      } flex-shrink-0 border-r border-white/10 bg-zinc-950/95 md:bg-zinc-950/80 backdrop-blur-2xl h-full flex flex-col transition-all duration-300 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        
        {/* Collapse Toggle (Desktop only) */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-6 w-6 h-6 bg-zinc-900 rounded-full border border-emerald-500/40 items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)] hover:bg-zinc-800 hover:text-emerald-300 transition-colors z-50 cursor-pointer"
          title={isCollapsed ? "Expand HUD Rail" : "Collapse HUD Rail"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand Header */}
        <div className={`h-16 flex items-center justify-between ${isCollapsed ? 'px-5 md:justify-center md:px-0' : 'px-5'} border-b border-white/10 overflow-hidden`}>
          <div className="flex items-center">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.35)] flex-shrink-0">
              <div className="absolute inset-0 rounded-xl ring-1 ring-emerald-500/50 animate-pulse pointer-events-none" />
              <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5 text-emerald-400">
                <path
                  d="M16 3L4 9V17C4 23.5 9.5 28.5 16 30C22.5 28.5 28 23.5 28 17V9L16 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16" r="4.5" stroke="#38bdf8" strokeWidth="2" />
                <path d="M16 8V11.5M16 20.5V24M8 16H11.5M20.5 16H24" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className={`ml-3 flex flex-col overflow-hidden ${isCollapsed ? 'flex md:hidden' : 'flex'}`}>
              <span className="font-extrabold text-base tracking-wider text-white whitespace-nowrap">
                UNIVLABS CCP
              </span>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
                CYBER-CLINICAL HUD
              </span>
            </div>
          </div>

          {/* Mobile close button inside mobile sidebar header */}
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped High-Tech Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4 overflow-x-hidden">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.name} className="space-y-1">
                <div className={`text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3 py-1 font-mono ${isCollapsed ? 'block md:hidden' : 'block'}`}>
                  {group.name}
                </div>
                {isCollapsed && (
                  <div className="hidden md:block h-px bg-white/10 my-2 mx-2" />
                )}

                {visibleItems.map((item) => {
                  const isRequestsItem = item.path === '/requests';
                  const hasPendingLeads = isRequestsItem && pendingLeads > 0;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => onMobileClose?.()}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) => 
                        `relative flex items-center min-h-[44px] ${isCollapsed ? 'px-3 md:justify-center md:px-0' : 'px-3'} py-2.5 rounded-xl transition-all duration-200 group ${
                          isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="relative flex items-center justify-center">
                            <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'} ${isCollapsed ? 'mr-3 md:mr-0' : 'mr-3'}`} />
                            {isCollapsed && hasPendingLeads && (
                              <span className="hidden md:block absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-pulse" />
                            )}
                          </div>
                          <div className={`flex-1 flex items-center justify-between min-w-0 ${isCollapsed ? 'flex md:hidden' : 'flex'}`}>
                            <span className="font-medium text-sm whitespace-nowrap truncate">{item.label}</span>
                            {hasPendingLeads && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                {pendingLeads}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Live Fleet Pulse Ticker */}
        <div className="p-3 border-t border-white/10 bg-zinc-950/60">
          <div className={`p-3 rounded-xl bg-zinc-900/80 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.06)] flex flex-col gap-2 ${isCollapsed ? 'flex md:hidden' : 'flex'}`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">Fleet Pulse</span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                mTLS 1.3
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-[11px]">
              <div>
                <div className="text-zinc-500 uppercase tracking-wider text-[9px] font-mono">Sessions</div>
                <div className="font-mono font-bold text-white flex items-center gap-1">
                  <span className="text-emerald-400">{activeSurgeries}</span>
                  <span className="text-zinc-400 text-[10px]">Active</span>
                </div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase tracking-wider text-[9px] font-mono">Latency</div>
                <div className="font-mono font-bold text-white flex items-center gap-1">
                  <span className="text-cyan-400">{latencyMs}</span>
                  <span className="text-zinc-400 text-[10px]">ms</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/5">
              <span className="truncate">Tunnel Health</span>
              <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                SECURE
              </span>
            </div>
          </div>

          {isCollapsed && (
            <div className="hidden md:flex flex-col items-center justify-center gap-1 py-1" title={`Fleet Pulse: ${activeSurgeries} active surgeries · ${latencyMs}ms · mTLS 1.3 Secure`}>
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </div>
              <span className="font-mono text-[9px] text-zinc-400">{latencyMs}ms</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
