import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import Modal from '../components/ui/Modal';
import Drawer from '../components/ui/Drawer';
import { useToast } from '../components/ui/ToastProvider';
import {
  listBalanceRequests,
  approveBalanceRequest,
  rejectBalanceRequest,
  listPlanChangeRequests,
  approvePlanChangeRequest,
  rejectPlanChangeRequest,
  getClinicalLeads,
  updateClinicalLead,
  getGeneralInquiries,
  updateGeneralInquiry,
  getTowers,
  type BalanceRequest,
  type PlanChangeRequest,
  type Tower,
} from '../services/api';
import { resolveTowerPricing, calculateCommercialBreakdown } from '../services/pricing';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Eye,
  Check,
  X,
  AlertCircle,
  Clock,
  Layers,
  FileCheck,
  FileSpreadsheet,
  Inbox,
  Sparkles,
  Phone,
  Mail,
  Building2,
  User,
  ChevronRight,
  Save,
  MessageSquare,
  Tag,
  ShieldCheck,
  Building,
  HelpCircle,
} from 'lucide-react';

export interface ClinicalLead {
  id: string;
  tracking_id: string;
  hospital_name: string;
  city_state?: string;
  requester_name: string;
  requester_role?: string;
  email: string;
  phone: string;
  system: string;
  monthly_surgeries: string;
  speciality?: string;
  urgency?: string;
  status: 'PENDING_REVIEW' | 'CONTACTED' | 'EVALUATION_APPROVED' | 'DEMO_DISPATCHED' | 'CONVERTED';
  created_at: string;
  notes?: string;
  assigned_distributor?: string;
  updated_at?: string;
  reviewed_by?: string;
}

export interface GeneralInquiryItem {
  id: string;
  tracking_id: string;
  category: string;
  name: string;
  email: string;
  phone?: string;
  institution?: string;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}

const MOCK_LEAD_IDENTIFIERS = new Set([
  'lead-1',
  'lead-2',
  'lead-3',
  'UL-DEMO-202610-1042',
  'UL-DEMO-202610-1039',
  'UL-DEMO-202609-0988',
  'UL-DEMO-202610-1842',
  'UL-DEMO-202610-2917',
]);

const MOCK_INQUIRY_IDENTIFIERS = new Set([
  'inq-1',
  'inq-2',
  'inq-3',
  'inq-4',
  'UL-INQ-202610-4012',
  'UL-INQ-202610-3984',
  'UL-INQ-202609-3890',
  'UL-INQ-202609-3750',
]);

const loadLeadsFromStorage = (): ClinicalLead[] => {
  try {
    const raw = localStorage.getItem('univlabs_clinical_leads');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(
      (item: any) =>
        !MOCK_LEAD_IDENTIFIERS.has(item.id) &&
        !MOCK_LEAD_IDENTIFIERS.has(item.tracking_id)
    );
    if (filtered.length !== parsed.length) {
      localStorage.setItem('univlabs_clinical_leads', JSON.stringify(filtered));
    }
    return filtered.map((item: any, idx: number) => ({
      id: item.id || ('lead-' + (idx + 1)),
      tracking_id: item.tracking_id || item.id || ('UL-DEMO-' + Date.now() + '-' + (idx + 1)),
      hospital_name: item.hospital_name || item.hospital || item.institution || 'Medical Institution',
      city_state: item.city_state || item.city || item.location || '',
      requester_name: item.requester_name || item.name || item.requester || 'Clinician',
      requester_role: item.requester_role || item.role || item.title || 'Surgeon',
      email: item.email || item.contact_email || '',
      phone: item.phone || item.contact_phone || '',
      system: item.system || item.selected_system || 'Spectra ICG 4K',
      monthly_surgeries: item.monthly_surgeries || item.surgery_volume || '15-30 cases/mo',
      speciality: item.speciality || item.clinical_speciality || 'General Laparoscopy',
      urgency: item.urgency || item.delivery_urgency || 'Standard',
      status: item.status || 'PENDING_REVIEW',
      created_at: item.created_at || item.timestamp || new Date().toISOString(),
      notes: item.notes || '',
      assigned_distributor: item.assigned_distributor || '',
      updated_at: item.updated_at,
      reviewed_by: item.reviewed_by,
    }));
  } catch {
    return [];
  }
};

const loadInquiriesFromStorage = (): GeneralInquiryItem[] => {
  try {
    const raw = localStorage.getItem('univlabs_general_inquiries');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(
      (item: any) =>
        !MOCK_INQUIRY_IDENTIFIERS.has(item.id) &&
        !MOCK_INQUIRY_IDENTIFIERS.has(item.tracking_id)
    );
    if (filtered.length !== parsed.length) {
      localStorage.setItem('univlabs_general_inquiries', JSON.stringify(filtered));
    }
    return filtered.map((item: any, idx: number) => ({
      id: item.id || ('inq-' + (idx + 1)),
      tracking_id: item.tracking_id || item.id || ('UL-INQ-' + Date.now() + '-' + (idx + 1)),
      category: item.category || 'General Commercial',
      name: item.name || 'Inquirer',
      email: item.email || '',
      phone: item.phone || '',
      institution: item.institution || item.hospital || '',
      message: item.message || item.notes || '',
      status: item.status || 'NEW',
      notes: item.notes || '',
      assigned_to: item.assigned_to || '',
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at,
      resolved_at: item.resolved_at,
    }));
  } catch {
    return [];
  }
};

const INQUIRY_CATEGORIES = [
  'All Categories',
  'Hospital Onboarding',
  'Distributor Partnership',
  'Technical / Clinical Support',
  'General Commercial',
] as const;

const RequestsManagement: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userRole = currentUser.role || '';
  const canReview = userRole === 'superadmin' || userRole === 'subscription_manager';

  // Navigation & Filtering
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'topup' | 'plan' | 'leads' | 'inquiries'>(() => {
    if (initialTab === 'inquiries') return 'inquiries';
    if (initialTab === 'leads') return 'leads';
    if (initialTab === 'plan') return 'plan';
    return 'topup';
  });

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data
  const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
  const [planRequests, setPlanRequests] = useState<PlanChangeRequest[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [leads, setLeads] = useState<ClinicalLead[]>(loadLeadsFromStorage);
  const [inquiries, setInquiries] = useState<GeneralInquiryItem[]>(loadInquiriesFromStorage);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Detail Drawer for Balance Requests
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<BalanceRequest | null>(null);

  const handleOpenDetailDrawer = (req: BalanceRequest) => {
    setSelectedRequestDetail(req);
    setDetailDrawerOpen(true);
  };

  // Modals for Top-up & Plan
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedForApproval, setSelectedForApproval] = useState<{
    type: 'topup' | 'plan';
    data: BalanceRequest | PlanChangeRequest;
  } | null>(null);

  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedForRejection, setSelectedForRejection] = useState<{
    type: 'topup' | 'plan';
    data: BalanceRequest | PlanChangeRequest;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action Drawer for Leads
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ClinicalLead | null>(null);
  const [editLeadStatus, setEditLeadStatus] = useState<ClinicalLead['status']>('PENDING_REVIEW');
  const [editLeadNotes, setEditLeadNotes] = useState('');
  const [editLeadDistributor, setEditLeadDistributor] = useState('');

  // Action Drawer for Inquiries
  const [isInquiryDrawerOpen, setIsInquiryDrawerOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<GeneralInquiryItem | null>(null);
  const [editInquiryStatus, setEditInquiryStatus] = useState<GeneralInquiryItem['status']>('NEW');
  const [editInquiryNotes, setEditInquiryNotes] = useState('');
  const [editInquiryAssignee, setEditInquiryAssignee] = useState('');

  // Handle URL tab changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'inquiries' && activeTab !== 'inquiries') {
      setActiveTab('inquiries');
    } else if (tabParam === 'leads' && activeTab !== 'leads') {
      setActiveTab('leads');
    } else if (tabParam === 'plan' && activeTab !== 'plan') {
      setActiveTab('plan');
    } else if (tabParam === 'topup' && activeTab !== 'topup') {
      setActiveTab('topup');
    }
  }, [searchParams, activeTab]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [balRes, planRes, leadsRes, inqRes, towersRes] = await Promise.allSettled([
        listBalanceRequests(),
        listPlanChangeRequests(),
        getClinicalLeads(),
        getGeneralInquiries(),
        getTowers(),
      ]);

      if (balRes.status === 'fulfilled') {
        setBalanceRequests(balRes.value || []);
      } else {
        console.warn('Failed to load balance requests:', balRes.reason);
      }

      if (planRes.status === 'fulfilled') {
        setPlanRequests(planRes.value || []);
      } else {
        console.warn('Failed to load plan change requests:', planRes.reason);
      }

      if (towersRes.status === 'fulfilled') {
        setTowers(towersRes.value || []);
      } else {
        console.warn('Failed to load towers:', towersRes.reason);
      }

      if (leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value) && leadsRes.value.length > 0) {
        setLeads(leadsRes.value);
      } else {
        setLeads(loadLeadsFromStorage());
      }

      if (inqRes.status === 'fulfilled' && Array.isArray(inqRes.value) && inqRes.value.length > 0) {
        setInquiries(inqRes.value);
      } else {
        setInquiries(loadInquiriesFromStorage());
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to fetch requests', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();

    const onLeadsUpdated = () => {
      setLeads(loadLeadsFromStorage());
    };
    const onInquiriesUpdated = () => {
      setInquiries(loadInquiriesFromStorage());
    };
    window.addEventListener('storage', onLeadsUpdated);
    window.addEventListener('storage', onInquiriesUpdated);
    window.addEventListener('univlabs:leads-updated', onLeadsUpdated);
    window.addEventListener('univlabs:inquiries-updated', onInquiriesUpdated);
    return () => {
      window.removeEventListener('storage', onLeadsUpdated);
      window.removeEventListener('storage', onInquiriesUpdated);
      window.removeEventListener('univlabs:leads-updated', onLeadsUpdated);
      window.removeEventListener('univlabs:inquiries-updated', onInquiriesUpdated);
    };
  }, [fetchData]);

  // Filtered Top-Up Requests
  const filteredBalanceRequests = useMemo(() => {
    return balanceRequests.filter((req) => {
      const matchStatus =
        statusFilter === 'ALL' || req.status?.toUpperCase() === statusFilter.toUpperCase();
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        req.tower_id?.toLowerCase().includes(query) ||
        req.requested_by?.toLowerCase().includes(query) ||
        req.po_number?.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [balanceRequests, statusFilter, searchQuery]);

  // Filtered Plan Change Requests
  const filteredPlanRequests = useMemo(() => {
    return planRequests.filter((req) => {
      const matchStatus =
        statusFilter === 'ALL' || req.status?.toUpperCase() === statusFilter.toUpperCase();
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        req.tower_id?.toLowerCase().includes(query) ||
        req.requested_by?.toLowerCase().includes(query) ||
        req.customer_id?.toLowerCase().includes(query) ||
        req.requested_plan?.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [planRequests, statusFilter, searchQuery]);

  // Filtered Clinical Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchStatus =
        statusFilter === 'ALL' || lead.status?.toUpperCase() === statusFilter.toUpperCase();
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        lead.hospital_name?.toLowerCase().includes(query) ||
        lead.requester_name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query) ||
        lead.system?.toLowerCase().includes(query) ||
        lead.tracking_id?.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [leads, statusFilter, searchQuery]);

  // Filtered Corporate & Reach Us Inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const matchStatus =
        statusFilter === 'ALL' || inq.status?.toUpperCase() === statusFilter.toUpperCase();
      const matchCategory =
        categoryFilter === 'All Categories' || inq.category?.toLowerCase() === categoryFilter.toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        inq.name?.toLowerCase().includes(query) ||
        inq.email?.toLowerCase().includes(query) ||
        inq.phone?.toLowerCase().includes(query) ||
        inq.institution?.toLowerCase().includes(query) ||
        inq.message?.toLowerCase().includes(query) ||
        inq.category?.toLowerCase().includes(query) ||
        inq.tracking_id?.toLowerCase().includes(query) ||
        inq.assigned_to?.toLowerCase().includes(query);
      return matchStatus && matchCategory && matchSearch;
    });
  }, [inquiries, statusFilter, categoryFilter, searchQuery]);

  // Status Badge Helpers
  const renderStatusBadge = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          APPROVED
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-3.5 h-3.5" />
        PENDING
      </span>
    );
  };

  const renderLeadStatusBadge = (status: string) => {
    const s = (status || 'PENDING_REVIEW').toUpperCase();
    switch (s) {
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            CONVERTED
          </span>
        );
      case 'DEMO_DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            DEMO DISPATCHED
          </span>
        );
      case 'EVALUATION_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Check className="w-3.5 h-3.5" />
            EVAL APPROVED
          </span>
        );
      case 'CONTACTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Phone className="w-3.5 h-3.5" />
            CONTACTED
          </span>
        );
      case 'PENDING_REVIEW':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            PENDING REVIEW
          </span>
        );
    }
  };

  const renderInquiryStatusBadge = (status: string) => {
    const s = (status || 'NEW').toUpperCase();
    switch (s) {
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            RESOLVED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            IN PROGRESS
          </span>
        );
      case 'CONTACTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Phone className="w-3.5 h-3.5" />
            CONTACTED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <XCircle className="w-3.5 h-3.5" />
            CLOSED
          </span>
        );
      case 'NEW':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            NEW
          </span>
        );
    }
  };

  const renderCategoryBadge = (category: string) => {
    const cat = category || 'General Commercial';
    if (cat.includes('Hospital')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Building2 className="w-3 h-3" />
          Hospital Onboarding
        </span>
      );
    }
    if (cat.includes('Distributor')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Building className="w-3 h-3" />
          Distributor Partnership
        </span>
      );
    }
    if (cat.includes('Technical') || cat.includes('Support')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <HelpCircle className="w-3 h-3" />
          Technical / Clinical Support
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Tag className="w-3 h-3" />
        General Commercial
      </span>
    );
  };

  // Lead Action Drawer Open
  const handleOpenLeadDrawer = (lead: ClinicalLead) => {
    setSelectedLead(lead);
    setEditLeadStatus(lead.status);
    setEditLeadNotes(lead.notes || '');
    setEditLeadDistributor(lead.assigned_distributor || '');
    setIsLeadDrawerOpen(true);
  };

  // Save Lead Updates
  const handleSaveLead = async () => {
    if (!selectedLead) return;
    const updatedLead: ClinicalLead = {
      ...selectedLead,
      status: editLeadStatus,
      notes: editLeadNotes,
      assigned_distributor: editLeadDistributor,
      updated_at: new Date().toISOString(),
      reviewed_by: currentUser.username || currentUser.name || 'Subscription Manager',
    };

    const updated = leads.map((l) => (l.id === selectedLead.id || l.tracking_id === selectedLead.tracking_id ? updatedLead : l));
    setLeads(updated);
    localStorage.setItem('univlabs_clinical_leads', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('univlabs:leads-updated'));

    try {
      await updateClinicalLead(selectedLead.id || selectedLead.tracking_id, {
        status: editLeadStatus,
        notes: editLeadNotes,
        assigned_distributor: editLeadDistributor,
      });
    } catch (err) {
      console.warn('API updateClinicalLead failed, saved locally:', err);
    }

    addToast(`Clinical lead ${selectedLead.tracking_id} updated.`, 'success');
    setIsLeadDrawerOpen(false);
  };

  // Inquiry Action Drawer Open
  const handleOpenInquiryDrawer = (inq: GeneralInquiryItem) => {
    setSelectedInquiry(inq);
    setEditInquiryStatus(inq.status);
    setEditInquiryNotes(inq.notes || '');
    setEditInquiryAssignee(inq.assigned_to || '');
    setIsInquiryDrawerOpen(true);
  };

  // Save Inquiry Updates
  const handleSaveInquiry = async () => {
    if (!selectedInquiry) return;
    const now = new Date().toISOString();
    const updatedInquiry: GeneralInquiryItem = {
      ...selectedInquiry,
      status: editInquiryStatus,
      notes: editInquiryNotes,
      assigned_to: editInquiryAssignee,
      updated_at: now,
      resolved_at: editInquiryStatus === 'RESOLVED' || editInquiryStatus === 'CLOSED' ? (selectedInquiry.resolved_at || now) : undefined,
    };

    const updated = inquiries.map((item) => (item.id === selectedInquiry.id || item.tracking_id === selectedInquiry.tracking_id ? updatedInquiry : item));
    setInquiries(updated);
    localStorage.setItem('univlabs_general_inquiries', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('univlabs:inquiries-updated'));

    try {
      await updateGeneralInquiry(selectedInquiry.id || selectedInquiry.tracking_id, {
        status: editInquiryStatus,
        notes: editInquiryNotes,
        assigned_to: editInquiryAssignee,
      });
    } catch (err) {
      console.warn('API updateGeneralInquiry failed, saved locally:', err);
    }

    addToast(`Inquiry ${selectedInquiry.tracking_id} updated.`, 'success');
    setIsInquiryDrawerOpen(false);
  };

  const handleOpenApprove = (type: 'topup' | 'plan', data: BalanceRequest | PlanChangeRequest) => {
    setSelectedForApproval({ type, data });
    setApprovalModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedForApproval) return;
    setIsSubmitting(true);
    try {
      if (selectedForApproval.type === 'topup') {
        const req = selectedForApproval.data as BalanceRequest;
        await approveBalanceRequest(req.request_id);
        addToast(`Top-up request for ${req.tower_id} approved.`, 'success');
      } else {
        const req = selectedForApproval.data as PlanChangeRequest;
        await approvePlanChangeRequest(req.request_id);
        addToast(`Plan change request for ${req.tower_id} approved.`, 'success');
      }
      setApprovalModalOpen(false);
      setSelectedForApproval(null);
      await fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || err.message || 'Approval failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReject = (type: 'topup' | 'plan', data: BalanceRequest | PlanChangeRequest) => {
    setSelectedForRejection({ type, data });
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedForRejection) return;
    setIsSubmitting(true);
    try {
      if (selectedForRejection.type === 'topup') {
        const req = selectedForRejection.data as BalanceRequest;
        await rejectBalanceRequest(req.request_id, rejectionReason.trim());
        addToast(`Top-up request for ${req.tower_id} rejected.`, 'info');
      } else {
        const req = selectedForRejection.data as PlanChangeRequest;
        await rejectPlanChangeRequest(req.request_id, rejectionReason.trim());
        addToast(`Plan change request for ${req.tower_id} rejected.`, 'info');
      }
      setRejectionModalOpen(false);
      setSelectedForRejection(null);
      setRejectionReason('');
      await fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || err.message || 'Rejection failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingTopupCount = balanceRequests.filter(
    (r) => (r.status || '').toUpperCase() === 'PENDING'
  ).length;
  const pendingPlanCount = planRequests.filter(
    (r) => (r.status || '').toUpperCase() === 'PENDING'
  ).length;
  const pendingLeadsCount = leads.filter(
    (l) => {
      const s = (l.status || 'PENDING_REVIEW').toUpperCase();
      return s === 'PENDING_REVIEW' || s === 'PENDING';
    }
  ).length;
  const pendingInquiriesCount = inquiries.filter(
    (i) => {
      const s = (i.status || 'NEW').toUpperCase();
      return s === 'NEW' || s === 'IN_PROGRESS';
    }
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            Requests & Inquiries Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {canReview
              ? 'Authorize top-up balances, approve subscription plan modifications, dispatch clinical demo evaluations, and manage corporate inquiries.'
              : 'Track the status and history of submitted service requests, clinical trials, and corporate communications.'}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all text-sm font-medium self-start sm:self-auto disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs and Filters Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Navigation Quadruple Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('topup');
                setSearchParams({ tab: 'topup' });
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'topup'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Top-Up Minutes</span>
              {pendingTopupCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40">
                  {pendingTopupCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('plan');
                setSearchParams({ tab: 'plan' });
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'plan'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Plan Upgrade</span>
              {pendingPlanCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40">
                  {pendingPlanCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('leads');
                setSearchParams({ tab: 'leads' });
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Clinical Demo Leads</span>
              {pendingLeadsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  {pendingLeadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('inquiries');
                setSearchParams({ tab: 'inquiries' });
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'inquiries'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Reach Us Inquiries</span>
              {pendingInquiriesCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 animate-pulse">
                  {pendingInquiriesCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'leads'
                    ? 'Search hospital, surgeon, system...'
                    : activeTab === 'inquiries'
                    ? 'Search name, institution, message...'
                    : 'Search Tower ID, Requester...'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-xl px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-zinc-400 ml-1" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-zinc-300 text-sm font-medium focus:outline-none pr-2 py-1 cursor-pointer"
              >
                {activeTab === 'leads' ? (
                  <>
                    <option value="ALL" className="bg-zinc-900 text-white">All Statuses</option>
                    <option value="PENDING_REVIEW" className="bg-zinc-900 text-white">Pending Review</option>
                    <option value="CONTACTED" className="bg-zinc-900 text-white">Contacted</option>
                    <option value="EVALUATION_APPROVED" className="bg-zinc-900 text-white">Evaluation Approved</option>
                    <option value="DEMO_DISPATCHED" className="bg-zinc-900 text-white">Demo Dispatched</option>
                    <option value="CONVERTED" className="bg-zinc-900 text-white">Converted</option>
                  </>
                ) : activeTab === 'inquiries' ? (
                  <>
                    <option value="ALL" className="bg-zinc-900 text-white">All Statuses</option>
                    <option value="NEW" className="bg-zinc-900 text-white">New</option>
                    <option value="CONTACTED" className="bg-zinc-900 text-white">Contacted</option>
                    <option value="IN_PROGRESS" className="bg-zinc-900 text-white">In Progress</option>
                    <option value="RESOLVED" className="bg-zinc-900 text-white">Resolved</option>
                    <option value="CLOSED" className="bg-zinc-900 text-white">Closed</option>
                  </>
                ) : (
                  <>
                    <option value="ALL" className="bg-zinc-900 text-white">All Statuses</option>
                    <option value="PENDING" className="bg-zinc-900 text-white">Pending</option>
                    <option value="APPROVED" className="bg-zinc-900 text-white">Approved</option>
                    <option value="REJECTED" className="bg-zinc-900 text-white">Rejected</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Content Area */}
      {activeTab === 'topup' && (
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              Top-Up Balance Requests ({filteredBalanceRequests.length})
            </h2>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Request ID</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tower ID</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type & Allocation</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Est. Commercial Value</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">PO / Reference #</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Requester</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Submitted</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Receipt</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Review Info</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBalanceRequests.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-zinc-500">
                      {isLoading ? 'Loading requests...' : 'No top-up requests found matching your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredBalanceRequests.map((req) => {
                    const minutes = req.requested_minutes ?? req.requested_min ?? 0;
                    const hours = (minutes / 60).toFixed(1);
                    const isPending = (req.status || 'PENDING').toUpperCase() === 'PENDING';
                    const pricing = resolveTowerPricing(req.tower_id, towers);
                    const breakdown = calculateCommercialBreakdown(Math.floor(minutes / 60), minutes % 60, pricing.ratePerMin);
                    const isDuration = Boolean((req as any).duration_days || (req as any).duration_months || req.notes?.toLowerCase().includes('duration') || req.notes?.toLowerCase().includes('lease'));

                    return (
                      <tr key={req.request_id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-xs font-mono text-zinc-300 font-semibold">{req.request_id}</td>
                        <td className="p-4 text-sm font-semibold text-white">
                          <div>{req.tower_id}</div>
                          <div className="text-[10px] font-normal text-zinc-400 font-mono">{pricing.model}</div>
                        </td>
                        <td className="p-4 text-sm text-zinc-200">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit border ${
                              isDuration 
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' 
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {isDuration ? 'Duration' : 'Time Credit'}
                            </span>
                            <span className="font-semibold text-white">
                              {hours} hrs <span className="text-xs text-zinc-400 font-normal">({minutes} min)</span>
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-xs">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                ₹{breakdown.totalAmount.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold" title={`${pricing.displayName} Rate`}>
                                ₹{pricing.ratePerMin.toFixed(2)}/min
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400">
                              Sub: ₹{breakdown.subtotal.toLocaleString('en-IN')} + 18% GST
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-zinc-300">
                          {req.po_number ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-200 font-medium">
                              {req.po_number}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-zinc-300">{req.requested_by}</td>
                        <td className="p-4 text-xs text-zinc-400">
                          {req.requested_at ? new Date(req.requested_at).toLocaleString() : req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="p-4 text-sm">{renderStatusBadge(req.status)}</td>
                        <td className="p-4 text-sm">
                          {req.receipt_data_url ? (
                            <button
                              onClick={() => {
                                setReceiptUrl(req.receipt_data_url || null);
                                setReceiptModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          ) : (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-zinc-400 max-w-xs">
                          {req.reviewed_by ? (
                            <div className="space-y-0.5">
                              <div>
                                <span className="text-zinc-500">By: </span>
                                <span className="text-zinc-300">{req.reviewed_by}</span>
                              </div>
                              {req.reviewed_at && (
                                <div className="text-[11px] text-zinc-500">
                                  {new Date(req.reviewed_at).toLocaleDateString()}
                                </div>
                              )}
                              {req.rejection_reason && (
                                <div className="text-[11px] text-rose-400 font-medium truncate" title={req.rejection_reason}>
                                  Reason: {req.rejection_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-500">Pending review</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => handleOpenDetailDrawer(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all cursor-pointer"
                              title="View request details and commercial breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Details
                            </button>
                            {canReview && isPending && (
                              <>
                                <button
                                  onClick={() => handleOpenApprove('topup', req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all shadow-sm cursor-pointer"
                                  title="Approve top-up"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleOpenReject('topup', req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white transition-all shadow-sm cursor-pointer"
                                  title="Reject top-up"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'plan' && (
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Plan Upgrade Requests ({filteredPlanRequests.length})
            </h2>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Request ID</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tower ID</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Current Plan</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Requested Plan</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Requester</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Submitted</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Review Info</th>
                  {canReview && (
                    <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPlanRequests.length === 0 ? (
                  <tr>
                    <td colSpan={canReview ? 10 : 9} className="p-8 text-center text-zinc-500">
                      {isLoading ? 'Loading requests...' : 'No plan change requests found matching your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredPlanRequests.map((req) => {
                    const isPending = (req.status || 'PENDING').toUpperCase() === 'PENDING';

                    return (
                      <tr key={req.request_id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-xs font-mono text-zinc-300 font-semibold">{req.request_id}</td>
                        <td className="p-4 text-sm font-semibold text-white">{req.tower_id}</td>
                        <td className="p-4 text-sm">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {req.current_plan || 'NONE'}
                          </span>
                        </td>
                        <td className="p-4 text-sm">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {req.requested_plan}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-zinc-300">
                          {req.requested_duration_days && (
                            <div>Duration: <span className="font-semibold text-white">{req.requested_duration_days} days</span></div>
                          )}
                          {req.requested_balance_hours && (
                            <div>Balance: <span className="font-semibold text-white">{req.requested_balance_hours} hrs</span></div>
                          )}
                          {req.notes && (
                            <div className="text-zinc-400 italic truncate max-w-xs" title={req.notes}>
                              Note: {req.notes}
                            </div>
                          )}
                          {!req.requested_duration_days && !req.requested_balance_hours && !req.notes && (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-zinc-300">{req.requested_by}</td>
                        <td className="p-4 text-xs text-zinc-400">
                          {req.requested_at ? new Date(req.requested_at).toLocaleString() : '—'}
                        </td>
                        <td className="p-4 text-sm">{renderStatusBadge(req.status)}</td>
                        <td className="p-4 text-xs text-zinc-400 max-w-xs">
                          {req.reviewed_by ? (
                            <div className="space-y-0.5">
                              <div>
                                <span className="text-zinc-500">By: </span>
                                <span className="text-zinc-300">{req.reviewed_by}</span>
                              </div>
                              {req.reviewed_at && (
                                <div className="text-[11px] text-zinc-500">
                                  {new Date(req.reviewed_at).toLocaleDateString()}
                                </div>
                              )}
                              {req.rejection_reason && (
                                <div className="text-[11px] text-rose-400 font-medium truncate" title={req.rejection_reason}>
                                  Reason: {req.rejection_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-500">Pending review</span>
                          )}
                        </td>
                        {canReview && (
                          <td className="p-4 text-right">
                            {isPending ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenApprove('plan', req)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all shadow-sm cursor-pointer"
                                  title="Approve plan change"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleOpenReject('plan', req)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white transition-all shadow-sm cursor-pointer"
                                  title="Reject plan change"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-500">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Clinical Demo Enquiries & Leads Tab */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-400" />
                Institutional Clinical Demo Leads ({filteredLeads.length})
              </h2>
              <span className="text-xs text-zinc-500 hidden sm:inline">
                Captured via UnivLabs 5-Day Surgical Evaluation Trials Gateway
              </span>
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <GlassCard className="p-12 text-center text-zinc-500 space-y-2">
              <Inbox className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm">No clinical demo leads matching your search criteria.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const isPending = (lead.status || 'PENDING_REVIEW').toUpperCase() === 'PENDING_REVIEW';
                const systemBadgeColor = lead.system?.includes('Spectra')
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : lead.system?.includes('Lumina')
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';

                return (
                  <GlassCard
                    key={lead.id || lead.tracking_id}
                    className={`p-5 flex flex-col justify-between transition-all border hover:border-emerald-500/40 ${
                      isPending ? 'bg-zinc-950/70 border-amber-500/20' : 'bg-zinc-950/60 border-white/10'
                    }`}
                  >
                    <div>
                      {/* Card Header: Tracking ID + Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-semibold text-zinc-400">
                          {lead.tracking_id}
                        </span>
                        {renderLeadStatusBadge(lead.status)}
                      </div>

                      {/* Hospital & Requester */}
                      <div className="space-y-1 mb-4">
                        <h3 className="text-base font-bold text-white flex items-start gap-2 leading-tight">
                          <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{lead.hospital_name}</span>
                        </h3>
                        {lead.city_state && (
                          <p className="text-xs text-zinc-400 pl-6">{lead.city_state}</p>
                        )}
                        <div className="flex items-center gap-2 pt-2 text-xs text-zinc-300">
                          <User className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <span className="font-semibold text-white">{lead.requester_name}</span>
                          {lead.requester_role && (
                            <span className="text-zinc-400">· {lead.requester_role}</span>
                          )}
                        </div>
                      </div>

                      {/* Contact Info Pills */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors truncate"
                          title={lead.email}
                        >
                          <Mail className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors truncate"
                          title={lead.phone}
                        >
                          <Phone className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </a>
                      </div>

                      {/* System & Telemetry */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Selected System</span>
                          <span className={`px-2 py-0.5 rounded font-semibold text-[11px] border ${systemBadgeColor}`}>
                            {lead.system}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Monthly Volume</span>
                          <span className="font-medium text-white">{lead.monthly_surgeries}</span>
                        </div>
                        {lead.speciality && (
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">Speciality</span>
                            <span className="text-zinc-300 truncate max-w-[180px]">{lead.speciality}</span>
                          </div>
                        )}
                        {lead.urgency && (
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">Timeline</span>
                            <span className="text-zinc-300">{lead.urgency}</span>
                          </div>
                        )}
                      </div>

                      {lead.notes && (
                        <div className="text-xs text-zinc-400 bg-white/5 p-2.5 rounded-lg border border-white/5 mb-4 line-clamp-2">
                          <span className="font-semibold text-zinc-300">Notes: </span>
                          {lead.notes}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Submitted time + Action */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                      </span>
                      {canReview ? (
                        <button
                          onClick={() => handleOpenLeadDrawer(lead)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
                        >
                          <span>Review & Dispatch</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenLeadDrawer(lead)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <span>Details</span>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Corporate & Reach Us Inquiries Tab */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          {/* Header & Category Filter Pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Corporate & Reach Us Inquiries ({filteredInquiries.length})
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>SLA Guaranteed Response Time: <strong>&lt; 4 Business Hours</strong></span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
              {INQUIRY_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredInquiries.length === 0 ? (
            <GlassCard className="p-12 text-center text-zinc-500 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm">No corporate inquiries matching your search or category filters.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredInquiries.map((inq) => {
                const isNew = (inq.status || 'NEW').toUpperCase() === 'NEW';

                return (
                  <GlassCard
                    key={inq.id || inq.tracking_id}
                    className={`p-5 flex flex-col justify-between transition-all border hover:border-indigo-500/40 ${
                      isNew ? 'bg-zinc-950/80 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-zinc-950/60 border-white/10'
                    }`}
                  >
                    <div>
                      {/* Card Header: Tracking ID + Category + Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-semibold text-zinc-400">
                          {inq.tracking_id}
                        </span>
                        {renderInquiryStatusBadge(inq.status)}
                      </div>

                      {/* Category Badge */}
                      <div className="mb-3">
                        {renderCategoryBadge(inq.category)}
                      </div>

                      {/* Contact & Institution */}
                      <div className="space-y-1 mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2 leading-tight">
                          <User className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <span>{inq.name}</span>
                        </h3>
                        {inq.institution && (
                          <p className="text-xs text-zinc-300 flex items-center gap-1.5 pl-5 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span>{inq.institution}</span>
                          </p>
                        )}
                      </div>

                      {/* Contact Info Pills */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
                        <a
                          href={`mailto:${inq.email}`}
                          className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors truncate"
                          title={inq.email}
                        >
                          <Mail className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <span className="truncate">{inq.email}</span>
                        </a>
                        {inq.phone ? (
                          <a
                            href={`tel:${inq.phone}`}
                            className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors truncate"
                            title={inq.phone}
                          >
                            <Phone className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span className="truncate">{inq.phone}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5 text-zinc-500 text-xs">
                            <Phone className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                            <span>No phone</span>
                          </div>
                        )}
                      </div>

                      {/* Inquiry Message Box */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-4 text-xs">
                        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                          Inquiry Statement
                        </span>
                        <p className="text-zinc-200 line-clamp-3 leading-relaxed">
                          {inq.message}
                        </p>
                      </div>

                      {/* Assignee & Notes Excerpt */}
                      {inq.assigned_to && (
                        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 mb-3">
                          <span className="text-zinc-400 text-[11px]">Assigned Staff:</span>
                          <span className="font-semibold">{inq.assigned_to}</span>
                        </div>
                      )}

                      {inq.notes && (
                        <div className="text-xs text-zinc-400 bg-white/5 p-2.5 rounded-lg border border-white/5 mb-3 line-clamp-2">
                          <span className="font-semibold text-zinc-300">Resolution Note: </span>
                          {inq.notes}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Submitted time + Action */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="flex flex-col text-[11px] text-zinc-500 font-mono">
                        <span>{inq.created_at ? new Date(inq.created_at).toLocaleDateString() : '—'}</span>
                        <span className="text-[10px] text-emerald-400 font-sans">SLA: &lt; 4 hrs</span>
                      </div>
                      <button
                        onClick={() => handleOpenInquiryDrawer(inq)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer shadow-xs"
                      >
                        <span>{canReview ? 'Manage Inquiry' : 'View Full Details'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Drawer for Lead Review & Qualification */}
      <Drawer
        isOpen={isLeadDrawerOpen}
        onClose={() => setIsLeadDrawerOpen(false)}
        title={selectedLead ? `Clinical Lead · ${selectedLead.tracking_id}` : 'Clinical Lead Review'}
        width="max-w-xl"
      >
        {selectedLead && (
          <div className="space-y-6 text-sm text-zinc-200">
            {/* Header Identity Card */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400 font-bold">
                  {selectedLead.tracking_id}
                </span>
                {renderLeadStatusBadge(editLeadStatus)}
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{selectedLead.hospital_name}</h4>
                {selectedLead.city_state && (
                  <p className="text-xs text-zinc-400">{selectedLead.city_state}</p>
                )}
              </div>
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 block">Surgeon / Requester</span>
                  <span className="font-semibold text-white">{selectedLead.requester_name}</span>
                  {selectedLead.requester_role && (
                    <span className="text-zinc-400 block text-[11px]">{selectedLead.requester_role}</span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500 block">Clinical System</span>
                  <span className="font-semibold text-emerald-400">{selectedLead.system}</span>
                  <span className="text-zinc-400 block text-[11px]">{selectedLead.monthly_surgeries}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-3 text-xs">
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{selectedLead.email}</span>
                </a>
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedLead.phone}</span>
                </a>
              </div>
            </div>

            {/* Quick Status Setter Pills */}
            {canReview && (
              <div className="space-y-2">
                <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  Lead Qualification Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: 'PENDING_REVIEW', label: 'Pending Review' },
                    { key: 'CONTACTED', label: 'Contacted' },
                    { key: 'EVALUATION_APPROVED', label: 'Eval Approved' },
                    { key: 'DEMO_DISPATCHED', label: 'Demo Dispatched' },
                    { key: 'CONVERTED', label: 'Converted' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setEditLeadStatus(s.key as any)}
                      className={`px-3 py-2 rounded-xl font-medium border text-left transition-all cursor-pointer ${
                        editLeadStatus === s.key
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm'
                          : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Distributor & Notes Form */}
            {canReview ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Assigned Regional Distributor / Field Lead
                  </label>
                  <input
                    type="text"
                    value={editLeadDistributor}
                    onChange={(e) => setEditLeadDistributor(e.target.value)}
                    placeholder="e.g. South Zone BioTech Systems / Eng. Karthik"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Clinical Trial & Institutional Assessment Notes
                  </label>
                  <textarea
                    value={editLeadNotes}
                    onChange={(e) => setEditLeadNotes(e.target.value)}
                    rows={4}
                    placeholder="Document clinical trial dates, scope optics requirements, surgeon availability, institution review board approvals..."
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLeadDrawerOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLead}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Lead Updates</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-zinc-400">
                {selectedLead.assigned_distributor && (
                  <div>
                    <span className="text-zinc-500 block">Assigned Distributor:</span>
                    <span className="text-zinc-200">{selectedLead.assigned_distributor}</span>
                  </div>
                )}
                {selectedLead.notes && (
                  <div>
                    <span className="text-zinc-500 block">Notes:</span>
                    <p className="text-zinc-200 mt-1">{selectedLead.notes}</p>
                  </div>
                )}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setIsLeadDrawerOpen(false)}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Action Drawer for Corporate & Reach Us Inquiry Detail */}
      <Drawer
        isOpen={isInquiryDrawerOpen}
        onClose={() => setIsInquiryDrawerOpen(false)}
        title={selectedInquiry ? `Reach Us Inquiry · ${selectedInquiry.tracking_id}` : 'Inquiry Management'}
        width="max-w-xl"
      >
        {selectedInquiry && (
          <div className="space-y-6 text-sm text-zinc-200">
            {/* Header Identity Card */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400 font-bold">
                  {selectedInquiry.tracking_id}
                </span>
                {renderInquiryStatusBadge(editInquiryStatus)}
              </div>

              <div className="flex items-center justify-between gap-2">
                <h4 className="text-lg font-bold text-white">{selectedInquiry.name}</h4>
                {renderCategoryBadge(selectedInquiry.category)}
              </div>

              {selectedInquiry.institution && (
                <p className="text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <span>{selectedInquiry.institution}</span>
                </p>
              )}

              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-4 text-xs">
                <a
                  href={`mailto:${selectedInquiry.email}`}
                  className="flex items-center gap-1.5 text-zinc-300 hover:text-indigo-400 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{selectedInquiry.email}</span>
                </a>
                {selectedInquiry.phone && (
                  <a
                    href={`tel:${selectedInquiry.phone}`}
                    className="flex items-center gap-1.5 text-zinc-300 hover:text-indigo-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{selectedInquiry.phone}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Full Inquiry Message Box */}
            <div className="space-y-2">
              <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                Full Inquiry Statement & Requirement
              </label>
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-white text-sm leading-relaxed whitespace-pre-wrap">
                {selectedInquiry.message}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
                <span>Received: {new Date(selectedInquiry.created_at).toLocaleString()}</span>
                <span className="text-emerald-400">SLA: &lt; 4 Business Hours Guaranteed</span>
              </div>
            </div>

            {/* Quick Status Setter Pills */}
            {canReview && (
              <div className="space-y-2">
                <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  Inquiry Workflow Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: 'NEW', label: 'New' },
                    { key: 'CONTACTED', label: 'Contacted' },
                    { key: 'IN_PROGRESS', label: 'In Progress' },
                    { key: 'RESOLVED', label: 'Resolved' },
                    { key: 'CLOSED', label: 'Closed' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setEditInquiryStatus(s.key as any)}
                      className={`px-3 py-2 rounded-xl font-medium border text-left transition-all cursor-pointer ${
                        editInquiryStatus === s.key
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 shadow-sm'
                          : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignee & Notes Form */}
            {canReview ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Assigned Corporate / Support Officer
                  </label>
                  <input
                    type="text"
                    value={editInquiryAssignee}
                    onChange={(e) => setEditInquiryAssignee(e.target.value)}
                    placeholder="e.g. Priya Nair (Enterprise Sales) or Arun Kumar (Support Lead)"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Internal Resolution Notes & Follow-up History
                  </label>
                  <textarea
                    value={editInquiryNotes}
                    onChange={(e) => setEditInquiryNotes(e.target.value)}
                    rows={4}
                    placeholder="Document conversation summaries, agreed SLA terms, enterprise proposals dispatched, or next meeting dates..."
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInquiryDrawerOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveInquiry}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Inquiry Updates</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-zinc-400">
                {selectedInquiry.assigned_to && (
                  <div>
                    <span className="text-zinc-500 block">Assigned Officer:</span>
                    <span className="text-zinc-200">{selectedInquiry.assigned_to}</span>
                  </div>
                )}
                {selectedInquiry.notes && (
                  <div>
                    <span className="text-zinc-500 block">Resolution Notes:</span>
                    <p className="text-zinc-200 mt-1">{selectedInquiry.notes}</p>
                  </div>
                )}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setIsInquiryDrawerOpen(false)}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Action Drawer for Balance Request Detail */}
      <Drawer
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        title={selectedRequestDetail ? `Balance Request · ${selectedRequestDetail.request_id}` : 'Request Detail'}
        width="max-w-xl"
      >
        {selectedRequestDetail && (() => {
          const req = selectedRequestDetail;
          const minutes = req.requested_minutes ?? req.requested_min ?? 0;
          const hours = (minutes / 60).toFixed(1);
          const pricing = resolveTowerPricing(req.tower_id, towers);
          const breakdown = calculateCommercialBreakdown(Math.floor(minutes / 60), minutes % 60, pricing.ratePerMin);
          const isDuration = Boolean((req as any).duration_days || (req as any).duration_months || req.notes?.toLowerCase().includes('duration') || req.notes?.toLowerCase().includes('lease'));
          const isPending = (req.status || 'PENDING').toUpperCase() === 'PENDING';

          return (
            <div className="space-y-6 text-sm text-zinc-200">
              {/* Header Card */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-400 font-bold">{req.request_id}</span>
                  {renderStatusBadge(req.status)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Tower Target</span>
                    <span className="font-semibold text-white text-sm">{req.tower_id}</span>
                    <span className="text-zinc-400 block text-[11px]">{pricing.displayName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Requested By</span>
                    <span className="font-semibold text-white">{req.requested_by}</span>
                    <span className="text-zinc-400 block text-[11px]">
                      {req.requested_at ? new Date(req.requested_at).toLocaleString() : req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commercial Financial Summary Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-black border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                      Commercial Financial Summary
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {pricing.model} TARIFF
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-zinc-400">Allocation Type:</span>
                    <span className="font-semibold text-blue-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {isDuration ? 'Duration Contract Extension' : 'Procedural Time Credit'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-zinc-400">Hours / Duration:</span>
                    <span className="font-mono font-bold text-white">
                      {hours} hrs ({minutes} minutes)
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-zinc-400">Per-Minute Tariff:</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      ₹{pricing.ratePerMin.toFixed(2)} / min <span className="text-zinc-400 text-[11px]">(₹{pricing.ratePerHour.toLocaleString('en-IN')} / hr)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-zinc-400">Estimated Subtotal:</span>
                    <span className="font-mono text-zinc-200">
                      ₹{breakdown.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-zinc-400">Standard GST ({breakdown.gstPct}%):</span>
                    <span className="font-mono text-zinc-200">
                      ₹{breakdown.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 text-sm font-bold">
                    <span className="text-emerald-400">Estimated Total Value:</span>
                    <span className="font-mono text-emerald-400 text-base">
                      ₹{breakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reference & Justification */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/10 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-semibold">PO / Reference #:</span>
                  <span className="font-mono text-white px-2 py-0.5 rounded bg-white/5 border border-white/10 font-medium">
                    {req.po_number || 'None provided'}
                  </span>
                </div>
                {req.notes && (
                  <div>
                    <span className="text-zinc-400 block mb-1">Clinical Justification & Notes:</span>
                    <p className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-zinc-300 leading-relaxed">
                      {req.notes}
                    </p>
                  </div>
                )}
                {req.receipt_data_url && (
                  <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                    <span className="text-zinc-400">Supporting Document / Receipt:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptUrl(req.receipt_data_url || null);
                        setReceiptModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Attachment
                    </button>
                  </div>
                )}
                {req.reviewed_by && (
                  <div className="pt-2 border-t border-white/10 text-zinc-400 space-y-1">
                    <div>Reviewed By: <span className="text-white">{req.reviewed_by}</span> on {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '—'}</div>
                    {req.rejection_reason && (
                      <div className="text-rose-400 font-medium">Rejection Reason: {req.rejection_reason}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDetailDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Close
                </button>
                {canReview && isPending && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailDrawerOpen(false);
                        handleOpenReject('topup', req);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600/80 hover:bg-rose-500 text-white transition-all shadow-sm cursor-pointer"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailDrawerOpen(false);
                        handleOpenApprove('topup', req);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Approve Top-Up
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={approvalModalOpen}
        onClose={() => !isSubmitting && setApprovalModalOpen(false)}
        title={selectedForApproval?.type === 'topup' ? 'Confirm Balance Approval' : 'Confirm Plan Upgrade Approval'}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              Are you sure you want to approve this request? Once approved, the configuration will immediately apply to the tower.
            </div>
          </div>

          {selectedForApproval?.type === 'topup' && (() => {
            const req = selectedForApproval.data as BalanceRequest;
            const minutes = req.requested_minutes ?? req.requested_min ?? 0;
            const hours = (minutes / 60).toFixed(1);
            const pricing = resolveTowerPricing(req.tower_id, towers);
            const breakdown = calculateCommercialBreakdown(Math.floor(minutes / 60), minutes % 60, pricing.ratePerMin);
            const isDuration = Boolean((req as any).duration_days || (req as any).duration_months || req.notes?.toLowerCase().includes('duration') || req.notes?.toLowerCase().includes('lease'));

            return (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Tower ID:</span>
                  <div className="text-right">
                    <span className="font-semibold text-white">{req.tower_id}</span>
                    <span className="text-xs text-zinc-400 block font-mono">{pricing.displayName}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Allocation Type:</span>
                  <span className="font-semibold text-blue-400">
                    {isDuration ? 'Duration Contract' : 'Time Credit'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Hours / Duration:</span>
                  <span className="font-semibold text-emerald-400 font-mono">
                    {hours} hrs ({minutes} min)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Per-Minute Tariff:</span>
                  <span className="font-mono text-zinc-200">
                    ₹{pricing.ratePerMin.toFixed(2)} / min <span className="text-xs text-zinc-400">(₹{pricing.ratePerHour.toLocaleString('en-IN')} / hr)</span>
                  </span>
                </div>
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Estimated Subtotal:</span>
                    <span className="font-mono text-zinc-300">₹{breakdown.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Estimated GST ({breakdown.gstPct}%):</span>
                    <span className="font-mono text-zinc-300">₹{breakdown.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-white/5">
                    <span className="text-emerald-400">Total Commercial Value:</span>
                    <span className="font-mono text-emerald-400">₹{breakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                {req.po_number && (
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-zinc-400">PO / Reference #:</span>
                    <span className="font-mono text-white">{req.po_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400">Requested By:</span>
                  <span className="text-white">{req.requested_by}</span>
                </div>
              </div>
            );
          })()}

          {selectedForApproval?.type === 'plan' && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Tower ID:</span>
                <span className="font-semibold text-white">{selectedForApproval.data.tower_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Current Plan:</span>
                <span className="text-zinc-300">{(selectedForApproval.data as PlanChangeRequest).current_plan || 'NONE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">New Plan:</span>
                <span className="font-semibold text-blue-400">{(selectedForApproval.data as PlanChangeRequest).requested_plan}</span>
              </div>
              {(selectedForApproval.data as PlanChangeRequest).requested_duration_days && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Lease Duration:</span>
                  <span className="text-white">{(selectedForApproval.data as PlanChangeRequest).requested_duration_days} days</span>
                </div>
              )}
              {(selectedForApproval.data as PlanChangeRequest).requested_balance_hours && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Initial Balance:</span>
                  <span className="text-white">{(selectedForApproval.data as PlanChangeRequest).requested_balance_hours} hrs</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApprovalModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmApprove}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Confirm Approval
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectionModalOpen}
        onClose={() => !isSubmitting && setRejectionModalOpen(false)}
        title={selectedForRejection?.type === 'topup' ? 'Reject Top-Up Request' : 'Reject Plan Upgrade Request'}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              Please provide a reason for rejecting this request. This will be visible to the requesting administrator.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1.5">
              Rejection Reason (Max 255 chars)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value.slice(0, 255))}
              rows={3}
              maxLength={255}
              placeholder="e.g., PO verification failed, insufficient credit limit, or invalid plan selected..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
            <div className="text-right text-[11px] text-zinc-500 mt-1">
              {rejectionReason.length} / 255
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectionModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* View Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="Payment Receipt / PO Document"
      >
        <div className="space-y-4">
          {receiptUrl ? (
            <div className="flex flex-col items-center">
              {receiptUrl.startsWith('data:image/') || receiptUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                <div className="max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/30 p-2">
                  <img
                    src={receiptUrl}
                    alt="Receipt Attachment"
                    className="max-w-full h-auto rounded-lg mx-auto"
                  />
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-black/40 border border-white/10 text-center space-y-3 w-full">
                  <FileText className="w-12 h-12 text-blue-400 mx-auto" />
                  <p className="text-sm text-zinc-300">Document attachment available</p>
                  <a
                    href={receiptUrl}
                    download="payment-receipt"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/20"
                  >
                    Download / View Document
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-center py-6">No receipt attachment found.</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequestsManagement;
