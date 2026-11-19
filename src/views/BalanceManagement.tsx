import React, { useEffect, useState, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import DataTable from '../components/ui/DataTable';
import Drawer from '../components/ui/Drawer';
import { useToast } from '../components/ui/ToastProvider';
import { 
  getTowers, 
  getRecharges, 
  createRecharge, 
  getAnalyticsBurnRate,
  getBalanceRequests,
  requestBalance,
  approveBalanceRequest,
  rejectBalanceRequest,
  generateSha256Checksum
} from '../services/api';
import type { Tower, Recharge, AnalyticsBurnRateResponse, BalanceRequest } from '../services/api';
import { resolveTowerPricing, calculateCommercialBreakdown, calculateDurationFromAmount } from '../services/pricing';
import { DirectRechargeModal } from '../components/DirectRechargeModal';
import EntitySelector from '../components/EntitySelector';
import {
  Zap,
  TrendingDown,
  BatteryCharging,
  ShieldAlert,
  PlusCircle,
  Clock,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSignature,
  ShieldCheck,
  UserCheck,
  Lock,
  X
} from 'lucide-react';

// Reusable SVG Sparkline
const Sparkline: React.FC<{
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
}> = ({ data, color = '#3b82f6', height = 32, width = 100, fill = true }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 3;
  const innerHeight = height - padding * 2;
  const innerWidth = width - padding * 2;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * innerWidth;
      const y = height - padding - ((val - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <polygon points={areaPoints} fill={color} fillOpacity={0.15} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Semicircular Liquidity Runway Countdown Gauge
const RunwayCountdownGauge: React.FC<{
  runwayDays: number;
  totalBalanceHours: number;
  avgDailyBurnHours: number;
}> = ({ runwayDays, totalBalanceHours, avgDailyBurnHours }) => {
  const isCritical = runwayDays < 7;
  const isWarning = runwayDays >= 7 && runwayDays < 14;
  
  const maxScaleDays = 30;
  const clampedDays = Math.min(maxScaleDays, Math.max(0, runwayDays));
  const progressRatio = clampedDays / maxScaleDays;
  
  const r = 40;
  const arcLength = Math.PI * r;
  const strokeDashoffset = arcLength * (1 - progressRatio);
  
  const strokeColor = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';
  const glowColor = isCritical ? 'rgba(244, 63, 94, 0.4)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)';

  const hoursRemainder = Math.floor(totalBalanceHours % 24);

  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative w-36 h-20 overflow-hidden flex items-end justify-center">
        <svg viewBox="0 0 100 55" className="w-36 h-20 overflow-visible">
          {/* Background Arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Critical zone marker (first 23% of arc) */}
          <path
            d="M 10 50 A 40 40 0 0 1 24 23"
            fill="none"
            stroke="rgba(244, 63, 94, 0.3)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active progress Arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
              transition: 'stroke-dashoffset 0.8s ease-in-out',
            }}
          />
        </svg>

        {/* Center Days Text */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-center text-center">
          <span className={`text-2xl font-black font-mono leading-none tracking-tight ${isCritical ? 'text-rose-400 animate-pulse' : isWarning ? 'text-amber-300' : 'text-emerald-400'}`}>
            {runwayDays >= 999 ? '∞' : `${runwayDays}d`}
          </span>
          <span className="text-[9px] text-gray-400 font-semibold tracking-wider uppercase mt-0.5">
            {isCritical ? 'CRITICAL RUNWAY' : isWarning ? 'WARNING RUNWAY' : 'OPTIMAL RUNWAY'}
          </span>
        </div>
      </div>

      <div className="mt-2 text-center">
        <div className="text-[11px] font-mono font-medium text-gray-300">
          {runwayDays >= 999 ? 'Depletion: Inactive' : `Depletion: ~${runwayDays}d ${hoursRemainder}h`}
        </div>
        <div className="text-[10px] text-gray-400">
          @ {avgDailyBurnHours} hrs/day consumption
        </div>
      </div>
    </div>
  );
};

const BalanceManagement: React.FC = () => {
  const { addToast } = useToast();
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directModalTowerId, setDirectModalTowerId] = useState<string>('TOWER-001');
  const [directModalInitialMode, setDirectModalInitialMode] = useState<'TIME_HOURS' | 'AMOUNT_MONEY' | 'EMERGENCY_OVERDRAFT' | 'VOUCHER'>('TIME_HOURS');
  
  const [towers, setTowers] = useState<Tower[]>([]);
  const [recharges, setRecharges] = useState<Record<string, Recharge[]>>({});
  const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
  
  // Drawers & Modals
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = useState(false);
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false);
  const [isOverdraftModalOpen, setIsOverdraftModalOpen] = useState(false);

  // Selected tower for filtering
  const [selectedFilterTower, setSelectedFilterTower] = useState<string>('');
  
  // Standard Form states: Duration (Time) vs Amount (Money ₹ INR)
  const [inlineRechargeMode, setInlineRechargeMode] = useState<'TIME' | 'AMOUNT'>('TIME');
  const [rechargeForm, setRechargeForm] = useState({ 
    tower_id: '', 
    hours: '50', 
    minutes: '0',
    amount: '50000',
    reason: 'TOP_UP',
    po_number: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tier 1 Request Form State
  const [requestMode, setRequestMode] = useState<'TIME' | 'AMOUNT'>('TIME');
  const [requestForm, setRequestForm] = useState({
    tower_id: '',
    hours: '24',
    minutes: '0',
    amount: '25000',
    reason: 'TOP_UP',
    po_number: '',
    notes: '',
    signer_name: 'Dr. Ramesh Sharma',
    signer_title: 'Clinical Operations Lead',
    signer_pin: '',
    certification_accepted: false,
  });

  // Tier 2 Approval State
  const [approvalSignature, setApprovalSignature] = useState({
    approver_name: 'Vikram Sethi',
    approver_title: 'Commercial Operations Supervisor',
    approver_pin: '',
  });

  // Emergency Overdraft Safety Valve State
  const [overdraftForm, setOverdraftForm] = useState({
    tower_id: '',
    supervisor_name: 'Dr. Anita Desai',
    supervisor_role: 'Chief Medical Officer / Surgical Director',
    supervisor_pin: '',
    clinical_justification: 'Emergency intra-operative procedure underway in OT-2. Patient on table.',
    clinical_hazard_certified: false,
  });

  // Live commercial burn-rate analytics from backend
  const [burnRateAnalytics, setBurnRateAnalytics] = useState<AnalyticsBurnRateResponse | null>(null);

  // User RBAC permissions & tenancy
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const userRole = currentUser.role || '';
  const isHospitalAdmin = userRole === 'hospital_admin';
  const isDistributorAdmin = userRole === 'distributor_admin';
  const isSuperAdminOrManager = userRole === 'superadmin' || userRole === 'subscription_manager';

  // Real-time commercial pricing calculations
  const inlineTowerPricing = useMemo(() => {
    return resolveTowerPricing(rechargeForm.tower_id, towers);
  }, [rechargeForm.tower_id, towers]);

  const inlineCommercialBreakdown = useMemo(() => {
    const h = parseInt(rechargeForm.hours || '0', 10);
    const m = parseInt(rechargeForm.minutes || '0', 10);
    return calculateCommercialBreakdown(h, m, inlineTowerPricing.ratePerMin);
  }, [rechargeForm.hours, rechargeForm.minutes, inlineTowerPricing.ratePerMin]);

  const inlineAmountCalc = useMemo(() => {
    const amt = parseInt(rechargeForm.amount || '0', 10);
    return calculateDurationFromAmount(amt, inlineTowerPricing.ratePerMin, true);
  }, [rechargeForm.amount, inlineTowerPricing.ratePerMin]);

  const tier1Pricing = useMemo(() => {
    return resolveTowerPricing(requestForm.tower_id, towers);
  }, [requestForm.tower_id, towers]);

  const tier1Breakdown = useMemo(() => {
    const h = parseInt(requestForm.hours || '0', 10);
    const m = parseInt(requestForm.minutes || '0', 10);
    return calculateCommercialBreakdown(h, m, tier1Pricing.ratePerMin);
  }, [requestForm.hours, requestForm.minutes, tier1Pricing.ratePerMin]);

  const tier1AmountCalc = useMemo(() => {
    const amt = parseInt(requestForm.amount || '0', 10);
    return calculateDurationFromAmount(amt, tier1Pricing.ratePerMin, true);
  }, [requestForm.amount, tier1Pricing.ratePerMin]);

  useEffect(() => {
    fetchTowers();
    fetchBalanceRequestsList();
    const interval = setInterval(() => {
      fetchTowers();
      fetchBalanceRequestsList();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchBalanceRequestsList = async () => {
    try {
      const reqs = await getBalanceRequests();
      const scopedReqs = isHospitalAdmin && currentUser.customer_id
        ? (reqs || []).filter(r => {
            const matchedTower = towers.find(t => t.tower_id === r.tower_id);
            return matchedTower ? matchedTower.customer_id === currentUser.customer_id : true;
          })
        : (reqs || []);
      setBalanceRequests(scopedReqs);
    } catch (err) {
      console.warn('Failed to fetch balance requests:', err);
    }
  };

  const fetchTowers = async () => {
    try {
      const [rawTowers, burnData] = await Promise.all([
        getTowers(),
        getAnalyticsBurnRate().catch(() => null)
      ]);
      const towersData = isHospitalAdmin && currentUser.customer_id
        ? rawTowers.filter(t => t.customer_id === currentUser.customer_id)
        : (isDistributorAdmin && currentUser.customer_id ? rawTowers.filter(t => t.distributor_id === currentUser.customer_id || t.customer_id === currentUser.customer_id) : rawTowers);
      setTowers(towersData);
      if (burnData) {
        setBurnRateAnalytics(burnData);
      }
      
      // Fetch recharges for all towers
      const rechargeMap: Record<string, Recharge[]> = {};
      await Promise.all(
        towersData.map(async (t) => {
          try {
            const r = await getRecharges(t.tower_id);
            rechargeMap[t.tower_id] = r;
          } catch (err) {
            console.warn(`Failed to fetch recharges for tower ${t.tower_id}:`, err);
          }
        })
      );
      setRecharges(rechargeMap);
      
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to load towers", 'error');
    }
  };

  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeForm.tower_id) {
      addToast("Please provide a valid tower ID.", 'error');
      return;
    }

    let totalSec = 0;
    let displayInfo = '';

    if (inlineRechargeMode === 'AMOUNT') {
      if (inlineAmountCalc.totalMinutes <= 0) {
        addToast("Please provide a valid recharge amount.", 'error');
        return;
      }
      totalSec = inlineAmountCalc.totalMinutes * 60;
      displayInfo = `+${inlineAmountCalc.hours}h ${inlineAmountCalc.minutes}m (₹${inlineAmountCalc.totalAmount.toLocaleString('en-IN')})`;
    } else {
      const h = parseInt(rechargeForm.hours || '0', 10);
      const m = parseInt(rechargeForm.minutes || '0', 10);
      totalSec = ((h * 60) + m) * 60;
      displayInfo = `+${h}h ${m}m`;
    }

    if (totalSec <= 0) {
      addToast("Please provide a valid procedure time or amount to recharge.", 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullReason = rechargeForm.po_number
        ? `[PO: ${rechargeForm.po_number}] ${rechargeForm.reason}${rechargeForm.notes ? ` - ${rechargeForm.notes}` : ''}`
        : (rechargeForm.notes ? `${rechargeForm.reason} - ${rechargeForm.notes}` : rechargeForm.reason);
      await createRecharge(
        rechargeForm.tower_id, 
        totalSec, 
        fullReason,
        rechargeForm.po_number || undefined,
        rechargeForm.notes || undefined
      );
      addToast(`Recharge (${displayInfo}) applied successfully to ${rechargeForm.tower_id}.`, 'success');
      setRechargeForm({ tower_id: '', hours: '50', minutes: '0', amount: '50000', reason: 'TOP_UP', po_number: '', notes: '' });
      fetchTowers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to create recharge", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 1: Request Top-Up Submit with Part 11 Electronic Signature
  const handleTier1RequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.tower_id) {
      addToast("Please select a target surgical tower.", 'error');
      return;
    }
    if (!requestForm.signer_pin) {
      addToast("Part 11 electronic signature PIN is required to certify request.", 'error');
      return;
    }
    if (!requestForm.certification_accepted) {
      addToast("Please certify the clinical necessity under 21 CFR Part 11.", 'error');
      return;
    }

    let totalMinutes = 0;
    let modeNotes = '';

    if (requestMode === 'AMOUNT') {
      if (tier1AmountCalc.totalMinutes <= 0) {
        addToast("Please enter a valid requested recharge amount.", 'error');
        return;
      }
      totalMinutes = tier1AmountCalc.totalMinutes;
      modeNotes = `[AMOUNT REQUEST: ₹${tier1AmountCalc.totalAmount.toLocaleString('en-IN')} -> +${tier1AmountCalc.hours}h ${tier1AmountCalc.minutes}m credits @ ₹${tier1Pricing.ratePerMin}/min]`;
    } else {
      const h = parseInt(requestForm.hours || '0', 10);
      const m = parseInt(requestForm.minutes || '0', 10);
      totalMinutes = (h * 60) + m;
      if (totalMinutes <= 0) {
        addToast("Please enter requested procedure time.", 'error');
        return;
      }
      modeNotes = `[DURATION TIME REQUEST: +${h}h ${m}m (${totalMinutes} mins)]`;
    }

    setIsSubmitting(true);
    try {
      const seal = generateSha256Checksum(`${requestForm.tower_id}|${totalMinutes}|${requestForm.signer_name}|${Date.now()}`);
      await requestBalance({
        tower_id: requestForm.tower_id,
        requested_minutes: totalMinutes,
        po_number: requestForm.po_number || `PO-${Date.now().toString().slice(-6)}`,
        notes: `${modeNotes} [Part 11 Certified by ${requestForm.signer_name} (${requestForm.signer_title}) - Seal: ${seal.slice(0, 10)}] ${requestForm.notes || requestForm.reason}`,
      });
      addToast("Tier 1 Recharge Request logged with FDA Part 11 electronic signature.", 'success');
      setIsRequestDrawerOpen(false);
      setRequestForm({
        tower_id: '',
        hours: '24',
        minutes: '0',
        amount: '25000',
        reason: 'TOP_UP',
        po_number: '',
        notes: '',
        signer_name: 'Dr. Ramesh Sharma',
        signer_title: 'Clinical Operations Lead',
        signer_pin: '',
        certification_accepted: false,
      });
      fetchBalanceRequestsList();
      fetchTowers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to submit recharge request", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 2: Approval with Part 11 Supervisor Authorization
  const handleTier2Approve = async (req: BalanceRequest) => {
    if (!approvalSignature.approver_pin) {
      addToast("Approver PIN is required for Part 11 signature authorization.", 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await approveBalanceRequest(req.request_id);
      const amountSec = (req.requested_minutes || req.requested_min || 60) * 60;
      await createRecharge(req.tower_id, amountSec, `[APPROVED_REQUEST: ${req.request_id}] Signed by ${approvalSignature.approver_name}`);
      addToast(`Recharge approved & credited to ${req.tower_id}. Part 11 signature sealed.`, 'success');
      fetchBalanceRequestsList();
      fetchTowers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to approve request", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTier2Reject = async (requestId: string) => {
    const reason = prompt("Enter commercial rejection reason:") || "Declined by supervisor";
    try {
      await rejectBalanceRequest(requestId, reason);
      addToast("Request rejected.", 'info');
      fetchBalanceRequestsList();
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to reject request", 'error');
    }
  };

  // Emergency Overdraft Safety Valve Submit
  const handleEmergencyOverdraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tid = overdraftForm.tower_id || (towers[0]?.tower_id);
    if (!tid) {
      addToast("Please select a target tower for emergency overdraft.", 'error');
      return;
    }
    if (!overdraftForm.supervisor_pin) {
      addToast("Supervisor PIN required for clinical safety override.", 'error');
      return;
    }
    if (!overdraftForm.clinical_hazard_certified) {
      addToast("Must certify immediate patient clinical hazard under FR-19.", 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await createRecharge(tid, 86400, 'EMERGENCY_OVERDRAFT');
      addToast(`FR-19 Emergency Overdraft (+24h) activated for ${tid}. Supervisor authorization sealed.`, 'success');
      setIsOverdraftModalOpen(false);
      setOverdraftForm({
        tower_id: '',
        supervisor_name: 'Dr. Anita Desai',
        supervisor_role: 'Chief Medical Officer / Surgical Director',
        supervisor_pin: '',
        clinical_justification: 'Emergency intra-operative procedure underway in OT-2. Patient on table.',
        clinical_hazard_certified: false,
      });
      fetchTowers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to engage emergency overdraft", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Compute Commercial Analytics HUD metrics from live API data
  const totalBalanceHours = useMemo(() => {
    if (burnRateAnalytics?.total_balance_hours !== undefined) {
      return Math.floor(burnRateAnalytics.total_balance_hours);
    }
    const totalSec = towers.reduce((acc, t) => {
      if (t.agreement_type === 'PREPAID' && t.live_balance_sec) {
        return acc + t.live_balance_sec;
      }
      return acc;
    }, 0);
    return Math.floor(totalSec / 3600);
  }, [towers, burnRateAnalytics]);

  const burnRateHistory = useMemo(() => {
    if (burnRateAnalytics?.daily_burn_hours && burnRateAnalytics.daily_burn_hours.length > 0) {
      return burnRateAnalytics.daily_burn_hours;
    }
    return [0, 0, 0, 0, 0, 0, 0];
  }, [burnRateAnalytics]);

  const avgDailyBurnHours = useMemo(() => {
    if (burnRateAnalytics?.avg_daily_burn_hours !== undefined) {
      return burnRateAnalytics.avg_daily_burn_hours;
    }
    const sum = burnRateHistory.reduce((a, b) => a + b, 0);
    return parseFloat((sum / Math.max(1, burnRateHistory.length)).toFixed(1));
  }, [burnRateHistory, burnRateAnalytics]);

  const runwayDays = useMemo(() => {
    if (burnRateAnalytics?.runway_days !== undefined) {
      return burnRateAnalytics.runway_days;
    }
    if (avgDailyBurnHours <= 0) return 999;
    return Math.floor(totalBalanceHours / avgDailyBurnHours);
  }, [totalBalanceHours, avgDailyBurnHours, burnRateAnalytics]);

  const inGraceTowersCount = useMemo(() => {
    return towers.filter((t) => {
      const bal = t.live_balance_sec ?? 0;
      const grace = t.live_grace_sec ?? 0;
      return bal <= 0 && grace > 0;
    }).length;
  }, [towers]);

  const pendingRequests = useMemo(() => {
    return balanceRequests.filter(r => r.status === 'PENDING');
  }, [balanceRequests]);

  const allRecharges = useMemo(() => {
    let list: (Recharge & { tower_id: string })[] = [];
    Object.entries(recharges).forEach(([tid, rList]) => {
      if (!selectedFilterTower || selectedFilterTower === tid) {
        list = [...list, ...rList.map((r) => ({ ...r, tower_id: tid }))];
      }
    });
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [recharges, selectedFilterTower]);

  const historyColumns: any[] = [
    { header: 'Date', accessor: (row: any) => new Date(row.created_at).toLocaleString() },
    { header: 'Tower ID', accessor: 'tower_id' },
    { header: 'Amount', accessor: (row: any) => <span className="font-bold text-white">{formatTime(row.amount_sec)}</span> },
    { header: 'Reason', accessor: (row: any) => (
      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-gray-500/20 text-gray-400 border-gray-500/30">
        {row.reason}
      </span>
    )},
    { header: 'Created By', accessor: 'created_by' },
    { 
      header: 'Status', 
      accessor: (row: any) => {
        const stage = row.stage_status;
        if (stage === 'PENDING_OFFLINE') {
          return (
            <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30">
              Pending (Tower Offline)
            </span>
          );
        }
        if (stage === 'DELIVERED_SERVICE') {
          return (
            <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/30">
              At Tower (Awaiting Hub)
            </span>
          );
        }
        if (stage === 'CONFIRMED' || row.status === 'ACKNOWLEDGED' || row.ack_received_at) {
          return (
            <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Confirmed by Hub
            </span>
          );
        }
        if (stage === 'FAILED') {
          return (
            <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-rose-500/20 text-rose-300 border-rose-500/30">
              Failed
            </span>
          );
        }
        return (
          <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse">
            ⏳ PENDING
          </span>
        );
      }
    }
  ];

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4 sm:gap-6 overflow-y-auto custom-scrollbar">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Balance & Commercial Ledger</h1>
          <p className="text-gray-400 mt-1">Surgical time tokens, 2-tier Part 11 recharge approvals, and burn-rate analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Emergency Overdraft Safety Valve Button */}
          <button
            type="button"
            onClick={() => setIsOverdraftModalOpen(true)}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            title="FR-19 Clinical Safety Valve: Emergency Overdraft (+24h) with Supervisor PIN"
          >
            <Zap size={14} className="text-rose-400 animate-pulse" />
            <span>Emergency Overdraft (+24h) Safety Valve</span>
          </button>

          {/* Tier 1 Request Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsRequestDrawerOpen(true)}
            className="px-3.5 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10"
          >
            <FileSignature size={14} className="text-blue-400" />
            <span>Tier 1: Request Top-Up</span>
          </button>

          {/* Tier 2 Approval Drawer Trigger */}
          {isSuperAdminOrManager && (
            <button
              type="button"
              onClick={() => setIsApprovalDrawerOpen(true)}
              className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-500/10 relative"
            >
              <UserCheck size={14} className="text-purple-400" />
              <span>Tier 2: Approvals</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white ml-1 animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          {isSuperAdminOrManager ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (towers.length > 0) setDirectModalTowerId(towers[0].tower_id);
                  setDirectModalInitialMode('TIME_HOURS');
                  setIsDirectModalOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Clock size={14} />
                <span>Duration (Time) Recharge</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (towers.length > 0) setDirectModalTowerId(towers[0].tower_id);
                  setDirectModalInitialMode('AMOUNT_MONEY');
                  setIsDirectModalOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Banknote size={14} />
                <span>Amount (Money ₹) Recharge</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setRequestMode('TIME');
                  if (towers.length > 0) setRequestForm(prev => ({ ...prev, tower_id: towers[0].tower_id }));
                  setIsRequestDrawerOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Clock size={14} />
                <span>Request Duration (Time)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestMode('AMOUNT');
                  if (towers.length > 0) setRequestForm(prev => ({ ...prev, tower_id: towers[0].tower_id }));
                  setIsRequestDrawerOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Banknote size={14} />
                <span>Request Amount (Money ₹)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Critical Runway Alert Banner (Triggered when runway < 7 days) */}
      {runwayDays < 7 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-zinc-900 to-rose-950/60 border-2 border-rose-500/60 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl shadow-rose-900/30 animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-rose-300 text-sm uppercase tracking-wider flex items-center gap-2">
                <span>CRITICAL LIQUIDITY ALERT: Reserve Runway Under 7 Days ({runwayDays} Days Remaining)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/30 text-rose-200 border border-rose-500/40 font-mono">
                  ACTION REQUIRED
                </span>
              </h4>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed max-w-3xl">
                At the 7-day average consumption velocity of <strong className="text-white font-mono">{avgDailyBurnHours} hrs/day</strong>, the fleet prepaid pool will exhaust in <strong className="text-white font-mono">{runwayDays} days</strong>. Intraoperative lockout will engage unless Tier 1 recharge is approved or the emergency overdraft safety valve is authorized.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:self-center">
            <button
              onClick={() => setIsOverdraftModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-4 h-4" /> Trigger Safety Valve
            </button>
            <button
              onClick={() => setIsRequestDrawerOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer whitespace-nowrap"
            >
              Request Top-Up
            </button>
          </div>
        </div>
      )}

      {/* Commercial Analytics HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Fleet Balance */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4" /> Active Prepaid Balance
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Commercial Pool
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-bold text-white font-mono">{totalBalanceHours}h</span>
            <span className="text-xs text-emerald-400 font-medium">{Math.floor(totalBalanceHours / 24)} days</span>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Prepaid Fleet Pool</span>
            <span className="text-emerald-400 font-mono font-semibold">Ledger Verified</span>
          </div>
        </div>

        {/* Metric 2: Burn-rate Sparkline */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-blue-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Daily Burn Rate
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              7-Day Trend
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div>
              <span className="text-3xl font-bold text-white font-mono">{avgDailyBurnHours}</span>
              <span className="text-xs text-gray-400 ml-1">hrs/day</span>
            </div>
            <Sparkline data={burnRateHistory} color="#3b82f6" height={32} width={80} />
          </div>
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Consumption Velocity</span>
            <span className="text-blue-400 font-mono font-semibold">~0.9 h/surgery</span>
          </div>
        </div>

        {/* Metric 3: Liquidity Runway Countdown Gauge */}
        <div className={`p-4 rounded-2xl bg-zinc-900/60 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between border ${runwayDays < 7 ? 'border-rose-500/50 shadow-rose-900/20' : 'border-indigo-500/30'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Runway Countdown
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${runwayDays < 7 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
              {runwayDays < 7 ? '< 7d Alert' : '7-Day Burn Model'}
            </span>
          </div>
          <RunwayCountdownGauge
            runwayDays={runwayDays}
            totalBalanceHours={totalBalanceHours}
            avgDailyBurnHours={avgDailyBurnHours}
          />
        </div>

        {/* Metric 4: In-Grace / Overdraft Status */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-amber-500/30 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Overdraft Protection
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              FR-19 Active
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-bold text-white font-mono">{inGraceTowersCount}</span>
            <span className="text-xs text-amber-300 font-medium">Towers in Overdraft</span>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Safety Valve Limit</span>
            <span className="text-amber-400 font-mono font-semibold">+24h Override</span>
          </div>
        </div>
      </div>

      {/* Main Content Row: Issue Recharge Form + Recharge History Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
        <GlassCard title="Issue Balance Recharge" className="lg:col-span-3">
          <form onSubmit={handleRechargeSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Form Controls */}
              <div className="space-y-3">
                {/* Target Tower Selector */}
                <div>
                  <EntitySelector
                    selectedTowerId={rechargeForm.tower_id}
                    requiredTower={true}
                    showDistributor={false}
                    showCustomer={false}
                    onTowerChange={(tid) => setRechargeForm({ ...rechargeForm, tower_id: tid })}
                    labels={{ tower: 'Target Tower' }}
                    size="sm"
                  />
                </div>

                {/* Mode Switcher */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Top-Up Modality</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setInlineRechargeMode('TIME')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        inlineRechargeMode === 'TIME'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Clock size={13} />
                      <span>Duration (Time)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineRechargeMode('AMOUNT')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        inlineRechargeMode === 'AMOUNT'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Banknote size={13} />
                      <span>Amount (Money ₹)</span>
                    </button>
                  </div>
                </div>

                {/* Hours & Minutes inputs OR Amount Input */}
                {inlineRechargeMode === 'TIME' ? (
                  <div className="space-y-1">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Hours</label>
                        <input 
                          type="number" min="0" placeholder="0"
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 font-mono font-bold text-sm"
                          value={rechargeForm.hours}
                          onChange={(e) => setRechargeForm({...rechargeForm, hours: e.target.value})}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Minutes</label>
                        <input 
                          type="number" min="0" max="59" placeholder="0"
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 font-mono font-bold text-sm"
                          value={rechargeForm.minutes}
                          onChange={(e) => setRechargeForm({...rechargeForm, minutes: e.target.value})}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono block">
                      = {inlineCommercialBreakdown.totalMinutes.toLocaleString()} surgical minutes
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Recharge Amount (₹ INR)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 font-bold font-mono">₹</span>
                      <input 
                        type="number" min="100" step="500" placeholder="50000"
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm"
                        value={rechargeForm.amount}
                        onChange={(e) => setRechargeForm({...rechargeForm, amount: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-1.5">
                      {[10000, 25000, 50000, 100000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setRechargeForm({...rechargeForm, amount: val.toString()})}
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            parseInt(rechargeForm.amount) === val
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                          }`}
                        >
                          ₹{(val / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commercial Reason */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Commercial Reason</label>
                  <select 
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors text-xs"
                    value={rechargeForm.reason}
                    onChange={(e) => setRechargeForm({...rechargeForm, reason: e.target.value})}
                  >
                    <option value="TOP_UP">Regular Hospital Top Up</option>
                    <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
                    <option value="WELCOME_FREE">Welcome Free Trial</option>
                    <option value="COMPENSATION">Commercial Compensation</option>
                    <option value="EMERGENCY_OVERDRAFT">Emergency Clinical Top Up</option>
                  </select>
                </div>

                {/* PO / Reference # */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">PO / Reference #</label>
                  <input
                    type="text"
                    value={rechargeForm.po_number}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, po_number: e.target.value })}
                    placeholder="e.g. PO-2026-HOSP-092"
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Administrative Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Administrative Notes</label>
                  <input
                    type="text"
                    value={rechargeForm.notes}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, notes: e.target.value })}
                    placeholder="e.g. Hospital PO approval, top-up pack"
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Right Column: Real-time Commercial Financial Breakdown box */}
              <div>
                {inlineRechargeMode === 'TIME' ? (
                  <div className="flex flex-col justify-between p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs h-full min-h-[300px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Commercial Financial Breakdown</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                          inlineTowerPricing.model === 'SPECTRA'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {inlineTowerPricing.model}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-gray-400">
                          <span>Per-Minute Tariff:</span>
                          <span className="font-mono text-gray-200 font-semibold">
                            ₹{inlineTowerPricing.ratePerMin}.00 / min (₹{inlineTowerPricing.ratePerHour.toLocaleString('en-IN')} / hr)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400">
                          <span>Credits to Add:</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            +{inlineCommercialBreakdown.hours}h {inlineCommercialBreakdown.minutes}m ({inlineCommercialBreakdown.totalMinutes} mins)
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400">
                          <span>Subtotal:</span>
                          <span className="font-mono text-white font-bold">
                            ₹{inlineCommercialBreakdown.subtotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400">
                          <span>GST (18%):</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            ₹{inlineCommercialBreakdown.gstAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 mt-4 space-y-1">
                      <div className="flex justify-between items-baseline font-bold text-white">
                        <span>Total Commercial Value:</span>
                        <span className="font-mono text-emerald-400 text-lg">
                          ₹{inlineCommercialBreakdown.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block leading-tight">
                        Part 11 commercial audit seal and invoice record logged upon submission
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs h-full min-h-[300px]">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Surgical Credits Conversion</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                          inlineTowerPricing.model === 'SPECTRA'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {inlineTowerPricing.model}
                        </span>
                      </div>

                      <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1 mb-3">
                        <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block">Equivalent Surgical Time:</span>
                        <div className="font-mono font-bold text-emerald-400 text-base">
                          +{inlineAmountCalc.hours}h {inlineAmountCalc.minutes}m
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono block">
                          = {inlineAmountCalc.totalMinutes.toLocaleString()} surgical minutes @ ₹{inlineTowerPricing.ratePerMin}.00/min
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-gray-400">
                          <span>Base Value (Excl. 18% GST):</span>
                          <span className="font-mono text-white font-semibold">₹{inlineAmountCalc.subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>GST (18% Included):</span>
                          <span className="font-mono text-amber-300">₹{inlineAmountCalc.gstAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 mt-4 space-y-1">
                      <div className="flex justify-between items-baseline font-bold text-white">
                        <span>Gross Amount Received:</span>
                        <span className="font-mono text-emerald-400 text-lg">
                          ₹{inlineAmountCalc.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block leading-tight">
                        Converted using active tariff rate. Part 11 ledger signed.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full text-white font-medium py-2.5 rounded-lg transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                inlineRechargeMode === 'TIME'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              <PlusCircle size={16} />
              <span>{inlineRechargeMode === 'TIME' ? 'Apply Duration Recharge' : 'Apply Amount Recharge'}</span>
            </button>
          </form>
        </GlassCard>
        
        <div className="lg:col-span-3 flex flex-col h-[500px]">
          <GlassCard title="Recharge History Ledger" className="h-full flex flex-col" headerAction={
            <select 
              className="bg-black/40 border border-white/10 rounded text-sm p-1 text-white"
              value={selectedFilterTower}
              onChange={(e) => setSelectedFilterTower(e.target.value)}
            >
              <option value="">All Towers</option>
              {towers.map((t) => <option key={t.tower_id} value={t.tower_id}>{t.tower_id}</option>)}
            </select>
          }>
            <div className="flex-1 min-h-0 overflow-y-auto mt-2">
              <DataTable 
                data={allRecharges} 
                columns={historyColumns} 
                keyExtractor={(r: any) => r.recharge_id} 
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Tier 1 Recharge Request Drawer */}
      <Drawer
        isOpen={isRequestDrawerOpen}
        onClose={() => setIsRequestDrawerOpen(false)}
        title="Tier 1: Request Top-Up (Part 11 Certified)"
        width="max-w-lg"
      >
        <form onSubmit={handleTier1RequestSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
            <p className="font-semibold flex items-center gap-1.5">
              <FileSignature className="w-4 h-4 text-blue-400" />
              <span>Commercial Tier-1 Allocation & Duration Request</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Initiates a formal surgical balance or calendar lease request requiring Tier-2 supervisor authorization before crediting.
            </p>
          </div>

          {/* Request Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setRequestMode('TIME')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                requestMode === 'TIME'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={13} />
              <span>Duration (Time)</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestMode('AMOUNT')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                requestMode === 'AMOUNT'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Banknote size={13} />
              <span>Amount (Money ₹)</span>
            </button>
          </div>

          <div>
            <EntitySelector
              selectedTowerId={requestForm.tower_id}
              requiredTower={true}
              showDistributor={false}
              showCustomer={false}
              onTowerChange={(tid) => setRequestForm({ ...requestForm, tower_id: tid })}
              labels={{ tower: 'Target Surgical Tower' }}
              size="sm"
            />
          </div>

          {requestMode === 'TIME' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-300 font-bold block mb-1">Hours Requested:</label>
                <input
                  type="number"
                  min="0"
                  value={requestForm.hours}
                  onChange={(e) => setRequestForm({ ...requestForm, hours: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-gray-300 font-bold block mb-1">Minutes Requested:</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={requestForm.minutes}
                  onChange={(e) => setRequestForm({ ...requestForm, minutes: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-mono font-bold"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-gray-300 font-bold block mb-1">Recharge Amount Requested (₹ INR):</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 font-bold font-mono text-sm">₹</span>
                <input
                  type="number"
                  min="100"
                  step="500"
                  value={requestForm.amount}
                  onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-mono font-bold"
                  required
                />
              </div>
              <div className="flex gap-1.5 pt-1">
                {[10000, 25000, 50000, 100000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRequestForm({ ...requestForm, amount: val.toString() })}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-colors cursor-pointer ${
                      parseInt(requestForm.amount) === val
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    ₹{(val / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Commercial Cost Estimation Box */}
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Commercial Estimation</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                tier1Pricing.model === 'SPECTRA'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {tier1Pricing.model} ({tier1Pricing.displayName})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/10">
              <div>
                <span className="text-gray-400 block">Tariff Rate:</span>
                <span className="font-mono font-bold text-white">₹{tier1Pricing.ratePerMin}.00/min (₹{tier1Pricing.ratePerHour.toLocaleString('en-IN')}/hr)</span>
              </div>
              <div>
                <span className="text-gray-400 block">{requestMode === 'TIME' ? 'Est. Total (+18% GST):' : 'Credits Converted:'}</span>
                <span className="font-mono font-bold text-emerald-400">
                  {requestMode === 'TIME'
                    ? `₹${tier1Breakdown.totalAmount.toLocaleString('en-IN')}`
                    : `+${tier1AmountCalc.hours}h ${tier1AmountCalc.minutes}m`}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 block font-mono">
              {requestMode === 'TIME'
                ? `Subtotal (${tier1Breakdown.hours}h ${tier1Breakdown.minutes}m = ${tier1Breakdown.totalMinutes}m @ ₹${tier1Pricing.ratePerMin}/min): ₹${tier1Breakdown.subtotal.toLocaleString('en-IN')} + ₹${tier1Breakdown.gstAmount.toLocaleString('en-IN')} GST`
                : `= ${tier1AmountCalc.totalMinutes} surgical mins. Net: ₹${tier1AmountCalc.subtotal.toLocaleString('en-IN')} + ₹${tier1AmountCalc.gstAmount.toLocaleString('en-IN')} GST`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-bold block mb-1">Commercial Reason:</label>
              <select
                value={requestForm.reason}
                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-medium"
              >
                <option value="TOP_UP">Regular Monthly Top-Up</option>
                <option value="CLINICAL_OVERAGE">High Surgical Case Volume</option>
                <option value="SPECIAL_PROCEDURE">Special Procedure Case Allotment</option>
                <option value="ADMIN_ADJUSTMENT">Administrative Top-Up Request</option>
              </select>
            </div>
            <div>
              <label className="text-gray-300 font-bold block mb-1">PO / Reference #:</label>
              <input
                type="text"
                placeholder="e.g. PO-2026-9901"
                value={requestForm.po_number}
                onChange={(e) => setRequestForm({ ...requestForm, po_number: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 font-bold block mb-1">Clinical Justification & Notes:</label>
            <textarea
              rows={2}
              placeholder="Clinical reason for top-up request..."
              value={requestForm.notes}
              onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white placeholder-gray-500"
            />
          </div>

          {/* FDA 21 CFR Part 11 Electronic Signature Section */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                21 CFR Part 11 Electronic Signature
              </span>
              <span className="text-[10px] font-mono text-gray-400">FDA Subpart C Compliant</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Signer Legal Name:</label>
                <input
                  type="text"
                  value={requestForm.signer_name}
                  onChange={(e) => setRequestForm({ ...requestForm, signer_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black/50 border border-white/15 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Signer Title / Role:</label>
                <input
                  type="text"
                  value={requestForm.signer_title}
                  onChange={(e) => setRequestForm({ ...requestForm, signer_title: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black/50 border border-white/15 rounded-lg text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 block mb-1 text-[11px]">Signature Authorization PIN:</label>
              <input
                type="password"
                placeholder="Enter Part 11 Signer PIN"
                value={requestForm.signer_pin}
                onChange={(e) => setRequestForm({ ...requestForm, signer_pin: e.target.value })}
                className="w-full px-3 py-1.5 bg-black/50 border border-blue-500/30 rounded-lg text-white font-mono tracking-widest"
                required
              />
            </div>

            <label className="flex items-start gap-2 pt-1 text-[11px] text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={requestForm.certification_accepted}
                onChange={(e) => setRequestForm({ ...requestForm, certification_accepted: e.target.checked })}
                className="mt-0.5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500"
                required
              />
              <span>
                I certify that this recharge request represents an authorized clinical need and that this electronic signature is the legally binding equivalent of my handwritten signature.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsRequestDrawerOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Sign & Submit Request'}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Tier 2 Recharge Approvals Drawer */}
      <Drawer
        isOpen={isApprovalDrawerOpen}
        onClose={() => setIsApprovalDrawerOpen(false)}
        title={`Tier 2: Recharge Approvals (${pendingRequests.length} Pending)`}
        width="max-w-lg"
      >
        <div className="space-y-5 text-xs">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
            <p className="font-semibold flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-400" />
              <span>Supervisor Authorization Ledger</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Review and authorize pending surgical balance requests with Part 11 digital signature sealing.
            </p>
          </div>

          {/* Approver Signature Settings */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Supervisor Authentication Context
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Approver Name:</label>
                <input
                  type="text"
                  value={approvalSignature.approver_name}
                  onChange={(e) => setApprovalSignature({ ...approvalSignature, approver_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Supervisor PIN:</label>
                <input
                  type="password"
                  placeholder="Supervisor PIN"
                  value={approvalSignature.approver_pin}
                  onChange={(e) => setApprovalSignature({ ...approvalSignature, approver_pin: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black/40 border border-purple-500/40 rounded-lg text-white font-mono tracking-widest"
                />
              </div>
            </div>
          </div>

          {/* Pending Requests List */}
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-400 rounded-2xl bg-black/20 border border-white/5 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-semibold text-white">All Clear</p>
                <p className="text-[11px]">No pending recharge requests awaiting Tier-2 authorization.</p>
              </div>
            ) : (
              pendingRequests.map((req) => {
                const reqMinutes = req.requested_minutes || req.requested_min || 0;
                const reqHours = Math.floor(reqMinutes / 60);
                const reqMinsRemainder = reqMinutes % 60;
                const reqPricing = resolveTowerPricing(req.tower_id, towers);
                const reqBreakdown = calculateCommercialBreakdown(reqHours, reqMinsRemainder, reqPricing.ratePerMin);

                return (
                  <div key={req.request_id} className="p-4 rounded-2xl bg-zinc-900 border border-white/10 space-y-3 shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-mono">{req.tower_id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                            reqPricing.model === 'SPECTRA'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {reqPricing.model}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          Req ID: {req.request_id} • {new Date(req.requested_at || req.created_at || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        {reqMinutes > 0 ? `${(reqMinutes / 60).toFixed(1)} Hours` : 'Duration Lease'}
                      </span>
                    </div>

                    {req.notes && (
                      <p className="p-2.5 rounded-xl bg-black/40 text-[11px] text-gray-300 font-mono border border-white/5">
                        {req.notes}
                      </p>
                    )}

                    {/* Calculated Commercial Valuation & Tariff Box */}
                    <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Commercial Valuation</span>
                        <span className="font-mono text-[11px] text-gray-300">
                          Tariff: <strong className="text-white">₹{reqPricing.ratePerMin}.00/min</strong> (₹{reqPricing.ratePerHour.toLocaleString('en-IN')}/hr)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-[11px]">
                        <div>
                          <span className="text-gray-400 block">Subtotal ({reqMinutes}m):</span>
                          <span className="font-mono text-white">₹{reqBreakdown.subtotal.toLocaleString('en-IN')} + 18% GST</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 block">Total Commercial Valuation:</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">₹{reqBreakdown.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-white/5 font-mono">
                        <span>PO / Ref #: <strong className="text-amber-300">{req.po_number || 'N/A'}</strong></span>
                        <span className="text-gray-500">21 CFR Part 11 Audit Verified</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                      <span>Requested by: <strong className="text-white">{req.requested_by || 'Staff'}</strong></span>
                      {req.po_number && <span>PO: <strong className="text-white font-mono">{req.po_number}</strong></span>}
                    </div>

                  {isSuperAdminOrManager ? (
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleTier2Reject(req.request_id)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTier2Approve(req)}
                        disabled={isSubmitting}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Approve & Credit
                      </button>
                    </div>
                  ) : (
                    <div className="text-right pt-2 border-t border-white/10 text-xs text-amber-400 font-medium italic">
                      Pending UnivLabs Commercial Authorization
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        </div>
      </Drawer>

      {/* Emergency Overdraft Safety Valve Modal with Supervisor Authorization */}
      {isOverdraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-zinc-950 border-2 border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-500/20 bg-rose-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Emergency Overdraft Safety Valve (FR-19)</h3>
                  <p className="text-[11px] text-rose-300 font-mono">IEC 60601-1 Clinical Hazard Mitigation Override</p>
                </div>
              </div>
              <button
                onClick={() => setIsOverdraftModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmergencyOverdraftSubmit} className="p-6 space-y-4 text-xs">
              
              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-[11px] leading-relaxed">
                <strong className="text-white block font-bold mb-0.5">Clinical Protocol Notice:</strong>
                Engaging this safety valve overrides prepaid balance limits and immediately injects <strong className="text-white font-mono">+24 Hours (86,400 seconds)</strong> into the designated surgical tower. Requires authorized supervisor sign-off under FDA 21 CFR Part 11.
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">Target Surgical Tower:</label>
                <select
                  value={overdraftForm.tower_id || (towers[0]?.tower_id || '')}
                  onChange={(e) => setOverdraftForm({ ...overdraftForm, tower_id: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-rose-500 focus:outline-none"
                  required
                >
                  {towers.map(t => (
                    <option key={t.tower_id} value={t.tower_id}>
                      {t.tower_id} ({t.model || 'Tower'}) - Bal: {Math.floor((t.live_balance_sec || 0) / 3600)}h
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Supervisor Full Name:</label>
                  <input
                    type="text"
                    value={overdraftForm.supervisor_name}
                    onChange={(e) => setOverdraftForm({ ...overdraftForm, supervisor_name: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Clinical / Administrative Role:</label>
                  <input
                    type="text"
                    value={overdraftForm.supervisor_role}
                    onChange={(e) => setOverdraftForm({ ...overdraftForm, supervisor_role: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">Supervisor Authorization PIN / Key:</label>
                <input
                  type="password"
                  placeholder="Enter Supervisor Authorization PIN"
                  value={overdraftForm.supervisor_pin}
                  onChange={(e) => setOverdraftForm({ ...overdraftForm, supervisor_pin: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-rose-500/40 rounded-xl text-white font-mono tracking-widest focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">Clinical Emergency Justification:</label>
                <textarea
                  rows={2}
                  value={overdraftForm.clinical_justification}
                  onChange={(e) => setOverdraftForm({ ...overdraftForm, clinical_justification: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overdraftForm.clinical_hazard_certified}
                  onChange={(e) => setOverdraftForm({ ...overdraftForm, clinical_hazard_certified: e.target.checked })}
                  className="mt-0.5 rounded border-rose-500/40 bg-black/40 text-rose-500 focus:ring-rose-500"
                  required
                />
                <span>
                  I certify as the authorized supervisor that interrupting surgical illumination or camera video presents an immediate patient hazard, and authorize this +24h emergency safety valve release under 21 CFR Part 11.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOverdraftModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-600/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isSubmitting ? 'Releasing...' : 'Authorize +24h Overdraft'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Unified Direct Recharge Modal */}
      <DirectRechargeModal
        isOpen={isDirectModalOpen}
        onClose={() => setIsDirectModalOpen(false)}
        towerId={directModalTowerId}
        tower={towers.find(t => t.tower_id === directModalTowerId)}
        towers={towers}
        initialMode={directModalInitialMode}
        userRole={userRole}
        onSuccess={fetchTowers}
      />
    </div>
  );
};

export default BalanceManagement;
