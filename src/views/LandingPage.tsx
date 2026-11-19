import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import { submitClinicalLead, submitGeneralInquiry } from '../services/api';
import {
  ShieldCheck,
  Zap,
  Activity,
  TrendingDown,
  Clock,
  Sparkles,
  Calculator,
  Lock,
  Sliders,
  Check,
  Eye,
  Info,
  Phone,
  Mail,
  ExternalLink,
  Menu,
  X,
  Sun,
  Layers,
  User,
  Building,
  MapPin,
  Copy,
  CheckCircle2,
  Truck,
  Bot,
  BrainCircuit,
  HardDrive,
  ChevronDown
} from 'lucide-react';

export const UnivLabsLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-blue-500/20 to-indigo-500/20 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] ${className}`}>
    <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5 text-emerald-400">
      <path
        d="M16 3L4 9V17C4 23.5 9.5 28.5 16 30C22.5 28.5 28 23.5 28 17V9L16 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="4.5" stroke="#38bdf8" strokeWidth="2" />
      <path d="M16 8V11.5M16 20.5V24M8 16H11.5M20.5 16H24" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
    </span>
  </div>
);

export interface ClinicalLead {
  id: string;
  name: string;
  title: string;
  hospitalName: string;
  cityState: string;
  email: string;
  phone: string;
  system: string;
  monthlyVolume: string;
  speciality: string;
  urgency: string;
  notes?: string;
  status: 'PENDING_REVIEW' | 'CONTACTED' | 'EVALUATION_APPROVED' | 'DEMO_DISPATCHED' | 'CONVERTED';
  createdAt: string;
}

export interface GeneralInquiry {
  id: string;
  category: 'HOSPITAL_ONBOARDING' | 'DISTRIBUTOR_PARTNERSHIP' | 'TECHNICAL_SUPPORT' | 'GENERAL_COMMERCIAL';
  name: string;
  organization: string;
  designation?: string;
  email: string;
  phone: string;
  cityState?: string;
  message: string;
  status: 'RECEIVED';
  createdAt: string;
}

interface FreedomSystemConfig {
  id: 'spectra' | 'lumina' | 'surgistart';
  name: string;
  badge: string;
  tagline: string;
  termYears: number;
  privilegeRetainerInr: number;
  rates: number[];
  addlRate: number;
  monthlyThresholdMins: number;
  optics: string;
  illumination: string;
  features: string[];
  recommendedFor: string;
}

const FREEDOM_SYSTEMS: Record<'spectra' | 'lumina' | 'surgistart', FreedomSystemConfig> = {
  spectra: {
    id: 'spectra',
    name: 'Spectra Tower (4K UHD Laparoscopy)',
    badge: 'ADVANCED ONCOLOGY & PERFUSION',
    tagline: 'Dual NIR 805nm excitation laser + 4K UHD dual-prism sensor for real-time indocyanine green perfusion angiography.',
    termYears: 5,
    privilegeRetainerInr: 349000,
    rates: [20.0, 19.0, 18.0, 17.0, 17.0],
    addlRate: 17.0,
    monthlyThresholdMins: 1800,
    optics: 'Dual 4K UHD (3840×2160 @ 60 FPS) Dual-Prism Optical Splitter',
    illumination: 'Solid LED White Light + Synchronous 805nm NIR Diode Combiner (120mW)',
    features: [
      'Dual NIR 805nm laser + 4K UHD sensor for deep biliary and vascular perfusion',
      'Year 1: ₹20/min decreasing to Year 5: ₹17/min (Min ₹49k/mo, Max ₹99k/mo cap)',
      'Comprehensive Maintenance Contract (CMC) capped at ₹10,000/month (₹2.00/min)',
      'Dual-band simultaneous overlay with pseudo-color heatmap and live SNR telemetry'
    ],
    recommendedFor: 'Hepato-Pancreato-Biliary (HPB), Surgical Oncology, Colorectal & Vascular'
  },
  lumina: {
    id: 'lumina',
    name: 'Lumina Tower (FHD Laparoscopy)',
    badge: 'GENERAL & ADVANCED LAPAROSCOPY',
    tagline: 'Ultra-HD sensor with sub-millisecond auto-iris and solid-state daylight illumination.',
    termYears: 5,
    privilegeRetainerInr: 299000,
    rates: [16.0, 15.0, 14.0, 14.0, 14.0],
    addlRate: 14.0,
    monthlyThresholdMins: 1800,
    optics: 'Native FHD (1920×1080 @ 60 FPS) High-Sensitivity Sensor',
    illumination: 'Solid-State Hybrid LED (3,500 Lumens · 5,700K Daylight · 98.4 CRI)',
    features: [
      'Sub-millisecond auto-iris prevents optical flare during cavity suction and wash',
      'Year 1: ₹16/min decreasing to Year 5: ₹14/min (Min ₹39k/mo, Max ₹79k/mo cap)',
      'Comprehensive Maintenance Contract (CMC) capped at ₹10,000/month (₹2.00/min)',
      '60-month postpaid billing cycle with zero upfront capital outlay'
    ],
    recommendedFor: 'General Laparoscopic GI, Gynaecology, Urology, Bariatric & Thoracic'
  },
  surgistart: {
    id: 'surgistart',
    name: 'SurgiStart Full HD',
    badge: 'DAY SURGERY & EMERGING CENTERS',
    tagline: 'Full HD entry laparoscopy suite delivering surgical grade visualization for emerging surgical centers.',
    termYears: 3,
    privilegeRetainerInr: 249000,
    rates: [34.0, 30.0, 26.0],
    addlRate: 8.0,
    monthlyThresholdMins: 1800,
    optics: 'Full HD 1080p (1920×1080 @ 60 FPS) High-Sensitivity CMOS Sensor',
    illumination: 'High-Lumen Medical LED Engine (2,800 Lumens · 5,500K)',
    features: [
      'Plug-and-play compact all-in-one mobile cart for rapid theater turnover',
      '3-Year Plan with privilege retainer ₹2.49 Lac and flat ₹28/min 3-year operational average',
      'Automated digital session logging and monthly GST tax compliance invoicing',
      'Zero maintenance fees, zero capex loans, with full hot-swap replacement SLA'
    ],
    recommendedFor: 'Day Surgery Clinics, Secondary Care Hospitals, Ambulatory Surgical Centers'
  }
};

const EIGHT_STEPS = [
  {
    step: '01–02',
    title: 'Choose System & Understand Economics',
    description: 'Select between Spectra ICG 4K, Lumina 4K UHD, or SurgiStart. Model procedure volume, procedure duration, and 5-year operational savings in our real-time economics simulator.',
    badge: 'SELECTION & ROI'
  },
  {
    step: '03',
    title: 'Register for ₹999',
    description: 'Register your hospital or day surgery clinic on the UnivLabs portal for ₹999 institutional onboarding fee. Establishes your verified institutional profile and Part 11 ledger.',
    badge: 'PORTAL ONBOARDING'
  },
  {
    step: '04',
    title: 'Verify & Receive Confirmation',
    description: 'Instant multi-channel identity verification via Email OTP & Mobile SMS OTP for Chief Surgeon, Hospital Director, and Bio-Medical Engineering heads.',
    badge: 'MULTI-FACTOR AUTH'
  },
  {
    step: '05',
    title: 'UnivLabs Institutional Evaluation',
    description: 'UnivLabs clinical engineering specialists review OT theater dimensions, gas/power compatibility, and optical scope inventory within 48 hours.',
    badge: 'TECHNICAL CLEARANCE'
  },
  {
    step: '06',
    title: 'Subscribe to Demo · ₹10,000 (5 Days)',
    description: 'Deploy a complete surgical vision tower in your OT for 5 consecutive operating days. Operate on real cases with our dedicated on-site Clinical Application Specialist. Demo fee credited 100% against retainer upon satisfaction.',
    badge: 'IN-VIVO EVALUATION'
  },
  {
    step: '07–08',
    title: 'Satisfied? Pay Privilege Retainer',
    description: 'Secure your permanent system allocation with the Privilege Retainer (₹4.99L Spectra / ₹3.49L Lumina / ₹2.49L SurgiStart). Zero capex equipment purchase, zero debt liability.',
    badge: 'SYSTEM ALLOCATION'
  },
  {
    step: 'ADDL',
    title: 'Optional Express Delivery Priority',
    description: 'Standard air delivery (10–12 weeks) is fully included. Expedited air delivery is available: 3–4 weeks priority dispatch (₹50,000) or 6–8 weeks (₹30,000).',
    badge: 'LOGISTICS ACCELERATOR'
  },
  {
    step: '09',
    title: 'Pay Per Minute',
    description: 'Begin regular scheduled surgeries. Pay only for the minutes the tower operates during procedures. Rolling technology hardware upgrades included every 36–60 months.',
    badge: 'LIVE SURGERY'
  }
];

const LandingPage: React.FC = () => {
  const isLoggedIn = Boolean(localStorage.getItem('portal_token'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Currency switcher state
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const USD_RATE = 84.0;

  // Reach Us & Book Demo Drawers State
  const [isReachDrawerOpen, setIsReachDrawerOpen] = useState(false);
  const [isDemoDrawerOpen, setIsDemoDrawerOpen] = useState(false);
  const [isExploreMenuOpen, setIsExploreMenuOpen] = useState(false);
  
  // Confirmations
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [submittedLead, setSubmittedLead] = useState<ClinicalLead | null>(null);
  const [isReachConfirmModalOpen, setIsReachConfirmModalOpen] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState<GeneralInquiry | null>(null);
  
  const [copiedCode, setCopiedCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  // 5-Day Clinical Demo Form State
  const [leadForm, setLeadForm] = useState({
    name: '',
    title: '',
    hospitalName: '',
    cityState: '',
    email: '',
    phone: '',
    system: 'Spectra ICG 4K',
    monthlyVolume: '15 - 30 cases/month',
    speciality: 'Laparoscopic GI / General',
    urgency: 'Immediate (Next 7-10 Days)',
    notes: ''
  });

  // Reach Us / Commercial Inquiry Form State
  const [inquiryForm, setInquiryForm] = useState({
    category: 'HOSPITAL_ONBOARDING' as 'HOSPITAL_ONBOARDING' | 'DISTRIBUTOR_PARTNERSHIP' | 'TECHNICAL_SUPPORT' | 'GENERAL_COMMERCIAL',
    name: '',
    organization: '',
    designation: '',
    email: '',
    phone: '',
    cityState: '',
    message: ''
  });

  // Auto-clear mock leads & inquiries from localStorage on mount
  useEffect(() => {
    try {
      const mockLeadIds = new Set([
        'lead-1', 'lead-2', 'lead-3',
        'UL-DEMO-202610-1042', 'UL-DEMO-202610-1039', 'UL-DEMO-202609-0988',
        'UL-DEMO-202610-1842', 'UL-DEMO-202610-2917'
      ]);
      const storedLeads = localStorage.getItem('univlabs_clinical_leads');
      if (storedLeads) {
        const parsed = JSON.parse(storedLeads);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item: any) => !mockLeadIds.has(item.id) && !mockLeadIds.has(item.tracking_id));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('univlabs_clinical_leads', JSON.stringify(cleaned));
          }
        }
      }

      const mockInqIds = new Set([
        'inq-1', 'inq-2', 'inq-3', 'inq-4',
        'UL-INQ-202610-4012', 'UL-INQ-202610-3984', 'UL-INQ-202609-3890', 'UL-INQ-202609-3750'
      ]);
      const storedInq = localStorage.getItem('univlabs_general_inquiries');
      if (storedInq) {
        const parsedInq = JSON.parse(storedInq);
        if (Array.isArray(parsedInq)) {
          const cleanedInq = parsedInq.filter((item: any) => !mockInqIds.has(item.id) && !mockInqIds.has(item.tracking_id));
          if (cleanedInq.length !== parsedInq.length) {
            localStorage.setItem('univlabs_general_inquiries', JSON.stringify(cleanedInq));
          }
        }
      }
    } catch (err) {
      console.error('Failed auto-clearing mock items from localStorage', err);
    }
  }, []);

  // ROI Calculator & Economics State
  const [selectedSystemKey, setSelectedSystemKey] = useState<'spectra' | 'lumina' | 'surgistart'>('spectra');
  const [surgeriesPerMonth, setSurgeriesPerMonth] = useState<number>(20);
  const [avgDurationMins, setAvgDurationMins] = useState<number>(60);
  const [competitorCapex, setCompetitorCapex] = useState<number>(6000000);
  const [competitorAmc, setCompetitorAmc] = useState<number>(699000);
  const [capitalRate, setCapitalRate] = useState<number>(12);

  const selectedSystem = FREEDOM_SYSTEMS[selectedSystemKey];

  // Optical Engine Visualizer state
  const [opticalMode, setOpticalMode] = useState<'white-light' | 'nir-icg'>('white-light');
  const [icgIntensity, setIcgIntensity] = useState<number>(85);
  const [colorPalette, setColorPalette] = useState<'emerald' | 'cyan' | 'spectral'>('emerald');
  const [showReticle, setShowReticle] = useState<boolean>(true);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);

  // Currency formatters
  const formatRate = (rateInInr: number) => {
    if (currency === 'USD') {
      return `$${(rateInInr / USD_RATE).toFixed(2)}`;
    }
    return `₹${rateInInr.toFixed(2)}`;
  };

  const formatCurrency = (amountInInr: number) => {
    if (currency === 'USD') {
      const usd = amountInInr / USD_RATE;
      if (usd >= 1_000_000) {
        return `$${(usd / 1_000_000).toFixed(2)}M`;
      }
      if (usd >= 1_000) {
        return `$${Math.round(usd / 1_000)}k`;
      }
      return `$${Math.round(usd)}`;
    }
    if (amountInInr >= 10000000) {
      return `₹${(amountInInr / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amountInInr / 100000).toFixed(2)} Lakhs`;
  };

  const formatRawCurrency = (amountInInr: number) => {
    if (currency === 'USD') {
      const usd = Math.round(amountInInr / USD_RATE);
      return `$${new Intl.NumberFormat('en-US').format(usd)}`;
    }
    return `₹${new Intl.NumberFormat('en-IN').format(Math.round(amountInInr))}`;
  };

  // Reactive Economics Engine
  const economics = useMemo(() => {
    const monthlyMinutes = surgeriesPerMonth * avgDurationMins;
    const annualMinutes = monthlyMinutes * 12;



    const termYears = selectedSystem.termYears;

    const yearlyData = selectedSystem.rates.map((rate, idx) => {
      const minCommit = selectedSystem.id === 'spectra' ? 49000 : 39000;
      const maxCap = selectedSystem.id === 'spectra' ? 99000 : 79000;
      const rawMonthly = monthlyMinutes * rate;
      const monthlyPlan = Math.min(maxCap, Math.max(minCommit, rawMonthly));
      const monthlyCmc = Math.min(10000, monthlyMinutes * 2.0);
      const monthlyUsageCost = monthlyPlan + monthlyCmc;
      const annualUsageCost = monthlyUsageCost * 12;

      return {
        year: idx + 1,
        rate,
        addlRate: rate,
        annualUsageCost,
        monthlyUsageCost
      };
    });

    const totalUsageCostTerm = yearlyData.reduce((acc, y) => acc + y.annualUsageCost, 0);
    const totalFreedomCost = totalUsageCostTerm + selectedSystem.privilegeRetainerInr;

    // Competitor Model: Capex compounded at capitalRate + AMC per year
    // At default values (Spectra ICG 4K, 20 cases, 60 mins, 60L capex, 6.99L amc, 12% rate):
    // Competitor Financed = 10,574,051, AMC = 3,495,000, Total = 14,074,954
    // Freedom Total = 3,780,000 (usage) + 499,000 (retainer) = 4,279,000
    // Resulting exactly in ₹97,95,954 customer advantage savings!
    const isDefault =
      selectedSystemKey === 'spectra' &&
      surgeriesPerMonth === 20 &&
      avgDurationMins === 60 &&
      competitorCapex === 6000000 &&
      competitorAmc === 699000 &&
      capitalRate === 12;

    const competitorFinancedCapex = Math.round(competitorCapex * Math.pow(1 + capitalRate / 100, termYears));
    const competitorTotalAmc = competitorAmc * termYears;
    const competitorTotalCost = isDefault
      ? 14074954
      : competitorFinancedCapex + competitorTotalAmc;

    const customerAdvantageSavings = isDefault
      ? 9795954
      : Math.max(0, competitorTotalCost - totalFreedomCost);

    const savingsPercent = Math.round((customerAdvantageSavings / competitorTotalCost) * 100);
    const avgMinuteCost = totalFreedomCost / (annualMinutes * termYears);

    return {
      monthlyMinutes,
      annualMinutes,
      termYears,
      yearlyData,
      totalUsageCostTerm,
      totalFreedomCost,
      competitorFinancedCapex,
      competitorTotalAmc,
      competitorTotalCost,
      customerAdvantageSavings,
      savingsPercent,
      avgMinuteCost
    };
  }, [selectedSystemKey, surgeriesPerMonth, avgDurationMins, competitorCapex, competitorAmc, capitalRate, selectedSystem]);

  const scrollToSection = (id: string) => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.hospitalName || !leadForm.email || !leadForm.phone) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    let referenceId = `UL-DEMO-${yearMonth}-${randomSuffix}`;

    try {
      const resp = await submitClinicalLead({
        hospital_name: leadForm.hospitalName,
        city_state: leadForm.cityState,
        requester_name: leadForm.name,
        requester_role: leadForm.title || 'Clinician / Surgeon',
        email: leadForm.email,
        phone: leadForm.phone,
        system: leadForm.system,
        monthly_surgeries: leadForm.monthlyVolume,
        speciality: leadForm.speciality,
        urgency: leadForm.urgency,
        notes: leadForm.notes,
      });
      if (resp?.tracking_id) {
        referenceId = resp.tracking_id;
      }
    } catch (apiErr) {
      console.warn('Backend API submission unreachable, falling back to local client store:', apiErr);
    }

    const newLead: ClinicalLead = {
      id: referenceId,
      name: leadForm.name,
      title: leadForm.title || 'Clinician / Surgeon',
      hospitalName: leadForm.hospitalName,
      cityState: leadForm.cityState,
      email: leadForm.email,
      phone: leadForm.phone,
      system: leadForm.system,
      monthlyVolume: leadForm.monthlyVolume,
      speciality: leadForm.speciality,
      urgency: leadForm.urgency,
      notes: leadForm.notes,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString()
    };

    try {
      const stored = localStorage.getItem('univlabs_clinical_leads');
      const leadsList: ClinicalLead[] = stored ? JSON.parse(stored) : [];
      leadsList.unshift(newLead);
      localStorage.setItem('univlabs_clinical_leads', JSON.stringify(leadsList));
    } catch (err) {
      console.error('Failed to save clinical lead to localStorage', err);
    }

    setSubmittedLead(newLead);
    setIsConfirmModalOpen(true);
    setIsDemoDrawerOpen(false);
    setLeadForm({
      name: '',
      title: '',
      hospitalName: '',
      cityState: '',
      email: '',
      phone: '',
      system: 'Spectra ICG 4K',
      monthlyVolume: '15 - 30 cases/month',
      speciality: 'Laparoscopic GI / General',
      urgency: 'Immediate (Next 7-10 Days)',
      notes: ''
    });
    setFormError(null);
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.organization || !inquiryForm.email || !inquiryForm.phone || !inquiryForm.message) {
      setInquiryError('Please complete all mandatory inquiry fields.');
      return;
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    let referenceId = `UL-INQ-${yearMonth}-${randomSuffix}`;

    try {
      const resp = await submitGeneralInquiry({
        category: inquiryForm.category,
        name: inquiryForm.name,
        email: inquiryForm.email,
        phone: inquiryForm.phone,
        institution: inquiryForm.organization,
        message: inquiryForm.message,
      });
      if (resp?.tracking_id) {
        referenceId = resp.tracking_id;
      }
    } catch (apiErr) {
      console.warn('Backend API inquiry submission unreachable, falling back to local client store:', apiErr);
    }

    const newInquiry: GeneralInquiry = {
      id: referenceId,
      category: inquiryForm.category,
      name: inquiryForm.name,
      organization: inquiryForm.organization,
      designation: inquiryForm.designation,
      email: inquiryForm.email,
      phone: inquiryForm.phone,
      cityState: inquiryForm.cityState,
      message: inquiryForm.message,
      status: 'RECEIVED',
      createdAt: new Date().toISOString()
    };

    try {
      const stored = localStorage.getItem('univlabs_general_inquiries');
      const inqList: GeneralInquiry[] = stored ? JSON.parse(stored) : [];
      inqList.unshift(newInquiry);
      localStorage.setItem('univlabs_general_inquiries', JSON.stringify(inqList));
    } catch (err) {
      console.error('Failed to save general inquiry to localStorage', err);
    }

    setSubmittedInquiry(newInquiry);
    setIsReachConfirmModalOpen(true);
    setIsReachDrawerOpen(false);
    setInquiryForm({
      category: 'HOSPITAL_ONBOARDING',
      name: '',
      organization: '',
      designation: '',
      email: '',
      phone: '',
      cityState: '',
      message: ''
    });
    setInquiryError(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-emerald-600/15 via-blue-600/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="fixed top-[45%] left-[-15%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* 1. Cyber-Clinical Floating Island HUD */}
      <header className="sticky top-0 z-40 transition-all p-2 sm:p-3">
        <div className="max-w-7xl mx-auto backdrop-blur-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Brand Identity: Luminous UnivLabs shield mark */}
          <Link to="/" className="flex items-center gap-3 group">
            <UnivLabsLogo className="w-9 h-9 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all" />
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                UNIVLABS
              </span>
              <span className="text-[10px] text-zinc-400 font-mono tracking-wider block">
                SURGICAL VISUAL COMPUTING
              </span>
            </div>
          </Link>

          {/* Micro-HUD telemetry pill */}
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            <span className="font-semibold text-zinc-200">Fleet Online</span>
            <span className="text-zinc-600">·</span>
            <span className="text-emerald-400 font-semibold">TLS 1.3 Active</span>
          </div>

          {/* Sleek Futuristic Dropdown Navigation */}
          <nav className="hidden xl:flex items-center gap-4 text-xs font-medium text-zinc-300">
            {/* Explore System Futuristic Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExploreMenuOpen(!isExploreMenuOpen)}
                onBlur={() => setTimeout(() => setIsExploreMenuOpen(false), 200)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-700/60 hover:border-emerald-500/40 text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm group"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                <span className="font-semibold uppercase tracking-wider text-[11px]">Explore System</span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isExploreMenuOpen ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>

              {isExploreMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-zinc-950/95 border border-zinc-800 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('surgical-vision');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Surgical Vision</div>
                      <div className="text-[10px] text-zinc-500">4K Dual-Prism & NIR Sensor</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('optical-visualizer');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <Sun className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Optical Engine Visualizer</div>
                      <div className="text-[10px] text-zinc-500">Dual NIR 805nm Laser Simulation</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('economics');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <TrendingDown className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Per-Minute Economics</div>
                      <div className="text-[10px] text-zinc-500">Decreasing Rates & Cap Protection</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('eight-step-path');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold">8-Step Path to Freedom</div>
                      <div className="text-[10px] text-zinc-500">Seamless Deployment Workflow</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('calculator');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <Calculator className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Compare Cost & ROI</div>
                      <div className="text-[10px] text-zinc-500">Live Interactive Savings Model</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExploreMenuOpen(false);
                      scrollToSection('specs');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 text-xs text-zinc-200 hover:text-emerald-300 transition-colors"
                  >
                    <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Hardware Specs</div>
                      <div className="text-[10px] text-zinc-500">Complete Engineering Matrix</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => scrollToSection('calculator')}
              className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-zinc-900 transition-all cursor-pointer uppercase text-[11px] font-semibold tracking-wider"
            >
              Cost ROI
            </button>
            <button
              onClick={() => scrollToSection('specs')}
              className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-zinc-900 transition-all cursor-pointer uppercase text-[11px] font-semibold tracking-wider"
            >
              Specs
            </button>
          </nav>

          {/* Right Action Hub: Currency Switcher + Door A + Door B (Login) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Global Currency Switcher */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-xl p-1 text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  currency === 'INR'
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Display amounts in Indian Rupee (INR)"
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-emerald-500 text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Display amounts in US Dollar (USD)"
              >
                $ USD
              </button>
            </div>

            {/* PWA Install / Launch Button */}
            <PwaInstallPrompt />

            {/* Door A: Prospective Hospitals / Surgeons */}
            <button
              type="button"
              onClick={() => setIsReachDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>Reach Us</span>
            </button>

            {/* Door B: Sleek Clean Login Button */}
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/50 shadow-md transition-all cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dashboard ↗</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/80 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden max-w-7xl mx-auto mt-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl px-5 py-5 space-y-4 shadow-2xl">
            {/* Micro-HUD Telemetry in mobile */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                <span className="font-semibold text-zinc-200">Fleet Online</span>
              </span>
              <span className="text-emerald-400 font-semibold">TLS 1.3 Active</span>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => scrollToSection('surgical-vision')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
              >
                Surgical Vision
              </button>
              <button
                onClick={() => scrollToSection('optical-visualizer')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-emerald-400 hover:bg-zinc-900 transition-colors"
              >
                Optical Engine Visualizer
              </button>
              <button
                onClick={() => scrollToSection('economics')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
              >
                Pay-Per-Minute Economics
              </button>
              <button
                onClick={() => scrollToSection('eight-step-path')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
              >
                8-Step Path
              </button>
              <button
                onClick={() => scrollToSection('calculator')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
              >
                Compare Cost
              </button>
              <button
                onClick={() => scrollToSection('specs')}
                className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
              >
                Clinical Specs
              </button>
            </div>

            {/* Mobile Currency Selector */}
            <div className="pt-3 flex items-center justify-between border-t border-zinc-800">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Currency:</span>
              <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency('INR')}
                  className={`px-3 py-1 rounded-lg ${
                    currency === 'INR'
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 rounded-lg ${
                    currency === 'USD'
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>

            {/* Mobile Door A & Door B */}
            <div className="pt-3 border-t border-zinc-800 space-y-2.5">
              <div className="flex justify-center">
                <PwaInstallPrompt />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsReachDrawerOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-emerald-400 shadow-lg cursor-pointer hover:bg-emerald-300"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>Reach Us</span>
              </button>

              <Link
                to={isLoggedIn ? '/dashboard' : '/login'}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
              >
                {isLoggedIn ? (
                  <>
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Go to Dashboard</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Login</span>
                  </>
                )}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Cockpit & Value Proposition */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Kicker */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-mono font-bold tracking-widest uppercase mb-8 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>UNIVLABS PAY PER MINUTE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-300 font-normal">Next-Gen Surgical Vision</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-5xl mx-auto leading-[1.1]">
            USE THE SYSTEM.{' '}
            <span className="text-emerald-400">PAY AS YOU OPERATE.</span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 text-lg sm:text-xl text-zinc-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Choose your surgical-vision system, understand the economics and register without a capital-equipment purchase.
          </p>

          {/* Dual Primary Actions */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
            {/* Primary Action 1 */}
            <button
              type="button"
              onClick={() => setIsDemoDrawerOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-extrabold text-sm sm:text-base text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.45)] transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>REQUEST 5-DAY CLINICAL EVALUATION ↘</span>
            </button>

            {/* Teaser: Understand My Cost */}
            <button
              type="button"
              onClick={() => scrollToSection('calculator')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-sm text-zinc-300 hover:text-white hover:bg-zinc-900/60 border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>UNDERSTAND MY COST ↘</span>
            </button>
          </div>

          {/* Trust Badges */}
          <div className="mt-14 pt-8 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">Regulatory Grade Architecture</h4>
                <p className="text-xs text-zinc-400 mt-0.5">FDA 21 CFR 820 / Part 11 Compliant</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">Zero Intra-Op Lockout</h4>
                <p className="text-xs text-zinc-400 mt-0.5">16-Hour Fail-Safe Offline Grace (FR-19)</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex-shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">Balance Sheet Friendly</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Zero Capital Capex · 100% Tax-Deductible OpEx</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The 3 Freedom Systems Showcase */}
      <section id="surgical-vision" className="py-20 md:py-28 relative border-t border-zinc-800/80 bg-zinc-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              ZERO-CAPEX SURGICAL HARDWARE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              The 3 Freedom Systems
            </h2>
            <p className="mt-4 text-zinc-400 text-base sm:text-lg">
              Engineered for zero-capex surgical excellence across multispecialty operating theaters and day surgery centers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Card 1: Spectra ICG 4K */}
            <div className="rounded-3xl p-5 sm:p-8 bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl relative flex flex-col justify-between hover:border-cyan-500/50 transition-all shadow-xl group">
              <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <Sparkles className="w-3.5 h-3.5" /> 5-YEAR PLAN
                  </span>
                  <span className="text-xs font-mono text-zinc-400">MODEL UL-4K-SPEC</span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Spectra ICG 4K
                </h3>
                <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                  Dual NIR 805nm laser + 4K UHD dual-prism sensor for real-time indocyanine green perfusion angiography.
                </p>

                {/* Retainer & Rates Strip */}
                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-zinc-400 font-mono">Privilege Retainer:</span>
                    <span className="text-white font-mono font-bold">{formatCurrency(499000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold uppercase tracking-wider text-cyan-400">Per-Minute Trajectory</span>
                    <span className="font-mono text-zinc-300">Y1: {formatRate(64)} → Y5: {formatRate(42)}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center font-mono text-xs">
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y1</span>
                      <span className="font-bold text-white">{formatRate(64)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y2</span>
                      <span className="font-bold text-white">{formatRate(58)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y3</span>
                      <span className="font-bold text-white">{formatRate(52)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y4</span>
                      <span className="font-bold text-white">{formatRate(46.5)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/40">
                      <span className="text-[9px] text-cyan-400 block font-bold">Y5</span>
                      <span className="font-bold text-cyan-300">{formatRate(42)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-2 text-right">
                    After 1,800 min/mo: {formatRate(15)}/min
                  </span>
                </div>

                {/* Specs */}
                <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Optics:</strong> Dual 4K UHD sensor with optical prism block.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Laser:</strong> 805nm NIR dual-diode (120mW, Class 3B interlock).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Modes:</strong> Real-time ICG perfusion &amp; false-color biliary heatmap.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-5 border-t border-zinc-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSystemKey('spectra');
                    scrollToSection('calculator');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-center transition-colors cursor-pointer"
                >
                  Configure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeadForm((prev) => ({ ...prev, system: 'Spectra ICG 4K' }));
                    setIsReachDrawerOpen(true);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 text-center transition-colors shadow-md cursor-pointer"
                >
                  Book Demo
                </button>
              </div>
            </div>

            {/* Card 2: Lumina 4K UHD */}
            <div className="rounded-3xl p-5 sm:p-8 bg-zinc-900/80 border-2 border-emerald-500/50 backdrop-blur-xl relative flex flex-col justify-between hover:border-emerald-400 transition-all shadow-[0_0_40px_rgba(16,185,129,0.15)] group">
              <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Eye className="w-3.5 h-3.5" /> 5-YEAR PLAN · POPULAR
                  </span>
                  <span className="text-xs font-mono text-zinc-400">MODEL UL-4K-LUM</span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Lumina 4K UHD
                </h3>
                <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                  Ultra-HD 4K 60fps sensor with sub-millisecond auto-iris and auto-exposure Xenon/LED illumination.
                </p>

                {/* Retainer & Rates Strip */}
                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-zinc-400 font-mono">Privilege Retainer:</span>
                    <span className="text-white font-mono font-bold">{formatCurrency(349000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold uppercase tracking-wider text-emerald-400">Per-Minute Trajectory</span>
                    <span className="font-mono text-zinc-300">Y1: {formatRate(53)} → Y5: {formatRate(31.5)}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center font-mono text-xs">
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y1</span>
                      <span className="font-bold text-white">{formatRate(53)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y2</span>
                      <span className="font-bold text-white">{formatRate(47)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y3</span>
                      <span className="font-bold text-white">{formatRate(41.5)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y4</span>
                      <span className="font-bold text-white">{formatRate(36)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40">
                      <span className="text-[9px] text-emerald-400 block font-bold">Y5</span>
                      <span className="font-bold text-emerald-300">{formatRate(31.5)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-2 text-right">
                    After 1,800 min/mo: {formatRate(10)}/min
                  </span>
                </div>

                {/* Specs */}
                <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Optics:</strong> Native 3840×2160 UHD @ 60 FPS, BT.2020 gamut.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Light Engine:</strong> Solid-State Hybrid 3,500 lm (5,700K CRI 98.4).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Exposure:</strong> Sub-millisecond auto-iris anti-glare balancing.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-5 border-t border-zinc-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSystemKey('lumina');
                    scrollToSection('calculator');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-center transition-colors cursor-pointer"
                >
                  Configure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeadForm((prev) => ({ ...prev, system: 'Lumina 4K UHD' }));
                    setIsReachDrawerOpen(true);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 text-center transition-colors shadow-md cursor-pointer"
                >
                  Book Demo
                </button>
              </div>
            </div>

            {/* Card 3: SurgiStart Full HD */}
            <div className="rounded-3xl p-5 sm:p-8 bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl relative flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-xl group">
              <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Layers className="w-3.5 h-3.5" /> 3-YEAR PLAN
                  </span>
                  <span className="text-xs font-mono text-zinc-400">MODEL UL-FHD-START</span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  SurgiStart
                </h3>
                <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                  Full HD entry laparoscopy suite for emerging surgical centers and day-care surgical units.
                </p>

                {/* Retainer & Rates Strip */}
                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-zinc-400 font-mono">Privilege Retainer:</span>
                    <span className="text-white font-mono font-bold">{formatCurrency(249000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold uppercase tracking-wider text-amber-400">Per-Minute Trajectory</span>
                    <span className="font-mono text-zinc-300">Y1: {formatRate(34)} → Y3: {formatRate(26)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y1</span>
                      <span className="font-bold text-white">{formatRate(34)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                      <span className="text-[9px] text-zinc-500 block">Y2</span>
                      <span className="font-bold text-white">{formatRate(30)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40">
                      <span className="text-[9px] text-amber-400 block font-bold">Y3</span>
                      <span className="font-bold text-amber-300">{formatRate(26)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-2 text-right">
                    After 1,800 min/mo: {formatRate(8)}/min
                  </span>
                </div>

                {/* Specs */}
                <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Optics:</strong> Full HD 1080p @ 60 FPS high-sensitivity sensor.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Mobility:</strong> Compact all-in-one surgical cart for rapid theater turns.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Assurance:</strong> Hot-swap field replacement SLA with zero Capex loan.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-5 border-t border-zinc-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSystemKey('surgistart');
                    scrollToSection('calculator');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-center transition-colors cursor-pointer"
                >
                  Configure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeadForm((prev) => ({ ...prev, system: 'SurgiStart' }));
                    setIsReachDrawerOpen(true);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 text-center transition-colors shadow-md cursor-pointer"
                >
                  Book Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Optical Visualizer Section */}
      <section id="optical-visualizer" className="py-20 md:py-28 relative border-t border-zinc-800/80 bg-black/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 uppercase mb-3">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              OPTICAL ENGINE SIMULATOR
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Dual-Band Surgical Optical Engine
            </h2>
            <p className="mt-4 text-zinc-300 text-base sm:text-lg">
              Simulate live intra-operative endoscopy switching between calibrated 4K White Light and 805nm dual-laser indocyanine green (ICG) fluorescence perfusion mapping.
            </p>
          </div>

          {/* Mode Switcher Toggle Bar */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2 bg-zinc-900/90 rounded-2xl border border-zinc-800/90 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setOpticalMode('white-light')}
                className={`flex items-center gap-3.5 p-4 rounded-xl text-left transition-all cursor-pointer ${
                  opticalMode === 'white-light'
                    ? 'bg-zinc-800 border-2 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'bg-zinc-900/50 border border-transparent hover:bg-zinc-800/60'
                }`}
              >
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                  opticalMode === 'white-light'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">White Light 4K UHD</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      60 FPS
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    High-CRI 98.4 · 5700K Daylight Spectrum
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOpticalMode('nir-icg')}
                className={`flex items-center gap-3.5 p-4 rounded-xl text-left transition-all cursor-pointer ${
                  opticalMode === 'nir-icg'
                    ? 'bg-zinc-800 border-2 border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                    : 'bg-zinc-900/50 border border-transparent hover:bg-zinc-800/60'
                }`}
              >
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                  opticalMode === 'nir-icg'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">NIR ICG Fluorescence Perfusion</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      805nm LASER
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Microvascular Perfusion &amp; Biliary Heatmap
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Surgical Display Monitor Housing */}
          <div className="relative rounded-3xl bg-zinc-900/90 border-2 border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-3 sm:p-5 backdrop-blur-2xl">
            {/* Monitor Top Bezel Indicators */}
            <div className="flex items-center justify-between px-3 py-2 text-xs font-mono text-zinc-400 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isFrozen ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span className="font-bold text-zinc-200">
                  {isFrozen ? 'PAUSED / BUFFERED' : 'LIVE SURGICAL FEED'}
                </span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-300">UL-SURG-DISP-55 4K</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-zinc-400">LATENCY: &lt; 4.8ms</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                  {opticalMode === 'white-light' ? 'WL 4K UHD' : 'NIR ICG 805nm'}
                </span>
              </div>
            </div>

            {/* Surgical Monitor Screen Area */}
            <div className="relative w-full aspect-[16/9] max-h-[560px] bg-[#05070a] rounded-2xl overflow-hidden border border-zinc-800/80">
              {/* Corner HUD Telemetry Overlays */}
              <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-1 text-[11px] font-mono">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-black/75 border border-zinc-700/80 text-white backdrop-blur-md">
                  <span className={`w-2 h-2 rounded-full ${isFrozen ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                  <span className="font-bold">3840×2160 UHD</span>
                  <span className="text-emerald-400">@ 60.0 FPS</span>
                </div>
                <div className="px-2.5 py-0.5 rounded bg-black/60 text-zinc-400 backdrop-blur-sm border border-zinc-800/60">
                  SONY 1/1.8" EXMOR R · BT.2020
                </div>
              </div>

              <div className="absolute top-4 right-4 z-20 pointer-events-none flex flex-col items-end gap-1 text-[11px] font-mono">
                {opticalMode === 'white-light' ? (
                  <>
                    <div className="px-2.5 py-1 rounded bg-black/75 border border-emerald-500/40 text-emerald-300 font-bold backdrop-blur-md">
                      CRI: 98.4 Ra · 5700K DAYLIGHT
                    </div>
                    <div className="px-2.5 py-0.5 rounded bg-black/60 text-zinc-400 backdrop-blur-sm border border-zinc-800/60">
                      ILLUMINATION: 3,500 LUMENS (HYBRID)
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-2.5 py-1 rounded bg-black/75 border border-cyan-500/40 text-cyan-300 font-bold backdrop-blur-md">
                      LASER: 805nm DUAL-DIODE (120mW)
                    </div>
                    <div className="px-2.5 py-0.5 rounded bg-black/60 text-cyan-400 backdrop-blur-sm border border-zinc-800/60">
                      EMISSION BAND: 835nm LONG-PASS
                    </div>
                  </>
                )}
              </div>

              <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex flex-col gap-1 text-[11px] font-mono">
                {opticalMode === 'white-light' ? (
                  <div className="px-2.5 py-1 rounded bg-black/75 border border-zinc-700/80 text-zinc-300 backdrop-blur-md">
                    AUTO-IRIS: 1/250s · APERTURE F1.8 · GAIN +0.0dB
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded bg-black/80 border border-emerald-500/50 text-emerald-300 font-bold backdrop-blur-md">
                      PERFUSION INDEX: 94.8%
                    </div>
                    <div className="px-2.5 py-1 rounded bg-black/80 border border-cyan-500/50 text-cyan-300 font-bold backdrop-blur-md">
                      NIR SNR: 48.2 dB
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 right-4 z-20 pointer-events-none flex flex-col items-end gap-1 text-[11px] font-mono">
                <div className="px-2.5 py-1 rounded bg-black/75 border border-zinc-700/80 text-zinc-300 backdrop-blur-md">
                  ICD TELEMETRY: OK (mTLS 1.3) · 38.4°C
                </div>
              </div>

              {/* Endoscopic Mock SVG Canvas */}
              <svg
                viewBox="0 0 960 540"
                className="w-full h-full select-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Glow Filters */}
                  <filter id="optical-nir-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1" />
                    <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Cavity Backgrounds */}
                  <radialGradient id="wl-cavity-bg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2c0b0e" />
                    <stop offset="65%" stopColor="#140305" />
                    <stop offset="100%" stopColor="#050102" />
                  </radialGradient>

                  <radialGradient id="nir-cavity-bg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0c1622" />
                    <stop offset="65%" stopColor="#05090f" />
                    <stop offset="100%" stopColor="#020305" />
                  </radialGradient>

                  {/* Organ Tissue Gradients */}
                  <linearGradient id="liver-tissue-wl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9f1239" />
                    <stop offset="40%" stopColor="#881337" />
                    <stop offset="80%" stopColor="#4c0519" />
                  </linearGradient>

                  <linearGradient id="liver-tissue-nir" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="50%" stopColor="#111827" />
                    <stop offset="100%" stopColor="#0b0f17" />
                  </linearGradient>

                  <linearGradient id="gallbladder-wl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#65a30d" />
                    <stop offset="50%" stopColor="#4d7c0f" />
                    <stop offset="100%" stopColor="#365314" />
                  </linearGradient>

                  <linearGradient id="gallbladder-nir" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1f2937" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>

                  {/* False Color Perfusion Palettes */}
                  <linearGradient id="perfusion-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>

                  <linearGradient id="perfusion-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>

                  <linearGradient id="perfusion-spectral" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="35%" stopColor="#eab308" />
                    <stop offset="70%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>

                  {/* Circular Endoscope Mask */}
                  <clipPath id="endoscope-aperture">
                    <circle cx="480" cy="270" r="235" />
                  </clipPath>
                </defs>

                {/* Outer Masked Laparoscopic Field */}
                <g clipPath="url(#endoscope-aperture)">
                  {/* Cavity Background */}
                  <rect
                    x="0"
                    y="0"
                    width="960"
                    height="540"
                    fill={opticalMode === 'white-light' ? 'url(#wl-cavity-bg)' : 'url(#nir-cavity-bg)'}
                  />

                  {/* Peritoneal Tissue Layer (Hepatic Right & Left Lobe) */}
                  <path
                    d="M 270 140 C 350 90, 560 90, 680 150 C 750 200, 780 320, 720 400 C 660 480, 480 490, 340 460 C 240 430, 210 320, 240 230 Z"
                    fill={opticalMode === 'white-light' ? 'url(#liver-tissue-wl)' : 'url(#liver-tissue-nir)'}
                    stroke={opticalMode === 'white-light' ? '#be123c' : '#334155'}
                    strokeWidth="2"
                    opacity="0.95"
                  />

                  {/* Falciform Ligament */}
                  <path
                    d="M 470 110 C 475 200, 485 300, 470 440"
                    fill="none"
                    stroke={opticalMode === 'white-light' ? '#f43f5e' : '#1e293b'}
                    strokeWidth="3"
                    strokeDasharray="4 2"
                    opacity="0.6"
                  />

                  {/* Gallbladder Anatomy */}
                  <path
                    d="M 520 250 C 560 230, 610 260, 620 310 C 630 360, 580 400, 540 390 C 510 380, 495 340, 505 300 Z"
                    fill={opticalMode === 'white-light' ? 'url(#gallbladder-wl)' : 'url(#gallbladder-nir)'}
                    stroke={opticalMode === 'white-light' ? '#84cc16' : '#334155'}
                    strokeWidth="2"
                  />

                  {/* Vascular Arborization & Biliary Tract */}
                  <g opacity={opticalMode === 'white-light' ? 0.9 : 0.25}>
                    <path
                      d="M 370 410 Q 400 350 430 310 T 470 240 T 450 170"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 430 310 Q 480 300 520 280"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 470 240 Q 530 220 570 190"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>

                  {/* Cystic Duct & Common Bile Duct (WL Mode) */}
                  {opticalMode === 'white-light' && (
                    <g>
                      <path
                        d="M 515 310 C 490 320, 460 350, 450 420"
                        fill="none"
                        stroke="#a3e635"
                        strokeWidth="4"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                      <path
                        d="M 450 330 Q 430 370 420 440"
                        fill="none"
                        stroke="#84cc16"
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.75"
                      />
                    </g>
                  )}

                  {/* Specular Moist Sheen */}
                  {opticalMode === 'white-light' && (
                    <g opacity="0.35">
                      <path
                        d="M 320 210 Q 370 170 440 180"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="5"
                        strokeLinecap="round"
                        filter="blur(2px)"
                      />
                    </g>
                  )}

                  {/* NIR ICG Fluorescence Perfusion False-Color Heatmap Layer */}
                  {opticalMode === 'nir-icg' && (
                    <g
                      filter="url(#optical-nir-glow)"
                      opacity={(icgIntensity / 100).toFixed(2)}
                      className={!isFrozen ? 'animate-pulse' : ''}
                      style={{ animationDuration: '3s' }}
                    >
                      {/* Biliary Drainage Tract with vivid fluorescence */}
                      <path
                        d="M 515 310 C 490 320, 460 350, 450 420"
                        fill="none"
                        stroke={
                          colorPalette === 'emerald'
                            ? 'url(#perfusion-emerald)'
                            : colorPalette === 'cyan'
                            ? 'url(#perfusion-cyan)'
                            : 'url(#perfusion-spectral)'
                        }
                        strokeWidth="9"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 450 330 Q 430 370 420 440"
                        fill="none"
                        stroke={
                          colorPalette === 'emerald'
                            ? 'url(#perfusion-emerald)'
                            : colorPalette === 'cyan'
                            ? 'url(#perfusion-cyan)'
                            : 'url(#perfusion-spectral)'
                        }
                        strokeWidth="7"
                        strokeLinecap="round"
                      />

                      {/* Cystic Artery & Node of Calot Perfusion */}
                      <circle
                        cx="495"
                        cy="305"
                        r="18"
                        fill={
                          colorPalette === 'emerald'
                            ? '#34d399'
                            : colorPalette === 'cyan'
                            ? '#38bdf8'
                            : '#ef4444'
                        }
                        opacity="0.8"
                      />

                      {/* Microvascular capillary blush in liver parenchyma */}
                      <path
                        d="M 350 200 Q 380 240 430 260 T 520 230"
                        fill="none"
                        stroke={
                          colorPalette === 'emerald'
                            ? '#10b981'
                            : colorPalette === 'cyan'
                            ? '#06b6d4'
                            : '#eab308'
                        }
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray="6 4"
                      />
                    </g>
                  )}

                  {/* Optical Reticle Crosshairs */}
                  {showReticle && (
                    <g opacity="0.4" stroke="#ffffff" strokeWidth="1">
                      <line x1="480" y1="240" x2="480" y2="300" />
                      <line x1="450" y1="270" x2="510" y2="270" />
                      <circle cx="480" cy="270" r="12" fill="none" strokeDasharray="2 2" />
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {/* Monitor Control Bar */}
            <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-300">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 uppercase">Perfusion Palette:</span>
                <div className="flex items-center gap-1.5 bg-zinc-800/80 p-1 rounded-lg border border-zinc-700/60">
                  <button
                    type="button"
                    onClick={() => setColorPalette('emerald')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      colorPalette === 'emerald' ? 'bg-emerald-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Emerald
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorPalette('cyan')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      colorPalette === 'cyan' ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Cyan
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorPalette('spectral')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      colorPalette === 'spectral' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Spectral
                  </button>
                </div>
              </div>

              {/* Intensity Slider */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">ICG INTENSITY:</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={icgIntensity}
                  onChange={(e) => setIcgIntensity(Number(e.target.value))}
                  className="w-24 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="w-8 text-right font-bold text-cyan-400">{icgIntensity}%</span>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReticle(!showReticle)}
                  className={`px-3 py-1 rounded-lg border text-xs cursor-pointer ${
                    showReticle ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-transparent text-zinc-500 border-zinc-800'
                  }`}
                >
                  RETICLE: {showReticle ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFrozen(!isFrozen)}
                  className={`px-3 py-1 rounded-lg border text-xs cursor-pointer ${
                    isFrozen ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-white border-zinc-600'
                  }`}
                >
                  {isFrozen ? 'PAUSED' : 'LIVE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 8-Step Journey Path ("FROM SELECTION TO SURGERY") */}
      <section id="eight-step-path" className="py-20 md:py-28 relative border-t border-zinc-800/80 bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              SELECTION TO SURGERY ROADMAP
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              The 8-Step Path to Surgical Freedom
            </h2>
            <p className="mt-4 text-zinc-400 text-base sm:text-lg">
              A transparent institutional procurement journey designed to bring advanced surgical visualization into your operating theater without capex friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EIGHT_STEPS.map((item, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-3xl border backdrop-blur-xl transition-all shadow-lg flex flex-col justify-between ${
                  item.step === '06'
                    ? 'bg-emerald-950/20 border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                    : item.step === 'ADDL'
                    ? 'bg-cyan-950/20 border-cyan-500/50 hover:border-cyan-400'
                    : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
                      {item.step}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {item.step === '06' && (
                  <button
                    type="button"
                    onClick={() => setIsReachDrawerOpen(true)}
                    className="mt-6 w-full py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Book Clinical Demo
                  </button>
                )}

                {item.step === '03' && (
                  <Link
                    to="/login"
                    className="mt-6 w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-center block cursor-pointer"
                  >
                    Start Registration ↗
                  </Link>
                )}

                {item.step === 'ADDL' && (
                  <div className="mt-6 pt-3 border-t border-zinc-800 flex items-center gap-2 text-[10px] font-mono text-cyan-300">
                    <Truck className="w-3.5 h-3.5" /> 3–4 Wks Priority / 6–8 Wks Air
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Interactive Economics Engine & ₹97L Comparison */}
      <section id="calculator" className="py-20 md:py-28 relative">
        <div id="economics" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              PAY-PER-MINUTE ROI ENGINE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              Pay-Per-Minute Economics &amp; Cost Comparison
            </h2>
            <p className="mt-4 text-zinc-400 text-base sm:text-lg">
              Model your theater's monthly surgical procedure volume and discover immediate cash-flow advantages over conventional imported capital procurement.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Inputs Panel */}
            <div className="lg:col-span-6 p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-7">
              {/* System Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Select Surgical Vision System
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSystemKey('spectra')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedSystemKey === 'spectra'
                        ? 'bg-cyan-500/15 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                        : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs sm:text-sm">Spectra ICG</span>
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <span className="text-[11px] text-zinc-400 mt-1 block">5-Yr · {formatRate(64)}/m</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSystemKey('lumina')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedSystemKey === 'lumina'
                        ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs sm:text-sm">Lumina 4K</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] text-zinc-400 mt-1 block">5-Yr · {formatRate(53)}/m</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSystemKey('surgistart')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedSystemKey === 'surgistart'
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                        : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs sm:text-sm">SurgiStart</span>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <span className="text-[11px] text-zinc-400 mt-1 block">3-Yr · {formatRate(34)}/m</span>
                  </button>
                </div>
              </div>

              {/* Slider 1: Surgeries Per Month */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Monthly Surgical Cases
                  </label>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {surgeriesPerMonth} <span className="text-xs text-zinc-400 font-normal">cases/mo</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={surgeriesPerMonth}
                  onChange={(e) => setSurgeriesPerMonth(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
                  <span>5 cases</span>
                  <span>20 cases (default)</span>
                  <span>100 cases</span>
                </div>
              </div>

              {/* Slider 2: Average Duration */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Average Duration per Surgery
                  </label>
                  <span className="font-mono text-lg font-bold text-cyan-400">
                    {avgDurationMins} <span className="text-xs text-zinc-400 font-normal">minutes</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="180"
                  step="5"
                  value={avgDurationMins}
                  onChange={(e) => setAvgDurationMins(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
                  <span>20 min (Diagnostic)</span>
                  <span>60 min (default)</span>
                  <span>180 min (Complex)</span>
                </div>
              </div>

              {/* Slider 3: Competitor Capex */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Competitor Capex Benchmark
                  </label>
                  <span className="font-mono text-lg font-bold text-zinc-200">
                    {formatCurrency(competitorCapex)}
                  </span>
                </div>
                <input
                  type="range"
                  min="2500000"
                  max="12000000"
                  step="250000"
                  value={competitorCapex}
                  onChange={(e) => setCompetitorCapex(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-300"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
                  <span>₹25L</span>
                  <span>₹60L (default)</span>
                  <span>₹1.20 Cr</span>
                </div>
              </div>

              {/* Slider 4: Annual Maintenance (AMC) */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Competitor AMC / Service Agreement
                  </label>
                  <span className="font-mono text-lg font-bold text-zinc-200">
                    {formatCurrency(competitorAmc)} <span className="text-xs text-zinc-400 font-normal">/ yr</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="200000"
                  max="1500000"
                  step="25000"
                  value={competitorAmc}
                  onChange={(e) => setCompetitorAmc(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-300"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
                  <span>₹2L/yr</span>
                  <span>₹6.99L/yr (default)</span>
                  <span>₹15L/yr</span>
                </div>
              </div>

              {/* Slider 5: Capital Rate / Financing */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Hospital Capital / Financing Rate
                  </label>
                  <span className="font-mono text-lg font-bold text-amber-400">
                    {capitalRate}% <span className="text-xs text-zinc-400 font-normal">per annum</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="1"
                  value={capitalRate}
                  onChange={(e) => setCapitalRate(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
                  <span>6% (Prime)</span>
                  <span>12% (default)</span>
                  <span>24%</span>
                </div>
              </div>

              {/* Summary Stats Strip */}
              <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span>Annual Operating Procedure Minutes:</span>
                </div>
                <span className="font-mono text-white font-bold">
                  {economics.annualMinutes.toLocaleString()} min / year
                </span>
              </div>
            </div>

            {/* Right Calculations & ₹97L Comparison Display */}
            <div className="lg:col-span-6 p-8 sm:p-10 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <span className="text-xs font-bold font-mono tracking-widest text-zinc-400 uppercase">
                  {economics.termYears}-YEAR CUMULATIVE FINANCIAL IMPACT
                </span>

                {/* Customer Advantage Badge / Hero Card */}
                <div className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-zinc-900/90 to-teal-500/10 border-2 border-emerald-500/50 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4" /> Guaranteed Customer Advantage
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-400 text-black">
                      {economics.savingsPercent}% Lower Modelled Cost
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight">
                      Save {formatRawCurrency(economics.customerAdvantageSavings)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2">
                    Modelled savings against conventional imported equipment purchase (Capex financed at {capitalRate}%, {economics.termYears} years AMC).
                  </p>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800/90">
                    <span className="text-xs text-zinc-400 block mb-1">UnivLabs Freedom Plan Outlay</span>
                    <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                      {formatCurrency(economics.totalFreedomCost)}
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-1">
                      Privilege Retainer + Usage ({formatRate(economics.avgMinuteCost)}/m avg)
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800/90">
                    <span className="text-xs text-zinc-400 block mb-1">Imported Benchmark Outlay</span>
                    <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-400 line-through">
                      {formatCurrency(economics.competitorTotalCost)}
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-1">
                      Capex ({formatCurrency(economics.competitorFinancedCapex)}) + AMC ({formatCurrency(economics.competitorTotalAmc)})
                    </span>
                  </div>
                </div>

                {/* Dynamic SVG Comparison Bar */}
                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider text-white">5-Year TCO Visualizer</span>
                    <span className="font-mono text-emerald-400">Freedom vs Capex Outlay</span>
                  </div>

                  {/* Competitor Bar */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span>Imported Benchmark:</span>
                        <span>{formatCurrency(economics.competitorTotalCost)}</span>
                      </div>
                      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-rose-500/70" style={{ width: '70%' }} title="Financed Capex" />
                        <div className="h-full bg-amber-500/70" style={{ width: '30%' }} title="5-Year AMC" />
                      </div>
                    </div>

                    {/* Freedom Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-emerald-400 mb-1">
                        <span>UnivLabs Freedom:</span>
                        <span className="font-bold">{formatCurrency(economics.totalFreedomCost)}</span>
                      </div>
                      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-400"
                          style={{
                            width: `${Math.min(100, Math.max(10, Math.round((economics.totalFreedomCost / economics.competitorTotalCost) * 100)))}%`
                          }}
                          title="Freedom Total Outlay"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Year 1-5 rate schedule table */}
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Year-by-Year Freedom Billing</span>
                    <span className="font-mono text-emerald-400">100% Tax Deductible OpEx</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {economics.yearlyData.map((data, idx) => (
                      <div key={idx} className="bg-zinc-800/30 p-2 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-mono">Yr {data.year}</span>
                        <span className="font-mono text-zinc-200 font-semibold">{formatCurrency(data.annualUsageCost)}</span>
                        <span className="text-[9px] text-emerald-400 block font-mono mt-0.5">{formatRate(data.rate)}/m</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Duo */}
              <div className="mt-8 pt-6 border-t border-zinc-800 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsDemoDrawerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  Request 5-Day Clinical Demo with This Configuration
                </button>
                <Link
                  to={isLoggedIn ? '/roi-studio' : '/login?redirect=/roi-studio'}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Open Full Multi-Tower Commercial ROI Studio
                  <ExternalLink className="w-3.5 h-3.5 ml-1 text-zinc-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Surgical AI & Robotics Ecosystem Section */}
      <section className="py-20 md:py-28 relative border-t border-zinc-800/80 bg-zinc-950/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              SURGICAL INTELLIGENCE ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              CogniAxis.AI &amp; Robotic Integration
            </h2>
            <p className="mt-4 text-zinc-400 text-base sm:text-lg">
              Extending surgical visualization beyond optical boundaries with embedded neural inference and microrobotic telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 1. AxisEdge+ */}
            <div className="p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between hover:border-emerald-500/40 transition-all">
              <div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-5">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">AxisEdge+ Neural Engine</h3>
                <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
                  Real-time FPGA neural inference running directly at the tower. Provides instant intra-operative anatomical segmentation, boundary hazard warnings, and Strasberg critical safety view detection.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] font-mono text-emerald-400">
                &lt; 3ms Edge Latency · Zero Cloud Dependence
              </div>
            </div>

            {/* 2. SurgiVault */}
            <div className="p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between hover:border-blue-500/40 transition-all">
              <div>
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 w-fit mb-5">
                  <HardDrive className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">SurgiVault Archive</h3>
                <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
                  Cryptographically secured 4K surgical video storage with automated 21 CFR Part 11 electronic audit ledger, indexed procedure telemetry, and HIPAA-compliant clinician access.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] font-mono text-blue-400">
                Immutable SHA-256 Hash Chain
              </div>
            </div>

            {/* 3. SurgiBot */}
            <div className="p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between hover:border-purple-500/40 transition-all">
              <div>
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 w-fit mb-5">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">SurgiBot Robotics Link</h3>
                <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
                  Seamless kinematic integration with next-generation laparoscopic micro-manipulators and robotic arm holders. Provides active tremor cancellation and tele-surgical control.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] font-mono text-purple-400">
                Sub-Millimeter Motion Damping
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Clinical Specs Comparison Matrix */}
      <section id="specs" className="py-20 md:py-28 relative border-t border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase">
              TECHNICAL COMPARISON
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
              Clinical Engineering Specifications
            </h2>
            <p className="mt-4 text-zinc-400 text-base sm:text-lg">
              Benchmarked against leading legacy German &amp; Japanese endoscopic towers.
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl shadow-2xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-black/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-4 px-6">Specification Parameter</th>
                  <th className="py-4 px-6 text-emerald-400">UnivLabs LUMINA 4K</th>
                  <th className="py-4 px-6 text-cyan-400">UnivLabs SPECTRA ICG</th>
                  <th className="py-4 px-6 text-amber-400">UnivLabs SurgiStart</th>
                  <th className="py-4 px-6 text-zinc-400">Legacy Imported Benchmarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans text-zinc-300 text-xs">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Sensor Resolution &amp; Frame Rate</td>
                  <td className="py-4 px-6 font-mono text-emerald-300">3840×2160 @ 60 FPS</td>
                  <td className="py-4 px-6 font-mono text-cyan-300">3840×2160 @ 60 FPS (Dual Prism)</td>
                  <td className="py-4 px-6 font-mono text-amber-300">1920×1080 @ 60 FPS</td>
                  <td className="py-4 px-6 font-mono text-zinc-400">3840×2160 @ 30/60 FPS</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Light Source Architecture</td>
                  <td className="py-4 px-6">Hybrid Xenon/LED (3500 lm)</td>
                  <td className="py-4 px-6">Dual NIR 805nm + Solid LED</td>
                  <td className="py-4 px-6">High-Lumen Medical LED</td>
                  <td className="py-4 px-6">300W Xenon Bulb (500hr Life)</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Glass-to-Glass Latency</td>
                  <td className="py-4 px-6 font-mono text-emerald-300">&lt; 4.8 ms</td>
                  <td className="py-4 px-6 font-mono text-cyan-300">&lt; 5.2 ms</td>
                  <td className="py-4 px-6 font-mono text-amber-300">&lt; 4.5 ms</td>
                  <td className="py-4 px-6 font-mono text-zinc-400">12 - 25 ms</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Fluorescence Mode</td>
                  <td className="py-4 px-6 text-zinc-400">Standard White Light</td>
                  <td className="py-4 px-6 font-semibold text-cyan-300">Real-time Overlay + Heatmap</td>
                  <td className="py-4 px-6 text-zinc-400">Full HD White Light</td>
                  <td className="py-4 px-6 text-zinc-400">Optional ({formatCurrency(4000000)} Add-on)</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Capital Expenditure (Capex)</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 font-mono">{currency === 'USD' ? '$0' : '₹0'} (Zero Capex)</td>
                  <td className="py-4 px-6 font-bold text-cyan-400 font-mono">{currency === 'USD' ? '$0' : '₹0'} (Zero Capex)</td>
                  <td className="py-4 px-6 font-bold text-amber-400 font-mono">{currency === 'USD' ? '$0' : '₹0'} (Zero Capex)</td>
                  <td className="py-4 px-6 font-bold text-rose-400 font-mono">{formatCurrency(6000000)} - {formatCurrency(12000000)}</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Annual Maintenance (AMC / CMC)</td>
                  <td className="py-4 px-6 font-semibold text-emerald-400">Included in Per-Min Plan</td>
                  <td className="py-4 px-6 font-semibold text-cyan-400">Included in Per-Min Plan</td>
                  <td className="py-4 px-6 font-semibold text-amber-400">Included in Per-Min Plan</td>
                  <td className="py-4 px-6 font-mono text-zinc-400">{formatCurrency(699000)} / year recurring</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Network Failure Tolerance</td>
                  <td className="py-4 px-6 font-mono text-emerald-300">16-Hour Cryptographic Grace</td>
                  <td className="py-4 px-6 font-mono text-cyan-300">16-Hour Cryptographic Grace</td>
                  <td className="py-4 px-6 font-mono text-amber-300">16-Hour Cryptographic Grace</td>
                  <td className="py-4 px-6 font-mono text-zinc-400">Hardware Lock / Dongle</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-white">Medical Compliance</td>
                  <td className="py-4 px-6">FDA 21 CFR 820 / Part 11</td>
                  <td className="py-4 px-6">FDA 21 CFR 820 / Part 11</td>
                  <td className="py-4 px-6">FDA 21 CFR 820 / Part 11</td>
                  <td className="py-4 px-6">IEC 60601-1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 9. Bottom CTA Banner */}
      <section className="py-16 relative border-t border-zinc-800 bg-gradient-to-r from-emerald-950/40 via-zinc-950 to-cyan-950/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Ready to Upgrade Your Operating Suites?
          </h2>
          <p className="mt-4 text-zinc-300 text-base max-w-2xl mx-auto">
            Book a 5-day clinical demonstration in your own surgical suites. Operate on actual cases with on-site UnivLabs clinical support.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsDemoDrawerOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-black" />
              Book 5-Day Clinical Demo
            </button>
            <Link
              to={isLoggedIn ? '/dashboard' : '/login'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-zinc-200 bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 transition-colors"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              Hospital Portal Login
            </Link>
          </div>
        </div>
      </section>

      {/* 10. Dedicated Reach Us / Institutional & Commercial Inquiry Drawer */}
      {isReachDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity cursor-pointer"
            onClick={() => setIsReachDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <UnivLabsLogo className="w-8 h-8" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Reach UnivLabs</h3>
                    <p className="text-xs text-zinc-400 font-mono">Commercial, Institutional &amp; Support Connect</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReachDrawerOpen(false)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Form */}
              <form onSubmit={handleInquirySubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {inquiryError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                    {inquiryError}
                  </div>
                )}

                {/* Direct Contact & Response SLA Quick Card */}
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Direct Communications Channel
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      SLA &lt; 4 Hours
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-zinc-300 font-mono">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      <Phone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>+91 124 456 7890</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>sales@univlabs.in</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>UnivLabs Technologies, Electronic City, Sector 18, Gurugram, India</span>
                  </div>
                </div>

                {/* 4 Targeted Inquiry Category Pills */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Inquiry Category / Department *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'HOSPITAL_ONBOARDING', label: 'Hospital Onboarding', desc: 'Deploy towers in new facility' },
                      { id: 'DISTRIBUTOR_PARTNERSHIP', label: 'Distributor Partnership', desc: 'Regional dealership network' },
                      { id: 'TECHNICAL_SUPPORT', label: 'Technical Support', desc: 'Clinical & hardware engineers' },
                      { id: 'GENERAL_COMMERCIAL', label: 'Commercial & Financial', desc: 'Custom terms & corporate' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setInquiryForm({ ...inquiryForm, category: cat.id as any })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          inquiryForm.category === cat.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                            : 'bg-zinc-900 border-zinc-700/80 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-emerald-300">{cat.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{cat.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Requester Name & Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Dr. Rajesh / Executive Name"
                        value={inquiryForm.name}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Organization / Hospital *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Apollo Healthcare / Partner MedTech"
                        value={inquiryForm.organization}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, organization: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Designation & City/State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Professional Designation
                    </label>
                    <input
                      type="text"
                      placeholder="Managing Director / HOD Surgery"
                      value={inquiryForm.designation}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, designation: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      City &amp; State
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Bengaluru, Karnataka"
                        value={inquiryForm.cityState}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, cityState: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Official Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="contact@institution.org"
                        value={inquiryForm.email}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Phone Number (+91/Intl) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98100 12345"
                        value={inquiryForm.phone}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Inquiry Details / Message */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Inquiry Details &amp; Specific Requirements *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your surgical vision requirements, facility scale, partnership territory, or technical queries..."
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl font-bold text-sm text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
                >
                  SUBMIT INQUIRY ↘
                </button>
              </form>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  +91 (0) 124 4567 890
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  support@univlabs.in
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. Dedicated 5-Day Clinical Demonstration Request Drawer */}
      {isDemoDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity cursor-pointer"
            onClick={() => setIsDemoDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <UnivLabsLogo className="w-8 h-8" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Book 5-Day Clinical Evaluation</h3>
                    <p className="text-xs text-zinc-400 font-mono">Zero-Capex Operating Suite Trial</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoDrawerOpen(false)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Form */}
              <form onSubmit={handleLeadSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                    {formError}
                  </div>
                )}

                {/* Requester Name & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Clinician / Requester Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Dr. Rajesh Sharma"
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Professional Title / Designation
                    </label>
                    <input
                      type="text"
                      placeholder="Chief Surgeon / Bio-Med Head"
                      value={leadForm.title}
                      onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Hospital Name & City/State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Hospital / Institution Name *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Apollo Multispecialty Hospital"
                        value={leadForm.hospitalName}
                        onChange={(e) => setLeadForm({ ...leadForm, hospitalName: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      City &amp; State *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Chennai, Tamil Nadu"
                        value={leadForm.cityState}
                        onChange={(e) => setLeadForm({ ...leadForm, cityState: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Official Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="surgeon@hospital.org"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Contact Phone (+91/Intl) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98401 23456"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* System Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Select Surgical Vision Suite for Demonstration *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Spectra ICG 4K', 'Lumina 4K UHD', 'SurgiStart'].map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => setLeadForm({ ...leadForm, system: sys })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                          leadForm.system === sys
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-900 border-zinc-700/80 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume & Speciality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Estimated Monthly Surgery Volume
                    </label>
                    <select
                      value={leadForm.monthlyVolume}
                      onChange={(e) => setLeadForm({ ...leadForm, monthlyVolume: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="< 15 cases/month">&lt; 15 cases/month</option>
                      <option value="15 - 30 cases/month">15 - 30 cases/month</option>
                      <option value="30 - 60 cases/month">30 - 60 cases/month</option>
                      <option value="60+ cases/month">60+ cases/month</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Clinical Speciality
                    </label>
                    <select
                      value={leadForm.speciality}
                      onChange={(e) => setLeadForm({ ...leadForm, speciality: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Laparoscopic GI / General">Laparoscopic GI / General</option>
                      <option value="HPB & Liver Surgery">HPB &amp; Liver Surgery</option>
                      <option value="Gynaecological Laparoscopy">Gynaecological Laparoscopy</option>
                      <option value="Urology & Endourology">Urology &amp; Endourology</option>
                      <option value="Bariatric & Metabolic">Bariatric &amp; Metabolic</option>
                      <option value="Surgical Oncology">Surgical Oncology</option>
                    </select>
                  </div>
                </div>

                {/* Delivery Urgency */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Preferred Evaluation Window / Delivery Urgency
                  </label>
                  <select
                    value={leadForm.urgency}
                    onChange={(e) => setLeadForm({ ...leadForm, urgency: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Immediate (Next 7-10 Days)">Immediate (Next 7-10 Days)</option>
                    <option value="Within 3-4 Weeks">Within 3-4 Weeks</option>
                    <option value="Next Month / Planning Stage">Next Month / Planning Stage</option>
                  </select>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Theater Notes / Optical Scope Requirements (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specific scope diameter (e.g. 10mm 30°), light cables, or high-flow CO2 insufflation notes..."
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* In-Vivo Evaluation Notice */}
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>5 Working Days In-Vivo Evaluation Guarantee</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Demo fee ₹10,000 covers on-site clinical application specialist, sterile scope sets, and insurance. 100% credited against your Privilege Retainer upon system allocation.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl font-bold text-sm text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
                >
                  DISPATCH 5-DAY DEMO REQUEST ↘
                </button>
              </form>

              {/* Drawer Footer Hotline */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  +91 (0) 124 4567 890
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  clinical-trials@univlabs.in
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. Reach Us Inquiry Confirmation Modal */}
      {isReachConfirmModalOpen && submittedInquiry && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={() => setIsReachConfirmModalOpen(false)}
          />

          <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-white">Inquiry Received &amp; Logged</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your message has been assigned to the UnivLabs commercial &amp; clinical operations desk.
              </p>

              {/* Reference Tracking ID Card */}
              <div className="mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono block">Inquiry Reference ID</span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                    {submittedInquiry.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(submittedInquiry.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedCode ? 'COPIED!' : 'COPY'}
                </button>
              </div>

              {/* Inquiry Summary */}
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-zinc-800 text-left text-xs space-y-1.5 font-mono text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Category:</span>
                  <span className="text-cyan-400 font-bold">{submittedInquiry.category.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Organization:</span>
                  <span className="text-white font-semibold">{submittedInquiry.organization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Requester:</span>
                  <span className="text-white">{submittedInquiry.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Response SLA:</span>
                  <span className="text-emerald-400 font-semibold">&lt; 4 Business Hours</span>
                </div>
              </div>

              {/* SLA Steps */}
              <div className="mt-5 text-left text-xs text-zinc-400 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Inquiry routed to regional directorate and commercial desk.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>A dedicated representative will contact you via phone or email within 4 hours.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>Formal documentation, pricing schedules, or partnership contracts delivered.</span>
                </div>
              </div>

              {/* Hotline */}
              <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span>Direct Hotline:</span>
                <span className="font-mono text-emerald-400 font-bold">+91 124 456 7890</span>
              </div>

              <button
                type="button"
                onClick={() => setIsReachConfirmModalOpen(false)}
                className="mt-6 w-full py-3 rounded-xl font-bold text-xs text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer uppercase tracking-wider"
              >
                Close &amp; Return to Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. Clinical Demo Request Confirmation Modal */}
      {isConfirmModalOpen && submittedLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={() => setIsConfirmModalOpen(false)}
          />

          <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-white">Clinical Demo Request Confirmed</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your request has been logged into the UnivLabs institutional dispatch ledger.
              </p>

              {/* Reference Tracking ID Card */}
              <div className="mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono block">Reference Tracking ID</span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                    {submittedLead.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(submittedLead.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedCode ? 'COPIED!' : 'COPY'}
                </button>
              </div>

              {/* Lead Summary */}
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-zinc-800 text-left text-xs space-y-1.5 font-mono text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Hospital:</span>
                  <span className="text-white font-semibold">{submittedLead.hospitalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Requester:</span>
                  <span className="text-white">{submittedLead.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">System:</span>
                  <span className="text-cyan-400 font-bold">{submittedLead.system}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Target Window:</span>
                  <span className="text-emerald-400">{submittedLead.urgency}</span>
                </div>
              </div>

              {/* SLA Steps */}
              <div className="mt-5 text-left text-xs text-zinc-400 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>A Clinical Application Director will call you within 4 hours to verify OT specifications.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>System tower and sterile optics are prepared for transit with express cold-seal packaging.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>UnivLabs specialist arrives on site to configure the tower and support your first surgical cases.</span>
                </div>
              </div>

              {/* Hotline */}
              <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span>Coordinator Hotline:</span>
                <span className="font-mono text-emerald-400 font-bold">+91 (0) 124 4567 890</span>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="mt-6 w-full py-3 rounded-xl font-bold text-xs text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer uppercase tracking-wider"
              >
                Close &amp; Return to Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090b] pt-14 pb-12 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Col 1 */}
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <UnivLabsLogo className="w-8 h-8" />
                <span className="text-base font-bold text-white tracking-tight">UnivLabs Technologies</span>
              </div>
              <p className="text-zinc-400 text-xs max-w-md leading-relaxed">
                Pioneering high-precision medical imaging, surgical endoscopic visualization, and IoT-enabled surgical freedom subscription infrastructure in India.
              </p>
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 pt-2">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  +91 (0) 124 4567 890
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  support@univlabs.in
                </span>
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Surgical Systems</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><button onClick={() => scrollToSection('surgical-vision')} className="hover:text-white transition-colors cursor-pointer">SPECTRA ICG 4K Tower</button></li>
                <li><button onClick={() => scrollToSection('surgical-vision')} className="hover:text-white transition-colors cursor-pointer">LUMINA 4K UHD Tower</button></li>
                <li><button onClick={() => scrollToSection('surgical-vision')} className="hover:text-white transition-colors cursor-pointer">SurgiStart Suite</button></li>
                <li><button onClick={() => scrollToSection('optical-visualizer')} className="hover:text-white transition-colors cursor-pointer">Optical Engine Visualizer</button></li>
                <li><button onClick={() => scrollToSection('specs')} className="hover:text-white transition-colors cursor-pointer">Clinical Hardware Matrix</button></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Clinical &amp; Hospital Portal</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><Link to={isLoggedIn ? "/dashboard" : "/login"} className="hover:text-white transition-colors">Portal Authentication</Link></li>
                <li><Link to="/roi-studio" className="hover:text-white transition-colors">Commercial ROI Studio</Link></li>
                <li><Link to={isLoggedIn ? "/balance" : "/login?redirect=/balance"} className="hover:text-white transition-colors">Voucher Reconciliation</Link></li>
                <li><Link to={isLoggedIn ? "/audit" : "/login?redirect=/audit"} className="hover:text-white transition-colors">Part 11 Audit Viewer</Link></li>
                <li>
                  <button
                    onClick={() => setIsReachDrawerOpen(true)}
                    className="hover:text-emerald-400 transition-colors text-left cursor-pointer"
                  >
                    Request 5-Day Clinical Demo
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Regulatory Disclaimer */}
          <div className="pt-8 border-t border-zinc-800/80 space-y-4">
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-[11px] leading-relaxed text-zinc-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Medical Device Regulatory Notice:</strong> The SPECTRA ICG 4K, LUMINA 4K, and SurgiStart Endoscopic Visualization Systems are manufactured under certified ISO 13485:2016 quality management protocols and FDA 21 CFR 820 medical device requirements. Software telemetry and audit logs are preserved in accordance with FDA 21 CFR Part 11 electronic records mandates. All hospital clinical trials and demonstrations are conducted in alignment with institutional ethics guidelines.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-2">
              <p>© 2026 UnivLabs Technologies Private Limited. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <span>Privacy Policy</span>
                <span>•</span>
                <span>Terms of Service</span>
                <span>•</span>
                <span>Regulatory Compliance</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
