import React, { useState, useEffect } from 'react';
import { 
  Building, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Copy, 
  Check, 
  Plus, 
  Mail, 
  User, 
  Shield 
} from 'lucide-react';
import { onboardCustomer, getTowers } from '../services/api';
import type { Tower } from '../services/api';

interface DeploymentWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const generateCustomerId = (orgType: string): string => {
  const prefix = orgType === 'DISTRIBUTOR' ? 'DIST' : 'HOSP';
  const year = '2026';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}-${rand}`;
};

export const DeploymentWizardModal: React.FC<DeploymentWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Customer Details
  const [orgType, setOrgType] = useState<'HOSPITAL' | 'DISTRIBUTOR' | 'CLINIC'>('HOSPITAL');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [agreementType, setAgreementType] = useState<'PREPAID' | 'POSTPAID' | 'LEASE'>('POSTPAID');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL'>('MONTHLY');

  // Step 2: Tower Allocation
  const [allTowers, setAllTowers] = useState<Tower[]>([]);
  const [selectedTowerIds, setSelectedTowerIds] = useState<string[]>([]);
  const [quickTowerId, setQuickTowerId] = useState('');
  const [quickTowerModel, setQuickTowerModel] = useState<'LUMINA' | 'SPECTRA'>('LUMINA');
  const [quickTowerSerial, setQuickTowerSerial] = useState('');
  const [quickTowersToRegister, setQuickTowersToRegister] = useState<Array<{
    towerId: string;
    model: 'LUMINA' | 'SPECTRA';
    serial: string;
  }>>([]);

  // Step 3: Admin User Invitation
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  // Wizard state & results
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completionResult, setCompletionResult] = useState<{
    customerId: string;
    customerName: string;
    allocatedTowerIds: string[];
    activationLink?: string;
    adminEmail?: string;
    customerEmail?: string;
    customerEmailStatus?: boolean;
    adminEmailStatus?: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hasCreatedAssets, setHasCreatedAssets] = useState(false);

  // Initialize or reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      const initialId = generateCustomerId('HOSPITAL');
      setOrgType('HOSPITAL');
      setCustomerId(initialId);
      setCustomerName('');
      setAgreementType('POSTPAID');
      setContactPerson('');
      setContactPhone('');
      setContactEmail('');
      setBillingCycle('MONTHLY');
      setSelectedTowerIds([]);
      setQuickTowersToRegister([]);
      setQuickTowerId('');
      setQuickTowerSerial('');
      setAdminEmail('');
      setAdminUsername('');
      setUsernameManuallyEdited(false);
      setErrorMsg('');
      setCompletionResult(null);
      setCopiedLink(false);
      setHasCreatedAssets(false);

      // Fetch towers
      setLoadingTowers(true);
      getTowers()
        .then(data => setAllTowers(data))
        .catch(err => console.error('Failed to fetch towers:', err))
        .finally(() => setLoadingTowers(false));
    }
  }, [isOpen]);

  const handleDismiss = () => {
    if (isSubmitting) return;
    if (hasCreatedAssets || completionResult) {
      onSuccess();
    }
    onClose();
  };

  // Auto-generate customer ID when orgType changes if not manually modified
  const handleOrgTypeChange = (newType: 'HOSPITAL' | 'DISTRIBUTOR' | 'CLINIC') => {
    setOrgType(newType);
    setCustomerId(generateCustomerId(newType));
  };

  const handleRegenerateId = () => {
    setCustomerId(generateCustomerId(orgType));
  };

  // Auto-suggest username when adminEmail changes
  const handleAdminEmailChange = (val: string) => {
    setAdminEmail(val);
    if (!usernameManuallyEdited) {
      const prefix = val.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
      setAdminUsername(prefix);
    }
  };

  // Add quick-registered tower to pending list
  const handleAddQuickTower = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = quickTowerId.trim().toUpperCase();
    if (!cleanId) return;

    if (
      allTowers.some(t => t.tower_id.toUpperCase() === cleanId) ||
      quickTowersToRegister.some(t => t.towerId.toUpperCase() === cleanId)
    ) {
      setErrorMsg(`Tower ID '${cleanId}' is already in use or queued.`);
      return;
    }

    setErrorMsg('');
    setQuickTowersToRegister(prev => [
      ...prev,
      { towerId: cleanId, model: quickTowerModel, serial: quickTowerSerial.trim() }
    ]);
    setQuickTowerId('');
    setQuickTowerSerial('');
  };

  const handleRemoveQuickTower = (idToRemove: string) => {
    setQuickTowersToRegister(prev => prev.filter(t => t.towerId !== idToRemove));
  };

  const handleToggleTowerSelection = (towerId: string) => {
    setSelectedTowerIds(prev => 
      prev.includes(towerId) ? prev.filter(id => id !== towerId) : [...prev, towerId]
    );
  };

  const unassignedTowers = allTowers.filter(t => !t.customer_id || t.status === 'UNASSIGNED');

  // Submit complete onboarding deployment
  const handleCompleteDeployment = async () => {
    setErrorMsg('');
    const cleanCustId = customerId.trim();
    const cleanCustName = customerName.trim();
    const cleanAdminEmail = adminEmail.trim();

    if (!cleanCustId || !cleanCustName) {
      setStep(1);
      setErrorMsg('Customer ID and Facility Name are required.');
      return;
    }

    if (!cleanAdminEmail) {
      setStep(3);
      setErrorMsg('Primary administrator email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const role = orgType === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin';
      const effectiveUsername = adminUsername.trim() || cleanAdminEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
      const allAllocated = [...selectedTowerIds, ...quickTowersToRegister.map(q => q.towerId)];
      const targetCustomerEmail = contactEmail.trim() || cleanAdminEmail;

      const onboardPayload = {
        customer_id: cleanCustId,
        name: cleanCustName,
        organization_type: orgType,
        agreement_type: agreementType,
        contact_person: contactPerson.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        email: targetCustomerEmail,
        billing_cycle: agreementType === 'PREPAID' ? undefined : billingCycle,
        existing_tower_ids: selectedTowerIds,
        tower_ids: selectedTowerIds,
        allocated_tower_ids: selectedTowerIds,
        quick_towers: quickTowersToRegister.map(qt => ({
          tower_id: qt.towerId,
          towerId: qt.towerId,
          model: qt.model,
          serial: qt.serial || undefined,
          serial_number: qt.serial || undefined,
        })),
        new_towers: quickTowersToRegister.map(qt => ({
          tower_id: qt.towerId,
          model: qt.model,
          serial_number: qt.serial || undefined,
        })),
        admin_email: cleanAdminEmail,
        admin_username: effectiveUsername,
        admin_role: role,
        admin_user: {
          username: effectiveUsername,
          email: cleanAdminEmail,
          role: role,
        },
      };

      const res = await onboardCustomer(onboardPayload);
      setHasCreatedAssets(true);

      const token = res?.activation_token || res?.invitation_token || res?.admin_user?.activation_token || res?.user?.activation_token;
      const link = res?.activation_link || (token ? `${window.location.origin}/activate?token=${token}` : undefined);

      const custEmailDelivered = Boolean(
        res?.email_delivery?.customer_confirmation ?? 
        res?.email_status?.customer_confirmation ?? 
        res?.customer_email_sent ?? 
        (res?.email_status?.customer === 'sent' || res?.email_status?.customer === true)
      );

      const adminEmailDelivered = Boolean(
        res?.email_delivery?.admin_invitation ?? 
        res?.email_status?.admin_invitation ?? 
        res?.admin_email_sent ?? 
        (res?.email_status?.admin === 'sent' || res?.email_status?.admin === true)
      );

      const returnedAllocated = res?.allocated_tower_ids || res?.tower_ids || allAllocated;

      setCompletionResult({
        customerId: cleanCustId,
        customerName: cleanCustName,
        allocatedTowerIds: returnedAllocated,
        activationLink: link,
        adminEmail: cleanAdminEmail,
        customerEmail: targetCustomerEmail,
        customerEmailStatus: custEmailDelivered,
        adminEmailStatus: adminEmailDelivered,
      });

      setStep(4);
    } catch (err: any) {
      console.error('Deployment wizard failed:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Deployment onboarding failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!completionResult?.activationLink) return;
    navigator.clipboard.writeText(completionResult.activationLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={handleDismiss}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 glass-panel">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Building className="w-4 h-4" />
              </span>
              <span>Onboarding Customer</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              3-Step Guided Provisioning: Customer &bull; Towers &bull; Primary Admin
            </p>
          </div>
          
          <button 
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        {step < 4 && (
          <div className="px-6 py-3 bg-black/20 border-b border-white/5 flex items-center justify-between text-xs">
            <div className={`flex items-center gap-2 font-medium ${step === 1 ? 'text-blue-400' : 'text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-emerald-600 text-white' : 'bg-white/10'
              }`}>
                {step > 1 ? '✓' : '1'}
              </span>
              <span>Customer Details</span>
            </div>

            <div className="h-0.5 w-8 bg-white/10" />

            <div className={`flex items-center gap-2 font-medium ${step === 2 ? 'text-blue-400' : 'text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 2 ? 'bg-blue-600 text-white' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-white/10'
              }`}>
                {step > 2 ? '✓' : '2'}
              </span>
              <span>Tower Allocation</span>
            </div>

            <div className="h-0.5 w-8 bg-white/10" />

            <div className={`flex items-center gap-2 font-medium ${step === 3 ? 'text-blue-400' : 'text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 3 ? 'bg-blue-600 text-white' : 'bg-white/10'
              }`}>
                3
              </span>
              <span>Admin Invitation</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: CUSTOMER DETAILS */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                    Organization Type *
                  </label>
                  <select
                    value={orgType}
                    onChange={(e) => handleOrgTypeChange(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="HOSPITAL" className="bg-gray-900 text-white">Hospital</option>
                    <option value="CLINIC" className="bg-gray-900 text-white">Clinic / Surgical Center</option>
                    <option value="DISTRIBUTOR" className="bg-gray-900 text-white">Distributor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex justify-between items-center">
                    <span>Customer ID (Auto-Generated) *</span>
                    <button
                      type="button"
                      onClick={handleRegenerateId}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case font-normal"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value.toUpperCase())}
                    placeholder="e.g. HOSP-2026-A1B2"
                    className="w-full px-3 py-2 text-sm font-mono bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Facility / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Apollo Speciality Hospital"
                  className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                    Commercial Agreement Model *
                  </label>
                  <select
                    value={agreementType}
                    onChange={(e) => setAgreementType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="POSTPAID" className="bg-gray-900 text-white">POSTPAID (UnivLabs Freedom Plan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                    Billing Cycle
                  </label>
                  {agreementType === 'PREPAID' ? (
                    <div className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-gray-400 flex items-center justify-between">
                      <span className="truncate">N/A (Per-Minute / Wallet)</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Prepaid</span>
                    </div>
                  ) : (
                    <select
                      value={billingCycle}
                      onChange={(e) => setBillingCycle(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="MONTHLY" className="bg-gray-900 text-white">Monthly</option>
                      <option value="QUARTERLY" className="bg-gray-900 text-white">Quarterly</option>
                      <option value="ANNUAL" className="bg-gray-900 text-white">Annual</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="w-full px-3 py-2 text-xs bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-xs bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@hospital.org"
                    className="w-full px-3 py-2 text-xs bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TOWER ALLOCATION */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
                  <span>Allocate Existing Unassigned Towers</span>
                  <span className="text-xs text-gray-400 font-normal">
                    {selectedTowerIds.length} selected
                  </span>
                </h4>
                <p className="text-xs text-gray-400 mb-3">
                  Check any unassigned hardware towers to link immediately to <strong className="text-blue-300 font-mono">{customerId}</strong>.
                </p>

                {loadingTowers ? (
                  <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-xs">Loading available towers...</span>
                  </div>
                ) : unassignedTowers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center text-xs text-gray-400">
                    No unassigned towers currently available in inventory. You can quick-register a new tower below.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2 bg-black/20 custom-scrollbar">
                    {unassignedTowers.map(tower => {
                      const isChecked = selectedTowerIds.includes(tower.tower_id);
                      return (
                        <div
                          key={tower.tower_id}
                          onClick={() => handleToggleTowerSelection(tower.tower_id)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-600/20 border-blue-500/50 text-white'
                              : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent onClick
                              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span className="font-mono font-semibold">{tower.tower_id}</span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 font-bold">
                              {tower.model || 'LUMINA'}
                            </span>
                          </div>
                          <span className="text-gray-400 font-mono text-[11px]">
                            {tower.serial_number ? `SN: ${tower.serial_number}` : 'Unassigned'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Register New Tower */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Quick-Register &amp; Provision New Tower</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={quickTowerId}
                    onChange={(e) => setQuickTowerId(e.target.value.toUpperCase())}
                    placeholder="New Tower ID (e.g. TOWER-09)"
                    className="px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <select
                    value={quickTowerModel}
                    onChange={(e) => setQuickTowerModel(e.target.value as any)}
                    className="px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="LUMINA" className="bg-gray-900 text-white">LUMINA</option>
                    <option value="SPECTRA" className="bg-gray-900 text-white">SPECTRA</option>
                  </select>
                  <input
                    type="text"
                    value={quickTowerSerial}
                    onChange={(e) => setQuickTowerSerial(e.target.value)}
                    placeholder="Serial No. (optional)"
                    className="px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddQuickTower}
                    disabled={!quickTowerId.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Deployment</span>
                  </button>
                </div>

                {quickTowersToRegister.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
                    <span className="text-[11px] text-gray-400 block font-medium">New towers to be provisioned on submit:</span>
                    {quickTowersToRegister.map(qt => (
                      <div key={qt.towerId} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-300 font-bold">{qt.towerId}</span>
                          <span className="text-[10px] bg-white/10 px-1 rounded">{qt.model}</span>
                          {qt.serial && <span className="text-gray-400 font-mono text-[10px]">{qt.serial}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuickTower(qt.towerId)}
                          className="text-red-400 hover:text-red-300 p-1 text-xs"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: ADMIN USER INVITATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                <div>
                  <span className="font-semibold text-white">Facility Administrator Account</span>
                  <p className="mt-0.5 text-blue-300/90 leading-relaxed">
                    An activation invitation will be generated for the customer's primary administrator.
                    The administrator will receive full management rights scoped strictly to <strong className="text-white font-mono">{customerId}</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Administrator Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => handleAdminEmailChange(e.target.value)}
                    placeholder="admin@hospital.org"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Required. Activation link will be generated and can be copied on the next screen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Initial Username (Optional)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => {
                      setUsernameManuallyEdited(true);
                      setAdminUsername(e.target.value);
                    }}
                    placeholder="Auto-suggested from email"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  If left blank, derived from the email prefix. Administrator can also change it during activation.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-xs text-gray-400 space-y-1">
                <span className="font-semibold text-gray-300">Deployment Summary:</span>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-mono text-white">{customerId} ({customerName || 'Pending'})</span>
                </div>
                <div className="flex justify-between">
                  <span>Towers Allocated:</span>
                  <span className="text-emerald-400 font-semibold">{selectedTowerIds.length + quickTowersToRegister.length} hardware unit(s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Role Assigned:</span>
                  <span className="text-blue-300 font-mono">{orgType === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin'}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS / COMPLETION SCREEN */}
          {step === 4 && completionResult && (
            <div className="space-y-5 text-center py-2">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Customer Successfully Onboarded!</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Customer account, hardware allocation, and administrator credentials are created.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                <div>
                  <span className="text-gray-500 block uppercase font-semibold text-[10px]">Customer / Facility</span>
                  <span className="text-white font-medium block truncate">{completionResult.customerName}</span>
                  <span className="text-blue-400 font-mono text-[11px]">{completionResult.customerId}</span>
                </div>
                <div>
                  <span className="text-gray-500 block uppercase font-semibold text-[10px]">Hardware Towers</span>
                  <span className="text-emerald-400 font-bold block">{completionResult.allocatedTowerIds.length} Assigned</span>
                  <span className="text-gray-400 font-mono text-[11px] truncate block">
                    {completionResult.allocatedTowerIds.join(', ') || 'None'}
                  </span>
                </div>
              </div>

              {/* Email Delivery Status */}
              <div className="space-y-2 text-left p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                <span className="text-gray-400 block uppercase font-semibold text-[10px] tracking-wider mb-2">
                  Email Delivery Status
                </span>

                {/* Customer Facility Confirmation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-gray-300 font-medium">Customer Facility Confirmation:</span>
                  {completionResult.customerEmailStatus ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                      <span>✓ Confirmation email sent to <strong className="text-white font-mono">{completionResult.customerEmail}</strong></span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Email delivery pending/unconfigured</span>
                    </span>
                  )}
                </div>

                {/* Admin Invitation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-gray-300 font-medium">Admin Invitation:</span>
                  {completionResult.adminEmailStatus ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                      <span>✓ Activation email sent to <strong className="text-white font-mono">{completionResult.adminEmail}</strong></span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Email delivery pending/unconfigured</span>
                    </span>
                  )}
                </div>
              </div>

              {completionResult.activationLink && (
                <div className="space-y-2 text-left p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-white">Administrator Activation Link:</span>
                    <span className="text-[10px] text-blue-300 font-mono">Valid for 24 Hours</span>
                  </div>
                  {!completionResult.adminEmailStatus && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                      <span>Email delivery unconfigured/pending. Use direct activation link below:</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={completionResult.activationLink}
                      className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-gray-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        copiedLink ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Send this link to <strong className="text-white">{completionResult.adminEmail}</strong> to finalize password and username setup.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/30 flex justify-between items-center">
          {step === 4 ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
              >
                Complete &amp; Return to Directory
              </button>
            </div>
          ) : (
            <>
              {step > 1 ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep((s) => (s - 1) as any)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDismiss}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1) {
                      if (!customerId.trim() || !customerName.trim()) {
                        setErrorMsg('Customer ID and Facility Name are required.');
                        return;
                      }
                      setErrorMsg('');
                    }
                    setStep((s) => (s + 1) as any);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteDeployment}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Deploying Assets...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Onboarding</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
