import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  FileText, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X,
  RefreshCw,
  Check,
  Zap
} from 'lucide-react';
import { 
  getInvoices, 
  createInvoice, 
  autoGenerateMonthlyInvoices,
  recordInvoicePayment, 
  approveInvoice,
  getCustomers, 
  getTowers, 
  DEFAULT_PRICING_CONFIGS, 
  type Invoice, 
  type InvoiceStatus, 
  type Customer, 
  type Tower, 
  type CreateInvoiceRequest, 
  type RecordPaymentRequest 
} from '../services/api';
import { EntitySelector, type EntitySelectorValues } from '../components/EntitySelector';
import InvoicePrintModal from '../components/InvoicePrintModal';

export const BillingManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const monthFilter = 'ALL';

  // Modals
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState<boolean>(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  // Generate Invoice Form State
  const [genDistributorId, setGenDistributorId] = useState<string>('');
  const [genCustomerId, setGenCustomerId] = useState<string>('');
  const [genTowerId, setGenTowerId] = useState<string>('');
  const [genBillingMonth, setGenBillingMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [genSurgeriesCount, setGenSurgeriesCount] = useState<number>(20);
  const [genTotalMinutes, setGenTotalMinutes] = useState<number>(1200);
  const [genBaseRate, setGenBaseRate] = useState<number>(64.0);
  const [genIncRate, setGenIncRate] = useState<number>(15.0);
  const [genDiscountPct, setGenDiscountPct] = useState<number>(0);
  const [genNotes, setGenNotes] = useState<string>('Freedom Plan monthly Pay-Per-Minute recurring usage charge.');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState<boolean>(false);

  // Record Payment Form State
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'NEFT_RTGS' | 'UPI' | 'CHEQUE' | 'CARD' | 'WIRE'>('NEFT_RTGS');
  const [payUtr, setPayUtr] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Approve Invoice Form State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [approvingInvoice, setApprovingInvoice] = useState<Invoice | null>(null);
  const [approveReason, setApproveReason] = useState<string>('Verified and approved onboarding advance invoice.');
  const [approveAdjustment, setApproveAdjustment] = useState<number>(0);
  const [approveNotes, setApproveNotes] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGenerateModalOpen(false);
        setIsRecordPaymentModalOpen(false);
        setIsApproveModalOpen(false);
        setSelectedInvoiceForPrint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      try {
        localStorage.removeItem('portal_commercial_invoices');
      } catch {}
      const [fetchedInvoices, fetchedCustomers, fetchedTowers] = await Promise.all([
        getInvoices(),
        getCustomers(),
        getTowers()
      ]);
      setInvoices(fetchedInvoices);
      setCustomers(fetchedCustomers);
      setTowers(fetchedTowers);
    } catch (err: any) {
      console.error('Failed to load billing data', err);
      setLoadError(err?.message || 'Unable to connect to billing server. Please verify network or retry.');
    } finally {
      setIsLoading(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalBilled = invoices.reduce((acc, inv) => acc + (inv.totalPayable ?? (inv as any).total_amount ?? (inv as any).net_payable ?? 0), 0);
    const totalCollected = invoices.reduce((acc, inv) => acc + (inv.amountPaid ?? (inv as any).amount_paid ?? 0), 0);
    const totalPending = invoices.filter(inv => (inv.status || (inv as any).status) !== 'PAID').reduce((acc, inv) => acc + (inv.balanceDue ?? (inv as any).balance_due ?? (inv as any).net_payable ?? 0), 0);
    const overdueCount = invoices.filter(inv => (inv.status || (inv as any).status) === 'OVERDUE').length;
    const paidCount = invoices.filter(inv => (inv.status || (inv as any).status) === 'PAID').length;
    const issuedCount = invoices.filter(inv => (inv.status || (inv as any).status) === 'ISSUED').length;






    return {
      totalBilled,
      totalCollected,
      totalPending,
      overdueCount,
      paidCount,
      issuedCount,
      collectionRatePct: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0
    };
  }, [invoices]);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const userRole = currentUser.role || '';
  const isHospitalAdmin = userRole === 'hospital_admin';

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (isHospitalAdmin && currentUser.customer_id && (inv.customerId || (inv as any).customer_id) !== currentUser.customer_id) {
        return false;
      }
      const status = inv.status || (inv as any).status;
      const custId = inv.customerId || (inv as any).customer_id;
      const billingMonth = inv.billingMonth || (inv as any).billing_period_start?.slice(0, 7);
      const matchStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchCustomer = customerFilter === 'ALL' || custId === customerFilter;
      const matchMonth = monthFilter === 'ALL' || billingMonth === monthFilter;
      const matchSearch = !searchQuery.trim() || 
        (inv.invoiceNumber || (inv as any).invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.customerName || (inv as any).customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.towerId || (inv as any).tower_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.customerGstin || (inv as any).customer_gstin || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchCustomer && matchMonth && matchSearch;
    });
  }, [invoices, statusFilter, customerFilter, monthFilter, searchQuery, isHospitalAdmin, currentUser]);



  // Handle entity selector change in generate modal
  const handleEntityChange = (values: EntitySelectorValues) => {
    setGenDistributorId(values.distributorId);
    setGenCustomerId(values.customerId);
    setGenTowerId(values.towerId);

    const selectedTower = towers.find(t => t.tower_id === values.towerId);
    if (selectedTower) {
      const modelKey = (selectedTower.model || 'SPECTRA').toUpperCase().includes('LUMINA') ? 'LUMINA' : 'SPECTRA';
      const cfg = DEFAULT_PRICING_CONFIGS[modelKey];
      if (cfg && cfg.rates.length > 0) {
        setGenBaseRate(cfg.rates[0].baseRatePerMin);
        setGenIncRate(cfg.rates[0].incrementalRatePerMin);
      }
    }
  };

  const handleOpenGenerateModal = () => {
    const firstCust = customers[0]?.customer_id || '';
    const firstTower = towers.find(t => t.customer_id === firstCust)?.tower_id || towers[0]?.tower_id || '';
    setGenCustomerId(firstCust);
    setGenTowerId(firstTower);
    setGenSurgeriesCount(20);
    setGenTotalMinutes(1200);
    setGenDiscountPct(0);
    setIsGenerateModalOpen(true);
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genCustomerId || !genTowerId) {
      alert('Please select both Customer and Tower');
      return;
    }

    const selectedCustomer = customers.find(c => c.customer_id === genCustomerId);
    const selectedTower = towers.find(t => t.tower_id === genTowerId);
    const towerModel = (selectedTower?.model || 'SPECTRA').toUpperCase().includes('LUMINA') ? 'LUMINA' : 'SPECTRA';

    setIsSubmittingInvoice(true);
    try {
      const clampedSurgeries = Math.min(5000, Math.max(0, Number(genSurgeriesCount) || 0));
      const clampedMinutes = Math.min(300000, Math.max(0, Number(genTotalMinutes) || 0));
      const clampedDiscount = Math.min(100, Math.max(0, Number(genDiscountPct) || 0));
      const clampedBaseRate = Math.max(0, Number(genBaseRate) || 0);
      const clampedIncRate = Math.max(0, Number(genIncRate) || 0);

      const [year, month] = (genBillingMonth || new Date().toISOString().slice(0, 7)).split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
      const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59)).getDate();
      const endDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59)).toISOString();

      const req: CreateInvoiceRequest = {
        customerId: genCustomerId,
        customerName: selectedCustomer?.name || 'Hospital Institution',
        customerGstin: selectedCustomer?.contact_person ? '07AAAAA0000A1Z5' : '07AAAAA9999Z1Z1',
        customerAddress: 'Department of Biomedical Engineering, Main Hospital Campus',
        towerId: genTowerId,
        towerModel,
        towerSerial: selectedTower?.serial_number || `UL-${towerModel}-2026-000`,
        billingMonth: genBillingMonth,
        start_date: startDate,
        end_date: endDate,
        status: 'PENDING_APPROVAL',
        surgeriesCount: clampedSurgeries,
        totalMinutesUsed: clampedMinutes,
        ratePerBaseMin: clampedBaseRate,
        ratePerIncMin: clampedIncRate,
        baseMinutesThreshold: 90,
        discountPct: clampedDiscount,
        notes: genNotes.trim()
      };

      const newInv = await createInvoice(req);
      await loadAllData();
      setIsGenerateModalOpen(false);
      setSelectedInvoiceForPrint(newInv);
    } catch (err) {
      console.error('Failed to generate invoice', err);
      alert('Failed to generate monthly tax invoice');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const [isAutoBilling, setIsAutoBilling] = useState<boolean>(false);
  const handleAutoBillingRun = async () => {
    if (!confirm('Run automated monthly billing cycle for all active towers and surgical usage?')) return;
    setIsAutoBilling(true);
    try {
      const generated = await autoGenerateMonthlyInvoices();
      await loadAllData();
      alert(`Automated billing run complete! Generated ${generated?.length || 0} statutory invoices.`);
    } catch (err) {
      console.error('Failed automated billing cycle', err);
      alert('Automated billing run failed. Please check network logs.');
    } finally {
      setIsAutoBilling(false);
    }
  };

  const handleOpenRecordPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
    setPayAmount(inv.balanceDue ?? (inv as any).balance_due ?? (inv as any).net_payable ?? 0);
    setPayUtr('');
    setPayNotes('');
    setIsRecordPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }
    const due = paymentInvoice.balanceDue ?? (paymentInvoice as any).balance_due ?? (paymentInvoice as any).net_payable ?? 0;
    if (payAmount > due) {
      alert(`Payment amount (₹${payAmount.toLocaleString('en-IN')}) cannot exceed outstanding balance due (₹${due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).`);
      return;
    }

    const cleanUtr = payUtr.trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 6) {
      alert('A valid Bank Transaction Reference / UTR (minimum 6 alphanumeric characters) is required for audit compliance.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const req: RecordPaymentRequest = {
        invoiceId: paymentInvoice.id,
        amount: payAmount,
        method: payMethod,
        utrReference: cleanUtr,
        notes: payNotes.trim() || undefined
      };

      await recordInvoicePayment(req);
      await loadAllData();
      setIsRecordPaymentModalOpen(false);
      setPaymentInvoice(null);
    } catch (err) {
      console.error('Failed to record payment', err);
      alert('Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleOpenApproveModal = (inv: Invoice) => {
    setApprovingInvoice(inv);
    setApproveReason('Verified and approved onboarding advance invoice.');
    setApproveAdjustment(0);
    setApproveNotes('');
    setIsApproveModalOpen(true);
  };

  const handleApproveInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingInvoice) return;
    if (!approveReason.trim()) {
      alert('Approval reason is mandatory per 21 CFR Part 11 requirements.');
      return;
    }
    setIsSubmittingApproval(true);
    try {
      const invoiceId = approvingInvoice.id || (approvingInvoice as any).invoice_number;
      await approveInvoice(invoiceId, {
        reason: approveReason.trim(),
        adjustment_amount: approveAdjustment > 0 ? approveAdjustment : undefined,
        notes: approveNotes.trim() || undefined,
      });
      await loadAllData();
      setIsApproveModalOpen(false);
      setApprovingInvoice(null);
    } catch (err: any) {
      console.error('Failed to approve invoice', err);
      alert(err?.response?.data?.detail || err?.message || 'Failed to approve invoice');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const getStatusPill = (status: InvoiceStatus) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> PENDING REVIEW
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> PAID
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" /> OVERDUE
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Clock className="w-3 h-3" /> ISSUED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <FileText className="w-3 h-3" /> DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900/90 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5" /> Commercial Revenue & Invoicing
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Invoices & GST Billing Management
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Pay-Per-Minute GST tax invoicing with HSN/SAC 997312 compliance, real-time surgical usage aggregation, and tamper-evident SHA-256 digital seals.
            </p>
          </div>

          {!isHospitalAdmin && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleAutoBillingRun}
                disabled={isAutoBilling}
                className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                title="Automatically aggregate usage and issue GST invoices for all towers"
              >
                <Zap className={`w-4 h-4 ${isAutoBilling ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                <span>{isAutoBilling ? 'Running Auto-Billing...' : 'Run Automated Billing'}</span>
              </button>
              <button
                onClick={handleOpenGenerateModal}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 border border-blue-400/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Monthly Invoice</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Network Error & Recovery Banner */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span className="text-xs font-semibold">{loadError}</span>
          </div>
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold border border-rose-500/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Billed */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Billed (YTD)</p>
            <p className="text-2xl font-black text-white font-mono">
              ₹{(kpis.totalBilled / 100000).toFixed(2)} L
            </p>
            <p className="text-[11px] text-gray-500">{invoices.length} Total Invoices</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Total Collected */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Collected</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">
              ₹{(kpis.totalCollected / 100000).toFixed(2)} L
            </p>
            <p className="text-[11px] text-emerald-500/80 font-medium">{kpis.collectionRatePct}% Settlement Rate</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Dues */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Outstanding Receivables</p>
            <p className="text-2xl font-black text-amber-400 font-mono">
              ₹{(kpis.totalPending / 100000).toFixed(2)} L
            </p>
            <p className="text-[11px] text-amber-500/80">{kpis.issuedCount} Pending Invoices</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Overdue Alerts</p>
            <p className="text-2xl font-black text-rose-400 font-mono">
              {kpis.overdueCount} <span className="text-sm font-normal text-gray-400">Invoices</span>
            </p>
            <p className="text-[11px] text-rose-500/80">Requires Immediate Follow-up</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Filter Bar & Search */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-black/40 rounded-xl border border-white/10 text-xs">
            {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PAID', 'OVERDUE'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st === 'PENDING_APPROVAL' ? 'PENDING' : st}
              </button>
            ))}
          </div>

          {/* Customer Filter */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Institutions</option>
            {customers.map(c => (
              <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
            ))}
          </select>

        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search invoice #, customer, tower..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none w-full sm:w-64"
          />
        </div>

      </div>

      {/* Invoices List Table */}
      <div className="rounded-3xl bg-zinc-900/80 border border-white/10 overflow-hidden backdrop-blur-xl shadow-xl">
        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              No invoices found matching current filters.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-gray-300">
                  <th className="py-3.5 px-4 font-bold">Invoice Details</th>
                  <th className="py-3.5 px-4 font-bold">Customer / Institution</th>
                  <th className="py-3.5 px-4 font-bold">Tower / Usage</th>
                  <th className="py-3.5 px-4 font-bold">Taxable Amount</th>
                  <th className="py-3.5 px-4 font-bold">GST (18%)</th>
                  <th className="py-3.5 px-4 font-bold">Total Payable</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    
                    {/* Invoice ID & Date */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-white text-sm font-mono">{inv.invoiceNumber || (inv as any).invoice_number || inv.id}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Period: <span className="text-blue-400 font-semibold">{inv.billingMonth}</span> • Due: <span className={inv.status === 'OVERDUE' ? 'text-rose-400 font-bold' : 'text-gray-300'}>{inv.dueDate}</span>
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-white text-sm">{inv.customerName || (inv as any).customer_name || customers.find(c => c.customer_id === (inv.customerId || (inv as any).customer_id))?.name || (inv.customerId || (inv as any).customer_id) || 'Hospital Institution'}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">GSTIN: {inv.customerGstin || (inv as any).customer_gstin || 'N/A'}</p>
                    </td>

                    {/* Tower & Surgical Usage */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-cyan-300">{inv.towerId || (inv as any).tower_id || 'N/A'} ({inv.towerModel || (inv as any).model || 'LUMINA'})</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {Number(inv.surgeriesCount ?? (inv as any).surgeries_count ?? 0)} Surgeries • {Number(inv.totalMinutesUsed ?? (inv as any).total_minutes ?? 0).toLocaleString()} mins
                      </p>
                    </td>

                    {/* Taxable Subtotal */}
                    <td className="py-4 px-4 font-mono text-gray-300 font-medium">
                      ₹{Number(inv.subtotal ?? (inv as any).subtotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Total Tax */}
                    <td className="py-4 px-4 font-mono text-gray-400">
                      ₹{Number(inv.totalTax ?? (inv as any).tax_gst_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Total Payable & Balance */}
                    <td className="py-4 px-4">
                      <p className="font-mono font-bold text-white text-sm">
                        ₹{Number(inv.totalPayable ?? (inv as any).total_amount ?? (inv as any).net_payable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      {Number(inv.balanceDue ?? (inv as any).balance_due ?? (inv as any).net_payable ?? 0) > 0 && (inv.status || (inv as any).status) !== 'PAID' && (
                        <p className="text-[10px] font-mono text-amber-400 mt-0.5">
                          Bal: ₹{Number(inv.balanceDue ?? (inv as any).balance_due ?? (inv as any).net_payable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {getStatusPill(inv.status)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                      
                      {!isHospitalAdmin && (inv.status === 'PENDING_APPROVAL' || inv.status === 'DRAFT') && (
                        <button
                          onClick={() => handleOpenApproveModal(inv)}
                          className="px-2.5 py-1 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Review & Approve Invoice"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      )}

                      {inv.status !== 'PAID' && inv.status !== 'PENDING_APPROVAL' && (
                        <button
                          onClick={() => handleOpenRecordPayment(inv)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                          title="Record Payment Settlement"
                        >
                          Record Pay
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedInvoiceForPrint(inv)}
                        className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="View / Print GST Invoice"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>

                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generate Monthly Invoice Modal / Drawer */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>Generate Monthly Pay-Per-Minute GST Invoice</span>
              </h3>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              
              {/* Entity Selector (Customer -> Tower) */}
              <div className="space-y-2 p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                <label className="font-bold text-gray-300 block uppercase tracking-wider text-[11px]">
                  Target Deployment Entity
                </label>
                <EntitySelector
                  selectedDistributorId={genDistributorId}
                  selectedCustomerId={genCustomerId}
                  selectedTowerId={genTowerId}
                  onChange={handleEntityChange}
                  showDistributor={false}
                  showCustomer={true}
                  showTower={true}
                  requiredCustomer={true}
                  requiredTower={true}
                />
              </div>

              {/* Billing Month & Surgeries */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Billing Month:</label>
                  <input
                    type="month"
                    value={genBillingMonth}
                    onChange={(e) => setGenBillingMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-medium focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Surgeries Completed:</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={genSurgeriesCount}
                    onChange={(e) => setGenSurgeriesCount(Math.min(5000, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Total Optical Mins:</label>
                  <input
                    type="number"
                    min="0"
                    max="300000"
                    value={genTotalMinutes}
                    onChange={(e) => setGenTotalMinutes(Math.min(300000, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Rates per minute */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Base Rate (₹/min):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000"
                    value={genBaseRate}
                    onChange={(e) => setGenBaseRate(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Incremental Rate (₹/min):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000"
                    value={genIncRate}
                    onChange={(e) => setGenIncRate(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-cyan-400 font-mono font-bold focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-300 block mb-1">Negotiated Discount (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={genDiscountPct}
                    onChange={(e) => setGenDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Summary Pre-calculation Box */}
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/20 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-300">
                  <span>HSN/SAC Code:</span>
                  <span className="font-mono font-bold text-white">997312</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Estimated Taxable Subtotal:</span>
                  <span className="font-mono font-bold text-white">
                    ₹{((genTotalMinutes * genBaseRate) * (1 - genDiscountPct / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Estimated GST (18%):</span>
                  <span className="font-mono text-cyan-300">
                    ₹{(((genTotalMinutes * genBaseRate) * (1 - genDiscountPct / 100)) * 0.18).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-blue-500/20 font-bold text-sm text-white">
                  <span>Estimated Total Amount:</span>
                  <span className="font-mono text-emerald-400">
                    ₹{(((genTotalMinutes * genBaseRate) * (1 - genDiscountPct / 100)) * 1.18).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">Invoice Notes / PO Reference:</label>
                <textarea
                  rows={2}
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  {isSubmittingInvoice ? 'Generating Tax Invoice...' : 'Generate & Issue Invoice'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordPaymentModalOpen && paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Record Invoice Payment</span>
              </h3>
              <button
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 text-xs">
              
              <div className="p-3 bg-zinc-900 rounded-xl border border-white/10 space-y-1">
                <p className="font-bold text-white text-sm">{paymentInvoice.customerName || (paymentInvoice as any).customer_name}</p>
                <p className="text-gray-400 font-mono">{paymentInvoice.invoiceNumber || (paymentInvoice as any).invoice_number}</p>
                <div className="flex justify-between pt-1 border-t border-white/10 text-zinc-300 font-mono">
                  <span>Balance Due:</span>
                  <span className="font-bold text-rose-400">₹{(paymentInvoice.balanceDue ?? (paymentInvoice as any).balance_due ?? (paymentInvoice as any).net_payable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">Payment Amount (₹):</label>
                <input
                  type="number"
                  step="0.01"
                  max={paymentInvoice.balanceDue ?? (paymentInvoice as any).balance_due ?? (paymentInvoice as any).net_payable ?? 0}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">Payment Method:</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none"
                >
                  <option value="NEFT_RTGS">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="UPI">UPI / Digital QR</option>
                  <option value="CHEQUE">Bank Cheque / Demand Draft</option>
                  <option value="CARD">Credit / Corporate Card</option>
                  <option value="WIRE">International Wire Transfer</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">UTR / Bank Transaction Reference Number:</label>
                <input
                  type="text"
                  value={payUtr}
                  onChange={(e) => setPayUtr(e.target.value)}
                  placeholder="e.g. HDFC2610034892150"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">Settlement Notes:</label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Printable GST Invoice Modal */}
      <InvoicePrintModal
        isOpen={!!selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
        invoice={selectedInvoiceForPrint}
        onApprove={(inv) => {
          setSelectedInvoiceForPrint(null);
          handleOpenApproveModal(inv);
        }}
        onRecordPayment={(inv) => {
          setSelectedInvoiceForPrint(null);
          handleOpenRecordPayment(inv);
        }}
      />

      {/* Approve Invoice Modal */}
      {isApproveModalOpen && approvingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Approve GST Tax Invoice</span>
              </h3>
              <button
                onClick={() => { setIsApproveModalOpen(false); setApprovingInvoice(null); }}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveInvoiceSubmit} className="p-6 space-y-4 text-xs">
              
              {/* Invoice Summary Card */}
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Invoice Number:</span>
                  <span className="font-mono font-bold text-white">{approvingInvoice.invoiceNumber || (approvingInvoice as any).invoice_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Customer / Hospital:</span>
                  <span className="font-bold text-white">{approvingInvoice.customerName || (approvingInvoice as any).customer_name || customers.find(c => c.customer_id === (approvingInvoice.customerId || (approvingInvoice as any).customer_id))?.name || (approvingInvoice.customerId || (approvingInvoice as any).customer_id)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Tower ID:</span>
                  <span className="font-mono text-cyan-300">{approvingInvoice.towerId || (approvingInvoice as any).tower_id}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-gray-400">Total Net Payable:</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    ₹{(approvingInvoice.totalPayable ?? (approvingInvoice as any).total_amount ?? (approvingInvoice as any).net_payable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Approval Reason (Mandatory per FDA 21 CFR Part 11 / backend requirement) */}
              <div className="space-y-1">
                <label className="text-gray-300 font-bold flex items-center justify-between">
                  <span>Approval Reason / Audit Justification <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-gray-400 font-normal">Mandatory for audit trail</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  placeholder="e.g. Verified onboarding advance security deposit for hospital assignment"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
              </div>

              {/* Optional Adjustment Amount */}
              <div className="space-y-1">
                <label className="text-gray-300 font-bold flex items-center justify-between">
                  <span>Adjustment / Discount Amount (₹)</span>
                  <span className="text-[10px] text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approveAdjustment}
                  onChange={(e) => setApproveAdjustment(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-green-500 focus:outline-none font-mono"
                />
              </div>

              {/* Optional Notes */}
              <div className="space-y-1">
                <label className="text-gray-300 font-bold">Internal Notes</label>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Optional review remarks"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] leading-relaxed">
                ℹ️ Upon approval, the invoice status transitions to <strong>APPROVED</strong>, generating a tamper-evident SHA-256 seal and making the invoice instantly visible to the customer on their portal.
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setIsApproveModalOpen(false); setApprovingInvoice(null); }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval || !approveReason.trim()}
                  className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingApproval ? 'Approving...' : 'Confirm & Approve'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default BillingManagement;
