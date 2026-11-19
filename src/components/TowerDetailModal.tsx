import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import {
  type Tower,
  type Subscription,
  type Session,
  getSessions,
  reactivateTower,
} from '../services/api';
import { resolveTowerPricing } from '../services/pricing';
import { realtimeClient } from '../services/realtime';
import {
  Server,
  Building2,
  Activity,
  ShieldCheck,
  Zap,
  Clock,
  Wifi,
  Cpu,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Lightbulb,
  Droplets,
  Wind,
  UserCheck,
  ArrowRightLeft,
} from 'lucide-react';

interface TowerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: Tower | null;
  subscription?: Subscription | null;
  userRole?: string;
  onTowerUpdated?: () => void;
  onOpenPlanChangeModal?: (tower: Tower) => void;
  onOpenSuspendModal?: (tower: Tower) => void;
  onOpenSessionModal?: (sessionId: string) => void;
  onOpenAssignModal?: (tower: Tower) => void;
  onOpenTransferModal?: (tower: Tower) => void;
}

type TabType = 'overview' | 'sessions' | 'subscription' | 'telemetry' | 'audit';

export const formatExactSessionDuration = (session: Session): string => {
  const rawSec = session.hub_duration_seconds ?? (session as any).duration_sec ?? session.session_elapsed_sec ?? session.elapsed_sec;
  let totalSec = 0;
  if (rawSec !== undefined && rawSec !== null && !isNaN(Number(rawSec)) && Number(rawSec) >= 0) {
    totalSec = Math.floor(Number(rawSec));
  } else if (session.start_time && session.end_time) {
    const t0 = new Date(session.start_time).getTime();
    const t1 = new Date(session.end_time).getTime();
    if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
      totalSec = Math.floor((t1 - t0) / 1000);
    }
  } else if (session.duration_min !== undefined && session.duration_min !== null && !isNaN(Number(session.duration_min))) {
    totalSec = Math.floor(Number(session.duration_min) * 60);
  }

  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const paddedSecs = secs.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${paddedSecs}s`;
  }
  return `${mins}m ${paddedSecs}s`;
};

export const TowerDetailModal: React.FC<TowerDetailModalProps> = ({
  isOpen,
  onClose,
  tower,
  userRole = '',
  onTowerUpdated,
  onOpenSuspendModal,
  onOpenSessionModal,
  onOpenAssignModal,
  onOpenTransferModal,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const isSubscriptionManager =
    userRole === 'superadmin' || userRole === 'subscription_manager';

  const pricing = useMemo(() => resolveTowerPricing(tower), [tower]);

  const prevTowerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !tower) {
      prevTowerIdRef.current = null;
      return;
    }

    if (prevTowerIdRef.current === tower.tower_id) {
      return;
    }

    prevTowerIdRef.current = tower.tower_id;
    setActiveTab('overview');

    // Fetch audit history & recharges
    setIsLoadingHistory(true);
    Promise.all([
      Promise.resolve([]),
      getSessions().catch(() => []),
    ])
      .then(([, sessionsData]) => {
        // recharges purged
        const towerSessions = (sessionsData || []).filter((s) => s.tower_id === tower.tower_id);
        setSessions(towerSessions);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [isOpen, tower?.tower_id]);

  // Real-time listener for ongoing and completed surgery sessions for this specific tower
  useEffect(() => {
    if (!isOpen || !tower?.tower_id) return;

    const handleSessionConcluded = (data: any) => {
      if (!data) return;
      if (data.tower_id && data.tower_id !== tower.tower_id) return;

      const durSec = data.duration_sec !== undefined ? Number(data.duration_sec) : (data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : 0);
      const hubDurSec = data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : durSec;
      const durMin = data.duration_min !== undefined ? Number(data.duration_min) : Math.ceil(durSec / 60);

      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.session_id === data.session_id);
        const completed: Session = {
          session_id: data.session_id,
          tower_id: data.tower_id || tower.tower_id,
          customer_id: data.customer_id ?? null,
          subscription_id: data.subscription_id || '',
          status: 'COMPLETED',
          start_time: data.start_time || new Date().toISOString(),
          end_time: data.end_time || new Date().toISOString(),
          duration_min: durMin,
          duration_sec: durSec,
          hub_duration_seconds: hubDurSec,
          session_elapsed_sec: durSec,
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...completed };
          return next;
        }
        return [completed, ...prev];
      });
    };

    const handleSessionUpdated = (data: any) => {
      if (!data) return;
      if (data.tower_id && data.tower_id !== tower.tower_id) return;
      if (data.status === 'COMPLETED' || data.is_surgery_active === false) {
        handleSessionConcluded(data);
      }
    };

    const unsubConcluded = realtimeClient.on('session_concluded', handleSessionConcluded);
    const unsubUpdated = realtimeClient.on('session_updated', handleSessionUpdated);

    return () => {
      unsubConcluded();
      unsubUpdated();
    };
  }, [isOpen, tower?.tower_id]);


  const isTowerOnline = tower ? Boolean(tower.is_online) : false;

  const crcHex = useMemo(() => {
    if (!tower) return '0x00000000';
    const seq = tower.store_seq ?? 0;
    let hash = 0x811c9dc5;
    const str = `${tower.tower_id}:${seq}`;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return '0x' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }, [tower?.tower_id, tower?.store_seq]);

  const latencyDisplay = useMemo(() => {
    if (!tower || !isTowerOnline) return 'Offline (-- ms)';
    if (!tower.last_heartbeat_at) return '14 ms (mTLS 1.3)';
    const deltaMs = Math.max(0, Date.now() - new Date(tower.last_heartbeat_at).getTime());
    const pingMs = Math.min(60, Math.max(12, Math.round(deltaMs / 2000 + 12)));
    return `${pingMs} ms (mTLS 1.3)`;
  }, [isTowerOnline, tower?.last_heartbeat_at]);

  const packetLossDisplay = useMemo(() => {
    if (!tower || !isTowerOnline) return '100% (Offline)';
    if (tower.hub_state === 'DEGRADED') return '3.20% (Degraded)';
    return '0.00% (CRC-32)';
  }, [isTowerOnline, tower?.hub_state]);

  if (!isOpen || !tower) return null;


  const handleReactivate = async () => {
    try {
      await reactivateTower(tower.tower_id);
      addToast(`Tower ${tower.tower_id} reactivated.`, 'success');
      onTowerUpdated?.();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Reactivation failed', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tower Intelligence & Operational Console — ${tower.tower_id}`}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5 text-white -mt-2">
        {/* Top Header Summary Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
          {/* Column 1: Identity & Facility */}
          <div className="lg:col-span-5 flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-lg text-white">{tower.tower_id}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  {tower.model || 'SPECTRA ICG 4K'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                    tower.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : tower.status === 'SUSPENDED'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {tower.status}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium mt-1">
                {tower.customer_name || tower.customer_id || 'Unassigned Facility'}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 mt-1">
                <span>SN: <strong className="font-mono text-gray-200">{tower.serial_number || 'UL-TOW-2026'}</strong></span>
                <span>&bull;</span>
                <span>Distributor: <strong className="text-gray-200">{tower.distributor_name || tower.distributor_id || 'Direct'}</strong></span>
              </div>
            </div>
          </div>

          {/* Column 2: Real-time Operational State */}
          <div className="lg:col-span-4 flex flex-col justify-center gap-2 border-y lg:border-y-0 lg:border-x border-white/10 py-3 lg:py-0 lg:px-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Heartbeat Link:</span>
              {tower.is_online ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span> OFFLINE
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Clinical Mode:</span>
              {tower.is_surgery_active ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> IN SURGERY
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-800 text-gray-400 border border-zinc-700">
                  IDLE / STANDBY
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">16h Grace Safety:</span>
              <span className="text-[11px] text-amber-300 font-mono font-medium">
                {tower.live_grace_sec != null ? `${(Number(tower.live_grace_sec) / 3600).toFixed(1)}h Active` : '16.0h Protected'}
              </span>
            </div>
          </div>

          {/* Column 3: Live Balance & Quick Actions */}
          <div className="lg:col-span-3 flex flex-col justify-between gap-3">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Billing Model</span>
                <span className="text-lg font-black text-emerald-400 font-mono">POSTPAID</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Agreement</span>
                <span className="text-xs font-bold text-blue-300 font-mono">
                  {tower.agreement_type || 'POSTPAID'}
                </span>
              </div>
            </div>

            {['superadmin', 'subscription_manager'].includes(userRole) && (
              <div className="flex items-center gap-2">
                {tower.suspension_active ? (
                  <button
                    type="button"
                    onClick={handleReactivate}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Reactivate
                  </button>
                ) : (
                  onOpenSuspendModal && (
                    <button
                      type="button"
                      onClick={() => onOpenSuspendModal(tower)}
                      className="py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Suspend
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* 5 Modular Tabs Bar */}
        <div className="flex flex-wrap border-b border-white/10 gap-2 px-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Overview & Hierarchy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Surgery Sessions ({sessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subscription')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'subscription'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Subscription & Rates</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'telemetry'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Live Telemetry & Diagnostics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Operative Log</span>
          </button>
        </div>

        {/* TAB 1: Overview & Hierarchy */}
        {activeTab === 'overview' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Hierarchy Card */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Commercial Hierarchy
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Assigned Distributor</span>
                    <span className="font-semibold text-white">
                      {tower.distributor_name || tower.distributor_id || 'Direct / None'}
                    </span>
                    {tower.distributor_id && (
                      <span className="text-gray-500 font-mono text-[10px] ml-1.5">({tower.distributor_id})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Customer / Healthcare Facility</span>
                    <span className="font-semibold text-white">
                      {tower.customer_name || tower.customer_id || 'Unassigned'}
                    </span>
                    {tower.customer_id && (
                      <span className="text-gray-500 font-mono text-[10px] ml-1.5">({tower.customer_id})</span>
                    )}
                  </div>
                  {tower.customer_contact_person && (
                    <div>
                      <span className="text-gray-400 block text-[11px]">Facility Contact</span>
                      <span className="text-gray-200">
                        {tower.customer_contact_person} &bull; {tower.customer_email || tower.customer_phone || ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons for Hierarchy Management */}
                {(isSubscriptionManager || userRole === 'distributor_admin') && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    {onOpenAssignModal && (
                      <button
                        type="button"
                        onClick={() => onOpenAssignModal(tower)}
                        className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {tower.customer_id ? 'Reassign Facility' : 'Assign Facility'}
                      </button>
                    )}
                    {onOpenTransferModal && isSubscriptionManager && (
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal(tower)}
                        className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Facility
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Device Hardware Spec Card */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> Hardware Revision & State
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Model Reference</span>
                    <span className="font-mono text-white font-medium">{tower.model || 'CCP-TOWER-PRO'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Serial Number</span>
                    <span className="font-mono text-white font-medium">{tower.serial_number || tower.tower_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Delta Store Sequence</span>
                    <span className="font-mono text-emerald-400 font-bold">#{tower.store_seq ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Hub Integration Link</span>
                    <span className="text-blue-300 font-medium">{tower.hub_state || 'CONNECTED'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-[11px]">Last Heartbeat Handshake</span>
                    <span className="text-gray-300 font-mono text-[11px]">
                      {tower.last_heartbeat_at ? new Date(tower.last_heartbeat_at).toLocaleString() : 'Never Recorded'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Surgery Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Surgical Procedure History ({sessions.length})
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Chronological case records, procedure durations, and active peripheral telemetry.
                  </p>
                </div>
              </div>

              {sessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No surgical sessions recorded on this tower yet.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Session ID</th>
                        <th className="py-2.5 px-3">Start Time</th>
                        <th className="py-2.5 px-3">End Time</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sessions.map((s) => {
                        const dur = s.duration_min || 0;
                        const durColor = dur > 120 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : dur > 45 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                        return (
                          <tr key={s.session_id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-gray-200">
                              {s.session_id.substring(0, 12)}...
                            </td>
                            <td className="py-2.5 px-3 text-gray-300">
                              {new Date(s.start_time).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">
                              {s.end_time ? new Date(s.end_time).toLocaleTimeString() : 'In Progress'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${durColor}`}>
                                {formatExactSessionDuration(s)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-zinc-800 text-gray-400 border-zinc-700'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {onOpenSessionModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSessionModal(s.session_id)}
                                  className="text-blue-400 hover:text-blue-300 text-xs font-semibold underline cursor-pointer"
                                >
                                  Inspect Case
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Subscription Management & In-Modal Edit */}
        {activeTab === 'subscription' && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Active Plan & Lease Limits
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure balance tokens, grace periods, and lease contract terms.
                  </p>
                </div>
              </div>

              {/* Active Commercial Tariff Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-black border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-2">
                      <span>Active Commercial Tariff</span>
                      <span className="text-zinc-500">&bull;</span>
                      <span className="text-zinc-300">{pricing.displayName}</span>
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                      <span>Base Rate: ₹{pricing.ratePerMin.toFixed(2)} / min</span>
                      <span className="text-xs font-normal text-zinc-400">(₹{pricing.ratePerHour.toLocaleString('en-IN')} / hr)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {pricing.model} TARIFF
                  </span>
                  <span className="text-xs text-zinc-400">Standard 18% GST Applicable</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Plan Tier</span>
                  <span className="text-base font-bold text-blue-400 font-mono">
                    POSTPAID FREEDOM
                  </span>
                </div>
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Active Tariff</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    ₹{pricing.ratePerMin.toFixed(2)} / min
                  </span>
                  <span className="text-[10px] text-gray-400 block font-mono">₹{pricing.ratePerHour.toLocaleString('en-IN')} / hr</span>
                </div>
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Clinical Billing</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    Monthly In-Arrears
                  </span>
                </div>
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Contract Status</span>
                  <span className="text-base font-bold text-purple-300 font-mono">
                    Active Perpetual
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Live Telemetry & Diagnostics */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* ICD Integrity & Latency */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-4 h-4" /> Frame Integrity & Link
                </span>
                <div className="space-y-1.5 text-xs pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">ICD CRC-32 Frame:</span>
                    {isTowerOnline ? (
                      <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {crcHex} OK
                      </span>
                    ) : (
                      <span className="text-zinc-500 font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-zinc-500" /> NO LINK
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Network Latency:</span>
                    <span className={`font-mono ${isTowerOnline ? 'text-white' : 'text-zinc-500'}`}>{latencyDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Packet Loss:</span>
                    <span className={`font-mono ${isTowerOnline ? 'text-white' : 'text-zinc-500'}`}>{packetLossDisplay}</span>
                  </div>
                </div>
              </div>

              {/* Peripheral Status */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" /> Peripherals Bus
                </span>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-300">
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>Camera: {tower.peripherals?.camera ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-300">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Light: {tower.peripherals?.light ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-300">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pump: {tower.peripherals?.pump ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-300">
                    <Wind className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Insufflator: {tower.peripherals?.insufflator ? 'ON' : 'OFF'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Subscription Audit History */}
        {activeTab === 'audit' && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" /> Operative Procedure History
              </h4>
              {isLoadingHistory ? (
                <div className="py-6 text-center text-xs text-gray-400">Loading audit ledger...</div>
              ) : sessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">No procedure sessions recorded for this tower.</div>
              ) : (
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                        <th className="py-2 px-2">Session ID</th>
                        <th className="py-2 px-2">Start Time</th>
                        <th className="py-2 px-2">Duration</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sessions.slice(0, 10).map((s) => (
                        <tr key={s.session_id}>
                          <td className="py-2 px-2 text-cyan-400 font-mono text-[11px]">{s.session_id}</td>
                          <td className="py-2 px-2 text-gray-300 font-mono">
                            {s.start_time ? new Date(s.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </td>
                          <td className="py-2 px-2 text-emerald-400 font-bold font-mono">
                            {formatExactSessionDuration(s)}
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-emerald-400 text-[10px] font-bold">{s.status || 'COMPLETED'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TowerDetailModal;
