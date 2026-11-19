import React, { useState, useEffect, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import CreateComplaintModal from '../components/CreateComplaintModal';
import ComplaintDetailModal from '../components/ComplaintDetailModal';
import EntitySelector from '../components/EntitySelector';
import { useToast } from '../components/ui/ToastProvider';
import {
  listComplaints,
  type Complaint,
} from '../services/api';
import {
  Search,
  Plus,
  AlertCircle,
  Activity,
  FileCheck2,
  RefreshCw,
  Eye,
  AlertTriangle,
  Building,
  Server,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  Zap,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export type LifecycleStageId = 'REPORTED' | 'INVESTIGATION' | 'CAPA_ACTIVE' | 'QA_REVIEW' | 'CLOSED';

export interface LifecycleStageConfig {
  id: LifecycleStageId;
  label: string;
  sublabel: string;
  cfrCitation: string;
  dotColor: string;
  badgeBg: string;
  headerBorder: string;
  columnBg: string;
}

export const LIFECYCLE_STAGES: LifecycleStageConfig[] = [
  {
    id: 'REPORTED',
    label: 'REPORTED',
    sublabel: 'Intake & Triage Gate',
    cfrCitation: '21 CFR §820.198(a)',
    dotColor: 'bg-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    headerBorder: 'border-blue-500/30',
    columnBg: 'bg-blue-950/10',
  },
  {
    id: 'INVESTIGATION',
    label: 'INVESTIGATION',
    sublabel: 'Root Cause & Failure Analysis',
    cfrCitation: '21 CFR §820.198(b)',
    dotColor: 'bg-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    headerBorder: 'border-indigo-500/30',
    columnBg: 'bg-indigo-950/10',
  },
  {
    id: 'CAPA_ACTIVE',
    label: 'CAPA_ACTIVE',
    sublabel: 'Corrective Action Linkage',
    cfrCitation: '21 CFR §820.100',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    headerBorder: 'border-amber-500/30',
    columnBg: 'bg-amber-950/10',
  },
  {
    id: 'QA_REVIEW',
    label: 'QA_REVIEW',
    sublabel: 'Verification & Resolution',
    cfrCitation: '21 CFR §820.198(e)',
    dotColor: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    headerBorder: 'border-emerald-500/30',
    columnBg: 'bg-emerald-950/10',
  },
  {
    id: 'CLOSED',
    label: 'CLOSED',
    sublabel: 'Pt 11 Sign-off & Tamper Seal',
    cfrCitation: '21 CFR Part 11',
    dotColor: 'bg-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    headerBorder: 'border-purple-500/30',
    columnBg: 'bg-purple-950/10',
  },
];

export const getComplaintStage = (c: Complaint): LifecycleStageId => {
  const s = (c.status || '').toUpperCase();
  if (['SUBMITTED', 'REPORTED', 'NEW', 'INTAKE'].includes(s)) return 'REPORTED';
  if (['TRIAGED', 'INVESTIGATING', 'INVESTIGATION', 'IN_PROGRESS'].includes(s)) return 'INVESTIGATION';
  if (['CAPA_ACTIVE', 'CAPA_REVIEW', 'CAPA'].includes(s)) return 'CAPA_ACTIVE';
  if (['QA_REVIEW', 'RESOLVED', 'RESOLUTION_PENDING'].includes(s)) return 'QA_REVIEW';
  if (['CLOSED', 'SEALED', 'ARCHIVED'].includes(s)) return 'CLOSED';
  return 'REPORTED';
};

export interface MdrTimeline {
  isMdr: boolean;
  isSeriousInjury: boolean;
  thirtyDayDaysLeft: number;
  thirtyDayOverdue: boolean;
  fiveDayDaysLeft: number;
  fiveDayOverdue: boolean;
  deadlineDate: Date;
  fiveDayDeadlineDate: Date;
}

export function computeMdrTimelines(complaint: Complaint): MdrTimeline {
  const isMdr = Boolean(complaint.is_mdr_reportable || complaint.severity === 'CRITICAL');
  const isSeriousInjury =
    complaint.severity === 'CRITICAL' ||
    complaint.category === 'PATIENT_INJURY' ||
    complaint.category === 'SAFETY_HAZARD';

  const createdAtMs = new Date(complaint.created_at).getTime() || Date.now();
  const thirtyDayDeadlineMs = createdAtMs + 30 * 24 * 60 * 60 * 1000;
  const fiveDayDeadlineMs = createdAtMs + 5 * 24 * 60 * 60 * 1000;

  const now = Date.now();
  const thirtyRemainingMs = thirtyDayDeadlineMs - now;
  const fiveRemainingMs = fiveDayDeadlineMs - now;

  const thirtyDayDaysLeft = Math.ceil(thirtyRemainingMs / (24 * 60 * 60 * 1000));
  const thirtyDayOverdue = thirtyRemainingMs < 0;

  const fiveDayDaysLeft = Math.ceil(fiveRemainingMs / (24 * 60 * 60 * 1000));
  const fiveDayOverdue = fiveRemainingMs < 0;

  return {
    isMdr,
    isSeriousInjury,
    thirtyDayDaysLeft,
    thirtyDayOverdue,
    fiveDayDaysLeft,
    fiveDayOverdue,
    deadlineDate: new Date(thirtyDayDeadlineMs),
    fiveDayDeadlineDate: new Date(fiveDayDeadlineMs),
  };
}

const ComplaintsManagement: React.FC = () => {
  const { addToast } = useToast();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userRole = currentUser.role || '';
  const userCustomerId = currentUser.customer_id;
  const isHospitalAdmin = userRole === 'hospital_admin';

  // View Mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedTowerId, setSelectedTowerId] = useState<string>('');

  // Data
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (isHospitalAdmin && userCustomerId) {
        params.customer_id = userCustomerId;
      } else if (selectedCustomerId) {
        params.customer_id = selectedCustomerId;
      }
      if (selectedTowerId) params.tower_id = selectedTowerId;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await listComplaints(params);
      setComplaints(res.items || []);
      setTotalCount(res.total || 0);
    } catch {
      addToast('Failed to load customer complaints.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, severityFilter]);

  // Derived KPI metrics
  const criticalCount = useMemo(() => {
    return complaints.filter((c) => c.severity === 'CRITICAL' || c.is_mdr_reportable).length;
  }, [complaints]);

  const investigatingCount = useMemo(() => {
    return complaints.filter((c) => ['TRIAGED', 'INVESTIGATING', 'CAPA_REVIEW', 'INVESTIGATION'].includes(c.status)).length;
  }, [complaints]);

  const closedCount = useMemo(() => {
    return complaints.filter((c) => c.status === 'CLOSED' || c.status === 'RESOLVED').length;
  }, [complaints]);

  // Grouped complaints for Kanban
  const kanbanStages = useMemo(() => {
    const stageMap: Record<LifecycleStageId, Complaint[]> = {
      REPORTED: [],
      INVESTIGATION: [],
      CAPA_ACTIVE: [],
      QA_REVIEW: [],
      CLOSED: [],
    };

    complaints.forEach((c) => {
      const stage = getComplaintStage(c);
      stageMap[stage].push(c);
    });

    return stageMap;
  }, [complaints]);

  const handleOpenDetail = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'REPORTED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">REPORTED</span>;
      case 'TRIAGED':
      case 'INVESTIGATING':
      case 'INVESTIGATION':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">INVESTIGATION</span>;
      case 'CAPA_REVIEW':
      case 'CAPA_ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">CAPA ACTIVE</span>;
      case 'RESOLVED':
      case 'QA_REVIEW':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">QA REVIEW</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">CLOSED (Pt 11)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">{status}</span>;
    }
  };

  const getSeverityBadge = (severity: string, isMdr: boolean) => {
    if (isMdr) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">MDR REPORTABLE</span>;
    }
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">LOW</span>;
    }
  };

  // Visual FDA 30-Day MDR Reporting Deadline Countdown Clock
  const renderMdrCountdownClock = (complaint: Complaint) => {
    const timeline = computeMdrTimelines(complaint);
    const isClosed = complaint.status === 'CLOSED' || complaint.status === 'RESOLVED';

    if (!timeline.isMdr && !timeline.isSeriousInjury) {
      return null;
    }

    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> MDR Filed
        </span>
      );
    }

    if (timeline.thirtyDayOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-red-950/80 text-red-300 border border-red-500/60 shadow-lg shadow-red-950/50 animate-pulse">
          <Clock className="w-3.5 h-3.5 text-red-400" />
          <span>MDR OVERDUE ({Math.abs(timeline.thirtyDayDaysLeft)}d)</span>
        </span>
      );
    }

    if (timeline.thirtyDayDaysLeft <= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/50 shadow-md shadow-red-900/30 animate-pulse">
          <Clock className="w-3.5 h-3.5 text-red-400" />
          <span>FDA 30d: {timeline.thirtyDayDaysLeft}d left!</span>
        </span>
      );
    }

    if (timeline.thirtyDayDaysLeft <= 10) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>FDA 30d: {timeline.thirtyDayDaysLeft}d left</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        <span>FDA 30d: {timeline.thirtyDayDaysLeft}d left</span>
      </span>
    );
  };

  // 5-Day Serious Injury Alert Badge (21 CFR §803.53)
  const renderSeriousInjuryAlertBadge = (complaint: Complaint) => {
    const timeline = computeMdrTimelines(complaint);
    const isClosed = complaint.status === 'CLOSED' || complaint.status === 'RESOLVED';
    if (!timeline.isSeriousInjury) return null;

    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10">
          5d Remediated
        </span>
      );
    }

    if (timeline.fiveDayOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-extrabold bg-red-900/80 text-white border border-red-500 shadow-md shadow-red-900/60 animate-pulse">
          <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
          <span>5-DAY BREACH ({Math.abs(timeline.fiveDayDaysLeft)}d)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-red-500/25 text-red-200 border border-red-500/60 shadow-md shadow-red-950/40">
        <Zap className="w-3 h-3 text-red-400 fill-red-400 animate-pulse" />
        <span>5-DAY ALERT: {timeline.fiveDayDaysLeft}d left</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Cockpit */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span>FDA Quality Complaints & eMDR Studio</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span className="text-blue-400 font-mono font-medium">21 CFR Part 820.198</span>
            <span>•</span>
            <span className="text-purple-400 font-mono font-medium">Part 803 eMDR</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono font-medium">Part 11 Tamper-Evident Lifecycle</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Kanban / Table View Toggle */}
          <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>820 Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={fetchComplaints}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors border border-white/10 cursor-pointer"
            title="Refresh Complaints"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Quality Complaint</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center gap-4 border border-blue-500/20 bg-blue-950/10">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{totalCount}</div>
            <div className="text-xs text-gray-400">Total Registered Files</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4 border border-red-500/20 bg-red-950/10">
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/30 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-red-300">{criticalCount}</div>
            <div className="text-xs text-gray-400">Critical & MDR Reportable</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4 border border-cyan-500/20 bg-cyan-950/10">
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-cyan-300">{investigatingCount}</div>
            <div className="text-xs text-gray-400">Active Investigation / RCA</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4 border border-emerald-500/20 bg-emerald-950/10">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-400">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-300">{closedCount}</div>
            <div className="text-xs text-gray-400">Part 11 Signed & Closed</div>
          </div>
        </GlassCard>
      </div>

      {/* Search & Filter Bar */}
      <GlassCard className="p-4 space-y-3 border border-white/10 bg-black/40">
        <EntitySelector
          selectedCustomerId={selectedCustomerId}
          selectedTowerId={selectedTowerId}
          disabledCustomer={isHospitalAdmin}
          showDistributor={!isHospitalAdmin}
          onCustomerChange={(id) => {
            setSelectedCustomerId(id);
          }}
          onTowerChange={(id) => {
            setSelectedTowerId(id);
          }}
          onChange={({ customerId: cid, towerId: tid }) => {
            setSelectedCustomerId(cid);
            setSelectedTowerId(tid);
          }}
          size="sm"
        />

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchComplaints()}
              placeholder="Search by Complaint ID, Title, Tower ID, Customer..."
              className="w-full pl-9 pr-4 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 placeholder-gray-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Reported / Intake</option>
              <option value="TRIAGED">Triaged</option>
              <option value="INVESTIGATING">Investigation</option>
              <option value="CAPA_REVIEW">CAPA Active</option>
              <option value="RESOLVED">QA Review</option>
              <option value="CLOSED">Closed (Pt 11)</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <button
              onClick={fetchComplaints}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs text-white font-medium transition-colors cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </GlassCard>

      {/* VIEW MODE: 21 CFR Part 820.198 KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white">21 CFR Part 820.198 Stage Pipeline</span>
              <span className="text-gray-500">| Linear regulatory progression</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> FDA 30-Day MDR Clock
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-red-400">
                <Zap className="w-3.5 h-3.5 text-red-400" /> 5-Day Serious Injury Alert
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {LIFECYCLE_STAGES.map((stage) => {
              const stageItems = kanbanStages[stage.id] || [];

              return (
                <div
                  key={stage.id}
                  className={`rounded-2xl border ${stage.headerBorder} ${stage.columnBg} p-3 flex flex-col flex-1 min-h-[580px]`}
                >
                  {/* Stage Column Header */}
                  <div className="pb-3 mb-3 border-b border-white/10 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          {stage.label}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white/10 text-gray-300">
                          {stageItems.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{stage.sublabel}</div>
                      <div className="text-[9px] font-mono text-gray-500 mt-0.5">{stage.cfrCitation}</div>
                    </div>
                  </div>

                  {/* Stage Cards Container */}
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[680px] pr-1 custom-scrollbar">
                    {stageItems.length === 0 ? (
                      <div className="py-12 text-center text-xs text-gray-500 border border-dashed border-white/5 rounded-xl bg-black/20">
                        No tickets in {stage.label.toLowerCase()}
                      </div>
                    ) : (
                      stageItems.map((complaint) => {
                        const mdrTimeline = computeMdrTimelines(complaint);

                        return (
                          <div
                            key={complaint.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenDetail(complaint)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenDetail(complaint);
                              }
                            }}
                            className={`p-3.5 rounded-xl border bg-black/60 hover:bg-black/80 transition-all cursor-pointer group shadow-sm hover:shadow-md ${
                              mdrTimeline.isSeriousInjury
                                ? 'border-red-500/40 hover:border-red-500/70'
                                : complaint.is_mdr_reportable
                                ? 'border-amber-500/40 hover:border-amber-500/70'
                                : 'border-white/10 hover:border-blue-500/40'
                            }`}
                          >
                            {/* Card Top: ID and Badges */}
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <span className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                                {complaint.id}
                              </span>
                              <div className="flex flex-col items-end gap-1">
                                {getSeverityBadge(complaint.severity, complaint.is_mdr_reportable)}
                              </div>
                            </div>

                            {/* Title */}
                            <h4 className="text-xs font-semibold text-white line-clamp-2 mb-2 group-hover:text-blue-200 transition-colors">
                              {complaint.title}
                            </h4>

                            {/* Regulatory Alert Badges (Deadlines & 5-day alert) */}
                            <div className="space-y-1.5 mb-2.5">
                              {renderSeriousInjuryAlertBadge(complaint)}
                              {renderMdrCountdownClock(complaint)}
                            </div>

                            {/* Facility & Tower metadata */}
                            <div className="space-y-1 text-[11px] text-gray-400 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-1.5 truncate">
                                <Building className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                <span className="text-gray-300 font-medium truncate">{complaint.customer_id}</span>
                              </div>
                              {complaint.tower_id && (
                                <div className="flex items-center gap-1.5 font-mono text-[10px] text-blue-300">
                                  <Server className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                  <span>{complaint.tower_id}</span>
                                </div>
                              )}
                            </div>

                            {/* Card Footer: Assignee & Date */}
                            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-white/5 text-[10px] text-gray-400">
                              <span className="truncate">
                                {complaint.assignee_id ? (
                                  <span className="text-gray-300">{complaint.assignee_id}</span>
                                ) : (
                                  <span className="text-gray-500 italic">Unassigned</span>
                                )}
                              </span>
                              <span className="text-gray-500 font-mono">
                                {new Date(complaint.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE: TABLE VIEW */}
      {viewMode === 'table' && (
        <GlassCard className="overflow-hidden border border-white/10 bg-black/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Facility / Tower</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Severity & MDR</th>
                  <th className="py-3 px-4">Stage / Status</th>
                  <th className="py-3 px-4">FDA Countdown / Alert</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Logged At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading customer complaint records...
                    </td>
                  </tr>
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      No customer complaints found matching active filters.
                    </td>
                  </tr>
                ) : (
                  complaints.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-blue-400">{item.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-gray-400" /> {item.customer_id}
                        </div>
                        {item.tower_id && (
                          <div className="text-xs text-blue-300 font-mono flex items-center gap-1 mt-0.5">
                            <Server className="w-3 h-3 text-blue-400" /> {item.tower_id}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="text-[11px] text-gray-400">{item.category.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getSeverityBadge(item.severity, item.is_mdr_reportable)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(item.status)}
                          <span className="text-[10px] font-mono text-gray-500 uppercase">
                            Stage: {getComplaintStage(item)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {renderSeriousInjuryAlertBadge(item)}
                          {renderMdrCountdownClock(item)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-300">
                        {item.assignee_id ? (
                          <span className="text-gray-200">{item.assignee_id}</span>
                        ) : (
                          <span className="text-gray-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400 font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View File</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Modals */}
      <CreateComplaintModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchComplaints}
        currentUserCustomerId={userCustomerId}
        isHospitalAdmin={isHospitalAdmin}
      />

      <ComplaintDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedComplaint(null);
        }}
        complaint={selectedComplaint}
        onRefresh={() => {
          fetchComplaints();
          setDetailModalOpen(false);
        }}
        currentUserRole={userRole}
      />
    </div>
  );
};

export default ComplaintsManagement;
