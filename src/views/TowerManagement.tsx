import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Modal from '../components/ui/Modal';
import BalanceGauge from '../components/ui/BalanceGauge';
import SessionDetailModal from '../components/ui/SessionDetailModal';
import QuickAssignModal from '../components/QuickAssignModal';
import RequestRechargeModal from '../components/RequestRechargeModal';
import RequestPlanChangeModal from '../components/RequestPlanChangeModal';
import { DirectRechargeModal } from '../components/DirectRechargeModal';
import TowerDetailModal from '../components/TowerDetailModal';
import EntitySelector from '../components/EntitySelector';
import { 
  getTowers, 
  getSubscriptions, 
  getCustomers, 
  assignPlan, 
  unassignTower,
  assignLease,
  suspendTower,
  updateTowerCustomer
} from '../services/api';
import type { Tower, Subscription, Customer, AssignPlanPayload } from '../services/api';
import { realtimeClient } from '../services/realtime';
import { Building, Radio, RotateCcw, Search, Cpu } from 'lucide-react';

const formatHMS = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};


const formatUsageHM = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds <= 0) return '0h 0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatUsagePill = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds <= 0) return '0h';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h`;
};

const getTimeMs = (dateStr?: string | null): number => {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
};



const getDeploymentBadge = (hasDist: boolean, hasCust: boolean) => {
  if (hasDist && hasCust) {
    return {
      label: 'Hospital via Distributor',
      style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    };
  }
  if (hasDist && !hasCust) {
    return {
      label: 'Distributor Stock',
      style: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
  }
  if (!hasDist && hasCust) {
    return {
      label: 'Hospital Deployed',
      style: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };
  }
  return {
    label: 'Unassigned Inventory (In-House Testing)',
    style: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };
};

const TowerManagement: React.FC = () => {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [, setTick] = useState(0);

  const hasActiveSurgeries = useMemo(() => {
    return towers.some(t => Boolean(t.is_online && t.is_surgery_active));
  }, [towers]);

  useEffect(() => {
    if (!hasActiveSurgeries) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [hasActiveSurgeries]);

  const [gaugeModeMap, setGaugeModeMap] = useState<Record<string, 'CUSTOMER' | 'LIFETIME'>>({});
  const monotonicClocksRef = useRef<Map<string, { lastServerSec: number | null; lastSec: number; localMs: number }>>(new Map());

  const getMonotonicElapsedSec = useCallback((tower: Tower): number => {
    if (!tower.is_surgery_active || !tower.is_online) {
      monotonicClocksRef.current.delete(tower.tower_id);
      return 0;
    }
    const serverSec = tower.session_elapsed_sec ?? tower.elapsed_sec;
    const now = Date.now();
    const entry = monotonicClocksRef.current.get(tower.tower_id);
    let validServerSec = (serverSec !== undefined && serverSec !== null && !isNaN(Number(serverSec)) && Number(serverSec) >= 0) ? Number(serverSec) : null;

    if (validServerSec === null && tower.session_start_time) {
      const startMs = new Date(tower.session_start_time).getTime();
      if (!isNaN(startMs) && startMs > 0 && startMs <= now) {
        validServerSec = Math.max(0, Math.floor((now - startMs) / 1000));
      }
    }

    if (entry) {
      if (validServerSec !== null && validServerSec !== entry.lastServerSec) {
        entry.lastServerSec = validServerSec;
        entry.lastSec = Math.max(entry.lastSec, validServerSec);
        entry.localMs = now;
        return entry.lastSec;
      }
      return entry.lastSec + Math.max(0, Math.floor((now - entry.localMs) / 1000));
    } else {
      const init = validServerSec ?? 0;
      monotonicClocksRef.current.set(tower.tower_id, { lastServerSec: validServerSec, lastSec: init, localMs: now });
      return init;
    }
  }, []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterDistributorId, setFilterDistributorId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  

  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);

  // Assignment states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetCustomerId, setAssignTargetCustomerId] = useState('');
  const [assignTargetDistributorId, setAssignTargetDistributorId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Unassign confirmation
  const [isUnassignConfirmOpen, setIsUnassignConfirmOpen] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  // Reassign customer states
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTowerId, setReassignTowerId] = useState('');
  const [reassignCustomerId, setReassignCustomerId] = useState('');
  const [reassignDistributorId, setReassignDistributorId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState('');

  // Quick Assign states
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [quickAssignTargetTower, setQuickAssignTargetTower] = useState<Tower | null>(null);

  // Lease states
  const [isLeaseModalOpen, setIsLeaseModalOpen] = useState(false);
  const [leaseYears, setLeaseYears] = useState(0);
  const [leaseMonths, setLeaseMonths] = useState(0);
  const [leaseDays, setLeaseDays] = useState(0);
  const [isAssigningLease, setIsAssigningLease] = useState(false);
  const [leaseError, setLeaseError] = useState('');

  // Suspension states
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);
  const [suspendError, setSuspendError] = useState('');

  // Session modal states
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Recharge states
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);

  // Top-Up & Plan Change Request states
  const [isRequestRechargeOpen, setIsRequestRechargeOpen] = useState(false);
  const [requestRechargeTower, setRequestRechargeTower] = useState<{ tower_id: string; live_balance_sec?: number | null; status?: string } | null>(null);

  const [isRequestPlanChangeOpen, setIsRequestPlanChangeOpen] = useState(false);
  const [requestPlanChangeTower, setRequestPlanChangeTower] = useState<{ tower_id: string; agreement_type?: string | null } | null>(null);

  // User RBAC permissions
  const currentUser = JSON.parse(localStorage.getItem('portal_user') || '{}');
  const userRole = currentUser.role || '';
  const isFieldSupport = userRole === 'field_support';
  const isHospitalAdmin = userRole === 'hospital_admin';
  const isDistributorAdmin = userRole === 'distributor_admin';
  const isAuditor = userRole === 'auditor';
  const isSuperAdminOrManager = userRole === 'superadmin' || userRole === 'subscription_manager';
  // Plan modification and recharge restricted to Super Admin & Subscription Manager
  const canModifyPlans = isSuperAdminOrManager && !isFieldSupport && !isHospitalAdmin && !isAuditor;
  const canSuspendReactivate = ['superadmin', 'subscription_manager'].includes(userRole);

  const wasDisconnectedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [towersRes, subsRes, customersRes] = await Promise.allSettled([
        getTowers(),
        getSubscriptions(),
        isHospitalAdmin ? Promise.resolve([]) : getCustomers()
      ]);
      if (towersRes.status === 'fulfilled') setTowers(towersRes.value);
      else console.error("Error fetching towers", towersRes.reason);

      if (subsRes.status === 'fulfilled') setSubscriptions(subsRes.value);
      else console.error("Error fetching subscriptions", subsRes.reason);

      if (customersRes.status === 'fulfilled') setCustomers(customersRes.value);
      else console.error("Error fetching customers", customersRes.reason);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  }, [isHospitalAdmin]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time telemetry updates
    const handleTelemetry = (data: any) => {
      if (!data?.tower_id) return;
      const nextOnline = data.is_online !== undefined ? Boolean(data.is_online) : true;
      const nextSurgeryActive = nextOnline ? (data.surgery_active !== undefined ? Boolean(data.surgery_active) : (data.is_surgery_active !== undefined ? Boolean(data.is_surgery_active) : undefined)) : false;

      if (nextSurgeryActive === false) {
        monotonicClocksRef.current.delete(data.tower_id);
      }

      setTowers(prev => prev.filter(t => {
        if (t.tower_id === data.tower_id) {
          if (isHospitalAdmin && (data.status === 'UNASSIGNED' || (data.customer_id && data.customer_id !== currentUser.customer_id))) {
            return false;
          }
          if (isDistributorAdmin && (data.status === 'UNASSIGNED' || (data.customer_id && data.customer_id !== currentUser.customer_id && data.distributor_id !== currentUser.customer_id))) {
            return false;
          }
        }
        return true;
      }).map(t => {
        if (t.tower_id === data.tower_id) {
          const resolvedSurgery = nextSurgeryActive !== undefined ? nextSurgeryActive : (nextOnline ? t.is_surgery_active : false);
          return {
            ...t,
            is_online: nextOnline,
            last_heartbeat_at: data.last_heartbeat_at || t.last_heartbeat_at || (nextOnline ? new Date().toISOString() : null),
            live_balance_sec: data.balance_sec !== undefined ? data.balance_sec : (data.live_balance_sec !== undefined ? data.live_balance_sec : t.live_balance_sec),
            live_grace_sec: data.grace_sec !== undefined ? data.grace_sec : (data.live_grace_sec !== undefined ? data.live_grace_sec : t.live_grace_sec),
            is_surgery_active: resolvedSurgery,
            session_elapsed_sec: resolvedSurgery ? (data.session_elapsed_sec !== undefined ? data.session_elapsed_sec : (data.elapsed_sec !== undefined ? data.elapsed_sec : t.session_elapsed_sec)) : 0,
            session_start_time: resolvedSurgery ? (data.session_start_time || t.session_start_time) : null,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : t.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : t.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : t.lifetime_surgery_seconds),
            running_hours: data.running_hours !== undefined ? data.running_hours : t.running_hours,
            die_temp_c: data.die_temp_c !== undefined ? data.die_temp_c : t.die_temp_c,
            peripherals: data.peripherals !== undefined ? data.peripherals : t.peripherals,
            store_seq: data.store_seq !== undefined ? data.store_seq : t.store_seq,
            hub_connected: data.hub_connected !== undefined ? data.hub_connected : (t as any).hub_connected,
            hub_state: data.hub_state !== undefined ? data.hub_state : t.hub_state,
            status: data.subscription_active ? (t.status === 'UNASSIGNED' ? 'ACTIVE' : t.status) : t.status,
          };
        }
        return t;
      }));

      setSelectedTower(prev => {
        if (prev && prev.tower_id === data.tower_id) {
          const resolvedSurgery = nextSurgeryActive !== undefined ? nextSurgeryActive : (nextOnline ? prev.is_surgery_active : false);
          return {
            ...prev,
            is_online: nextOnline,
            last_heartbeat_at: data.last_heartbeat_at || prev.last_heartbeat_at || (nextOnline ? new Date().toISOString() : null),
            live_balance_sec: data.balance_sec !== undefined ? data.balance_sec : (data.live_balance_sec !== undefined ? data.live_balance_sec : prev.live_balance_sec),
            live_grace_sec: data.grace_sec !== undefined ? data.grace_sec : (data.live_grace_sec !== undefined ? data.live_grace_sec : prev.live_grace_sec),
            is_surgery_active: resolvedSurgery,
            session_elapsed_sec: resolvedSurgery ? (data.session_elapsed_sec !== undefined ? data.session_elapsed_sec : (data.elapsed_sec !== undefined ? data.elapsed_sec : prev.session_elapsed_sec)) : 0,
            session_start_time: resolvedSurgery ? (data.session_start_time || prev.session_start_time) : null,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : prev.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : prev.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : prev.lifetime_surgery_seconds),
            running_hours: data.running_hours !== undefined ? data.running_hours : prev.running_hours,
            die_temp_c: data.die_temp_c !== undefined ? data.die_temp_c : prev.die_temp_c,
            peripherals: data.peripherals !== undefined ? data.peripherals : prev.peripherals,
            store_seq: data.store_seq !== undefined ? data.store_seq : prev.store_seq,
            hub_connected: data.hub_connected !== undefined ? data.hub_connected : (prev as any).hub_connected,
            hub_state: data.hub_state !== undefined ? data.hub_state : prev.hub_state,
            status: data.subscription_active ? (prev.status === 'UNASSIGNED' ? 'ACTIVE' : prev.status) : prev.status,
          };
        }
        return prev;
      });
    };

    const unsubTelemetry = realtimeClient.on('telemetry', handleTelemetry);
    const unsubTelemetryTick = realtimeClient.on('telemetry_tick', handleTelemetry);

    // Subscribe to real-time status transitions
    const unsubStatus = realtimeClient.on('tower_status', (data: any) => {
      if (!data?.tower_id) return;
      const nextOnline = data.is_online !== undefined ? Boolean(data.is_online) : undefined;
      const isSurgery = nextOnline !== false ? (data.is_surgery_active !== undefined ? Boolean(data.is_surgery_active) : undefined) : false;
      if (isSurgery === false) {
        monotonicClocksRef.current.delete(data.tower_id);
      }

      setTowers(prev => prev.map(t => {
        if (t.tower_id === data.tower_id) {
          const resolvedOnline = nextOnline !== undefined ? nextOnline : t.is_online;
          const resolvedSurgery = isSurgery !== undefined ? isSurgery : (resolvedOnline ? t.is_surgery_active : false);
          return {
            ...t,
            status: data.status || t.status,
            customer_id: data.customer_id !== undefined ? data.customer_id : t.customer_id,
            agreement_type: data.plan_type || data.agreement_type || t.agreement_type,
            is_online: resolvedOnline,
            is_surgery_active: resolvedSurgery,
            session_elapsed_sec: resolvedSurgery ? t.session_elapsed_sec : 0,
            session_start_time: resolvedSurgery ? t.session_start_time : null,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : t.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : t.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : t.lifetime_surgery_seconds),
            hub_state: data.hub_state !== undefined ? data.hub_state : t.hub_state,
          };
        }
        return t;
      }));

      setSelectedTower(prev => {
        if (prev && prev.tower_id === data.tower_id) {
          const resolvedOnline = nextOnline !== undefined ? nextOnline : prev.is_online;
          const resolvedSurgery = isSurgery !== undefined ? isSurgery : (resolvedOnline ? prev.is_surgery_active : false);
          return {
            ...prev,
            status: data.status || prev.status,
            customer_id: data.customer_id !== undefined ? data.customer_id : prev.customer_id,
            agreement_type: data.plan_type || data.agreement_type || prev.agreement_type,
            is_online: resolvedOnline,
            is_surgery_active: resolvedSurgery,
            session_elapsed_sec: resolvedSurgery ? prev.session_elapsed_sec : 0,
            session_start_time: resolvedSurgery ? prev.session_start_time : null,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : prev.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : prev.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : prev.lifetime_surgery_seconds),
            hub_state: data.hub_state !== undefined ? data.hub_state : prev.hub_state,
          };
        }
        return prev;
      });
    });

    // Subscribe to real-time session lifecycle transitions
    const unsubSessionUpdated = realtimeClient.on('session_updated', (data: any) => {
      if (!data?.tower_id) return;
      const isSurgeryActive = data.is_surgery_active !== undefined
        ? Boolean(data.is_surgery_active)
        : (data.status === 'ACTIVE' || data.status === 'RUNNING');

      if (!isSurgeryActive) {
        monotonicClocksRef.current.delete(data.tower_id);
      }

      setTowers(prev => prev.map(t => {
        if (t.tower_id === data.tower_id) {
          return {
            ...t,
            is_surgery_active: isSurgeryActive,
            session_start_time: isSurgeryActive ? (data.start_time || t.session_start_time) : null,
            session_elapsed_sec: isSurgeryActive ? (data.session_elapsed_sec !== undefined ? data.session_elapsed_sec : t.session_elapsed_sec) : 0,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : t.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : t.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : t.lifetime_surgery_seconds),
            live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : t.live_balance_sec,
          };
        }
        return t;
      }));

      setSelectedTower(prev => {
        if (prev && prev.tower_id === data.tower_id) {
          return {
            ...prev,
            is_surgery_active: isSurgeryActive,
            session_start_time: isSurgeryActive ? (data.start_time || prev.session_start_time) : null,
            session_elapsed_sec: isSurgeryActive ? (data.session_elapsed_sec !== undefined ? data.session_elapsed_sec : prev.session_elapsed_sec) : 0,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : prev.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : prev.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : prev.lifetime_surgery_seconds),
            live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : prev.live_balance_sec,
          };
        }
        return prev;
      });
    });

    // Subscribe to session concluded events to immediately silence timer and record final usage
    const unsubSessionConcluded = realtimeClient.on('session_concluded', (data: any) => {
      if (!data?.tower_id) return;
      monotonicClocksRef.current.delete(data.tower_id);

      setTowers(prev => prev.map(t => {
        if (t.tower_id === data.tower_id) {
          return {
            ...t,
            is_surgery_active: false,
            session_start_time: null,
            session_elapsed_sec: 0,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : t.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : t.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : t.lifetime_surgery_seconds),
            live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : t.live_balance_sec,
          };
        }
        return t;
      }));

      setSelectedTower(prev => {
        if (prev && prev.tower_id === data.tower_id) {
          return {
            ...prev,
            is_surgery_active: false,
            session_start_time: null,
            session_elapsed_sec: 0,
            customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : prev.customer_usage_seconds,
            total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : prev.total_usage_seconds),
            lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : prev.lifetime_surgery_seconds),
            live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : prev.live_balance_sec,
          };
        }
        return prev;
      });
    });

    // Subscribe to connection status to re-sync fleet state upon reconnect
    const unsubConnection = realtimeClient.on('connection_status', (data: any) => {
      const connected = Boolean(data?.connected);
      if (connected) {
        if (wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          fetchData();
        }
      } else {
        wasDisconnectedRef.current = true;
      }
    });

    return () => {
      unsubTelemetry();
      unsubTelemetryTick();
      unsubStatus();
      unsubSessionUpdated();
      unsubSessionConcluded();
      unsubConnection();
    };
  }, [fetchData]);


  const handleAssignPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTower) return;
    if (!assignTargetCustomerId && !assignTargetDistributorId) {
      setAssignError('Please select a customer or distributor.');
      return;
    }

    setIsAssigning(true);
    setAssignError('');
    try {
      const payload: AssignPlanPayload = {
        customer_id: assignTargetCustomerId || null,
        distributor_id: assignTargetDistributorId || null,
        plan_type: 'POSTPAID',
      };

      const updated = await assignPlan(selectedTower.tower_id, payload);
      setIsAssignModalOpen(false);
      setSelectedTower(updated);
      await fetchData();
    } catch (err: any) {
      setAssignError(err.response?.data?.detail || 'Failed to assign plan');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleExecuteUnassign = async () => {
    if (!selectedTower) return;
    setIsUnassigning(true);
    try {
      const updated = await unassignTower(selectedTower.tower_id);
      setIsUnassignConfirmOpen(false);
      setIsAssignModalOpen(false);
      setSelectedTower(updated);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to unassign tower');
    } finally {
      setIsUnassigning(false);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTowerId) return;
    setIsReassigning(true);
    setReassignError('');
    try {
      await updateTowerCustomer(reassignTowerId, {
        customer_id: reassignCustomerId || null,
        distributor_id: reassignDistributorId || null,
      });
      setIsReassignModalOpen(false);
      await fetchData();
      if (selectedTower?.tower_id === reassignTowerId) {
        setSelectedTower(prev => prev ? { 
          ...prev, 
          customer_id: reassignCustomerId || null,
          distributor_id: reassignDistributorId || undefined
        } : null);
      }
    } catch (err: any) {
      setReassignError(err.response?.data?.detail || err.message || 'Failed to reassign tower');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleAssignLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTower) return;
    if (leaseYears === 0 && leaseMonths === 0 && leaseDays === 0) {
      setLeaseError('Duration must be greater than zero');
      return;
    }
    
    setIsAssigningLease(true);
    setLeaseError('');
    try {
      await assignLease(selectedTower.tower_id, leaseYears, leaseMonths, leaseDays);
      setIsLeaseModalOpen(false);
      setLeaseYears(0);
      setLeaseMonths(0);
      setLeaseDays(0);
      await fetchData();
    } catch (err: any) {
      setLeaseError(err.response?.data?.detail || 'Failed to assign lease');
    } finally {
      setIsAssigningLease(false);
    }
  };

  const handleSuspendTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTower) return;
    if (!suspendReason.trim()) {
      setSuspendError('A reason is required');
      return;
    }

    setIsSuspending(true);
    setSuspendError('');
    try {
      await suspendTower(selectedTower.tower_id, suspendReason.trim());
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      await fetchData();
      setSelectedTower(prev => prev ? { ...prev, suspension_active: true, suspension_reason: suspendReason.trim() } : null);
    } catch (err: any) {
      setSuspendError(err.response?.data?.detail || 'Failed to suspend tower');
    } finally {
      setIsSuspending(false);
    }
  };

  const getTowerSubscription = (towerId: string) => {
    return subscriptions.find(s => s.tower_id === towerId && s.status === 'ACTIVE');
  };

  const filteredTowers = towers
    .filter(tower => {
      if (isHospitalAdmin && tower.customer_id !== currentUser.customer_id) return false;
      if (isDistributorAdmin && tower.distributor_id !== currentUser.customer_id && tower.customer_id !== currentUser.customer_id) return false;
      if (filterDistributorId && tower.distributor_id !== filterDistributorId) return false;
      if (filterCustomerId && tower.customer_id !== filterCustomerId) return false;

      const matchesSearch = tower.tower_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (tower.customer_id || '').toLowerCase().includes(searchQuery.toLowerCase());

      const isOnline = Boolean(tower.is_online);
      const isSurgeryActive = Boolean(isOnline && tower.is_surgery_active);

      let matchesStatus = true;
      switch (statusFilter) {
        case 'ALL':
          matchesStatus = true;
          break;
        case 'ONLINE':
          matchesStatus = isOnline;
          break;
        case 'ONLINE_SURGERY':
          matchesStatus = isOnline && isSurgeryActive;
          break;
        case 'ONLINE_IDLE':
          matchesStatus = isOnline && !isSurgeryActive;
          break;
        case 'OFFLINE':
          matchesStatus = !isOnline;
          break;
        case 'HUB_DISCONNECTED':
          matchesStatus = tower.hub_state === 'DISCONNECTED' || tower.status === 'HUB_DISCONNECTED';
          break;
        case 'ACTIVE':
          matchesStatus = (tower.status === 'ACTIVE' || tower.status === 'ASSIGNED_ACTIVE') && !tower.suspension_active;
          break;
        case 'UNASSIGNED':
          matchesStatus = tower.status === 'UNASSIGNED';
          break;
        case 'ASSIGNED_INACTIVE':
          matchesStatus = tower.status === 'ASSIGNED_INACTIVE';
          break;
        case 'BLOCKED':
          matchesStatus = tower.status === 'BLOCKED' || Boolean(tower.suspension_active);
          break;
        case 'DECOMMISSIONED':
          matchesStatus = tower.status === 'DECOMMISSIONED';
          break;
        default:
          matchesStatus = tower.status === statusFilter;
          break;
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const isOnlineA = Boolean(a.is_online);
      const isSurgeryA = Boolean(isOnlineA && a.is_surgery_active);
      const tierA = isSurgeryA ? 1 : (isOnlineA ? 2 : 3);

      const isOnlineB = Boolean(b.is_online);
      const isSurgeryB = Boolean(isOnlineB && b.is_surgery_active);
      const tierB = isSurgeryB ? 1 : (isOnlineB ? 2 : 3);

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      const timeA = getTimeMs(a.last_heartbeat_at) || getTimeMs(a.last_seen) || getTimeMs(a.registered_at);
      const timeB = getTimeMs(b.last_heartbeat_at) || getTimeMs(b.last_seen) || getTimeMs(b.registered_at);
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      return a.tower_id.localeCompare(b.tower_id);
    });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ASSIGNED_ACTIVE':
      case 'ACTIVE': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'UNASSIGNED': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'ASSIGNED_INACTIVE': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      case 'BLOCKED': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'DECOMMISSIONED': return 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60';
      case 'HUB_DISCONNECTED': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default: return 'bg-white/10 text-white border-white/20';
    }
  };

  const getStatusBadge = (tower: Tower, isOnline: boolean, isHospAdmin: boolean = false) => {
    const isSurgery = Boolean(isOnline && tower.is_surgery_active);
    const isUnassigned = tower.status === 'UNASSIGNED' || !tower.customer_id;

    if (isUnassigned) {
      if (isOnline) {
        if (isSurgery) {
          return {
            label: 'ONLINE (IN-HOUSE SURGERY)',
            style: 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-pulse',
            dot: (
              <span className="relative flex h-2 w-2" title="In-House Surgery Active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
              </span>
            )
          };
        }
        if ((tower.hub_state === 'DISCONNECTED' || tower.status === 'HUB_DISCONNECTED') && !isSurgery) {
          return {
            label: 'HUB DISCONNECTED',
            style: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
            dot: (
              <span className="relative flex h-2 w-2" title="Hub Disconnected">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
              </span>
            )
          };
        }
        return {
          label: 'ONLINE (UNASSIGNED)',
          style: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
          dot: (
            <span className="relative flex h-2 w-2" title="Online (Unassigned)">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]"></span>
            </span>
          )
        };
      }
      return {
        label: 'OFFLINE (UNASSIGNED)',
        style: 'bg-zinc-800/80 text-zinc-400 border-zinc-700',
        dot: <span className="w-2 h-2 rounded-full bg-zinc-500" title="Offline (Unassigned)"></span>
      };
    }

    if (isOnline) {
      if (isSurgery) {
        return {
          label: isHospAdmin ? 'In Surgery' : 'ONLINE (SURGERY ACTIVE)',
          style: 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-pulse',
          dot: (
            <span className="relative flex h-2 w-2" title={isHospAdmin ? 'In Surgery' : 'Surgery Active'}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
            </span>
          )
        };
      }
      if ((tower.hub_state === 'DISCONNECTED' || tower.status === 'HUB_DISCONNECTED') && !isSurgery) {
        return {
          label: isHospAdmin ? 'Hub Disconnected' : 'HUB DISCONNECTED',
          style: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
          dot: (
            <span className="relative flex h-2 w-2" title="Hub Disconnected">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
            </span>
          )
        };
      }
      if (tower.hub_state === 'SCANNING') {
        return {
          label: isHospAdmin ? 'Hub Connecting' : 'HUB CONNECTING',
          style: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
          dot: (
            <span className="relative flex h-2 w-2" title="Hub Connecting">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]"></span>
            </span>
          )
        };
      }
      if (tower.hub_state === 'DEGRADED') {
        return {
          label: isHospAdmin ? 'Hub Degraded' : 'HUB DEGRADED',
          style: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
          dot: <span className="w-2 h-2 rounded-full bg-amber-500" title="Hub Degraded"></span>
        };
      }
      return {
        label: isHospAdmin ? 'Idle' : 'ONLINE (IDLE)',
        style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
        dot: (
          <span className="relative flex h-2 w-2" title={isHospAdmin ? 'Idle' : 'Online (Idle)'}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]"></span>
          </span>
        )
      };
    }

    if (tower.status === 'HUB_DISCONNECTED') {
      return {
        label: isHospAdmin ? 'Hub Disconnected' : 'HUB DISCONNECTED',
        style: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
        dot: (
          <span className="relative flex h-2 w-2" title="Hub Disconnected">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]"></span>
          </span>
        )
      };
    }

    return {
      label: isHospAdmin ? 'Offline' : 'OFFLINE',
      style: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60',
      dot: <span className="w-2 h-2 rounded-full bg-zinc-500" title="Offline"></span>
    };
  };

  const unassignedTowers = towers.filter(t => t.status === 'UNASSIGNED' || (!t.customer_id && !t.distributor_id));

  return (
    <div className="relative -m-6 lg:-m-8 p-6 lg:p-8 min-h-full flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden">
      {/* Ambient Cockpit Radial Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-80" />

      {/* Page Header */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Tower Fleet Management</h1>
          <p className="text-sm text-zinc-400 mt-1">Lifecycle, plan provisioning, and live thermal telemetry for surgical endoscope towers.</p>
        </div>
        <div className="flex items-center gap-3">
        </div>
      </div>

      {/* Discovered / Unassigned Towers Alert Banner */}
      {unassignedTowers.length > 0 && isSuperAdminOrManager && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xl flex-shrink-0">
              ⚡
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡ {unassignedTowers.length} New Tower{unassignedTowers.length > 1 ? 's' : ''} Discovered via Zero-Touch Enrollment</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Unassigned
                </span>
              </h4>
              <p className="text-xs text-zinc-300 mt-1">
                Discovered: <span className="font-mono text-amber-300 font-semibold">{unassignedTowers.map(t => t.tower_id).slice(0, 4).join(', ')}{unassignedTowers.length > 4 ? ` (+${unassignedTowers.length - 4} more)` : ''}</span> — ready for tenant binding & plan provisioning.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickAssignTargetTower(unassignedTowers[0] || null);
              setIsQuickAssignOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-black px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 flex-shrink-0"
          >
            <span>⚡</span>
            <span>Quick Assign & Activate</span>
          </button>
        </div>
      )}

      {/* Controls & Filter Toolbar */}
      <div className="relative z-10 space-y-3 mb-6 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl shadow-lg">
        <EntitySelector
          selectedDistributorId={filterDistributorId}
          selectedCustomerId={filterCustomerId}
          showTower={false}
          showDistributor={!isHospitalAdmin}
          disabledCustomer={isHospitalAdmin}
          onDistributorChange={(id) => setFilterDistributorId(id)}
          onCustomerChange={(id) => setFilterCustomerId(id)}
          onChange={({ distributorId: did, customerId: cid }) => {
            setFilterDistributorId(did);
            setFilterCustomerId(cid);
          }}
          size="sm"
        />

        <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-zinc-800/80">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search by Tower ID, Serial, Model..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-zinc-100 placeholder-zinc-500 rounded-xl pl-10 pr-4 py-2.5 transition-colors text-sm"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 text-zinc-100 border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl px-4 py-2.5 transition-colors text-sm"
          >
            <option value="ALL" className="bg-zinc-900 text-zinc-100">All Towers</option>
            <option value="ONLINE" className="bg-zinc-900 text-zinc-100">Online (All)</option>
            <option value="ONLINE_SURGERY" className="bg-zinc-900 text-zinc-100">Online (Surgery Active)</option>
            <option value="ONLINE_IDLE" className="bg-zinc-900 text-zinc-100">Online (Idle)</option>
            <option value="HUB_DISCONNECTED" className="bg-zinc-900 text-zinc-100">Hub Disconnected</option>
            <option value="OFFLINE" className="bg-zinc-900 text-zinc-100">Offline</option>
            <option value="ACTIVE" className="bg-zinc-900 text-zinc-100">Active (Assigned)</option>
            <option value="UNASSIGNED" className="bg-zinc-900 text-zinc-100">Unassigned</option>
            <option value="ASSIGNED_INACTIVE" className="bg-zinc-900 text-zinc-100">Assigned Inactive</option>
            <option value="BLOCKED" className="bg-zinc-900 text-zinc-100">Blocked / Suspended</option>
            <option value="DECOMMISSIONED" className="bg-zinc-900 text-zinc-100">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Tower Fleet Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 overflow-y-auto pb-6">
        {filteredTowers.map(tower => {
          const sub = getTowerSubscription(tower.tower_id);
          
          const isOnline = Boolean(tower.is_online);
          const isSurgeryActive = Boolean(isOnline && tower.is_surgery_active);
          const activeSurgeryElapsedSec = isSurgeryActive ? getMonotonicElapsedSec(tower) : 0;

          // Server customer_usage_seconds already includes session_elapsed_sec when is_surgery_active is true (portal_api.py:940-943)
          // Only extrapolate the incremental time since the server's session_elapsed_sec snapshot
          const serverSessionElapsed = (isSurgeryActive && tower.session_elapsed_sec != null) ? Number(tower.session_elapsed_sec) : 0;
          const incrementalActiveElapsedSec = isSurgeryActive ? Math.max(0, activeSurgeryElapsedSec - serverSessionElapsed) : 0;

          // Customer usage calculation (active subscription / facility tenancy)
          const baseCustomerUsageSec = tower.customer_usage_seconds != null
            ? Number(tower.customer_usage_seconds)
            : (sub?.used_min != null
                ? Number(sub.used_min) * 60
                : 0);
          const customerUsageSec = baseCustomerUsageSec + incrementalActiveElapsedSec;

          // Lifetime usage calculation (fleet cumulative surgery runtime)
          const baseLifetimeSec = tower.lifetime_surgery_seconds != null
            ? Number(tower.lifetime_surgery_seconds)
            : (tower.total_usage_seconds != null
                ? Number(tower.total_usage_seconds)
                : (tower.running_hours != null
                    ? Math.round(Number(tower.running_hours) * 3600)
                    : baseCustomerUsageSec));
          const lifetimeSec = Math.max(baseLifetimeSec + incrementalActiveElapsedSec, customerUsageSec);

          const towerGaugeMode = gaugeModeMap[tower.tower_id] ?? 'CUSTOMER';
          const isCustomerMode = isHospitalAdmin || towerGaugeMode === 'CUSTOMER';
          const displayedUsageSec = isCustomerMode ? customerUsageSec : lifetimeSec;
          const gaugeSubText = isCustomerMode
            ? (isHospitalAdmin ? 'hospital usage' : 'facility usage')
            : 'lifetime usage';

          // Dual-State Operational Status Label & Styling
          const statusBadgeInfo = getStatusBadge(tower, isOnline, isHospitalAdmin);
          const opStatusLabel = statusBadgeInfo.label;
          const opBadgeStyle = statusBadgeInfo.style;
          const opDot = statusBadgeInfo.dot;

          const lastKnownTimestamp = tower.last_heartbeat_at
            ? new Date(tower.last_heartbeat_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : (tower.last_seen 
                ? new Date(tower.last_seen).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : (tower.registered_at ? new Date(tower.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Provisioned'));

          const hasDist = Boolean(tower.distributor_name || tower.distributor_id);
          const hasCust = Boolean(tower.customer_id);
          const deployBadge = getDeploymentBadge(hasDist, hasCust);
          const peripherals = tower.peripherals || { camera: false, light: false, pump: false, insufflator: false };
          const isSpectra = (tower.model || 'LUMINA').toUpperCase().includes('SPECTRA');

          return (
            <div
              key={tower.tower_id}
              onClick={() => setSelectedTower(tower)}
              className="cursor-pointer bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.12)] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold font-mono text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                        {tower.tower_id}
                      </span>
                      {/* Luminous Model Badge */}
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-full border ${
                        isSpectra
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                          : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      }`}>
                        {isSpectra ? 'SPECTRA ICG 4K' : 'LUMINA 4K UHD'}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap pt-0.5">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${deployBadge.style}`}>
                        {deployBadge.label}
                      </span>
                      {tower.customer_id && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md border bg-blue-500/10 text-blue-300 border-blue-500/30 inline-flex items-center gap-1" title={`Customer ID: ${tower.customer_id}`}>
                          <Building className="w-3 h-3 text-blue-400" />
                          <span className="truncate max-w-[130px]">{tower.customer_name || customers.find(c => c.customer_id === tower.customer_id)?.name || tower.customer_id}</span>
                        </span>
                      )}
                      {(tower.distributor_name || tower.distributor_id) && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md border bg-amber-500/10 text-amber-300 border-amber-500/30 inline-flex items-center gap-1" title={`Distributor ID: ${tower.distributor_id}`}>
                          <Building className="w-3 h-3 text-amber-400" />
                          <span className="truncate max-w-[120px]">Dist: {tower.distributor_name || customers.find(c => c.customer_id === tower.distributor_id)?.name || tower.distributor_id}</span>
                        </span>
                      )}
                      {(tower.status === 'UNASSIGNED' || !tower.customer_id) && !isHospitalAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTower(tower);
                            setAssignTargetCustomerId(tower.customer_id || '');
                            setAssignTargetDistributorId(tower.distributor_id || '');
                            setIsAssignModalOpen(true);
                          }}
                          className="text-[10px] bg-amber-500 hover:bg-amber-400 text-amber-950 font-black px-2.5 py-1 rounded-lg border border-amber-400/60 transition-colors shadow flex items-center gap-1 cursor-pointer"
                          title="Assign Customer"
                        >
                          <span>⚡</span>
                          <span>Assign Customer</span>
                        </button>
                      )}
                      {canModifyPlans && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReassignTowerId(tower.tower_id);
                            setReassignCustomerId(tower.customer_id || '');
                            setReassignDistributorId(tower.distributor_id || '');
                            setIsReassignModalOpen(true);
                          }}
                          className="text-[10px] bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 px-2 py-0.5 rounded-lg border border-indigo-500/30 transition-colors font-medium"
                          title="Transfer / Reassign Customer"
                        >
                          Transfer
                        </button>
                      )}
                      {tower.serial_number && (
                        <span className="font-mono text-zinc-500 text-[11px]">SN: {tower.serial_number}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(tower.status)}`}>
                      {tower.status}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${opBadgeStyle}`}>
                      {opDot}
                      <span>{opStatusLabel}</span>
                    </span>
                    {(tower.hub_state === 'DISCONNECTED' || tower.status === 'HUB_DISCONNECTED') && opStatusLabel !== 'HUB DISCONNECTED' && (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                        HUB DISCONNECTED
                      </span>
                    )}
                    {!isHospitalAdmin && tower.suspension_active && (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border bg-rose-900/40 text-rose-300 border-rose-500/50">
                        Suspended
                      </span>
                    )}
                  </div>
                </div>

                {/* Peripheral Health Chip: Compact 4-element status matrix with green micro-LED dots */}
                <div className="bg-black/40 border border-zinc-800/80 rounded-xl px-3 py-2 mb-3">
                  <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider text-zinc-400 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-zinc-400" />
                      <span>Peripheral Health</span>
                    </span>
                    <span className="font-mono text-[9px] text-zinc-500">ICD 0x80</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: 'cam', label: 'CAM', name: 'Camera', ok: Boolean(peripherals.camera) },
                      { key: 'lgt', label: 'LGT', name: 'Light', ok: Boolean(peripherals.light) },
                      { key: 'pmp', label: 'PMP', name: 'Pump', ok: Boolean(peripherals.pump) },
                      { key: 'ins', label: 'INS', name: 'Insufflator', ok: Boolean(peripherals.insufflator) },
                    ].map((item) => (
                      <div
                        key={item.key}
                        title={`${item.name}: ${item.ok ? 'Connected & Active' : 'Standby / Offline'}`}
                        className={`flex items-center justify-center gap-1.5 py-1 px-1 rounded-lg border text-[10px] font-mono font-medium transition-all ${
                          item.ok
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.ok
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Center Body: Usage Gauge & Live Usage */}
                <div className="flex flex-col items-center">
                  {/* Interactive pill toggle directly above the gauge for Super Admins / Managers */}
                  {!isHospitalAdmin && (
                    <div
                      className="inline-flex items-center bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800 text-[10px] mb-2.5 font-mono shadow-inner"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="View Active Hospital Usage"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGaugeModeMap(prev => ({ ...prev, [tower.tower_id]: 'CUSTOMER' }));
                        }}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                          towerGaugeMode === 'CUSTOMER'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        Hospital: {formatUsagePill(customerUsageSec)}
                      </button>
                      <div className="w-[1px] h-3 bg-zinc-800 mx-0.5" />
                      <button
                        type="button"
                        title="View Total Fleet Lifetime Usage"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGaugeModeMap(prev => ({ ...prev, [tower.tower_id]: 'LIFETIME' }));
                        }}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                          towerGaugeMode === 'LIFETIME'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        Lifetime: {formatUsagePill(lifetimeSec)}
                      </button>
                    </div>
                  )}

                  <BalanceGauge 
                    remainingMin={null} 
                    totalMin={1000} 
                    size={110} 
                    strokeWidth={8} 
                    displayText={formatUsageHM(displayedUsageSec)}
                    subText={gaugeSubText}
                    isPulse={isSurgeryActive}
                  />

                  {/* Dual-State Live Usage Metric Footer */}
                  <div className="w-full mt-3 pt-2.5 border-t border-zinc-800/80 flex flex-col gap-1.5 text-xs text-zinc-400 px-1">
                    <div className="flex justify-between items-center">
                      {isOnline ? (
                        isSurgeryActive ? (
                          <>
                            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                              Live Usage:
                            </span>
                            <strong className="font-mono text-sm tracking-tight text-rose-300">
                              {formatHMS(activeSurgeryElapsedSec)}
                            </strong>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              Live Usage:
                            </span>
                            <strong className="font-mono text-sm tracking-tight text-emerald-400">
                              Idle (Standby)
                            </strong>
                          </>
                        )
                      ) : (
                        <>
                          <span className="text-zinc-400 flex items-center gap-1">
                            Last Known Usage:
                          </span>
                          <strong className="font-mono text-sm tracking-tight text-zinc-400">
                            {tower.total_surgeries ?? 0} cases
                          </strong>
                        </>
                      )}
                    </div>

                    {!isOnline && (
                      <div className="text-[10px] text-zinc-500 font-mono text-right">
                        as of {lastKnownTimestamp}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar at Bottom of Card */}
              <div 
                className="w-full mt-4 pt-3 border-t border-zinc-800/80"
                onClick={(e) => e.stopPropagation()}
              >
                {isHospitalAdmin ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        title="Inspect Tower Details & Sessions"
                        onClick={() => setSelectedTower(tower)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>📋</span>
                        <span>Details</span>
                      </button>
                      <button
                        type="button"
                        title="View Live Diagnostics"
                        onClick={() => setSelectedTower(tower)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>🩺</span>
                        <span>Diagnostics</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  (tower.status === 'UNASSIGNED' || !tower.customer_id) ? (
                    <button
                      type="button"
                      title="Assign Customer & Subscription Plan"
                      onClick={() => {
                        setSelectedTower(tower);
                        setAssignTargetCustomerId(tower.customer_id || '');
                        setAssignTargetDistributorId(tower.distributor_id || '');
                        setIsAssignModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-amber-950 border border-amber-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer"
                    >
                      <span>⚡</span>
                      <span>Assign Customer</span>
                    </button>
                  ) : isDistributorAdmin ? (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        title="Request Balance Top-Up"
                        onClick={() => {
                          setRequestRechargeTower(tower);
                          setIsRequestRechargeOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>💳</span>
                        <span>Top-Up</span>
                      </button>
                      <button
                        type="button"
                        title="Request Subscription Plan Change"
                        onClick={() => {
                          setRequestPlanChangeTower(tower);
                          setIsRequestPlanChangeOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>🔄</span>
                        <span>Plan</span>
                      </button>
                      <button
                        type="button"
                        title="Inspect Details"
                        onClick={() => setSelectedTower(tower)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>📋</span>
                        <span>Details</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        title="Inspect Tower Details"
                        onClick={() => setSelectedTower(tower)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>📋</span>
                        <span>Details</span>
                      </button>
                      <button
                        type="button"
                        title="View Live Diagnostics"
                        onClick={() => setSelectedTower(tower)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 transition-all shadow-sm"
                      >
                        <span>🩺</span>
                        <span>Diagnostics</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
        {filteredTowers.length === 0 && (
          <div className="col-span-full py-16 px-6 bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center text-center my-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.08)]">
              <Radio className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Endoscope Towers Found</h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
              No surgical towers match the active filter criteria or search parameters. Clear your filters to inspect the entire fleet.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setFilterDistributorId('');
                setFilterCustomerId('');
              }}
              className="bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>


      {/* Tabbed Tower Detail Modal */}
      <TowerDetailModal
        isOpen={!!selectedTower}
        onClose={() => setSelectedTower(null)}
        tower={selectedTower}
        subscription={selectedTower ? getTowerSubscription(selectedTower.tower_id) : null}
        userRole={userRole}
        onTowerUpdated={fetchData}
        onOpenPlanChangeModal={(t: any) => {
          setRequestPlanChangeTower(t);
          setIsRequestPlanChangeOpen(true);
        }}
        onOpenSuspendModal={canSuspendReactivate ? (t) => {
          setSelectedTower(t);
          setIsSuspendModalOpen(true);
        } : undefined}
        onOpenSessionModal={(sid) => {
          setSelectedSessionId(sid);
          setIsSessionModalOpen(true);
        }}
        onOpenAssignModal={(t) => {
          setSelectedTower(t);
          setAssignTargetCustomerId(t.customer_id || '');
          setAssignTargetDistributorId(t.distributor_id || '');
          setIsAssignModalOpen(true);
        }}
        onOpenTransferModal={(t) => {
          setReassignTowerId(t.tower_id);
          setReassignCustomerId(t.customer_id || '');
          setReassignDistributorId(t.distributor_id || '');
          setIsReassignModalOpen(true);
        }}
      />

      {/* Assign Plan Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Customer & Subscription Plan" maxWidth="max-w-2xl">
        <form onSubmit={handleAssignPlanSubmit}>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-4">
              Configuring plan for tower <span className="font-bold text-white font-mono">{selectedTower?.tower_id}</span>. 
              Assigning a valid plan will transition the tower state to <span className="text-emerald-400 font-semibold">ACTIVE</span>.
            </p>
            
            <label className="block text-sm font-medium text-gray-300 mb-1">Distributor Partner (Optional)</label>
            <select
              value={assignTargetDistributorId}
              onChange={(e) => setAssignTargetDistributorId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="" className="bg-zinc-900 text-zinc-100">-- Direct from Manufacturer (UnivLabs) --</option>
              {customers.filter(c => c.organization_type === 'DISTRIBUTOR').map(d => (
                <option key={d.customer_id} value={d.customer_id} className="bg-zinc-900 text-zinc-100">
                  {d.name} ({d.customer_id})
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-300 mb-1">Hospital Facility (Optional)</label>
            <select
              value={assignTargetCustomerId}
              onChange={(e) => setAssignTargetCustomerId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="" className="bg-zinc-900 text-zinc-100">-- None / Unassigned Hospital --</option>
              {customers.filter(c => c.organization_type !== 'DISTRIBUTOR').map(c => (
                <option key={c.customer_id} value={c.customer_id} className="bg-zinc-900 text-zinc-100">
                  {c.name} ({c.customer_id}) - {c.organization_type}
                </option>
              ))}
            </select>

                        <label className="block text-sm font-medium text-gray-300 mb-1">Subscription Plan Model</label>
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
              <span className="font-semibold text-blue-200">Subscription Model: Freedom Postpaid.</span> Operational minutes are tracked continuously with automated end-of-cycle billing against agreed facility terms.
            </div>
          </div>

          {assignError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs">
              {assignError}
            </div>
          )}

          <div className="flex justify-between items-center mt-6">
            {selectedTower?.customer_id && (
              <button 
                type="button" 
                onClick={() => setIsUnassignConfirmOpen(true)}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Unassign Tower
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button 
                type="button" 
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isAssigning}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isAssigning ? 'Saving Plan...' : (assignTargetCustomerId ? 'Activate Plan' : 'Assign to Distributor Stock')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Unassign Confirmation Modal */}
      <Modal isOpen={isUnassignConfirmOpen} onClose={() => setIsUnassignConfirmOpen(false)} title="Confirm Tower Unassignment">
        <div className="mb-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Lifecycle Transition: UNASSIGNED
            </h3>
            <p className="text-xs text-amber-200 leading-relaxed">
              Unassigning tower <strong className="font-mono text-white">{selectedTower?.tower_id}</strong> will revoke its current subscription, clear customer assignment, and transition its state to <strong className="text-amber-400">UNASSIGNED</strong>. Device verification and operational handshakes will be blocked with <strong className="text-white">403 Forbidden</strong> until a new plan is assigned.
            </p>
          </div>
          <p className="text-gray-300 text-sm mt-4">Are you sure you want to proceed with unassignment?</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            onClick={() => setIsUnassignConfirmOpen(false)}
            disabled={isUnassigning}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExecuteUnassign}
            disabled={isUnassigning}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isUnassigning ? 'Unassigning...' : 'Yes, Unassign Tower'}
          </button>
        </div>
      </Modal>

      {/* Lease Modal */}
      <Modal isOpen={isLeaseModalOpen} onClose={() => setIsLeaseModalOpen(false)} title="Assign Lease Duration">
        <form onSubmit={handleAssignLease}>
          <div className="mb-4 text-sm text-gray-400">
            Set lease duration for tower <span className="font-bold text-white font-mono">{selectedTower?.tower_id}</span>.
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Years</label>
              <input 
                type="number" min="0" max="10" 
                value={leaseYears} 
                onChange={e => setLeaseYears(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Months</label>
              <input 
                type="number" min="0" max="11" 
                value={leaseMonths} 
                onChange={e => setLeaseMonths(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Days</label>
              <input 
                type="number" min="0" max="365" 
                value={leaseDays} 
                onChange={e => setLeaseDays(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="mb-4 text-xs text-gray-300">Total duration: {leaseYears}y {leaseMonths}m {leaseDays}d</p>
          
          {leaseError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {leaseError}
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={() => setIsLeaseModalOpen(false)}
              disabled={isAssigningLease}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isAssigningLease}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isAssigningLease ? 'Assigning...' : 'Assign Lease'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend Modal */}
      {!isHospitalAdmin && canSuspendReactivate && (
        <Modal isOpen={isSuspendModalOpen} onClose={() => setIsSuspendModalOpen(false)} title="Suspend Tower">
          <form onSubmit={handleSuspendTower}>
            <div className="mb-4 text-sm text-gray-400">
              You are about to suspend tower <span className="font-bold text-white font-mono">{selectedTower?.tower_id}</span>.
              This will immediately lock the tower UI (unless a surgery is active, in which case it will lock immediately after).
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Reason for Suspension</label>
              <input 
                type="text" 
                required
                value={suspendReason} 
                onChange={e => setSuspendReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. Non-payment, Maintenance Required, Contract Terminated"
              />
            </div>
            
            {suspendError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {suspendError}
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => setIsSuspendModalOpen(false)}
                disabled={isSuspending}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSuspending}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {isSuspending ? 'Suspending...' : 'Suspend Tower'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Unified Recharge Modal (Time, Duration, Token, Emergency) */}
      {!isHospitalAdmin && (
        <DirectRechargeModal
          isOpen={isRechargeModalOpen}
          onClose={() => setIsRechargeModalOpen(false)}
          towerId={selectedTower?.tower_id}
          tower={selectedTower || undefined}
          towers={towers}
          initialMode="TIME_HOURS"
          userRole={userRole}
          onSuccess={() => {
            setIsRechargeModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* Transfer / Reassign Customer Modal */}
      <Modal 
        isOpen={isReassignModalOpen} 
        onClose={() => setIsReassignModalOpen(false)} 
        title="Transfer / Reassign Customer"
      >
        <form onSubmit={handleReassignSubmit}>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-4">
              Select the new customer to transfer tower <span className="font-bold text-white font-mono">{reassignTowerId}</span> to.
            </p>
            <label className="block text-sm font-medium text-gray-300 mb-1">Distributor Partner (Optional)</label>
            <select
              value={reassignDistributorId}
              onChange={(e) => setReassignDistributorId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="" className="bg-zinc-900 text-zinc-100">-- Direct from Manufacturer (UnivLabs) --</option>
              {customers.filter(c => c.organization_type === 'DISTRIBUTOR').map(d => (
                <option key={d.customer_id} value={d.customer_id} className="bg-zinc-900 text-zinc-100">
                  {d.name} ({d.customer_id})
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-300 mb-1">Hospital Facility (Optional)</label>
            <select
              value={reassignCustomerId}
              onChange={(e) => setReassignCustomerId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="bg-zinc-900 text-zinc-100">-- None / Unassigned Facility --</option>
              {customers.filter(c => c.organization_type !== 'DISTRIBUTOR').map(c => (
                <option key={c.customer_id} value={c.customer_id} className="bg-zinc-900 text-zinc-100">
                  {c.name} ({c.customer_id}) - {c.organization_type}
                </option>
              ))}
            </select>
          </div>
          {reassignError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {reassignError}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsReassignModalOpen(false)}
              disabled={isReassigning}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReassigning}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isReassigning ? 'Transferring...' : 'Transfer Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Session Audit & Telemetry Viewer Modal */}
      <SessionDetailModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSelectedSessionId(null);
        }}
        sessionId={selectedSessionId}
        initialRole={userRole}
      />

      {/* Quick Assign & Activate Modal */}
      <QuickAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => {
          setIsQuickAssignOpen(false);
          setQuickAssignTargetTower(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        tower={quickAssignTargetTower}
        unassignedTowers={unassignedTowers}
        customers={customers}
      />

      {/* Request Recharge / Top-Up Modal */}
      <RequestRechargeModal
        isOpen={isRequestRechargeOpen}
        onClose={() => {
          setIsRequestRechargeOpen(false);
          setRequestRechargeTower(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        tower={requestRechargeTower}
      />

      {/* Request Plan Change Modal */}
      <RequestPlanChangeModal
        isOpen={isRequestPlanChangeOpen}
        onClose={() => {
          setIsRequestPlanChangeOpen(false);
          setRequestPlanChangeTower(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        tower={requestPlanChangeTower}
      />
    </div>
  );
};

export default TowerManagement;
