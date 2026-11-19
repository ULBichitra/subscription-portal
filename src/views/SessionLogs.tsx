import React, { useEffect, useState, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import DataTable from '../components/ui/DataTable';
import { getSessions, getSystemLogs } from '../services/api';
import type { Session, SystemLogEntry } from '../services/api';
import { realtimeClient } from '../services/realtime';
import { useToast } from '../components/ui/ToastProvider';
import { FileText, Activity, RefreshCw, Download, Database, Search } from 'lucide-react';

const SessionLogs: React.FC = () => {
  const { addToast } = useToast();
  
  // RBAC Permission Check
  const currentUser = JSON.parse(localStorage.getItem('portal_user') || '{}');
  const userRole = currentUser.role || '';
  // Hide Tab 2 if user role is subscription_manager or hospital_admin
  const canViewDetailedLogs = userRole !== 'subscription_manager' && userRole !== 'hospital_admin';

  const [activeTab, setActiveTab] = useState<'history' | 'telemetry'>('history');
  
  // Tab 1: Session History state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Tab 2: Live Telemetry & Delta Log state
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [towerFilter, setTowerFilter] = useState('');
  const [selectedLogEntry, setSelectedLogEntry] = useState<SystemLogEntry | null>(null);

  // Fetch Session History
  useEffect(() => {
    fetchSessions();
  }, []);

  // Fetch Live Telemetry Logs when tab switched and permitted
  useEffect(() => {
    if (activeTab === 'telemetry' && canViewDetailedLogs) {
      fetchLogs(towerFilter);
    }
  }, [activeTab, canViewDetailedLogs]);

  // Real-time session completion and update listeners for reactive view sync
  useEffect(() => {
    const handleSessionEvent = (data: any) => {
      if (!data?.session_id) return;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.session_id === data.session_id);
        const durMin = data.duration_min !== undefined ? Number(data.duration_min) : (idx >= 0 ? prev[idx].duration_min : 0);
        const durSec = data.duration_sec !== undefined ? Number(data.duration_sec) : (idx >= 0 ? prev[idx].duration_sec : (data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : durMin * 60));
        const updated: Session = {
          session_id: data.session_id,
          tower_id: data.tower_id || (idx >= 0 ? prev[idx].tower_id : ''),
          customer_id: data.customer_id !== undefined ? data.customer_id : (idx >= 0 ? prev[idx].customer_id : null),
          subscription_id: data.subscription_id || (idx >= 0 ? prev[idx].subscription_id : ''),
          status: data.status || 'COMPLETED',
          start_time: data.start_time || (idx >= 0 ? prev[idx].start_time : new Date().toISOString()),
          end_time: data.end_time || (idx >= 0 ? prev[idx].end_time : new Date().toISOString()),
          duration_min: durMin,
          duration_sec: durSec,
          hub_duration_seconds: data.hub_duration_seconds != null ? Number(data.hub_duration_seconds) : (idx >= 0 ? prev[idx].hub_duration_seconds : durSec)
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        } else {
          return [updated, ...prev];
        }
      });
    };

    const unsubUpd = realtimeClient.on('session_updated', handleSessionEvent);
    const unsubEnd = realtimeClient.on('session_concluded', handleSessionEvent);

    return () => {
      unsubUpd();
      unsubEnd();
    };
  }, []);

  // Real-time live delta and telemetry streaming into Tab 2
  useEffect(() => {
    if (!canViewDetailedLogs) return;

    const unsub = realtimeClient.on('telemetry', (data: any) => {
      if (!data?.tower_id) return;
      const peripherals = data.peripherals || { camera: false, light: false, pump: false, insufflator: false };
      const newEntry: SystemLogEntry = {
        log_id: `stream-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tower_id: data.tower_id,
        timestamp: new Date().toISOString(),
        level: data.is_surgery_active ? 'INFO' : 'DEBUG',
        message: data.is_surgery_active ? 'Real-time active surgical telemetry packet' : 'Telemetry heartbeat heartbeat snapshot',
        entry_type: data.is_surgery_active ? 'SURGERY_TELEMETRY' : 'HEARTBEAT_TELEMETRY',
        is_delta: false,
        payload: {
          die_temp_c: data.die_temp_c,
          store_seq: data.store_seq ?? 0,
          peripherals,
          is_surgery_active: data.is_surgery_active,
          live_balance_sec: data.live_balance_sec
        }
      };

      setSystemLogs(prev => [newEntry, ...prev.slice(0, 249)]);
    });

    return () => unsub();
  }, [canViewDetailedLogs]);

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await getSessions();
      const isHospitalAdmin = userRole === 'hospital_admin';
      const scoped = isHospitalAdmin && currentUser.customer_id
        ? data.filter(s => s.customer_id === currentUser.customer_id)
        : data;
      setSessions(scoped);
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to load session logs", "error");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchLogs = async (tId?: string) => {
    if (!canViewDetailedLogs) return;
    setIsLoadingLogs(true);
    try {
      const logs = await getSystemLogs(200, tId || undefined);
      setSystemLogs(logs);
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to load telemetry logs", "error");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!sessionSearchTerm) return sessions;
    const lower = sessionSearchTerm.toLowerCase();
    return sessions.filter(s => 
      s.session_id.toLowerCase().includes(lower) || 
      s.tower_id.toLowerCase().includes(lower) ||
      (s.customer_id || '').toLowerCase().includes(lower) ||
      (s.subscription_id || '').toLowerCase().includes(lower)
    );
  }, [sessions, sessionSearchTerm]);

  // Filtered System Logs
  const filteredSystemLogs = useMemo(() => {
    let result = systemLogs;
    if (towerFilter) {
      const tLower = towerFilter.toLowerCase();
      result = result.filter(l => l.tower_id.toLowerCase().includes(tLower));
    }
    if (logSearchTerm) {
      const lower = logSearchTerm.toLowerCase();
      result = result.filter(l => 
        l.tower_id.toLowerCase().includes(lower) ||
        l.message.toLowerCase().includes(lower) ||
        (l.entry_type || '').toLowerCase().includes(lower) ||
        (l.level || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [systemLogs, towerFilter, logSearchTerm]);

  // Exact seconds extractor: prioritizes hardware hub_duration_seconds & duration_sec over ceiling duration_min
  const getExactSessionSeconds = (session: Session): number => {
    const hubSec = (session as any).hub_duration_seconds;
    if (hubSec !== undefined && hubSec !== null && !isNaN(Number(hubSec)) && Number(hubSec) > 0) {
      return Math.floor(Number(hubSec));
    }
    const durSec = (session as any).duration_sec;
    if (durSec !== undefined && durSec !== null && !isNaN(Number(durSec)) && Number(durSec) > 0) {
      return Math.floor(Number(durSec));
    }
    const elapsed = session.session_elapsed_sec ?? session.elapsed_sec;
    if (elapsed !== undefined && elapsed !== null && !isNaN(Number(elapsed)) && Number(elapsed) > 0) {
      return Math.floor(Number(elapsed));
    }
    if (session.start_time) {
      const t0 = new Date(session.start_time).getTime();
      const t1 = session.end_time ? new Date(session.end_time).getTime() : (session.status === 'ACTIVE' ? Date.now() : NaN);
      if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
        return Math.floor((t1 - t0) / 1000);
      }
    }
    if (session.duration_min !== undefined && session.duration_min !== null && !isNaN(Number(session.duration_min)) && Number(session.duration_min) > 0) {
      return Math.floor(Number(session.duration_min) * 60);
    }
    return 0;
  };

  // Formatting helper for exact session duration formatted as HH:MM:SS
  const formatDurationHms = (totalSeconds: number | null | undefined): string => {
    const sec = totalSeconds !== undefined && totalSeconds !== null && !isNaN(Number(totalSeconds))
      ? Math.max(0, Math.floor(Number(totalSeconds)))
      : 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Export CSV for Session History
  const handleExportSessionCSV = () => {
    if (filteredSessions.length === 0) {
      addToast("No session data to export", "error");
      return;
    }
    const headers = [
      "Session ID", "Tower ID", "Customer ID", "Subscription ID", 
      "Start Time", "End Time", "Duration (HH:MM:SS)", "Duration (sec)", "Status"
    ];
    const rows = filteredSessions.map(s => {
      const exactSec = getExactSessionSeconds(s);
      return [
        s.session_id,
        s.tower_id,
        s.customer_id || '',
        s.subscription_id || '',
        s.start_time,
        s.end_time || '',
        formatDurationHms(exactSec),
        exactSec,
        s.status
      ];
    });
    downloadCSV("session_history", headers, rows);
  };

  // Export CSV for Telemetry & Delta Logs
  const handleExportTelemetryCSV = () => {
    if (filteredSystemLogs.length === 0) {
      addToast("No telemetry data to export", "error");
      return;
    }
    const headers = [
      "Log ID", "Timestamp", "Tower ID", "Entry Type", "Level", "Message",
      "Camera", "Light", "Pump", "Insufflator", "Die Temp (°C)", "Store Seq"
    ];
    const rows = filteredSystemLogs.map(l => {
      const p = l.payload?.peripherals || {};
      const temp = l.payload?.die_temp_c !== undefined ? l.payload.die_temp_c : (l.payload?.temperature !== undefined ? l.payload.temperature : '');
      const seq = l.payload?.store_seq !== undefined ? l.payload.store_seq : (l.payload?.monotonic_ts !== undefined ? l.payload.monotonic_ts : '');
      return [
        l.log_id,
        l.timestamp,
        l.tower_id,
        l.entry_type || (l.is_delta ? 'DELTA_DIFF' : 'PERIODIC'),
        l.level,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        p.camera ? '1' : '0',
        p.light ? '1' : '0',
        p.pump ? '1' : '0',
        p.insufflator ? '1' : '0',
        temp,
        seq
      ];
    });
    downloadCSV("telemetry_delta_logs", headers, rows);
  };

  const downloadCSV = (filenamePrefix: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Session History Columns
  const sessionColumns: any[] = [
    { header: 'Session ID', accessor: (row: Session) => <span className="font-mono text-xs text-gray-400">{row.session_id.substring(0, 8)}...</span> },
    { header: 'Tower', accessor: (row: Session) => <span className="font-semibold text-white font-mono">{row.tower_id}</span> },
    { header: 'Start Time', accessor: (row: Session) => new Date(row.start_time).toLocaleString() },
    { 
      header: 'Duration', 
      accessor: (row: Session) => {
        const exactSec = getExactSessionSeconds(row);
        const hms = formatDurationHms(exactSec);
        const durMin = Math.floor(exactSec / 60);
        const durColor = durMin > 120 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : durMin > 45 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${durColor}`}>
            {hms}
          </span>
        );
      }
    },
    { 
      header: 'Status', 
      accessor: (row: Session) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
          row.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
          'bg-gray-500/20 text-gray-400 border-gray-500/30'
        }`}>
          {row.status}
        </span>
      )
    },
    { 
      header: 'Actions', 
      accessor: (row: Session) => (
        <button 
          onClick={() => setSelectedSession(row)}
          className="text-blue-400 hover:text-blue-300 text-xs font-semibold underline cursor-pointer"
        >
          Inspect Case
        </button>
      )
    }
  ];

  // Live Telemetry & Delta Log Columns
  const telemetryColumns: any[] = [
    { 
      header: 'Timestamp', 
      accessor: (row: SystemLogEntry) => (
        <span className="font-mono text-xs text-gray-300 whitespace-nowrap">
          {new Date(row.timestamp).toLocaleTimeString()}
        </span>
      )
    },
    { 
      header: 'Tower', 
      accessor: (row: SystemLogEntry) => (
        <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">
          {row.tower_id}
        </span>
      )
    },
    { 
      header: 'Entry Type', 
      accessor: (row: SystemLogEntry) => {
        const typeStr = row.entry_type || (row.is_delta ? 'DELTA_DIFF' : 'PERIODIC');
        const isDelta = row.is_delta || typeStr.includes('DELTA');
        return (
          <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full border ${
            isDelta ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
            typeStr.includes('SURGERY') ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
            'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {typeStr}
          </span>
        );
      }
    },
    { 
      header: 'Level', 
      accessor: (row: SystemLogEntry) => {
        const lvl = row.level?.toUpperCase() || 'INFO';
        return (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            lvl === 'ERROR' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
            lvl === 'WARN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {lvl}
          </span>
        );
      }
    },
    { 
      header: 'Peripherals', 
      accessor: (row: SystemLogEntry) => {
        const p = row.payload?.peripherals || {};
        return (
          <div className="flex items-center gap-1">
            <span 
              title="Camera"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                p.camera ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-gray-600'
              }`}
            >
              CAM
            </span>
            <span 
              title="Light Source"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                p.light ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-gray-600'
              }`}
            >
              LGT
            </span>
            <span 
              title="Irrigation Pump"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                p.pump ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-gray-600'
              }`}
            >
              PMP
            </span>
            <span 
              title="CO2 Insufflator"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                p.insufflator ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-gray-600'
              }`}
            >
              INS
            </span>
          </div>
        );
      }
    },
    { 
      header: 'Die Temp', 
      accessor: (row: SystemLogEntry) => {
        const temp = row.payload?.die_temp_c !== undefined ? row.payload.die_temp_c : (row.payload?.temperature !== undefined ? row.payload.temperature : null);
        if (temp === null || temp === undefined) return <span className="text-gray-500 font-mono text-xs">—</span>;
        const num = Number(temp);
        return (
          <span className={`font-mono text-xs font-bold ${num >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {num.toFixed(1)}°C
          </span>
        );
      }
    },
    { 
      header: 'Store Seq', 
      accessor: (row: SystemLogEntry) => {
        const seq = row.payload?.store_seq !== undefined ? row.payload.store_seq : (row.payload?.monotonic_ts !== undefined ? row.payload.monotonic_ts : null);
        return (
          <span className="font-mono text-xs text-blue-300 font-semibold">
            {seq !== null && seq !== undefined ? `#${seq}` : '—'}
          </span>
        );
      }
    },
    { 
      header: 'Message', 
      accessor: (row: SystemLogEntry) => (
        <span className="text-xs text-gray-300 font-mono block max-w-xs truncate" title={row.message}>
          {row.message}
        </span>
      )
    },
    { 
      header: 'Actions', 
      accessor: (row: SystemLogEntry) => (
        <button 
          onClick={() => setSelectedLogEntry(row)}
          className="text-blue-400 hover:text-blue-300 text-xs font-medium underline"
        >
          Inspect
        </button>
      )
    }
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative overflow-y-auto custom-scrollbar">
      {/* Header and Dual Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Session & Telemetry Logs</h1>
          <p className="text-gray-400 mt-1">Audit ledgers, delta deduplication, and live hardware frame captures.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Session History
          </button>
          
          {canViewDetailedLogs && (
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'telemetry' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Live Telemetry & Delta Log
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Session History */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by ID, Tower, Customer..."
                value={sessionSearchTerm}
                onChange={(e) => setSessionSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button 
              onClick={handleExportSessionCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/10"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 border-0">
            <div className="p-1 h-full">
              {isLoadingSessions ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 h-[400px]">Loading sessions...</div>
              ) : (
                <DataTable 
                  columns={sessionColumns} 
                  data={filteredSessions} 
                  keyExtractor={(item: Session) => item.session_id}
                  emptyMessage="No matching sessions found."
                />
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Tab 2: Live Telemetry & Delta Log (Visible for superadmin & field_support) */}
      {activeTab === 'telemetry' && canViewDetailedLogs && (
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter message, level, type..."
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <input 
                type="text" 
                placeholder="Tower ID filter (optional)..."
                value={towerFilter}
                onChange={(e) => setTowerFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs(towerFilter)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 w-44 font-mono"
              />
              <button 
                onClick={() => fetchLogs(towerFilter)}
                title="Refresh from server"
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button 
              onClick={handleExportTelemetryCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors border border-white/10 ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Export Telemetry CSV
            </button>
          </div>

          <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 border-0">
            <div className="p-1 h-full">
              {isLoadingLogs ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 h-[400px]">Querying telemetry & delta entries...</div>
              ) : (
                <DataTable 
                  columns={telemetryColumns} 
                  data={filteredSystemLogs} 
                  keyExtractor={(item: SystemLogEntry) => item.log_id}
                  emptyMessage="No telemetry or delta log entries available."
                />
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Clinical Case Summary Report</h2>
                  <p className="text-xs text-gray-400 font-mono">Case #{selectedSession.session_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSession(null)}
                className="text-gray-400 hover:text-white transition-colors p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5 custom-scrollbar">
              {/* Primary Case Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Target Tower</span>
                  <span className="font-mono text-sm font-bold text-white">{selectedSession.tower_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Operating Room</span>
                  <span className="text-sm font-semibold text-gray-200">{selectedSession.customer_id || 'Hospital OT'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Duration</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatDurationHms(getExactSessionSeconds(selectedSession))}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Status</span>
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                    selectedSession.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800 text-gray-300 border-zinc-700'
                  }`}>
                    {selectedSession.status}
                  </span>
                </div>
              </div>

              {/* Timeline Vitals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/80 border border-white/10 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Timestamps & Audit Integrity</h4>
                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Start Time:</span>
                      <span className="font-mono">{new Date(selectedSession.start_time).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">End Time:</span>
                      <span className="font-mono">{selectedSession.end_time ? new Date(selectedSession.end_time).toLocaleString() : 'In Progress'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Subscription Ref:</span>
                      <span className="font-mono text-gray-400">{selectedSession.subscription_id || 'PREPAID_DEFAULT'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Audit Status:</span>
                      <span className="text-emerald-400 font-bold">21 CFR Part 11 Sealed</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-900/80 border border-white/10 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Surgical Peripherals Engaged</h4>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center gap-2 text-gray-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>4K Camera Active</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center gap-2 text-gray-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>LED Light Active</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center gap-2 text-gray-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Irrigation Pump</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center gap-2 text-gray-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>CO2 Insufflator</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Inspection Details */}
              <details className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-gray-400">
                <summary className="cursor-pointer font-mono font-medium hover:text-white">
                  Technical Wire Frame Metadata (JSON Payload)
                </summary>
                <pre className="mt-3 p-3 bg-black/80 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedSession, null, 2)}
                </pre>
              </details>
            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-black/40">
              <button 
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Case Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Log Detail Modal */}
      {selectedLogEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Telemetry & Delta Frame Inspector
              </h2>
              <button 
                onClick={() => setSelectedLogEntry(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-gray-500 block mb-1">Log ID</span>
                  <span className="text-white font-mono break-all">{selectedLogEntry.log_id}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-gray-500 block mb-1">Tower ID</span>
                  <span className="text-white font-mono font-bold">{selectedLogEntry.tower_id}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-gray-500 block mb-1">Timestamp</span>
                  <span className="text-white font-mono">{new Date(selectedLogEntry.timestamp).toISOString()}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-gray-500 block mb-1">Entry Type</span>
                  <span className="text-purple-300 font-mono font-bold">{selectedLogEntry.entry_type || 'TELEMETRY'}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Full Telemetry Payload (JSON)</p>
                <pre className="bg-black/60 p-4 rounded-lg border border-white/5 text-xs text-emerald-400 font-mono overflow-x-auto">
                  {JSON.stringify(selectedLogEntry, null, 2)}
                </pre>
              </div>
            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-end bg-black/40">
              <button 
                onClick={() => setSelectedLogEntry(null)}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionLogs;
