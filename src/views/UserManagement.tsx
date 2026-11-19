import React, { useEffect, useState, useMemo } from 'react';
import Modal from '../components/ui/Modal';
import Drawer from '../components/ui/Drawer';
import { 
  getUsers, 
  createUser, 
  resendUserInvitation, 
  getCustomers,
  getTowers,
  resetUserPassword,
  updateUserStatus,
  deletePortalUser
} from '../services/api';
import type { UserRecord, Customer, Tower } from '../services/api';
import { useToast } from '../components/ui/ToastProvider';
import { 
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Shield, 
  ShieldAlert,
  ShieldCheck,
  Mail, 
  Building,
  Send,
  Key,
  Trash2,
  Power,
  LayoutGrid,
  List,
  Layers,
  Activity,
  Globe,
  Lock,
  Clock,
  Sparkles
} from 'lucide-react';

interface ClearanceTierConfig {
  label: string;
  code: string;
  level: string;
  badgeStyle: string;
  cardGlow: string;
  dotColor: string;
  icon: React.ElementType;
  description: string;
}

const CLEARANCE_TIERS: Record<string, ClearanceTierConfig> = {
  superadmin: {
    label: 'Super Admin',
    code: 'SUPERADMIN',
    level: 'Clearance Tier 5 · Root Sovereign',
    badgeStyle: 'bg-purple-950/70 text-purple-200 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]',
    cardGlow: 'hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    dotColor: 'bg-purple-400',
    icon: ShieldAlert,
    description: 'Platform Root Authority · Fleet Governance & Cryptographic PKI'
  },
  subscription_manager: {
    label: 'Subscription Manager',
    code: 'SUB_MGR',
    level: 'Clearance Tier 4 · Commercial Lead',
    badgeStyle: 'bg-cyan-950/70 text-cyan-200 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    cardGlow: 'hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    dotColor: 'bg-cyan-400',
    icon: Layers,
    description: 'Commercial Operations · Billing, Tariffs & Recharge Quotas'
  },
  distributor_admin: {
    label: 'Distributor Admin',
    code: 'DIST_ADMIN',
    level: 'Clearance Tier 3 · Territory Command',
    badgeStyle: 'bg-amber-950/70 text-amber-200 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    cardGlow: 'hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    dotColor: 'bg-amber-400',
    icon: Building,
    description: 'Regional Channel Administration · Sub-Fleet Hospital Oversight'
  },
  hospital_admin: {
    label: 'Hospital Admin',
    code: 'HOSP_ADMIN',
    level: 'Clearance Tier 2 · Facility Governance',
    badgeStyle: 'bg-emerald-950/70 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    cardGlow: 'hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    dotColor: 'bg-emerald-400',
    icon: ShieldCheck,
    description: 'Clinical Facility Command · Tower Sessions & Operating Staff'
  },
  field_support: {
    label: 'Field Support',
    code: 'FIELD_ENG',
    level: 'Clearance Tier 1 · Biomedical Support',
    badgeStyle: 'bg-blue-950/70 text-blue-200 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]',
    cardGlow: 'hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
    dotColor: 'bg-blue-400',
    icon: Activity,
    description: 'Biomedical Field Specialist · Hardware Calibration & Telemetry'
  }
};

const UserManagement: React.FC = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INVITED' | 'SUSPENDED'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Slide-out User Activation Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'hospital_admin',
    customer_id: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<number | null>(null);

  // Success state with activation credentials
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Resend invitation modal state
  const [resendModalData, setResendModalData] = useState<{
    isOpen: boolean;
    username: string;
    email?: string;
    activationToken: string;
    activationLink: string;
  } | null>(null);
  const [resendCopied, setResendCopied] = useState(false);

  // Reset password modal state
  const [resetModalData, setResetModalData] = useState<{
    isOpen: boolean;
    username: string;
    email?: string;
    resetToken: string;
    resetLink: string;
  } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<number | null>(null);

  // Status toggle & delete states
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<number | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Current session user
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('portal_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const callerRole = currentUser?.role || 'superadmin';

  // Customer fast lookup dictionary
  const customerMap = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => {
      map[c.customer_id] = c;
    });
    return map;
  }, [customers]);

  // Allowed target roles based on caller clearance
  const availableRoles = useMemo(() => {
    if (callerRole === 'subscription_manager') {
      return [
        { value: 'hospital_admin', label: 'Hospital Admin (Tier 2)' },
        { value: 'distributor_admin', label: 'Distributor Admin (Tier 3)' },
      ];
    }
    if (callerRole === 'distributor_admin') {
      return [
        { value: 'hospital_admin', label: 'Hospital Admin (Tier 2)' },
      ];
    }
    return [
      { value: 'superadmin', label: 'Super Admin (Tier 5 · Root)' },
      { value: 'subscription_manager', label: 'Subscription Manager (Tier 4)' },
      { value: 'distributor_admin', label: 'Distributor Admin (Tier 3)' },
      { value: 'hospital_admin', label: 'Hospital Admin (Tier 2)' },
      { value: 'field_support', label: 'Field Support (Tier 1)' },
    ];
  }, [callerRole]);

  const fetchUsersList = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersList = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    }
  };

  const fetchTowersList = async () => {
    try {
      const data = await getTowers();
      setTowers(data);
    } catch (err: any) {
      console.error('Failed to load towers:', err);
    }
  };

  useEffect(() => {
    fetchUsersList();
    fetchCustomersList();
    fetchTowersList();
  }, []);

  const handleOpenDrawer = () => {
    const defaultRole = availableRoles[0]?.value || 'hospital_admin';
    const isStaff = ['superadmin', 'subscription_manager', 'field_support'].includes(defaultRole);
    setFormData({
      username: '',
      email: '',
      role: defaultRole,
      customer_id: isStaff ? '' : (currentUser?.customer_id || (customers[0]?.customer_id ?? '')),
    });
    setFormError('');
    setActivationToken(null);
    setActivationLink(null);
    setCopiedLink(false);
    setCopiedToken(false);
    setCopiedPayload(false);
    setIsDrawerOpen(true);
  };

  const handleResendInvitation = async (user: UserRecord) => {
    setResendingUserId(user.id);
    try {
      const res = await resendUserInvitation(user.id);
      if (res.ack && res.activation_token) {
        const link = `${window.location.origin}/activate?token=${res.activation_token}`;
        setResendModalData({
          isOpen: true,
          username: user.username,
          email: res.email || user.email || undefined,
          activationToken: res.activation_token,
          activationLink: link,
        });
        setResendCopied(false);
        addToast(res.message || 'Invitation refreshed successfully', 'success');
      } else {
        addToast(res.message || 'Failed to resend invitation', 'error');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || 'Failed to resend invitation';
      addToast(errorMsg, 'error');
    } finally {
      setResendingUserId(null);
    }
  };

  const handleResetPassword = async (targetUser: UserRecord) => {
    setResettingPasswordUserId(targetUser.id);
    try {
      const res = await resetUserPassword(targetUser.id);
      if (res.ack) {
        const link = `${window.location.origin}/reset-password?token=${res.reset_token}`;
        setResetModalData({
          isOpen: true,
          username: targetUser.username,
          email: res.email || targetUser.email || undefined,
          resetToken: res.reset_token,
          resetLink: link,
        });
        setResetCopied(false);
        addToast(`Password reset link generated for ${targetUser.username}`, 'success');
      } else {
        addToast(res.message || 'Failed to initiate password reset', 'error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to initiate password reset';
      addToast(msg, 'error');
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleToggleUserStatus = async (targetUser: UserRecord) => {
    if (targetUser.id === currentUser?.id || targetUser.username === currentUser?.username) {
      addToast('Security Invariant: Cannot suspend your own administrative session.', 'error');
      return;
    }
    const newStatus = targetUser.is_active === false ? true : false;
    setStatusUpdatingUserId(targetUser.id);
    try {
      const res = await updateUserStatus(targetUser.id, newStatus);
      if (res.ack) {
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: newStatus } : u));
        addToast(`Operator ${targetUser.username} status updated to ${newStatus ? 'ACTIVE' : 'SUSPENDED'}.`, 'success');
      } else {
        addToast('Failed to update operator status.', 'error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to update user status';
      addToast(msg, 'error');
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deleteConfirmUser.id === currentUser?.id || deleteConfirmUser.username === currentUser?.username) {
      addToast('Security Invariant: Cannot purge self account from system.', 'error');
      setDeleteConfirmUser(null);
      return;
    }
    setIsDeleting(true);
    try {
      const res = await deletePortalUser(deleteConfirmUser.id);
      if (res.ack) {
        setUsers(prev => prev.filter(u => u.id !== deleteConfirmUser.id));
        addToast(`Operator account ${deleteConfirmUser.username} permanently deleted.`, 'success');
        setDeleteConfirmUser(null);
        fetchCustomersList();
        fetchTowersList();
      } else {
        addToast('Failed to delete operator account.', 'error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete user';
      addToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    setActivationToken(null);
    setActivationLink(null);
    setCopiedLink(false);
    setCopiedToken(false);
    setCopiedPayload(false);

    try {
      const cleanEmail = formData.email.trim();
      if (!cleanEmail) {
        setFormError('Email address is required.');
        setIsSubmitting(false);
        return;
      }

      const isStaff = ['superadmin', 'subscription_manager', 'field_support'].includes(formData.role);
      if (!isStaff && !formData.customer_id.trim()) {
        setFormError('Please select a customer facility for this clearance tier.');
        setIsSubmitting(false);
        return;
      }

      const effectiveUsername = formData.username.trim() || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
      const payload: { username: string; email: string; role: string; customer_id?: string } = {
        username: effectiveUsername,
        email: cleanEmail,
        role: formData.role,
      };
      if (!isStaff && formData.customer_id.trim()) {
        payload.customer_id = formData.customer_id.trim();
      }

      const res = await createUser(payload);
      const token = res.activation_token || res.invitation_token;
      if (token) {
        const link = `${window.location.origin}/activate?token=${token}`;
        setActivationToken(token);
        setActivationLink(link);
      }
      await fetchUsersList();
      addToast(`Operator account ${effectiveUsername} provisioned successfully!`, 'success');
    } catch (err: any) {
      const message = err.response?.data?.detail || err.response?.data?.message || 'Failed to provision operator account.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy helpers
  const handleCopyLink = () => {
    if (!activationLink) return;
    navigator.clipboard.writeText(activationLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyToken = () => {
    if (!activationToken) return;
    navigator.clipboard.writeText(activationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyInvitationPayload = () => {
    if (!activationLink) return;
    const tier = CLEARANCE_TIERS[formData.role]?.label || formData.role;
    const payload = `UnivLabs Cyber-Clinical Portal Invitation\nAccount: ${formData.username || formData.email}\nClearance Tier: ${tier}\nFacility / ID: ${formData.customer_id || 'GLOBAL'}\nActivation Link: ${activationLink}\nValidity: 24 Hours`;
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.is_active !== false).length;
    const invited = users.filter(u => u.is_active === false).length;
    const customerBound = users.filter(u => Boolean(u.customer_id)).length;
    return { total, active, invited, customerBound };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && u.is_active === false) return false;
      if (statusFilter === 'INVITED' && u.is_active !== false) return false;
      if (statusFilter === 'SUSPENDED' && u.is_active !== false) return false;

      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customerName = (u.customer_id && customerMap[u.customer_id]?.name) || '';
        const match =
          u.username.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          (u.customer_id && u.customer_id.toLowerCase().includes(q)) ||
          customerName.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [users, statusFilter, roleFilter, searchQuery, customerMap]);

  const selectedCustomerInfo = useMemo(() => {
    if (!formData.customer_id) return null;
    return customerMap[formData.customer_id] || null;
  }, [formData.customer_id, customerMap]);

  return (
    <div className="relative min-h-[calc(100vh-6rem)] space-y-6">
      {/* Background Ambience Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-70" />

      {/* Header Cockpit Strip */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Fleet Identity & Access Control
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Part 11 Compliant
                </span>
              </div>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
                Centralized clearance governance for surgical operators, hospital administrations, and regional distributor hubs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-black/40 border border-zinc-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Switch to Tabular Cockpit"
            >
              <List className="w-4 h-4" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Switch to Holographic Operator Grid"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grid</span>
            </button>
          </div>

          <button
            onClick={fetchUsersList}
            disabled={loading}
            className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all disabled:opacity-50"
            title="Refresh Fleet Operator Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenDrawer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Provision Operator</span>
          </button>
        </div>
      </div>

      {/* High-Tech Metrics Ledger Strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Fleet Operators</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
          <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-zinc-500" />
            <span>Total enrolled accounts</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Operators</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{metrics.active}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>Verified mTLS credentials</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Pending Activation</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{metrics.invited}</div>
          <div className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Awaiting token completion</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Facility Mapped</span>
            <Building className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{metrics.customerBound}</div>
          <div className="text-[11px] text-blue-400/80 mt-1 flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            <span>Bound to customer nodes</span>
          </div>
        </div>
      </div>

      {/* Control & Filter Strip */}
      <div className="relative z-10 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Live search by operator username, email, customer facility, or clearance tier..."
            className="w-full bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-zinc-100 placeholder-zinc-500 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-black/40 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-950/70 text-emerald-200 shadow-sm border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active ({metrics.active})
            </button>
            <button
              onClick={() => setStatusFilter('INVITED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                statusFilter === 'INVITED'
                  ? 'bg-amber-950/70 text-amber-200 shadow-sm border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Invited ({metrics.invited})
            </button>
          </div>

          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-black/40 text-zinc-200 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl px-3 py-2 text-xs font-medium transition-all"
          >
            <option value="ALL" className="bg-zinc-900 text-zinc-200">All Clearance Tiers</option>
            <option value="superadmin" className="bg-zinc-900 text-purple-300">Tier 5 · Super Admin</option>
            <option value="subscription_manager" className="bg-zinc-900 text-cyan-300">Tier 4 · Subscription Manager</option>
            <option value="distributor_admin" className="bg-zinc-900 text-amber-300">Tier 3 · Distributor Admin</option>
            <option value="hospital_admin" className="bg-zinc-900 text-emerald-300">Tier 2 · Hospital Admin</option>
            <option value="field_support" className="bg-zinc-900 text-blue-300">Tier 1 · Field Support</option>
          </select>
        </div>
      </div>

      {/* Main Directory Display: Tabular vs Grid */}
      {viewMode === 'table' ? (
        <div className="relative z-10 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950/60 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Operator Identity</th>
                  <th className="px-6 py-4">Clearance Tier</th>
                  <th className="px-6 py-4">Facility & Customer Hierarchy</th>
                  <th className="px-6 py-4">Auth Channel</th>
                  <th className="px-6 py-4">Security Status</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs sm:text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        <span className="text-sm font-medium">Synchronizing fleet identity ledger...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-zinc-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-zinc-600 mb-1" />
                        <p className="font-semibold text-zinc-300">No operators match the current criteria.</p>
                        <p className="text-xs text-zinc-500">Adjust your search parameters or clearance filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const tier = CLEARANCE_TIERS[user.role] || {
                      label: user.role,
                      code: user.role.toUpperCase(),
                      level: 'Clearance Tier',
                      badgeStyle: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                      cardGlow: '',
                      dotColor: 'bg-zinc-400',
                      icon: Shield,
                      description: 'Custom Access Role'
                    };
                    const TierIcon = tier.icon;
                    const cust = user.customer_id ? customerMap[user.customer_id] : null;

                    return (
                      <tr 
                        key={user.id} 
                        className="hover:bg-zinc-800/30 transition-colors group"
                      >
                        {/* Operator Identity */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white font-black text-sm group-hover:border-emerald-500/50 transition-colors shadow-inner">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                                user.is_active !== false ? 'bg-emerald-400' : 'bg-amber-400'
                              }`} />
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                                {user.username}
                              </div>
                              <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3 h-3 text-zinc-500" />
                                <span>{user.email || <span className="italic text-zinc-600">No email bound</span>}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Clearance Tier Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${tier.badgeStyle}`}>
                              <TierIcon className="w-3.5 h-3.5" />
                              <span>{tier.label}</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 pl-1 font-mono">
                              {tier.level}
                            </span>
                          </div>
                        </td>

                        {/* Facility & Customer Hierarchy */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.customer_id ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="font-semibold text-zinc-200">
                                  {cust?.name || user.customer_id}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 border border-zinc-800 text-purple-300">
                                  {user.customer_id}
                                </span>
                                {cust?.organization_type && (
                                  <span className="text-[10px] text-zinc-400">
                                    {cust.organization_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400 text-xs font-mono">
                              <Globe className="w-3 h-3 text-zinc-500" />
                              <span>GLOBAL · PLATFORM ROOT</span>
                            </div>
                          )}
                        </td>

                        {/* Auth Channel */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                            user.auth_provider === 'google'
                              ? 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {user.auth_provider === 'google' ? (
                              <Sparkles className="w-3 h-3 text-rose-400" />
                            ) : (
                              <Lock className="w-3 h-3 text-emerald-400" />
                            )}
                            <span>{user.auth_provider || 'local'}</span>
                          </span>
                        </td>

                        {/* Security Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.is_active !== false ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active Verified</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span>Pending Token</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResendInvitation(user)}
                                disabled={resendingUserId === user.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all disabled:opacity-50"
                                title="Generate fresh invitation token and link"
                              >
                                <Send className={`w-3 h-3 ${resendingUserId === user.id ? 'animate-pulse text-emerald-400' : ''}`} />
                                <span>{resendingUserId === user.id ? 'Sending...' : 'Resend'}</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-400 text-xs font-mono">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'System Genesis'}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reset Password */}
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              disabled={resettingPasswordUserId === user.id}
                              className="p-2 rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-50 shadow-sm"
                              title="Generate Cryptographic Password Reset Link"
                            >
                              <Key className={`w-3.5 h-3.5 ${resettingPasswordUserId === user.id ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Toggle Account Status */}
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(user)}
                              disabled={statusUpdatingUserId === user.id || user.id === currentUser?.id || user.username === currentUser?.username}
                              className={`p-2 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
                                user.is_active !== false
                                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                              }`}
                              title={
                                user.id === currentUser?.id || user.username === currentUser?.username
                                  ? 'Cannot suspend active session'
                                  : user.is_active !== false
                                    ? 'Suspend Operator Account'
                                    : 'Restore Operator Account'
                              }
                            >
                              <Power className={`w-3.5 h-3.5 ${statusUpdatingUserId === user.id ? 'animate-pulse' : ''}`} />
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmUser(user)}
                              disabled={user.id === currentUser?.id || user.username === currentUser?.username}
                              className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                              title={user.id === currentUser?.id || user.username === currentUser?.username ? 'Cannot purge self' : 'Permanently Delete Operator'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Holographic Operator Grid View */
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-zinc-400 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
              <span>Synchronizing holographic operator ledger...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="col-span-full py-16 text-center text-zinc-400 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="font-semibold text-zinc-300">No operators found matching current filters.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const tier = CLEARANCE_TIERS[user.role] || {
                label: user.role,
                code: user.role.toUpperCase(),
                level: 'Clearance Tier',
                badgeStyle: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                cardGlow: '',
                dotColor: 'bg-zinc-400',
                icon: Shield,
                description: 'Custom Access Role'
              };
              const TierIcon = tier.icon;
              const cust = user.customer_id ? customerMap[user.customer_id] : null;

              return (
                <div
                  key={user.id}
                  className={`p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${tier.cardGlow}`}
                >
                  <div>
                    {/* Card Top: Avatar Halo + Status Pill */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {/* Concentric Role Halo */}
                          <div className={`w-12 h-12 rounded-2xl bg-zinc-950 border flex items-center justify-center text-white font-black text-lg shadow-inner ${tier.badgeStyle}`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${
                            user.is_active !== false ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">
                            {user.username}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[180px]">
                            {user.email || 'No email bound'}
                          </p>
                        </div>
                      </div>

                      {/* Status Pill */}
                      {user.is_active !== false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Clearance Tier Badge */}
                    <div className="mb-4">
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between ${tier.badgeStyle}`}>
                        <div className="flex items-center gap-2">
                          <TierIcon className="w-4 h-4" />
                          <span className="font-bold text-xs">{tier.label}</span>
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold opacity-90">
                          {tier.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 pl-1">
                        {tier.description}
                      </p>
                    </div>

                    {/* Customer & Facility Mapping Card */}
                    <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5 mb-4 text-xs">
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <span>Facility Node:</span>
                        <span className="font-semibold text-zinc-200">
                          {user.customer_id ? (cust?.name || user.customer_id) : 'GLOBAL PLATFORM'}
                        </span>
                      </div>
                      {user.customer_id && (
                        <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                          <span>Account ID:</span>
                          <span className="font-mono text-purple-300 bg-purple-950/50 px-1.5 py-0.2 rounded border border-purple-500/20">
                            {user.customer_id}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <span>Auth Standard:</span>
                        <span className="font-semibold text-zinc-300 uppercase">
                          {user.auth_provider || 'LOCAL mTLS'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <span>Enrolled Date:</span>
                        <span className="font-mono text-zinc-400">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Genesis'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Strip */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    {user.is_active === false ? (
                      <button
                        type="button"
                        onClick={() => handleResendInvitation(user)}
                        disabled={resendingUserId === user.id}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        <span>Resend Invite</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        disabled={resettingPasswordUserId === user.id}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Key className="w-3 h-3" />
                        <span>Reset Key</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleUserStatus(user)}
                      disabled={statusUpdatingUserId === user.id || user.id === currentUser?.id || user.username === currentUser?.username}
                      className={`p-2 rounded-xl border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        user.is_active !== false
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                      }`}
                      title={user.is_active !== false ? 'Suspend Account' : 'Activate Account'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmUser(user)}
                      disabled={user.id === currentUser?.id || user.username === currentUser?.username}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete User"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick-Action User Activation Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => !isSubmitting && setIsDrawerOpen(false)}
        title="Provision Fleet Operator Account"
        width="max-w-xl"
      >
        {activationLink ? (
          /* Post-Creation Token & Payload Cockpit */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <h4 className="font-bold text-white text-base">Account Provisioned Successfully!</h4>
                <p className="text-xs text-emerald-300/90 mt-1 leading-relaxed">
                  A single-use 24-hour cryptographic activation token has been generated. Transmit this credential securely to the operator.
                </p>
              </div>
            </div>

            {/* Single-Use Activation Token */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Single-Use Activation Token</span>
                <span className="text-[10px] text-emerald-400 font-mono">24h Validity</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activationToken || ''}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-black/60 border border-zinc-800 rounded-xl text-emerald-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    copiedToken
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Full Activation URL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Direct Activation URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activationLink}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-black/60 border border-zinc-800 rounded-xl text-cyan-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Customer Hierarchy Mapping Card */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
              <div className="font-bold text-zinc-300 uppercase tracking-wider text-[11px] mb-2">
                Mapped Identity Hierarchy
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Operator Username:</span>
                <span className="font-mono text-white font-semibold">{formData.username || 'Auto-derived'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Contact Email:</span>
                <span className="text-white">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Assigned Clearance:</span>
                <span className="font-bold text-emerald-300">{CLEARANCE_TIERS[formData.role]?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Facility / Organization:</span>
                <span className="font-mono text-purple-300 font-semibold">{formData.customer_id || 'GLOBAL (Platform-Wide)'}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCopyInvitationPayload}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  copiedPayload 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                }`}
              >
                {copiedPayload ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPayload ? 'Full Payload Copied!' : 'Copy Secure Invitation Payload'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form for Operator Provisioning */
          <form onSubmit={handleCreateUser} className="space-y-4">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Target Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Operator Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    const newEmail = e.target.value;
                    const prevDefault = formData.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
                    const newDefault = newEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
                    setFormData(prev => ({
                      ...prev,
                      email: newEmail,
                      username: (!prev.username || prev.username === prevDefault) ? newDefault : prev.username,
                    }));
                  }}
                  placeholder="surgeon@facility.org or operator@univlabs.in"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl text-white placeholder-zinc-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                An invitation email will be dispatched automatically if portal SMTP relay is enabled.
              </p>
            </div>

            {/* Operator Username */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Operator System Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Auto-suggested from email"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl text-white placeholder-zinc-500 transition-all font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                May be customized by the operator during single-use link activation.
              </p>
            </div>

            {/* Clearance Tier Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Clearance Tier & Role *
              </label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const isStaff = ['superadmin', 'subscription_manager', 'field_support'].includes(newRole);
                    setFormData(prev => ({
                      ...prev,
                      role: newRole,
                      customer_id: isStaff ? '' : (prev.customer_id || (customers[0]?.customer_id ?? ''))
                    }));
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl text-white transition-all"
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value} className="bg-zinc-900 text-white">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clearance Tier Description Card */}
              {CLEARANCE_TIERS[formData.role] && (
                <div className={`mt-2 p-3 rounded-xl border text-xs ${CLEARANCE_TIERS[formData.role].badgeStyle}`}>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{CLEARANCE_TIERS[formData.role].level}</span>
                  </div>
                  <p className="mt-0.5 text-zinc-300/90 text-[11px]">
                    {CLEARANCE_TIERS[formData.role].description}
                  </p>
                </div>
              )}
            </div>

            {/* Customer Hierarchy Mapping */}
            {['superadmin', 'subscription_manager', 'field_support'].includes(formData.role) ? (
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2.5">
                <Globe className="w-4 h-4 flex-shrink-0 text-blue-400" />
                <span>
                  <strong>Global Scope:</strong> This clearance tier operates platform-wide across all connected hospital towers and distributor nodes.
                </span>
              </div>
            ) : (formData.role === 'hospital_admin' || formData.role === 'distributor_admin') ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Target Customer Facility Hierarchy *
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl text-white transition-all"
                  >
                    <option value="" disabled className="bg-zinc-900 text-zinc-500">
                      -- Select Target Customer Hierarchy --
                    </option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id} className="bg-zinc-900 text-white">
                        {`${c.name} (${c.customer_id}) · ${c.organization_type}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Customer Hierarchy Preview */}
                {selectedCustomerInfo && (
                  <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                      <span>Customer Name:</span>
                      <span className="font-bold text-white">{selectedCustomerInfo.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                      <span>Organization Type:</span>
                      <span className="text-zinc-200">{selectedCustomerInfo.organization_type}</span>
                    </div>
                    {selectedCustomerInfo.distributor_id && (
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <span>Distributor Parent:</span>
                        <span className="font-mono text-amber-300">{selectedCustomerInfo.distributor_id}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                      <span>Assigned Towers:</span>
                      <span className="font-bold text-emerald-300">{selectedCustomerInfo.tower_count || 0} Surgical Towers</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Action Bar */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Provisioning Cryptographic Identity...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Generate & Issue Activation Token</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Drawer>

      {/* Resend Invitation Modal */}
      <Modal
        isOpen={Boolean(resendModalData?.isOpen)}
        onClose={() => setResendModalData(null)}
        title="Regenerate Operator Activation Token"
      >
        {resendModalData && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-3 text-cyan-300">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-cyan-400" />
              <div>
                <h4 className="font-bold text-white text-sm">Fresh Activation Token Generated</h4>
                <p className="text-xs text-cyan-300/90 mt-1">
                  Issued for <strong className="text-white">{resendModalData.username}</strong>
                  {resendModalData.email ? ` (${resendModalData.email})` : ''}.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Activation Token
              </label>
              <input
                type="text"
                readOnly
                value={resendModalData.activationToken}
                className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-zinc-800 rounded-xl text-emerald-300 select-all mb-3 focus:outline-none"
              />

              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Direct Activation URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resendModalData.activationLink}
                  className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-zinc-800 rounded-xl text-cyan-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resendModalData.activationLink);
                    setResendCopied(true);
                    setTimeout(() => setResendCopied(false), 2000);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    resendCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {resendCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{resendCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResendModalData(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={Boolean(resetModalData?.isOpen)}
        onClose={() => setResetModalData(null)}
        title="Issue Password Reset Link"
      >
        {resetModalData && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
              <Key className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <h4 className="font-bold text-white text-sm">Reset Link Ready for {resetModalData.username}</h4>
                <p className="text-xs text-amber-300/90 mt-1">
                  Share this single-use reset URL directly with the operator.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Reset Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resetModalData.resetLink}
                  className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-zinc-800 rounded-xl text-amber-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetModalData.resetLink);
                    setResetCopied(true);
                    setTimeout(() => setResetCopied(false), 2000);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    resetCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {resetCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{resetCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteConfirmUser)}
        onClose={() => !isDeleting && setDeleteConfirmUser(null)}
        title="Confirm Operator Purge"
      >
        {deleteConfirmUser && (() => {
          const isFacilityAdmin = Boolean(
            deleteConfirmUser.customer_id && 
            (deleteConfirmUser.role === 'hospital_admin' || deleteConfirmUser.role === 'distributor_admin')
          );
          const linkedTowers = isFacilityAdmin 
            ? towers.filter(t => t.customer_id === deleteConfirmUser.customer_id) 
            : [];
          const activeLinkedTowers = linkedTowers.filter(t => t.is_online || t.status === 'ACTIVE');
          const activeTowerIds = activeLinkedTowers.map(t => t.tower_id);

          return (
            <div className="space-y-4">
              {/* Active/Online Standby Towers High-Severity Warning Prompt */}
              {isFacilityAdmin && activeLinkedTowers.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/20 border-2 border-red-500/60 text-red-200 text-xs flex items-start gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <ShieldAlert className="w-6 h-6 flex-shrink-0 text-red-400 mt-0.5 animate-pulse" />
                  <div className="space-y-1.5 w-full">
                    <h4 className="font-black text-red-100 text-sm uppercase tracking-wide">
                      Active/Online Towers Detected!
                    </h4>
                    <p className="text-red-200 text-xs leading-relaxed font-semibold">
                      Active/Online Towers Detected! Purging this facility administrator will immediately unassign towers [{activeTowerIds.join(', ')}] and expire their subscriptions.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeLinkedTowers.map(t => (
                        <span key={t.tower_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-900/60 text-red-200 border border-red-500/40">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.is_online ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                          {t.tower_id} ({t.is_online ? 'ONLINE' : t.status})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Facility Administrator Warning */}
              {isFacilityAdmin && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Facility Administrator Notice</h5>
                    <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
                      Deleting facility administrator will also purge the associated Customer facility [{deleteConfirmUser.customer_id}] and unassign its linked towers.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">Permanently Purge Operator Account?</h4>
                  <p className="text-xs text-rose-300/90 mt-1">
                    Operator <strong className="text-white font-mono">{deleteConfirmUser.username}</strong> will be revoked immediately and removed from all customer facility access rosters.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 space-y-1.5">
                <div><span className="text-zinc-500">Assigned Clearance:</span> <span className="font-bold text-white">{CLEARANCE_TIERS[deleteConfirmUser.role]?.label || deleteConfirmUser.role}</span></div>
                <div><span className="text-zinc-500">Contact Email:</span> <span className="font-semibold text-white">{deleteConfirmUser.email || 'None'}</span></div>
                <div><span className="text-zinc-500">Facility Binding:</span> <span className="font-mono text-purple-300">{deleteConfirmUser.customer_id || 'GLOBAL PLATFORM'}</span></div>
                {isFacilityAdmin && (
                  <div><span className="text-zinc-500">Linked Towers:</span> <span className="font-mono text-amber-300">{linkedTowers.length} tower(s) ({activeLinkedTowers.length} active/online)</span></div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Purging Account...' : 'Purge Operator'}</span>
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default UserManagement;
