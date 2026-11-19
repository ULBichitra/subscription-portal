import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Drawer from '../components/ui/Drawer';
import { 
  Settings2, 
  Sliders, 
  Save, 
  RotateCcw, 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  Search, 
  CheckCircle2, 
  TrendingDown,
  Sparkles,
  Lock
} from 'lucide-react';
import { 
  getModelPricingConfigs, 
  updateModelPricingConfig, 
  resetModelPricingConfigs,
  getCustomHospitalPlans,
  saveCustomHospitalPlan,
  deleteCustomHospitalPlan,
  getCustomers,
  DEFAULT_PRICING_CONFIGS,
  type ModelPricingConfig,
  type CustomHospitalPlan,
  type Customer
} from '../services/api';

export const PricingConfiguration: React.FC = () => {
  const storedUser = localStorage.getItem('portal_user');
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const userRole = currentUser?.role || '';

  const canEdit = userRole === 'superadmin' || userRole === 'subscription_manager';
  const isViewOnly = userRole === 'hospital_admin' || userRole === 'field_support';

  const [configs, setConfigs] = useState<Record<string, ModelPricingConfig>>(DEFAULT_PRICING_CONFIGS);
  const [selectedModel, setSelectedModel] = useState<'SPECTRA' | 'LUMINA'>('SPECTRA');
  const [customPlans, setCustomPlans] = useState<CustomHospitalPlan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Custom Plan Modal state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<CustomHospitalPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  if (!currentUser || (!canEdit && !isViewOnly)) {
    return <Navigate to="/dashboard" replace />;
  }

  const loadData = async () => {
    setIsSaving(true);
    try {
      const [fetchedConfigs, fetchedPlans, fetchedCustomers] = await Promise.all([
        getModelPricingConfigs(),
        getCustomHospitalPlans(),
        getCustomers()
      ]);
      setConfigs(fetchedConfigs);
      setCustomPlans(fetchedPlans);
      setCustomers(fetchedCustomers);
    } catch (err) {
      console.error('Failed to load pricing data', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateChange = (year: number, field: 'baseRatePerMin' | 'incrementalRatePerMin', value: number) => {
    if (isViewOnly) return;
    setConfigs((prev) => {
      const current = prev[selectedModel];
      if (!current) return prev;
      const updatedRates = current.rates.map((r) => {
        if (r.year === year) {
          return { ...r, [field]: value };
        }
        return r;
      });
      return {
        ...prev,
        [selectedModel]: {
          ...current,
          rates: updatedRates
        }
      };
    });
  };

  const handleAdvanceChange = (val: number) => {
    if (isViewOnly) return;
    setConfigs((prev) => {
      const current = prev[selectedModel];
      if (!current) return prev;
      return {
        ...prev,
        [selectedModel]: {
          ...current,
          advancePayment: val
        }
      };
    });
  };

  const handleThresholdChange = (val: number) => {
    if (isViewOnly) return;
    setConfigs((prev) => {
      const current = prev[selectedModel];
      if (!current) return prev;
      return {
        ...prev,
        [selectedModel]: {
          ...current,
          baseMinutesThreshold: val
        }
      };
    });
  };

  const handleSaveDefaultConfig = async () => {
    if (isViewOnly) return;
    setIsSaving(true);
    try {
      await updateModelPricingConfig(configs[selectedModel]);
      setSaveSuccessMsg(`Pricing matrix for ${selectedModel} updated and persisted successfully.`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to save pricing config', err);
      alert('Failed to save pricing matrix configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (isViewOnly) return;
    if (!confirm('Are you sure you want to reset all model rate matrices to factory defaults?')) return;
    setIsSaving(true);
    try {
      const reset = await resetModelPricingConfigs();
      setConfigs(reset);
      setSaveSuccessMsg('Pricing matrices restored to standard factory rates.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to reset config', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreatePlan = () => {
    if (isViewOnly) return;
    const baseRates = configs[selectedModel].rates.map(r => ({ ...r }));
    setEditingPlan({
      id: '',
      customerId: customers[0]?.customer_id || 'UL-001',
      customerName: customers[0]?.name || 'Apollo Hospitals Group',
      model: selectedModel,
      customAdvancePayment: configs[selectedModel].advancePayment,
      customBaseThreshold: configs[selectedModel].baseMinutesThreshold,
      discountPct: 5,
      rates: baseRates,
      notes: '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: CustomHospitalPlan) => {
    if (isViewOnly) return;
    setEditingPlan({ ...plan, rates: plan.rates.map(r => ({ ...r })) });
    setIsPlanModalOpen(true);
  };

  const handleDeletePlan = async (id: string) => {
    if (isViewOnly) return;
    if (!confirm('Are you sure you want to delete this custom negotiated pricing plan?')) return;
    try {
      await deleteCustomHospitalPlan(id);
      setCustomPlans(prev => prev.filter(p => p.id !== id));
      setSaveSuccessMsg('Custom plan deleted.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to delete custom plan', err);
    }
  };

  const handleSaveCustomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly || !editingPlan) return;
    try {
      await saveCustomHospitalPlan(editingPlan);
      await loadData();
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      setSaveSuccessMsg('Negotiated hospital plan saved successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to save plan', err);
      alert('Failed to save custom negotiated plan');
    }
  };

  const filteredCustomPlans = customPlans.filter(p => 
    p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentActiveModelConfig = configs[selectedModel] || DEFAULT_PRICING_CONFIGS[selectedModel];

  return (
    <div className="space-y-8 pb-16">
      {isViewOnly && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-medium flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>View-Only Mode:</strong> Your role (<span className="font-mono text-amber-300 font-bold">{userRole}</span>) is granted read-only access to commercial pricing structures and rate schedules. Configuration edits are restricted to Superadmin and Subscription Manager roles.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            View-Only
          </span>
        </div>
      )}
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900/90 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <Settings2 className="w-3.5 h-3.5" /> Commercial Governance
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pricing Configuration & Rate Matrix Editor
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Configure baseline 5-year variable step-down schedules, advance security deposits, and customized hospital-negotiated contracts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canEdit ? (
              <>
                <button
                  onClick={handleResetDefaults}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Reset Factory Defaults
                </button>
                <button
                  onClick={handleSaveDefaultConfig}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Matrix Changes'}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Read-Only Mode</span>
              </div>
            )}
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Default Model Rate Matrix Editor */}
      <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
        
        {/* Model Tabs & General Settings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedModel('SPECTRA')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedModel === 'SPECTRA'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>SPECTRA ICG 4K Matrix</span>
            </button>
            <button
              onClick={() => setSelectedModel('LUMINA')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedModel === 'LUMINA'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>LUMINA 4K Matrix</span>
            </button>
          </div>

          {/* Model Global Params */}
          <div className="flex items-center gap-4 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Advance Deposit (₹):</label>
              <input
                type="number"
                value={currentActiveModelConfig.advancePayment}
                disabled={isViewOnly}
                onChange={(e) => handleAdvanceChange(Number(e.target.value))}
                className={`w-32 px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-white font-mono font-bold focus:border-blue-500 focus:outline-none ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Base Min Threshold:</label>
              <input
                type="number"
                value={currentActiveModelConfig.baseMinutesThreshold}
                disabled={isViewOnly}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className={`w-24 px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-white font-mono font-bold focus:border-blue-500 focus:outline-none ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* 5-Year Editable Rate Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Standard 5-Year Progressive Rate Matrix ({selectedModel})</span>
            </h3>
            <span className="text-xs text-gray-400">All rates in INR (₹) per procedure minute</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-white/10 bg-white/5 text-gray-300">
                  <th className="py-3 px-4 font-bold">Contract Year</th>
                  <th className="py-3 px-4 font-bold">Base Rate / Min (First {currentActiveModelConfig.baseMinutesThreshold} mins)</th>
                  <th className="py-3 px-4 font-bold">Incremental Rate / Min (Beyond {currentActiveModelConfig.baseMinutesThreshold} mins)</th>
                  <th className="py-3 px-4 font-bold">Sample 60-min Surgery Cost</th>
                  <th className="py-3 px-4 font-bold">Sample 120-min Surgery Cost</th>
                  <th className="py-3 px-4 font-bold text-center">Step-Down Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {currentActiveModelConfig.rates.map((rateObj) => {
                  const sample60 = 60 * rateObj.baseRatePerMin;
                  const sample120 = (currentActiveModelConfig.baseMinutesThreshold * rateObj.baseRatePerMin) + 
                    ((120 - currentActiveModelConfig.baseMinutesThreshold) * rateObj.incrementalRatePerMin);
                  
                  const year1Base = currentActiveModelConfig.rates[0]?.baseRatePerMin || 1;
                  const stepDownPct = rateObj.year === 1 
                    ? 0 
                    : Math.round(((year1Base - rateObj.baseRatePerMin) / year1Base) * 100);

                  return (
                    <tr key={rateObj.year} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-bold text-white text-sm">
                        Year {rateObj.year}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={rateObj.baseRatePerMin}
                            disabled={isViewOnly}
                            onChange={(e) => handleRateChange(rateObj.year, 'baseRatePerMin', Number(e.target.value))}
                            className={`w-28 px-2.5 py-1 bg-black/50 border border-white/15 rounded-lg text-white font-mono font-bold focus:border-blue-500 focus:outline-none ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={rateObj.incrementalRatePerMin}
                            disabled={isViewOnly}
                            onChange={(e) => handleRateChange(rateObj.year, 'incrementalRatePerMin', Number(e.target.value))}
                            className={`w-24 px-2.5 py-1 bg-black/50 border border-white/15 rounded-lg text-cyan-400 font-mono font-bold focus:border-blue-500 focus:outline-none ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-200">
                        ₹{sample60.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">
                        ₹{sample120.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {rateObj.year === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            Base Tier
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1">
                            <TrendingDown className="w-3 h-3 text-emerald-400" />
                            <span>-{stepDownPct}% Step-Down</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5-Year Model Simulation Strip */}
          <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Sparkles className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Standard 5-Year Outlay Projection</p>
                <p className="text-[11px] text-gray-400">Based on standard 20 surgeries/month (60 min/case) + ₹{(currentActiveModelConfig.advancePayment / 100000).toFixed(2)}L advance deposit.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Freedom 5-Yr Total</p>
                <p className="text-lg font-black font-mono text-emerald-400">
                  ₹{((currentActiveModelConfig.advancePayment + currentActiveModelConfig.rates.reduce((acc, r) => acc + (240 * 60 * r.baseRatePerMin), 0)) / 100000).toFixed(2)} Lakhs
                </p>
              </div>
              <div className="border-l border-white/10 pl-4">
                <p className="text-[10px] uppercase font-bold text-gray-400">Imported Benchmark</p>
                <p className="text-lg font-black font-mono text-gray-400 line-through">
                  ₹{(currentActiveModelConfig.importedBenchmarkCost / 100000).toFixed(2)} Lakhs
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Custom Hospital Negotiated Plans Section */}
      <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              <span>Custom Hospital Negotiated Plans</span>
            </h3>
            <p className="text-xs text-gray-400">Institutional overrides, group volume contracts, and key account matrices</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search hospital or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none w-60"
              />
            </div>

            {canEdit && (
              <button
                onClick={handleOpenCreatePlan}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Negotiated Plan</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Plans Table */}
        <div className="overflow-x-auto">
          {filteredCustomPlans.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No custom negotiated hospital plans found matching query.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-white/10 bg-white/5 text-gray-300">
                  <th className="py-3 px-4 font-bold">Plan ID & Institution</th>
                  <th className="py-3 px-4 font-bold">Model</th>
                  <th className="py-3 px-4 font-bold">Custom Advance</th>
                  <th className="py-3 px-4 font-bold">Year 1 (Base / Inc)</th>
                  <th className="py-3 px-4 font-bold">Year 5 (Base / Inc)</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  {canEdit && <th className="py-3 px-4 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white text-sm">{plan.customerName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{plan.id} • {plan.customerId}</p>
                      {plan.notes && (
                        <p className="text-[11px] text-purple-300/80 italic mt-0.5 truncate max-w-xs">{plan.notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white border border-white/10">
                        {plan.model}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-200">
                      ₹{plan.customAdvancePayment.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-300">
                      ₹{plan.rates[0]?.baseRatePerMin.toFixed(2)} / ₹{plan.rates[0]?.incrementalRatePerMin.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                      ₹{plan.rates[4]?.baseRatePerMin.toFixed(2)} / ₹{plan.rates[4]?.incrementalRatePerMin.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {plan.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-colors"
                          title="Edit Plan"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Custom Negotiated Hospital Rate Configuration Drawer */}
      <Drawer
        isOpen={isPlanModalOpen && !!editingPlan}
        onClose={() => setIsPlanModalOpen(false)}
        title={editingPlan?.id ? 'Edit Negotiated Hospital Plan' : 'Custom Negotiated Hospital Rate Configuration'}
        width="max-w-2xl"
      >
        {editingPlan && (
          <form onSubmit={handleSaveCustomPlan} className="space-y-5 text-xs">
            
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <p className="font-semibold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Hospital Contract & Progressive Step-Down Configuration</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                Configure customized 5-year rate matrices, tailored advance security deposits, and specific threshold overrides.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-gray-300 block mb-1">Target Healthcare Institution:</label>
                <select
                  value={editingPlan.customerId}
                  onChange={(e) => {
                    const cust = customers.find(c => c.customer_id === e.target.value);
                    setEditingPlan({
                      ...editingPlan,
                      customerId: e.target.value,
                      customerName: cust?.name || editingPlan.customerName
                    });
                  }}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-medium focus:border-purple-500 focus:outline-none"
                >
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.name} ({c.customer_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-300 block mb-1">Hardware Model:</label>
                <select
                  value={editingPlan.model}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    const baseRates = configs[newModel]?.rates || DEFAULT_PRICING_CONFIGS[newModel]?.rates;
                    setEditingPlan({
                      ...editingPlan,
                      model: newModel,
                      rates: baseRates.map(r => ({ ...r }))
                    });
                  }}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-medium focus:border-purple-500 focus:outline-none"
                >
                  <option value="SPECTRA">SPECTRA ICG 4K</option>
                  <option value="LUMINA">LUMINA 4K</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-gray-300 block mb-1">Custom Advance Deposit (₹):</label>
                <input
                  type="number"
                  value={editingPlan.customAdvancePayment}
                  onChange={(e) => setEditingPlan({ ...editingPlan, customAdvancePayment: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-300 block mb-1">Base Min Threshold:</label>
                <input
                  type="number"
                  value={editingPlan.customBaseThreshold}
                  onChange={(e) => setEditingPlan({ ...editingPlan, customBaseThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-mono font-bold focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-300 block mb-1">Commercial Status:</label>
                <select
                  value={editingPlan.status}
                  onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white font-medium focus:border-purple-500 focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>

            {/* Editable 5-Year Rates for this Custom Plan */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="font-bold text-gray-300 block">Custom 5-Year Progressive Rates (₹/min):</label>
              <div className="grid grid-cols-5 gap-2">
                {editingPlan.rates.map((r, idx) => (
                  <div key={r.year} className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <p className="font-bold text-purple-300 text-[11px]">Year {r.year}</p>
                    <div>
                      <span className="text-[10px] text-gray-400">Base:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={r.baseRatePerMin}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const copy = [...editingPlan.rates];
                          copy[idx].baseRatePerMin = val;
                          setEditingPlan({ ...editingPlan, rates: copy });
                        }}
                        className="w-full px-2 py-1 bg-zinc-900 border border-white/15 rounded text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400">Inc:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={r.incrementalRatePerMin}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const copy = [...editingPlan.rates];
                          copy[idx].incrementalRatePerMin = val;
                          setEditingPlan({ ...editingPlan, rates: copy });
                        }}
                        className="w-full px-2 py-1 bg-zinc-900 border border-white/15 rounded text-cyan-400 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-300 block mb-1">Contract Negotiation Notes:</label>
              <textarea
                rows={2}
                value={editingPlan.notes || ''}
                onChange={(e) => setEditingPlan({ ...editingPlan, notes: e.target.value })}
                placeholder="e.g. Special multi-tower group rate agreement approved by commercial committee..."
                className="w-full px-3 py-2 bg-zinc-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                Save Custom Plan
              </button>
            </div>

          </form>
        )}
      </Drawer>

    </div>
  );
};

export default PricingConfiguration;
