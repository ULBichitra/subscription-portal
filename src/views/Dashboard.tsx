import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import ProgressGauge from '../components/ui/ProgressGauge';
import LineChart from '../components/ui/LineChart';
import AreaChart from '../components/ui/AreaChart';
import BarChart from '../components/ui/BarChart';
import { getTowers, getSubscriptions, getSessions, getAnalyticsSummary, getCustomers } from '../services/api';
import type { Tower, Subscription, Session, AnalyticsSummaryResponse } from '../services/api';
import { realtimeClient } from '../services/realtime';
import {
  Activity,
  Receipt,
  Camera,
  Lightbulb,
  Droplets,
  Wind,
  Database,
  Cpu,
  Radio,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  BarChart3,
  History,
  PlusCircle,
  Key,
  LifeBuoy,
  Building,
  ShieldCheck
} from 'lucide-react';
import SessionDetailModal from '../components/ui/SessionDetailModal';
import { CreateComplaintModal } from '../components/CreateComplaintModal';
import { MaintenanceUnlockModal } from '../components/MaintenanceUnlockModal';
import TowerDetailModal from '../components/TowerDetailModal';


const getHubLinkDisplay = (hubState?: string, isOnline?: boolean) => {
  if (!isOnline) {
    return {
      dotClass: 'bg-zinc-500',
      label: 'Service Offline',
    };
  }
  switch (hubState) {
    case 'CONNECTED':
      return {
        dotClass: 'bg-emerald-400',
        label: 'Connected',
      };
    case 'SCANNING':
      return {
        dotClass: 'bg-amber-400 animate-pulse',
        label: 'Connecting',
      };
    case 'DEGRADED':
      return {
        dotClass: 'bg-amber-500',
        label: 'Degraded',
      };
    case 'DISCONNECTED':
    default:
      return {
        dotClass: 'bg-rose-400',
        label: 'Disconnected',
      };
  }
};

const formatElapsedTime = (totalSec: number): string => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatExactSessionDuration = (session: Session): string => {
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



const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState(true);
  const wasDisconnectedRef = useRef(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Command Station Modals State
  const [selectedDetailTower, setSelectedDetailTower] = useState<Tower | null>(null);
  const [isTowerDetailOpen, setIsTowerDetailOpen] = useState(false);
  const [selectedTowerForAction, setSelectedTowerForAction] = useState<string>('TOWER-001');
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

  // User RBAC permissions
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const userRole = currentUser.role || 'hospital_admin';
  const isHospitalAdmin = userRole === 'hospital_admin';
  const isDistributorAdmin = userRole === 'distributor_admin';
  const isCustomerRole = isHospitalAdmin || isDistributorAdmin;
  const [customerName, setCustomerName] = useState<string>('');

  // Live analytics summary from backend
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummaryResponse | null>(null);

  // Ticking clock for active procedure live duration & freshness
  const [liveTick, setLiveTick] = useState(0);
  const monotonicClocksRef = useRef<Map<string, { lastServerSec: number | null; lastSec: number; localMs: number }>>(new Map());

  const hasActiveSurgeries = useMemo(() => {
    return towers.some((t) => Boolean(t.is_online && t.is_surgery_active));
  }, [towers]);

  const getMonotonicElapsedSec = useCallback((tower: Tower, activeSession?: Session | null): number => {
    if (!tower.is_surgery_active || !tower.is_online) {
      monotonicClocksRef.current.delete(tower.tower_id);
      return 0;
    }
    const serverSec = tower.session_elapsed_sec ?? tower.elapsed_sec ?? (activeSession as any)?.session_elapsed_sec ?? (activeSession as any)?.elapsed_sec;
    const now = Date.now();
    const entry = monotonicClocksRef.current.get(tower.tower_id);
    let validServerSec = (serverSec !== undefined && serverSec !== null && !isNaN(Number(serverSec)) && Number(serverSec) >= 0) ? Number(serverSec) : null;

    if (validServerSec === null) {
      const startTimeStr = tower.session_start_time ?? (activeSession as any)?.start_time;
      if (startTimeStr) {
        const startMs = new Date(startTimeStr).getTime();
        if (!isNaN(startMs) && startMs > 0 && startMs <= now) {
          validServerSec = Math.max(0, Math.floor((now - startMs) / 1000));
        }
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

  useEffect(() => {
    if (!hasActiveSurgeries) return;
    const timer = setInterval(() => {
      setLiveTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [hasActiveSurgeries]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [towersData, subsData, sessionsData, summaryData, customersData] = await Promise.all([
        getTowers(),
        getSubscriptions(),
        getSessions(),
        getAnalyticsSummary().catch(() => null),
        getCustomers().catch(() => [])
      ]);
      setTowers(towersData);
      setSubscriptions(subsData);
      setSessions(sessionsData);
      if (customersData && customersData.length > 0) {
        setCustomerName(customersData[0].name);
      }
      if (towersData.length > 0 && !selectedTowerForAction) {
        setSelectedTowerForAction(towersData[0].tower_id);
      }
      if (summaryData) {
        setAnalyticsData(summaryData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTowerForAction]);

  useEffect(() => {
    setIsLoading(true);
    fetchDashboardData();

    // Subscribe to live telemetry and tower status events
    const handleTelemetry = (payload: any) => {
      setIsLiveStreamActive(true);

      setTowers((prev) => {
        const idx = prev.findIndex((t) => t.tower_id === payload.tower_id);
        const isOnline = payload.is_online !== undefined ? Boolean(payload.is_online) : (idx >= 0 ? prev[idx].is_online : true);
        const isSurgery = isOnline
          ? (payload.is_surgery_active !== undefined ? Boolean(payload.is_surgery_active) : (idx >= 0 ? prev[idx].is_surgery_active : false))
          : false;

        if (!isSurgery && payload.tower_id) {
          monotonicClocksRef.current.delete(payload.tower_id);
        }

        const liveElapsed = isSurgery ? (payload.session_elapsed_sec !== undefined ? payload.session_elapsed_sec : payload.elapsed_sec) : 0;

        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            live_balance_sec: payload.live_balance_sec !== undefined ? payload.live_balance_sec : updated[idx].live_balance_sec,
            live_grace_sec: payload.live_grace_sec !== undefined ? payload.live_grace_sec : updated[idx].live_grace_sec,
            is_online: isOnline,
            is_surgery_active: isSurgery,
            session_elapsed_sec: isSurgery ? (liveElapsed !== undefined ? liveElapsed : updated[idx].session_elapsed_sec) : 0,
            session_start_time: isSurgery ? (payload.session_start_time || updated[idx].session_start_time) : null,
            customer_usage_seconds: payload.customer_usage_seconds !== undefined ? payload.customer_usage_seconds : updated[idx].customer_usage_seconds,
            total_usage_seconds: payload.total_usage_seconds !== undefined ? payload.total_usage_seconds : (payload.lifetime_surgery_seconds !== undefined ? payload.lifetime_surgery_seconds : updated[idx].total_usage_seconds),
            lifetime_surgery_seconds: payload.lifetime_surgery_seconds !== undefined ? payload.lifetime_surgery_seconds : (payload.total_usage_seconds !== undefined ? payload.total_usage_seconds : updated[idx].lifetime_surgery_seconds),
            die_temp_c: payload.die_temp_c !== undefined ? payload.die_temp_c : updated[idx].die_temp_c,
            peripherals: payload.peripherals !== undefined ? payload.peripherals : updated[idx].peripherals,
            store_seq: payload.store_seq !== undefined ? payload.store_seq : updated[idx].store_seq,
            hub_connected: payload.hub_connected !== undefined ? payload.hub_connected : (updated[idx] as any).hub_connected,
            hub_state: payload.hub_state !== undefined ? payload.hub_state : updated[idx].hub_state,
            last_heartbeat_at: payload.last_heartbeat_at || updated[idx].last_heartbeat_at || (isOnline ? new Date().toISOString() : null)
          };
          return updated;
        } else {
          // RBAC isolation: customer roles must never append foreign or unassigned towers
          if (isHospitalAdmin && payload.customer_id !== currentUser.customer_id) {
            return prev;
          }
          if (isDistributorAdmin && payload.customer_id !== currentUser.customer_id && payload.distributor_id !== currentUser.customer_id) {
            return prev;
          }
          if (isCustomerRole && (!payload.customer_id || payload.customer_id !== currentUser.customer_id)) {
            return prev;
          }
          return [
            ...prev,
            {
              tower_id: payload.tower_id,
              customer_id: payload.customer_id || null,
              serial_number: payload.tower_id,
              model: 'CCP-TOWER',
              status: payload.status || 'ACTIVE',
              is_online: isOnline,
              live_balance_sec: payload.live_balance_sec || 0,
              live_grace_sec: payload.live_grace_sec || 57600,
              is_surgery_active: isSurgery,
              session_elapsed_sec: isSurgery ? (liveElapsed !== undefined ? liveElapsed : 0) : 0,
              session_start_time: isSurgery ? (payload.session_start_time || null) : null,
              customer_usage_seconds: payload.customer_usage_seconds ?? null,
              total_usage_seconds: payload.total_usage_seconds ?? payload.lifetime_surgery_seconds ?? null,
              lifetime_surgery_seconds: payload.lifetime_surgery_seconds ?? payload.total_usage_seconds ?? null,
              last_heartbeat_at: new Date().toISOString(),
              agreement_type: payload.agreement_type || 'PREPAID',
              die_temp_c: payload.die_temp_c,
              peripherals: payload.peripherals || { camera: false, light: false, pump: false, insufflator: false },
              store_seq: payload.store_seq || 0,
              hub_state: payload.hub_state || 'DISCONNECTED',
              subscriptions: []
            }
          ];
        }
      });
    };

    const unsubTelemetry = realtimeClient.on('telemetry', handleTelemetry);
    const unsubTelemetryTick = realtimeClient.on('telemetry_tick', handleTelemetry);

    const unsubTowerStatus = realtimeClient.on('tower_status', (payload: any) => {
      setTowers((prev) => {
        const idx = prev.findIndex((t) => t.tower_id === payload.tower_id);
        if (idx >= 0) {
          if (isCustomerRole && (payload.status === 'UNASSIGNED' || payload.customer_id === null)) {
            return prev.filter((t) => t.tower_id !== payload.tower_id);
          }
          if (isHospitalAdmin && payload.customer_id && payload.customer_id !== currentUser.customer_id) {
            return prev.filter((t) => t.tower_id !== payload.tower_id);
          }
          const updated = [...prev];
          const nextOnline = payload.is_online !== undefined ? Boolean(payload.is_online) : updated[idx].is_online;
          const isSurgery = nextOnline
            ? (payload.is_surgery_active !== undefined ? Boolean(payload.is_surgery_active) : updated[idx].is_surgery_active)
            : false;

          if (!isSurgery && payload.tower_id) {
            monotonicClocksRef.current.delete(payload.tower_id);
          }

          updated[idx] = {
            ...updated[idx],
            status: payload.status || updated[idx].status,
            customer_id: payload.customer_id !== undefined ? payload.customer_id : updated[idx].customer_id,
            agreement_type: payload.agreement_type !== undefined ? payload.agreement_type : updated[idx].agreement_type,
            is_online: nextOnline,
            is_surgery_active: isSurgery,
            session_elapsed_sec: isSurgery ? updated[idx].session_elapsed_sec : 0,
            session_start_time: isSurgery ? updated[idx].session_start_time : null,
            customer_usage_seconds: payload.customer_usage_seconds !== undefined ? payload.customer_usage_seconds : updated[idx].customer_usage_seconds,
            total_usage_seconds: payload.total_usage_seconds !== undefined ? payload.total_usage_seconds : (payload.lifetime_surgery_seconds !== undefined ? payload.lifetime_surgery_seconds : updated[idx].total_usage_seconds),
            lifetime_surgery_seconds: payload.lifetime_surgery_seconds !== undefined ? payload.lifetime_surgery_seconds : (payload.total_usage_seconds !== undefined ? payload.total_usage_seconds : updated[idx].lifetime_surgery_seconds),
            hub_state: payload.hub_state !== undefined ? payload.hub_state : updated[idx].hub_state
          };
          return updated;
        }
        return prev;
      });
    });

    const unsubSessionUpdated = realtimeClient.on('session_updated', (data: any) => {
      if (!data?.session_id) return;
      const isSurgeryActive = data.is_surgery_active !== undefined
        ? Boolean(data.is_surgery_active)
        : (data.status === 'ACTIVE' || data.status === 'RUNNING');

      if (!isSurgeryActive && data.tower_id) {
        monotonicClocksRef.current.delete(data.tower_id);
      }

      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.session_id === data.session_id);
        const existingSession = idx >= 0 ? prev[idx] : null;

        // Prevent late active ticks from reverting an already completed session
        if (existingSession && existingSession.status === 'COMPLETED' && isSurgeryActive) {
          return prev;
        }

        const durMin = data.duration_min !== undefined ? Number(data.duration_min) : (existingSession ? existingSession.duration_min : 0);
        const durSec = data.duration_sec !== undefined ? Number(data.duration_sec) : (data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : (existingSession ? existingSession.duration_sec : durMin * 60));
        const hubDurSec = data.hub_duration_seconds !== undefined ? (data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : null) : (existingSession ? existingSession.hub_duration_seconds : null);

        const updatedSession: Session = {
          session_id: data.session_id,
          tower_id: data.tower_id || (existingSession ? existingSession.tower_id : ''),
          customer_id: data.customer_id !== undefined ? data.customer_id : (existingSession ? existingSession.customer_id : null),
          subscription_id: data.subscription_id || (existingSession ? existingSession.subscription_id : ''),
          status: data.status || (isSurgeryActive ? 'ACTIVE' : 'COMPLETED'),
          start_time: data.start_time || (existingSession ? existingSession.start_time : new Date().toISOString()),
          end_time: data.end_time !== undefined ? data.end_time : (existingSession ? existingSession.end_time : (isSurgeryActive ? null : new Date().toISOString())),
          duration_min: durMin,
          duration_sec: durSec,
          hub_duration_seconds: hubDurSec,
          session_elapsed_sec: isSurgeryActive ? (data.session_elapsed_sec ?? (existingSession ? existingSession.session_elapsed_sec : 0)) : durSec
        };

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updatedSession };
          return next;
        } else {
          if (isCustomerRole && updatedSession.customer_id && updatedSession.customer_id !== currentUser.customer_id) {
            return prev;
          }
          return [updatedSession, ...prev];
        }
      });

      if (data.tower_id) {
        setTowers((prev) => {
          const tIdx = prev.findIndex((t) => t.tower_id === data.tower_id);
          if (tIdx >= 0) {
            const next = [...prev];
            next[tIdx] = {
              ...next[tIdx],
              is_surgery_active: isSurgeryActive,
              session_elapsed_sec: isSurgeryActive ? (data.session_elapsed_sec ?? next[tIdx].session_elapsed_sec) : 0,
              session_start_time: isSurgeryActive ? (data.start_time || next[tIdx].session_start_time) : null,
              customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : next[tIdx].customer_usage_seconds,
              total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : next[tIdx].total_usage_seconds),
              lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : next[tIdx].lifetime_surgery_seconds),
              live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : next[tIdx].live_balance_sec,
            };
            return next;
          }
          return prev;
        });
      }
    });

    const unsubSessionConcluded = realtimeClient.on('session_concluded', (data: any) => {
      if (!data?.session_id && !data?.tower_id) return;
      if (data.tower_id) {
        monotonicClocksRef.current.delete(data.tower_id);
      }

      if (data.session_id) {
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.session_id === data.session_id);
          const existing = idx >= 0 ? prev[idx] : null;
          const durMin = data.duration_min !== undefined ? Number(data.duration_min) : (existing ? existing.duration_min : 0);
          const durSec = data.duration_sec !== undefined ? Number(data.duration_sec) : (data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : (existing ? (existing.duration_sec || (existing.hub_duration_seconds ?? durMin * 60)) : durMin * 60));
          const hubDurSec = data.hub_duration_seconds !== undefined && data.hub_duration_seconds !== null ? Number(data.hub_duration_seconds) : (existing ? (existing.hub_duration_seconds ?? durSec) : durSec);

          const completedSession: Session = {
            session_id: data.session_id,
            tower_id: data.tower_id || (existing ? existing.tower_id : ''),
            customer_id: data.customer_id !== undefined ? data.customer_id : (existing ? existing.customer_id : null),
            subscription_id: data.subscription_id || (existing ? existing.subscription_id : ''),
            status: 'COMPLETED',
            start_time: data.start_time || (existing ? existing.start_time : new Date().toISOString()),
            end_time: data.end_time || new Date().toISOString(),
            duration_min: durMin,
            duration_sec: durSec,
            hub_duration_seconds: hubDurSec,
            session_elapsed_sec: durSec
          };

          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...completedSession };
            return next;
          } else {
            return [completedSession, ...prev];
          }
        });
      }

      if (data.tower_id) {
        setTowers((prev) => {
          const tIdx = prev.findIndex((t) => t.tower_id === data.tower_id);
          if (tIdx >= 0) {
            const next = [...prev];
            next[tIdx] = {
              ...next[tIdx],
              is_surgery_active: false,
              session_elapsed_sec: 0,
              session_start_time: null,
              customer_usage_seconds: data.customer_usage_seconds !== undefined ? data.customer_usage_seconds : next[tIdx].customer_usage_seconds,
              total_usage_seconds: data.total_usage_seconds !== undefined ? data.total_usage_seconds : (data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : next[tIdx].total_usage_seconds),
              lifetime_surgery_seconds: data.lifetime_surgery_seconds !== undefined ? data.lifetime_surgery_seconds : (data.total_usage_seconds !== undefined ? data.total_usage_seconds : next[tIdx].lifetime_surgery_seconds),
              live_balance_sec: data.live_balance_sec !== undefined ? data.live_balance_sec : next[tIdx].live_balance_sec,
            };
            return next;
          }
          return prev;
        });
      }
    });

    const unsubConnection = realtimeClient.on('connection_status', (data: any) => {
      const connected = Boolean(data?.connected);
      setIsLiveStreamActive(connected);
      if (connected) {
        if (wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          fetchDashboardData();
        }
      } else {
        wasDisconnectedRef.current = true;
      }
    });

    return () => {
      unsubTelemetry();
      unsubTelemetryTick();
      unsubTowerStatus();
      unsubSessionUpdated();
      unsubSessionConcluded();
      unsubConnection();
    };
  }, [fetchDashboardData]);

  // Scoped visible fleet for customer tenancy isolation
  const scopedTowers = useMemo(() => {
    if (isHospitalAdmin) {
      return towers.filter((t) => Boolean(t.customer_id) && t.customer_id === currentUser.customer_id);
    }
    if (isDistributorAdmin) {
      return towers.filter((t) => 
        (Boolean(t.customer_id) && t.customer_id === currentUser.customer_id) || 
        (Boolean(t.distributor_id) && t.distributor_id === currentUser.customer_id)
      );
    }
    return towers;
  }, [towers, isHospitalAdmin, isDistributorAdmin, currentUser.customer_id]);

  // Real-Time Fleet Health Radar Computations
  const onlineTowers = useMemo(() => {
    return scopedTowers.filter((t) => Boolean(t.is_online));
  }, [scopedTowers, liveTick]);

  const inSurgeryTowers = useMemo(() => {
    return onlineTowers.filter((t) => Boolean(t.is_surgery_active));
  }, [onlineTowers]);


  const onlineUnassignedTowers = useMemo(() => {
    if (isCustomerRole) return [];
    return onlineTowers.filter((t) => t.status === 'UNASSIGNED' || !t.customer_id);
  }, [onlineTowers, isCustomerRole]);

  const onlineIdleTowers = useMemo(() => {
    return onlineTowers.filter((t) => {
      const isSurgery = Boolean(t.is_surgery_active);
      const isUnassigned = t.status === 'UNASSIGNED' || !t.customer_id;
      return !isSurgery && !isUnassigned;
    });
  }, [onlineTowers]);

  const offlineTowers = useMemo(() => {
    return scopedTowers.filter((t) => !t.is_online);
  }, [scopedTowers]);

  const inSurgeryCount = inSurgeryTowers.length;
  const onlineIdleCount = onlineIdleTowers.length;
  const onlineUnassignedCount = onlineUnassignedTowers.length;
  // inGraceCount removed
  const offlineCount = offlineTowers.length;

  const chartData = useMemo(() => {
    const lData: Record<string, number> = {};
    const aData: Record<string, number> = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      lData[dateStr] = 0;
      aData[dateStr] = 0;
    }

    sessions.forEach((s) => {
      if (s?.start_time) {
        const d = new Date(s.start_time);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (lData[dateStr] !== undefined) {
          lData[dateStr] += 1;
          aData[dateStr] += Number(s.duration_min) || 0;
        }
      }
    });

    return {
      lineData: Object.entries(lData).map(([label, value]) => ({ label, value })),
      areaData: Object.entries(aData).map(([label, value]) => ({ label, value }))
    };
  }, [sessions]);

  const { lineData, areaData } = chartData;
  // Scoped sessions for customer tenancy isolation
  const scopedSessions = useMemo(() => {
    if (isHospitalAdmin) {
      return sessions.filter((s) => s.customer_id === currentUser.customer_id);
    }
    if (isDistributorAdmin) {
      const allowedTids = new Set(scopedTowers.map((t) => t.tower_id));
      return sessions.filter((s) => s.customer_id === currentUser.customer_id || (s.tower_id && allowedTids.has(s.tower_id)));
    }
    return sessions;
  }, [sessions, isHospitalAdmin, isDistributorAdmin, scopedTowers, currentUser.customer_id]);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const totalSessions = scopedSessions.length;
  const minutesConsumed = scopedSessions.reduce((acc, s) => acc + (Number(s.duration_min) || 0), 0);

  // Compute Top Active Towers
  const topTowersData = useMemo(() => {
    const towerMins: Record<string, number> = {};
    scopedSessions.forEach((s) => {
      if (s?.tower_id) {
        towerMins[s.tower_id] = (towerMins[s.tower_id] || 0) + (Number(s.duration_min) || 0);
      }
    });
    return Object.entries(towerMins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tower_id, val]) => ({ label: tower_id ? tower_id.substring(0, 8) : 'Unknown', value: val }));
  }, [scopedSessions]);

  // Recent Activity Feed
  const recentSessions = useMemo(() => {
    return [...scopedSessions]
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .slice(0, 10);
  }, [scopedSessions]);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-zinc-500 h-full bg-[#09090b] gap-3">
        <Activity className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-xs font-mono tracking-widest uppercase">Connecting Telemetry Engine...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4 sm:gap-6 overflow-y-auto custom-scrollbar bg-[#09090b]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Executive Dashboard & Telemetry HUD</h1>
            {userRole === 'hospital_admin' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold shadow-sm">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>{customerName || towers[0]?.customer_name || currentUser.customer_id || 'Hospital Facility'}</span>
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-sm">Real-time fleet health radar, zero-mock live curves, and surgical cockpit monitor.</p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'hospital_admin' && currentUser.customer_id && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-[11px] font-mono text-zinc-300">
              <span className="text-zinc-500">Facility ID:</span> {currentUser.customer_id}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {isLiveStreamActive ? 'Live Telemetry Stream' : 'Disconnected'}
            </span>
            {analyticsData && (
              <span className="text-xs text-zinc-400 border-l border-emerald-500/30 pl-2">
                Fleet Link: <span className="text-white font-mono font-semibold">{analyticsData.fleet_health?.link_quality_pct ?? 99.8}%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1. REAL-TIME FLEET HEALTH RADAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Online In-Surgery (Pulsing Emerald / Cyan) */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)] relative overflow-hidden flex flex-col justify-between hover:border-cyan-400/60 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-cyan-500/15 to-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              Online In-Surgery
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
              Active Case
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-extrabold text-white font-mono">{inSurgeryCount}</span>
            <span className="text-xs text-zinc-400 font-medium">/ {scopedTowers.length} Devices</span>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Live Optical Feeds</span>
            <span className="text-cyan-400 font-semibold font-mono">
              {inSurgeryCount > 0 ? `${inSurgeryCount} Resections Active` : '0 Theatres Active'}
            </span>
          </div>
        </div>

        {/* Card 2: Online Idle */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-emerald-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-emerald-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Online Idle
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Standby Ready
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-extrabold text-white font-mono">{onlineIdleCount}</span>
            <span className="text-xs text-zinc-400 font-medium">/ {scopedTowers.length} Devices</span>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Awaiting Case Call</span>
            <span className="text-emerald-400 font-semibold font-mono">mTLS 1.3 Sync</span>
          </div>
        </div>

        {/* Card 3: Online Unassigned (Hidden for customer tenants) */}
        {!isCustomerRole && (
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-amber-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </span>
                Online Unassigned
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Needs Assign
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-4xl font-extrabold text-white font-mono">{onlineUnassignedCount}</span>
              <span className="text-xs text-zinc-400 font-medium">/ {scopedTowers.length} Devices</span>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Awaiting Customer</span>
              <span className="text-amber-400 font-semibold font-mono">Heartbeat OK</span>
            </div>
          </div>
        )}



        {/* Card 5: Offline */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-700/50 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-zinc-600 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-400" /> Offline Fleet
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
              Air-Gapped
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-extrabold text-white font-mono">{offlineCount}</span>
            <span className="text-xs text-zinc-400 font-medium">/ {scopedTowers.length} Devices</span>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Awaiting Heartbeat</span>
            <span className="text-zinc-400 font-mono">Postpaid Ready</span>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE PROCEDURES LIVE MONITOR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Active Procedures Live Monitor</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono font-semibold">
              {inSurgeryTowers.length} Operative Case{inSurgeryTowers.length === 1 ? '' : 's'}
            </span>
          </div>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            Live operative duration tracking and procedure telemetry
          </span>
        </div>

        {inSurgeryTowers.length === 0 ? (
          /* Rich Empty State when no surgery is currently active */
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 backdrop-blur-xl flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">All Surgical Suites Standby</h3>
            <p className="text-xs text-zinc-400 max-w-md mt-1 mb-4 leading-relaxed">
              Zero active laparoscopic procedures in progress across the fleet. Towers are online, heartbeat synchronized, and ready for surgical intake.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700 font-mono">
                {onlineIdleCount} Towers Ready
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                Postpaid Active
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                FR-19 Resection Shield Ready
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {inSurgeryTowers.map((tower) => {
              const activeSession = sessions.find(
                (s) => s.tower_id === tower.tower_id && (!s.end_time || s.status === 'ACTIVE' || s.status === 'IN_PROGRESS')
              );

              const elapsedSecs = getMonotonicElapsedSec(tower, activeSession);
              const elapsedFormatted = formatElapsedTime(elapsedSecs);

              const department = tower.customer_name || '';
              const balanceSec = tower.live_balance_sec ?? 0;
              const balanceMin = Math.floor(balanceSec / 60);
              const isUnlimited = tower.agreement_type === 'LEASE' || tower.agreement_type === 'POSTPAID' || (tower as any).subscription_type === 'POSTPAID';
              const isGraceActive = !isUnlimited && balanceSec <= 0 && (tower.live_grace_sec ?? 0) > 0;

              return (
                <div
                  key={tower.tower_id}
                  onClick={() => {
                    setSelectedDetailTower(tower);
                    setIsTowerDetailOpen(true);
                  }}
                  className="p-5 rounded-2xl bg-zinc-900/80 border border-emerald-500/40 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.12)] flex flex-col justify-between gap-4 relative overflow-hidden cursor-pointer hover:border-emerald-400 hover:scale-[1.005] transition-all"
                >
                  <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header: Tower ID & Pulsing Live Resection Tag */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-extrabold text-white tracking-wider">{tower.tower_id}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {tower.model || 'CCP-LUMINA'}
                          </span>
                        </div>
                        <p className="text-xs text-cyan-300/90 font-medium mt-0.5 flex items-center gap-1.5">
                          <span>{department}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        SURGERY IN-PROGRESS
                      </span>
                    </div>
                  </div>

                  {/* Metrics Grid: Elapsed Clock + Optical Balance */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Elapsed Procedure Clock */}
                    <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> Elapsed Procedure Clock
                      </span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-wider">
                          {elapsedFormatted}
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono animate-pulse">LIVE</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-1">Real-time operative clock tick</span>
                    </div>

                    {/* Optical Balance */}
                    <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isGraceActive ? 'bg-amber-500/10 border-amber-500/40' : 'bg-black/50 border-white/10'
                    }`}>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className={`w-3.5 h-3.5 ${isGraceActive ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                        Optical Balance
                      </span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-2xl sm:text-3xl font-mono font-extrabold ${isGraceActive ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isUnlimited ? 'Unlimited' : `${balanceMin} min`}
                        </span>
                        {!isUnlimited && <span className="text-xs text-zinc-400">rem.</span>}
                      </div>
                      <div className="text-[10px] mt-1">
                        {isGraceActive ? (
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> FR-19 In-Grace Buffer Active
                          </span>
                        ) : isUnlimited ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Postpaid Freedom Plan (Unmetered)
                          </span>
                        ) : (
                          <span className="text-zinc-500">
                            Agreement: <span className="text-zinc-300 font-medium">{tower.agreement_type || 'PREPAID'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attached Peripherals in Surgery */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Operative Peripherals (ICD 0x80)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${
                        tower.peripherals?.camera ?? true ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        <Camera className="w-3 h-3" /> Cam
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${
                        tower.peripherals?.light ?? true ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        <Lightbulb className="w-3 h-3" /> Light
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${
                        tower.peripherals?.pump ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        <Droplets className="w-3 h-3" /> Pump
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${
                        tower.peripherals?.insufflator ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        <Wind className="w-3 h-3" /> Insuff.
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions for this Tower */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Database className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-mono text-zinc-300">Store #{tower.store_seq ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activeSession && (
                        <div className="p-0.5 inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSessionId(activeSession.session_id);
                              setIsSessionModalOpen(true);
                            }}
                            className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-blue-400" /> Audit Log
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. QUICK ACTION COMMAND STATION */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" /> Quick Action Command Station
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              1-click clinical, financial, and regulatory operational action triggers.
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Operator Role: <span className="text-zinc-300 uppercase font-semibold">{userRole || 'Admin'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: Invoices & Postpaid Billing */}
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-zinc-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer shadow-md hover:shadow-emerald-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-emerald-300 transition-colors">
                Invoices & Billing
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block leading-snug">
                Monthly statements and usage charges
              </span>
            </div>
          </button>

          {/* Action 2: Operative Session Logs */}
          <button
            type="button"
            onClick={() => navigate('/logs')}
            className="p-3.5 rounded-xl bg-zinc-900/90 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-zinc-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer shadow-md hover:shadow-cyan-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                Operative Session Logs
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block leading-snug">
                Real-time surgical procedures and duration
              </span>
            </div>
          </button>

          {/* Action 3: Incident Complaint Logging */}
          <button
            type="button"
            onClick={() => setIsComplaintModalOpen(true)}
            className="p-3.5 rounded-xl bg-zinc-900/90 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-zinc-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer shadow-md hover:shadow-cyan-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                Log Incident Complaint
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block leading-snug">
                21 CFR Part 820.198 MDR quality intake
              </span>
            </div>
          </button>

          {/* Action 4: Maintenance Unlock PIN generation */}
          <button
            type="button"
            onClick={() => setIsMaintenanceModalOpen(true)}
            className="p-3.5 rounded-xl bg-zinc-900/90 border border-purple-500/30 hover:border-purple-500/60 hover:bg-zinc-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer shadow-md hover:shadow-purple-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <Key className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition-colors">
                Maintenance Unlock PIN
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block leading-snug">
                60-min challenge-response diagnostic OTP
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Real-Time Live Telemetry & Tower Monitor */}
      <GlassCard title="Live Fleet Telemetry & Peripheral Matrix" className="border-blue-500/20 animate-in fade-in duration-500">
        {towers.length === 0 ? (
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center rounded-xl bg-zinc-900/40 border border-dashed border-zinc-800 my-2">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <h4 className="text-lg font-bold text-white tracking-tight">No Active Towers Provisioned</h4>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md mt-1 mb-6 leading-relaxed">
              No surgical endoscopic towers are currently assigned to this hospital organization or reporting active mTLS telemetry.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/towers"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-black bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-black" />
                Provision Tower
              </Link>
              <Link
                to="/roi-studio"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
              >
                <Cpu className="w-4 h-4 text-zinc-400" />
                View Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scopedTowers.map((tower) => {
              const isOnline = Boolean(tower.is_online);
              const balanceMins = tower.live_balance_sec !== null && tower.live_balance_sec !== undefined 
                ? Math.floor(tower.live_balance_sec / 60) 
                : 0;
              const isUnlimited = tower.agreement_type === 'LEASE' || tower.agreement_type === 'POSTPAID';

              // Compute operational status
              let opStatus = {
                label: 'OFFLINE',
                badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                dotClass: 'bg-zinc-500',
                isPulse: false
              };

              if (tower.status === 'UNASSIGNED' || !tower.customer_id) {
                if (isOnline) {
                  opStatus = {
                    label: 'ONLINE (UNASSIGNED)',
                    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    dotClass: 'bg-amber-400',
                    isPulse: true
                  };
                } else {
                  opStatus = {
                    label: 'OFFLINE (UNASSIGNED)',
                    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    dotClass: 'bg-zinc-500',
                    isPulse: false
                  };
                }
              } else if (!isOnline || tower.status === 'OFFLINE') {
                opStatus = {
                  label: 'OFFLINE',
                  badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                  dotClass: 'bg-zinc-500',
                  isPulse: false
                };
              } else if (tower.hub_state === 'DISCONNECTED' || tower.status === 'HUB_DISCONNECTED') {
                opStatus = {
                  label: 'HUB DISCONNECTED',
                  badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                  dotClass: 'bg-rose-400',
                  isPulse: false
                };
              } else if (tower.hub_state === 'SCANNING') {
                opStatus = {
                  label: 'HUB CONNECTING',
                  badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  dotClass: 'bg-amber-400',
                  isPulse: true
                };
              } else if (tower.hub_state === 'DEGRADED') {
                opStatus = {
                  label: 'HUB DEGRADED',
                  badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  dotClass: 'bg-amber-500',
                  isPulse: false
                };
              } else if (tower.is_surgery_active) {
                opStatus = {
                  label: 'SURGERY ACTIVE',
                  badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]',
                  dotClass: 'bg-cyan-400',
                  isPulse: true
                };
              } else {
                opStatus = {
                  label: 'ONLINE (IDLE)',
                  badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  dotClass: 'bg-emerald-400',
                  isPulse: true
                };
              }

              const peripherals = tower.peripherals || {
                camera: Boolean(isOnline && tower.is_surgery_active),
                light: Boolean(isOnline && tower.is_surgery_active),
                pump: false,
                insufflator: false
              };

              const lastKnownTimestamp = tower.last_heartbeat_at
                ? new Date(tower.last_heartbeat_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : (tower.last_seen 
                    ? new Date(tower.last_seen).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : (tower.registered_at ? new Date(tower.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Provisioned'));

              return (
                <div
                  key={tower.tower_id}
                  onClick={() => {
                    setSelectedDetailTower(tower);
                    setIsTowerDetailOpen(true);
                  }}
                  className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/60 hover:bg-zinc-900/60 transition-all flex flex-col gap-3 cursor-pointer shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${opStatus.dotClass} ${opStatus.isPulse ? 'animate-pulse' : ''}`} />
                      <span className="font-bold text-white font-mono">{tower.tower_id}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${opStatus.badgeClass}`}>
                      {opStatus.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-gray-400 block mb-0.5">Agreement</span>
                      <span className="text-white font-medium">{tower.agreement_type || 'Unassigned'}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg">
                      <span className="text-gray-400 block mb-0.5">{isOnline ? 'Live Balance' : 'Last Known Balance'}</span>
                      <span className="text-emerald-400 font-bold">
                        {isUnlimited ? `Unlimited (${tower.agreement_type})` : `${balanceMins} min`}
                      </span>
                      {!isOnline && (
                        <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                          as of {lastKnownTimestamp}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attached Peripherals Indicator Badges */}
                  <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
                    <div className="text-[10px] uppercase font-semibold text-gray-400 mb-2 flex items-center justify-between">
                      <span>Attached Peripherals</span>
                      <span className="text-[10px] text-gray-500 font-mono">ICD 0x80</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center justify-between ${
                        peripherals.camera ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-gray-500'
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <Camera className="w-3 h-3" />
                          Camera
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${peripherals.camera ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-gray-500'}`}>
                          {peripherals.camera ? 'Active' : 'Off'}
                        </span>
                      </div>

                      <div className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center justify-between ${
                        peripherals.light ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-gray-500'
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <Lightbulb className="w-3 h-3" />
                          Light
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${peripherals.light ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-gray-500'}`}>
                          {peripherals.light ? 'Active' : 'Off'}
                        </span>
                      </div>

                      <div className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center justify-between ${
                        peripherals.pump ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-gray-500'
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <Droplets className="w-3 h-3" />
                          Pump
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${peripherals.pump ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-gray-500'}`}>
                          {peripherals.pump ? 'Active' : 'Off'}
                        </span>
                      </div>

                      <div className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center justify-between ${
                        peripherals.insufflator ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.02] border-white/5 text-gray-500'
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <Wind className="w-3 h-3" />
                          Insufflator
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${peripherals.insufflator ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-gray-500'}`}>
                          {peripherals.insufflator ? 'Active' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hardware Hub Link Indicator */}
                  {(() => {
                    const hubInfo = getHubLinkDisplay(tower.hub_state, isOnline);
                    return (
                      <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          Hardware Hub Link
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${hubInfo.dotClass}`}></span>
                          <span className="font-medium text-white text-[11px]">{hubInfo.label}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Flash Store Seq Indicator */}
                  <div className="p-2 rounded-lg border bg-white/5 border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Database className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] font-semibold">Store Seq</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-300">
                      #{tower.store_seq !== undefined ? tower.store_seq : 0}
                    </span>
                  </div>

                  {tower.is_surgery_active ? (
                    <div className="flex items-center justify-between text-xs text-cyan-300 font-medium bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Surgery Active</span>
                      </div>
                      <span className="font-mono font-bold text-cyan-200">
                        {formatElapsedTime(getMonotonicElapsedSec(tower))}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-zinc-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">
                      <span>Procedure Idle</span>
                      <span className="font-mono text-zinc-300 font-medium">
                        {tower.customer_usage_seconds != null
                          ? `${Math.round(Number(tower.customer_usage_seconds) / 60)}m usage`
                          : (tower.total_usage_seconds != null
                              ? `${Math.round(Number(tower.total_usage_seconds) / 60)}m usage`
                              : (tower.lifetime_surgery_seconds != null
                                  ? `${Math.round(Number(tower.lifetime_surgery_seconds) / 60)}m usage`
                                  : (tower.running_hours ? `${tower.running_hours}h total` : 'Ready')))}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Operations Performance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs backdrop-blur-md">
          <span className="text-zinc-400 font-medium">Total Surgical Sessions:</span>
          <span className="font-mono font-bold text-blue-400 text-sm">{totalSessions} Sessions</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs backdrop-blur-md">
          <span className="text-zinc-400 font-medium">Minutes Consumed:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{minutesConsumed.toLocaleString()} min</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs backdrop-blur-md">
          <span className="text-zinc-400 font-medium">Active Subscriptions:</span>
          <span className="font-mono font-bold text-purple-400 text-sm">{activeSubs} Active</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <GlassCard title="Minutes Consumed (Last 7 Days)" className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <AreaChart data={areaData} height={200} color="#10b981" yUnit=" min" />
        </GlassCard>

        <GlassCard title="Sessions Volume (Last 7 Days)" className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <LineChart data={lineData} height={200} strokeColor="#3b82f6" yUnit="" />
        </GlassCard>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="xl:w-1/3 flex flex-col gap-4 sm:gap-6">
          <GlassCard title="System Fleet Health" className="flex-1 flex flex-col justify-center items-center py-8">
            <ProgressGauge 
              used={onlineTowers.length} 
              total={towers.length} 
              size={180} 
              strokeWidth={16} 
            />
            <span className="text-sm text-gray-400 mt-4 text-center">
              {onlineTowers.length} of {scopedTowers.length} Towers Online ({scopedTowers.length > 0 ? Math.round((onlineTowers.length / scopedTowers.length) * 100) : 0}%)
            </span>
          </GlassCard>
          
          <GlassCard title="Top Active Towers (Mins)">
            {topTowersData.length > 0 ? (
              <BarChart data={topTowersData} height={180} barColor="#a855f7" />
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-500 mb-2">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-300">No Tower Utilization Recorded</span>
                <span className="text-[11px] text-zinc-500 mt-0.5 max-w-[220px]">
                  Procedure duration minutes will plot automatically once surgical sessions commence.
                </span>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Column (Recent Activity Feed) */}
        <div className="xl:w-2/3">
          <GlassCard title="Recent Session Activity" className="h-full max-h-[600px] overflow-y-auto custom-scrollbar">
            {recentSessions.length === 0 ? (
              <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-500 mb-3 shadow-inner">
                  <History className="w-6 h-6 text-zinc-400" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-200">No Recent Surgical Sessions</h4>
                <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
                  Historical operative session logs, duration metrics, and 21 CFR Part 11 audit records will stream here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pr-2">
                {recentSessions.map((session) => (
                  <div 
                    key={session.session_id} 
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedSessionId(session.session_id);
                      setIsSessionModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSessionId(session.session_id);
                        setIsSessionModalOpen(true);
                      }
                    }}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-blue-500/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        S
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Tower {session.tower_id}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(session.start_time).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">{formatExactSessionDuration(session)}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {session.session_id.substring(0,8)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Session Audit & Telemetry Viewer Modal */}
      <SessionDetailModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSelectedSessionId(null);
        }}
        sessionId={selectedSessionId}
      />

      {/* Direct Account Recharge / Emergency Overdraft Modal */}

      {/* 21 CFR Part 820.198 Incident Complaint Logging Modal */}
      <CreateComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        currentUserCustomerId={currentUser.customer_id}
        isHospitalAdmin={userRole === 'hospital_admin'}
        onSuccess={fetchDashboardData}
      />

      {/* Maintenance Unlock PIN Challenge-Response Generator Modal */}
      <MaintenanceUnlockModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        towers={towers}
        defaultTowerId={selectedTowerForAction || towers[0]?.tower_id}
      />

      {/* Comprehensive Tower Intelligence & Telemetry Drawer Modal */}
      <TowerDetailModal
        isOpen={isTowerDetailOpen}
        onClose={() => {
          setIsTowerDetailOpen(false);
          setSelectedDetailTower(null);
        }}
        tower={selectedDetailTower}
        subscription={selectedDetailTower ? subscriptions.find((s) => s.tower_id === selectedDetailTower.tower_id) : null}
        userRole={userRole}
        onTowerUpdated={fetchDashboardData}
        onOpenSessionModal={(sid) => {
          setSelectedSessionId(sid);
          setIsSessionModalOpen(true);
        }}
      />
    </div>
  );
};

export default Dashboard;
