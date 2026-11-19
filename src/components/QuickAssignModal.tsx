import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { assignAndActivateTower } from '../services/api';
import type { Tower, Customer, AssignAndActivatePayload } from '../services/api';
import { Building, Zap, AlertCircle } from 'lucide-react';

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tower?: Tower | null;
  unassignedTowers?: Tower[];
  customers: Customer[];
}

export const QuickAssignModal: React.FC<QuickAssignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tower,
  unassignedTowers = [],
  customers = [],
}) => {
  const { addToast } = useToast();

  const [selectedTowerId, setSelectedTowerId] = useState<string>('');
  const [distributorId, setDistributorId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [subscriptionType, setSubscriptionType] = useState<'PREPAID' | 'LEASE' | 'LIFETIME' | 'POSTPAID'>('POSTPAID');
  const [balanceHours, setBalanceHours] = useState<number>(100);
  const [monthlyRate, setMonthlyRate] = useState<number>(1500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Active target tower based on prop or dropdown selection
  const activeTower: Tower | undefined = 
    tower || 
    unassignedTowers.find(t => t.tower_id === selectedTowerId) || 
    unassignedTowers[0];

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setIsSubmitting(false);
      if (tower) {
        setSelectedTowerId(tower.tower_id);
        setDistributorId(tower.distributor_id || '');
        setCustomerId(tower.customer_id || '');
      } else if (unassignedTowers.length > 0) {
        setSelectedTowerId(unassignedTowers[0].tower_id);
        setDistributorId('');
        setCustomerId('');
      }
      setSubscriptionType('POSTPAID');
      setBalanceHours(100);
      setMonthlyRate(1500);
    }
  }, [isOpen, tower, unassignedTowers]);

  // Distributors filter
  const distributors = customers.filter(c => c.organization_type === 'DISTRIBUTOR');

  // Hospital Facilities filter (hospitals or customers belonging to selected distributor)
  const hospitalFacilities = customers.filter(c => {
    if (c.organization_type === 'DISTRIBUTOR') return false;
    if (distributorId) {
      return c.distributor_id === distributorId || c.organization_type === 'HOSPITAL';
    }
    return c.organization_type === 'HOSPITAL' || c.organization_type === 'CLINIC';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTower) {
      setErrorMessage('Please select a valid tower to assign.');
      return;
    }
    if (!customerId && !distributorId) {
      setErrorMessage('Please select either a Distributor Partner or a Hospital Facility.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload: AssignAndActivatePayload = {
        distributor_id: distributorId || null,
        customer_id: customerId || null,
        subscription_type: subscriptionType,
        balance_hours: balanceHours,
        ...(subscriptionType === 'LEASE' ? { monthly_rate: monthlyRate } : {}),
      };

      await assignAndActivateTower(activeTower.tower_id, payload);
      addToast(customerId ? `⚡ Tower ${activeTower.tower_id} assigned & activated successfully!` : `📦 Tower ${activeTower.tower_id} assigned to Distributor Stock!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Failed to assign and activate tower';
      setErrorMessage(detail);
      addToast(`Assignment failed: ${detail}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ Quick Assign & Activate Tower">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tower Info Banner */}
        {activeTower ? (
          <div className="p-3 bg-zinc-900/80 border border-zinc-700/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono font-bold text-base">{activeTower.tower_id}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                  (activeTower.model || 'LUMINA').toUpperCase() === 'SPECTRA'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}>
                  {activeTower.model || 'LUMINA'}
                </span>
              </div>
              {activeTower.serial_number && (
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">SN: {activeTower.serial_number}</p>
              )}
            </div>
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border bg-amber-500/20 text-amber-300 border-amber-500/40">
              Unassigned Inventory (In-House Testing)
            </span>
          </div>
        ) : null}

        {/* Tower Selector if opening without target tower and multiple unassigned exist */}
        {!tower && unassignedTowers.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Select Discovered Tower
            </label>
            <select
              value={selectedTowerId}
              onChange={(e) => setSelectedTowerId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {unassignedTowers.map(t => (
                <option key={t.tower_id} value={t.tower_id} className="bg-zinc-900 text-zinc-100">
                  {t.tower_id} ({t.model || 'LUMINA'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Distributor Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-amber-400" />
            Distributor Partner (Optional)
          </label>
          <select
            value={distributorId}
            onChange={(e) => setDistributorId(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="bg-zinc-900 text-zinc-100">-- Direct from Manufacturer (UnivLabs) --</option>
            {distributors.map(d => (
              <option key={d.customer_id} value={d.customer_id} className="bg-zinc-900 text-zinc-100">
                {d.name} ({d.customer_id})
              </option>
            ))}
          </select>
        </div>

        {/* Hospital Facility Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-blue-400" />
            Hospital Facility (Customer)
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="bg-zinc-900 text-zinc-100">-- Select Hospital Facility --</option>
            {hospitalFacilities.map(h => (
              <option key={h.customer_id} value={h.customer_id} className="bg-zinc-900 text-zinc-100">
                {h.name} ({h.customer_id})
              </option>
            ))}
          </select>
        </div>

        {/* Subscription Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Subscription Plan Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: 'POSTPAID', label: 'UnivLabs Freedom Plan (Postpaid)' }
            ].map(p => (
              <button
                key={p.type}
                type="button"
                onClick={() => setSubscriptionType(p.type as any)}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                  subscriptionType === p.type
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/30'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Starting Balance (hours) input */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between">
            <span>Starting Balance (Hours)</span>
            <span className="text-[10px] text-zinc-400 font-mono">Default: 100 hrs</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={balanceHours}
              onChange={(e) => setBalanceHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">
              hrs
            </span>
          </div>
        </div>

        {/* Monthly Rate if LEASE */}
        {subscriptionType === 'LEASE' && (
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Monthly Lease Rate ($/mo)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1500"
            />
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !activeTower}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-900/30 flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4" />
            <span>{isSubmitting ? 'Activating...' : (customerId ? 'Assign & Activate' : 'Assign to Distributor Stock')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default QuickAssignModal;
