import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { getRbacMatrix, getPortalUsers } from '../services/api';
import type { RbacMatrixResponse, PortalUserRecord } from '../services/api';
import { Shield, ShieldCheck, UserCheck, Key, Lock, CheckCircle2, XCircle } from 'lucide-react';

const EXACT_4_ROLES = ['superadmin', 'subscription_manager', 'hospital_admin', 'field_support'];

const DEFAULT_RBAC_DATA: RbacMatrixResponse = {
  matrix: {
    superadmin: {
      role_key: 'superadmin',
      label: 'Super Admin',
      description: 'Unrestricted system-wide authority across all hospitals, devices, customer accounts, and financial operations',
      scope: 'GLOBAL',
      permissions: {
        'view_dashboard': true,
        'view_towers': true,
        'register_towers': true,
        'assign_plans': true,
        'view_customers': true,
        'manage_customers': true,
        'manage_subscriptions': true,
        'view_balance': true,
        'manage_balance': true,
        'view_session_logs': true,
        'view_audit_trail': true,
        'manage_field_support': true,
        'user_management': true,
        'export_compliance_data': true
      }
    },
    subscription_manager: {
      role_key: 'subscription_manager',
      label: 'Subscription Manager',
      description: 'Fleet commercial management, customer contracts, subscription plan allocation, and balance replenishment (no detailed logs)',
      scope: 'GLOBAL_COMMERCIAL',
      permissions: {
        'view_dashboard': true,
        'view_towers': true,
        'register_towers': true,
        'assign_plans': true,
        'view_customers': true,
        'manage_customers': true,
        'manage_subscriptions': true,
        'view_balance': true,
        'manage_balance': true,
        'view_session_logs': false,
        'view_audit_trail': false,
        'manage_field_support': false,
        'user_management': false,
        'export_compliance_data': false
      }
    },
    hospital_admin: {
      role_key: 'hospital_admin',
      label: 'Hospital Admin',
      description: 'Facility operations strictly scoped to owned towers; views procedures & session history only',
      scope: 'CUSTOMER_BOUND',
      permissions: {
        'view_dashboard': true,
        'view_towers': true,
        'register_towers': false,
        'assign_plans': false,
        'view_customers': false,
        'manage_customers': false,
        'manage_subscriptions': false,
        'view_balance': false,
        'manage_balance': false,
        'view_session_logs': true,
        'view_audit_trail': false,
        'manage_field_support': false,
        'user_management': false,
        'export_compliance_data': false
      }
    },
    field_support: {
      role_key: 'field_support',
      label: 'Field Support',
      description: 'On-site technical diagnostics, detailed telemetry & delta frame inspection, and hardware emergency service tokens',
      scope: 'ALL_DEVICES_DIAGNOSTICS',
      permissions: {
        'view_dashboard': true,
        'view_towers': true,
        'register_towers': false,
        'assign_plans': false,
        'view_customers': false,
        'manage_customers': false,
        'manage_subscriptions': false,
        'view_balance': false,
        'manage_balance': false,
        'view_session_logs': true,
        'view_audit_trail': false,
        'manage_field_support': true,
        'user_management': false,
        'export_compliance_data': false
      }
    }
  },
  current_user_claims: {
    sub: 'current-user',
    username: 'admin@ccp.local',
    role: 'superadmin',
    customer_id: 'GLOBAL',
    scope: 'GLOBAL',
    permissions: {}
  }
};

const RBACMatrix: React.FC = () => {
  const [matrixData, setMatrixData] = useState<RbacMatrixResponse>(DEFAULT_RBAC_DATA);
  const [portalUsers, setPortalUsers] = useState<PortalUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'invariants'>('matrix');

  const storedUser = localStorage.getItem('portal_user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const isHospitalAdmin = currentUser?.role === 'hospital_admin';

  useEffect(() => {
    if (!isHospitalAdmin) {
      fetchData();
    }
  }, [isHospitalAdmin]);

  if (isHospitalAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matrix, users] = await Promise.all([
        getRbacMatrix().catch(() => DEFAULT_RBAC_DATA),
        getPortalUsers().catch(() => [])
      ]);
      
      // Ensure exact 4 roles are displayed
      const mergedMatrix: Record<string, any> = { ...DEFAULT_RBAC_DATA.matrix };
      if (matrix?.matrix) {
        Object.entries(matrix.matrix).forEach(([k, v]) => {
          if (EXACT_4_ROLES.includes(k)) {
            mergedMatrix[k] = v;
          }
        });
      }

      setMatrixData({
        matrix: mergedMatrix,
        current_user_claims: matrix?.current_user_claims || DEFAULT_RBAC_DATA.current_user_claims
      });
      setPortalUsers(users);
    } catch (err) {
      console.error('Failed to load RBAC configuration', err);
      setMatrixData(DEFAULT_RBAC_DATA);
    } finally {
      setLoading(false);
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'subscription_manager':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'hospital_admin':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'field_support':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-gray-400">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        Loading security and RBAC definitions...
      </div>
    );
  }

  // Active matrix roles strictly aligned to exact 4 roles
  const activeRoles = EXACT_4_ROLES.map(rk => matrixData.matrix[rk] || DEFAULT_RBAC_DATA.matrix[rk]).filter(Boolean);

  // All unique permission keys across roles
  const allPermissions = Object.keys(DEFAULT_RBAC_DATA.matrix.superadmin.permissions);

  return (
    <div className="p-6 h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Access Control & RBAC Matrix</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Exact 4-role access matrix, security boundaries, and 21 CFR Part 11 segregation of duties.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'matrix' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Permissions Matrix
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'users' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            System Directory ({portalUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('invariants')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'invariants' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Compliance & Invariants
          </button>
        </div>
      </div>

      {/* Active User Security Claims Banner */}
      {matrixData?.current_user_claims && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Session Claims:</span>
              <div className="text-sm font-medium text-white flex items-center gap-2 mt-0.5">
                <span>Principal: <strong className="text-blue-300 font-mono">{matrixData.current_user_claims.username}</strong></span>
                <span>•</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${roleBadge(matrixData.current_user_claims.role)}`}>
                  {matrixData.current_user_claims.role}
                </span>
                <span>•</span>
                <span>Scope: <strong className="text-amber-300 font-mono">{matrixData.current_user_claims.scope}</strong></span>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400 font-mono">
            mTLS / Bearer Token Authenticated
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Roles Overview Cards (Exact 4 Roles) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeRoles.map((details) => (
              <GlassCard key={details.role_key} className="border-white/10 hover:border-white/20 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${roleBadge(details.role_key)}`}>
                    {details.label}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                    {details.scope}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed mt-2 min-h-[48px]">
                  {details.description}
                </p>
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-400">
                  <span>Granted Permissions:</span>
                  <span className="font-bold text-white">
                    {Object.values(details.permissions).filter(Boolean).length} / {Object.keys(details.permissions).length}
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Matrix Table */}
          <GlassCard className="overflow-x-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" />
              Role Authorization Matrix (Declarative Permissions)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-white/5">
                    <th className="py-3 px-4">Permission String</th>
                    <th className="py-3 px-4">Description</th>
                    {activeRoles.map(r => (
                      <th key={r.role_key} className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roleBadge(r.role_key)}`}>
                          {r.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {allPermissions.map((perm) => (
                    <tr key={perm} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-blue-300 font-medium">
                        {perm}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-300 capitalize">
                        {perm.replace(':', ' ').replace(/_/g, ' ')}
                      </td>
                      {activeRoles.map(r => {
                        const hasPerm = r.permissions[perm];
                        return (
                          <td key={r.role_key} className="py-2.5 px-4 text-center">
                            {hasPerm ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-600 inline opacity-40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* System Directory Tab */}
      {activeTab === 'users' && (
        <GlassCard>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                Provisioned System Operators & Personas
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Accounts seeded for multi-tenant portal demonstration and regulatory verification.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4">Operator Username</th>
                  <th className="py-3 px-4">Role Key</th>
                  <th className="py-3 px-4">Tenant Scope</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4">Provisioned At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {portalUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-sm text-white font-medium">
                      {u.username}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-300">
                      {u.customer_id || 'Global (Multi-tenant)'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never logged in'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Compliance & Invariants Tab */}
      {activeTab === 'invariants' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-bold text-white">4-Role Strict Segregation of Duties</h3>
            </div>
            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <p>
                In alignment with FDA guidelines and cyber-physical medical device safety standards:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-400">
                <li>
                  <strong className="text-white">Super Admin:</strong> System-wide unrestricted administration, device registration, and compliance audit trail inspection.
                </li>
                <li>
                  <strong className="text-white">Subscription Manager:</strong> Manages commercial contracts, subscriptions, customers, and recharges. Restricted from viewing detailed engineering logs and hardware delta frames.
                </li>
                <li>
                  <strong className="text-white">Hospital Admin:</strong> Strictly bound to their hospital tenant scope. Views facility towers, balance gauges, and session history only.
                </li>
                <li>
                  <strong className="text-white">Field Support:</strong> Technical maintenance personnel with real-time telemetry diagnostics, peripheral status inspection, and emergency field tokens. Prohibited from executing billing or plan modifications.
                </li>
              </ul>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Device Identity & mTLS Gating</h3>
            </div>
            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <p>
                Device authentication and lifecycle gating invariants:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-400">
                <li>
                  <strong className="text-white">Subject DN Authority:</strong> Endoscopic towers authenticate via mutual TLS (mTLS). The X.509 Common Name (CN) is the sole authority for device identification.
                </li>
                <li>
                  <strong className="text-white">Lifecycle Gating (UNASSIGNED):</strong> Unassigned or unconfigured towers are strictly rejected with <code className="text-red-400 bg-white/5 px-1 py-0.5 rounded">403 Forbidden / Subscription Inactive</code> across <code className="text-blue-300">/api/v1/verify</code>, <code className="text-blue-300">/heartbeat</code>, and log ingestion.
                </li>
                <li>
                  <strong className="text-white">Delta Telemetry & Flash Integrity:</strong> Incoming periodic and delta packets track flash store sequences (<code className="text-emerald-300">store_seq</code>) ensuring hardware-cloud state sync without telemetry drift.
                </li>
              </ul>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default RBACMatrix;
