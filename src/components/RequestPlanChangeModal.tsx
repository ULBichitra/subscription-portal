import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { requestPlanChange } from '../services/api';
import { Layers, AlertCircle, CheckCircle, Lock } from 'lucide-react';

interface RequestPlanChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tower: {
    tower_id: string;
    agreement_type?: string | null;
  } | null;
}

export const RequestPlanChangeModal: React.FC<RequestPlanChangeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tower,
}) => {
  const { addToast } = useToast();

  const [justification, setJustification] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setJustification('');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, tower]);

  if (!isOpen || !tower) return null;

  const currentPlan = tower.agreement_type || 'POSTPAID';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setErrorMessage('Please provide a justification or business reason');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await requestPlanChange({
        tower_id: tower.tower_id,
        requested_plan: 'POSTPAID',
        notes: justification.trim(),
      });

      addToast('Plan change request to POSTPAID submitted successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to submit plan change request';
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Subscription Plan Change"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tower & Current Plan Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Target Tower</span>
            <span className="text-sm font-mono font-bold text-white">{tower.tower_id}</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Current Plan</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Layers className="w-3 h-3 text-blue-400" />
              {currentPlan}
            </span>
          </div>
        </div>

        {/* Target Plan Dropdown */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Requested Target Plan <span className="text-rose-400">*</span>
            </label>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Lock className="w-3 h-3 text-blue-400" />
              Freedom Postpaid
            </span>
          </div>
          <select
            disabled
            value="POSTPAID"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-gray-300 text-sm focus:outline-none font-medium cursor-not-allowed opacity-90"
          >
            <option value="POSTPAID" className="bg-zinc-900 text-zinc-100">
              POSTPAID — UnivLabs Freedom Plan (Unmetered Surgical Sessions)
            </option>
          </select>
        </div>

        {/* Postpaid Note */}
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
          UnivLabs Freedom Plan provides unmetered surgical sessions billed at monthly invoice intervals according to contract terms.
        </div>

        {/* Justification / Business Reason */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Justification / Business Reason <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] font-mono text-gray-500">
              {justification.length}/255
            </span>
          </div>
          <textarea
            maxLength={255}
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explain the clinical requirement or contract renegotiation rationale..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-900/30 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Submit Plan Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RequestPlanChangeModal;
