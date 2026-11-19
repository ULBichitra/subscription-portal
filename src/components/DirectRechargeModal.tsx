import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { processDirectRecharge, generateOfflineVoucher } from '../services/api';
import type { Tower } from '../services/api';
import { resolveTowerPricing, calculateCommercialBreakdown, calculateDurationFromAmount } from '../services/pricing';
import { Key, AlertTriangle, ShieldCheck, Clock, Banknote, CheckCircle } from 'lucide-react';

export type RechargeMode = 'TIME_HOURS' | 'AMOUNT_MONEY' | 'EMERGENCY_OVERDRAFT' | 'VOUCHER' | 'PURCHASE_ORDER';

interface DirectRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  towerId?: string;
  tower?: Tower;
  towers?: Tower[];
  initialMode?: RechargeMode;
  userRole: string;
  onSuccess?: () => void;
}

export const DirectRechargeModal: React.FC<DirectRechargeModalProps> = ({
  isOpen,
  onClose,
  towerId = 'TOWER-001',
  tower,
  towers,
  initialMode = 'TIME_HOURS',
  userRole,
  onSuccess
}) => {
  const { addToast } = useToast();
  const [targetTower, setTargetTower] = useState(tower?.tower_id || towerId);
  const normalizeMode = (mode: RechargeMode): RechargeMode => {
    return mode === 'PURCHASE_ORDER' ? 'TIME_HOURS' : mode;
  };

  const [activeTab, setActiveTab] = useState<RechargeMode>(normalizeMode(initialMode));

  // Time / Duration State
  const [hours, setHours] = useState<number>(50);
  const [minutes, setMinutes] = useState<number>(0);

  // Monetary Amount State (₹ INR)
  const [amountInr, setAmountInr] = useState<number>(50000);

  // Common State
  const [poReference, setPoReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voucher Code State
  const [voucherCode, setVoucherCode] = useState('');
  const [generatedVoucher, setGeneratedVoucher] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const isAdminOrManager = userRole === 'superadmin' || userRole === 'subscription_manager';

  useEffect(() => {
    if (isOpen) {
      if (tower?.tower_id) {
        setTargetTower(tower.tower_id);
      } else if (towerId) {
        setTargetTower(towerId);
      }
      if (initialMode) setActiveTab(normalizeMode(initialMode));
      setNotes('');
      setPoReference('');
    }
  }, [isOpen]);

  // Dynamic Hardware Pricing Resolution
  const activeTower = (tower && tower.tower_id === targetTower) ? tower : towers?.find(t => t.tower_id === targetTower);
  const pricing = resolveTowerPricing(activeTower || targetTower, towers);
  
  // Real-time calculations
  const durationBreakdown = calculateCommercialBreakdown(hours, minutes, pricing.ratePerMin);
  const amountBreakdown = calculateDurationFromAmount(amountInr, pricing.ratePerMin, true);

  const handleGenerateQuickVoucher = async () => {
    setIsGenerating(true);
    try {
      const res = await generateOfflineVoucher(targetTower, hours, 1);
      if (res.voucher_code) {
        setGeneratedVoucher(res.voucher_code);
        setVoucherCode(res.voucher_code);
        addToast(`Cryptographic token ${res.voucher_code} generated for ${targetTower}`, 'success');
      }
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Could not generate voucher", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'TIME_HOURS') {
        const totalHours = Number(hours) + (Number(minutes) / 60);
        if (totalHours <= 0) {
          addToast("Duration must be greater than zero", 'error');
          setIsSubmitting(false);
          return;
        }
        const res = await processDirectRecharge({
          tower_id: targetTower,
          recharge_type: 'PURCHASE_ORDER',
          po_reference: poReference.trim() || undefined,
          hours: totalHours,
          notes: notes.trim() || undefined
        });
        addToast(`Duration Recharge Applied: +${res.hours_credited}h credited to ${res.tower_id}. Balance: ${res.balance_after_hours}h.`, 'success');
      } else if (activeTab === 'AMOUNT_MONEY') {
        if (amountInr <= 0 || amountBreakdown.totalMinutes <= 0) {
          addToast("Recharge amount must be greater than zero", 'error');
          setIsSubmitting(false);
          return;
        }
        const totalHours = amountBreakdown.totalMinutes / 60;
        const ref = poReference.trim() || `₹${amountInr.toLocaleString('en-IN')}-DIRECT`;
        const res = await processDirectRecharge({
          tower_id: targetTower,
          recharge_type: 'PURCHASE_ORDER',
          po_reference: ref,
          hours: totalHours,
          notes: notes.trim() ? `${notes.trim()} (Val: ₹${amountInr.toLocaleString('en-IN')})` : `Amount top-up: ₹${amountInr.toLocaleString('en-IN')}`
        });
        addToast(`Amount Recharge Applied: +${res.hours_credited}h (+${amountBreakdown.hours}h ${amountBreakdown.minutes}m) credited to ${res.tower_id}.`, 'success');
      } else if (activeTab === 'EMERGENCY_OVERDRAFT') {
        const res = await processDirectRecharge({
          tower_id: targetTower,
          recharge_type: 'EMERGENCY_OVERDRAFT',
          notes: notes.trim() || undefined
        });
        addToast(`Safety Valve Released: +72h emergency grace credited to ${res.tower_id}.`, 'success');
      } else if (activeTab === 'VOUCHER') {
        const res = await processDirectRecharge({
          tower_id: targetTower,
          recharge_type: 'VOUCHER',
          voucher_code: voucherCode.trim(),
          notes: notes.trim() || undefined
        });
        addToast(`Voucher Applied: +${res.hours_credited}h credited to ${res.tower_id}.`, 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.detail || err.message || "Operation failed", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Tower Surgical Balance Recharge Console"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 text-white text-sm">
        {/* Unified Category Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('TIME_HOURS')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'TIME_HOURS'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock size={15} />
            <span>Duration (Time)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AMOUNT_MONEY')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'AMOUNT_MONEY'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Banknote size={15} />
            <span>Amount (Money ₹)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VOUCHER')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'VOUCHER'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key size={15} />
            <span>Air-Gapped Token</span>
          </button>

          {isAdminOrManager && (
            <button
              type="button"
              onClick={() => setActiveTab('EMERGENCY_OVERDRAFT')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'EMERGENCY_OVERDRAFT'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle size={15} />
              <span>Emergency 72h</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Tower Identifier & Live Tariff */}
          <div className="p-3 bg-zinc-900/80 border border-white/10 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Target Tower:</span>
              <span className="text-base font-mono font-bold text-white px-2.5 py-0.5 rounded bg-white/5 border border-white/10">{targetTower}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                pricing.model === 'SPECTRA'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}>
                {pricing.model === 'SPECTRA' ? 'SPECTRA ICG 4K' : 'LUMINA 4K UHD'}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-gray-400">Rate:</span>
              <span className="text-amber-300 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10">
                ₹{pricing.ratePerMin.toFixed(2)}/min
              </span>
            </div>
          </div>

          {/* TAB 1: Duration / Time Recharge */}
          {activeTab === 'TIME_HOURS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Hours <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      required
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Minutes
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 font-mono block">
                  = {durationBreakdown.totalMinutes.toLocaleString()} surgical minutes ({((hours * 3600) + (minutes * 60)).toLocaleString()} sec)
                </span>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    PO / Invoice / Reference #
                  </label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="e.g. PO-2026-HOSP-092"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Administrative Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Hospital procurement approval, planned lap surgeries"
                  />
                </div>
              </div>

              {/* Financial Breakdown Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Commercial Financial Breakdown</span>
                    <span className="font-mono text-amber-300 font-bold">₹{pricing.ratePerMin.toFixed(2)} / min</span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-gray-300 font-medium">Credits to Apply:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +{hours}h {minutes}m <span className="text-gray-400 font-normal text-[11px]">({durationBreakdown.totalMinutes} mins)</span>
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-gray-400">
                        <span>Subtotal ({durationBreakdown.totalMinutes}m @ ₹{pricing.ratePerMin.toFixed(2)}/min):</span>
                        <span className="font-mono text-white font-semibold">₹{durationBreakdown.subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>GST ({durationBreakdown.gstPct}%):</span>
                        <span className="font-mono text-amber-300">₹{durationBreakdown.gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 mt-3">
                  <div className="flex justify-between items-baseline font-bold text-white">
                    <span>Total Commercial Value:</span>
                    <span className="font-mono text-emerald-400 text-base">₹{durationBreakdown.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-1">Tax invoice and FDA Part 11 audit record created upon confirmation</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Amount / Money (₹ INR) Recharge */}
          {activeTab === 'AMOUNT_MONEY' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Recharge Amount (₹ INR) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 font-bold font-mono">₹</span>
                    <input
                      type="number"
                      min={100}
                      step={500}
                      required
                      value={amountInr}
                      onChange={(e) => setAmountInr(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {/* Amount Quick Presets */}
                  <div className="flex gap-2 mt-2">
                    {[10000, 25000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountInr(val)}
                        className={`text-[11px] font-mono font-semibold px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                          amountInr === val
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        ₹{(val / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    PO / Bank Reference #
                  </label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="e.g. NEFT-992019 / PO-2026-HOSP"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Administrative Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Wire transfer, quarterly budget allotment"
                  />
                </div>
              </div>

              {/* Conversion & Credits Card */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Surgical Credits Conversion</span>
                    <span className="font-mono text-amber-300 font-bold">₹{pricing.ratePerMin.toFixed(2)} / min</span>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1 mb-3">
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block">Equivalent Surgical Time:</span>
                    <div className="font-mono font-bold text-emerald-400 text-lg">
                      +{amountBreakdown.hours}h {amountBreakdown.minutes}m
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono block">
                      = {amountBreakdown.totalMinutes.toLocaleString()} surgical minutes
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-gray-400">
                      <span>Base Value (Excl. 18% GST):</span>
                      <span className="font-mono text-white font-semibold">₹{amountBreakdown.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>GST (18% Included):</span>
                      <span className="font-mono text-amber-300">₹{amountBreakdown.gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 mt-3">
                  <div className="flex justify-between items-baseline font-bold text-white">
                    <span>Gross Amount Received:</span>
                    <span className="font-mono text-emerald-400 text-base">₹{amountBreakdown.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-1">Converted using {pricing.displayName} active tariff</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Air-Gapped Cryptographic Token */}
          {activeTab === 'VOUCHER' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    16-Character Cryptographic Token (HMAC-SHA256) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm tracking-widest uppercase text-center"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    maxLength={19}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Administrative Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Field service emergency, offline voucher"
                  />
                </div>
              </div>

              {/* Voucher Action Card */}
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block mb-1">Air-Gapped Offline Redemption</span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Generate or redeem HMAC-signed hardware tokens to unlock procedure hours on towers operating without an active internet connection.
                  </p>
                </div>

                {isAdminOrManager && (
                  <div className="pt-2 border-t border-white/10 mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleGenerateQuickVoucher}
                      disabled={isGenerating}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      {isGenerating ? "Signing..." : "Generate Offline Token"}
                    </button>
                    {generatedVoucher && (
                      <span className="text-[11px] text-emerald-400 font-mono font-bold">{generatedVoucher}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Emergency Safety Valve */}
          {activeTab === 'EMERGENCY_OVERDRAFT' && (
            <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldCheck size={18} />
                <span>Surgical Safety Continuity Override (IEC 60601-1)</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Releases an immediate +72-hour clinical grace extension to prevent mid-procedure illumination or video blackout. Permanently recorded in the 21 CFR Part 11 regulatory audit trail.
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'TIME_HOURS'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  : activeTab === 'AMOUNT_MONEY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : activeTab === 'EMERGENCY_OVERDRAFT'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              <CheckCircle size={14} />
              <span>{isSubmitting ? "Processing..." : "Confirm & Apply"}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
