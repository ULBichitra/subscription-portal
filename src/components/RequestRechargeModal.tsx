import React, { useState, useEffect, useRef } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { requestBalance } from '../services/api';
import EntitySelector from './EntitySelector';
import { Clock, Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';

interface RequestRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tower?: {
    tower_id: string;
    live_balance_sec?: number | null;
    status?: string;
  } | null;
}

export const RequestRechargeModal: React.FC<RequestRechargeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tower,
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTowerId, setSelectedTowerId] = useState<string>(tower?.tower_id || '');
  const [requestedHours, setRequestedHours] = useState<number>(50);
  const [calcMode, setCalcMode] = useState<'HOURS' | 'AMOUNT'>('HOURS');
  const [amountRupees, setAmountRupees] = useState<number>(187620);
  const [selectedPill, setSelectedPill] = useState<number | 'custom'>(50);
  const [poNumber, setPoNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileType, setReceiptFileType] = useState<string>('');
  const [receiptFileSize, setReceiptFileSize] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const HOURLY_RATE = 3180; // ₹3,180/hr (LUMINA Freedom Base Plan Rate)

  useEffect(() => {
    if (isOpen) {
      setSelectedTowerId(tower?.tower_id || '');
      setRequestedHours(50);
      setCalcMode('HOURS');
      setAmountRupees(187620);
      setSelectedPill(50);
      setPoNumber('');
      setNotes('');
      setReceiptDataUrl('');
      setReceiptFileName('');
      setReceiptFileType('');
      setReceiptFileSize('');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentHours = tower?.live_balance_sec != null
    ? (Number(tower.live_balance_sec) / 3600).toFixed(1)
    : null;

  const pillOptions = [10, 50, 100];

  const handlePillSelect = (hours: number) => {
    setSelectedPill(hours);
    setRequestedHours(hours);
    const sub = Math.round(hours * HOURLY_RATE);
    setAmountRupees(Math.round(sub * 1.18));
  };

  const handleCustomHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const validVal = isNaN(val) ? 0 : val;
    setRequestedHours(validVal);
    const sub = Math.round(validVal * HOURLY_RATE);
    setAmountRupees(Math.round(sub * 1.18));
    if (pillOptions.includes(validVal)) {
      setSelectedPill(validVal);
    } else {
      setSelectedPill('custom');
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const validVal = isNaN(val) ? 0 : val;
    setAmountRupees(validVal);
    const netBase = validVal / 1.18;
    const calcHours = Number((netBase / HOURLY_RATE).toFixed(1));
    setRequestedHours(calcHours);
    if (pillOptions.includes(calcHours)) {
      setSelectedPill(calcHours);
    } else {
      setSelectedPill('custom');
    }
  };

  const baseCost = Math.round(requestedHours * HOURLY_RATE);
  const gstAmount = Math.round(baseCost * 0.18);
  const totalPayable = baseCost + gstAmount;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds 5MB limit');
      return;
    }

    setReceiptFileName(file.name);
    setReceiptFileType(file.type);
    setReceiptFileSize((file.size / 1024).toFixed(1) + ' KB');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptDataUrl(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read receipt file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptDataUrl('');
    setReceiptFileName('');
    setReceiptFileType('');
    setReceiptFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const targetId = selectedTowerId || tower?.tower_id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setErrorMessage('Please select a target tower for recharge');
      return;
    }
    if (requestedHours <= 0) {
      setErrorMessage('Please specify at least 1 hour of requested balance');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await requestBalance({
        tower_id: targetId,
        requested_minutes: Math.round(requestedHours * 60),
        po_number: poNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        receipt_data_url: receiptDataUrl || undefined,
      });

      addToast(`Top-up request for ${requestedHours} hours submitted successfully for ${targetId}`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to submit top-up request';
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
      title="Request Balance Top-Up"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tower Info & Current Balance */}
        {tower ? (
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Target Tower</span>
              <span className="text-sm font-mono font-bold text-white">{tower.tower_id}</span>
              {tower.status && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {tower.status}
                </span>
              )}
            </div>
            {currentHours !== null && (
              <div className="text-right">
                <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Current Balance</span>
                <div className="flex items-center gap-1.5 justify-end">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-mono font-bold text-emerald-400">{currentHours} hrs</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-zinc-900/80 border border-white/10 rounded-xl">
            <EntitySelector
              selectedTowerId={selectedTowerId}
              requiredTower={true}
              onTowerChange={(id) => setSelectedTowerId(id)}
              size="sm"
            />
          </div>
        )}

        {/* Recharge Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => setCalcMode('HOURS')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              calcMode === 'HOURS'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Recharge by Hours
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('AMOUNT')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              calcMode === 'AMOUNT'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Recharge by Amount (₹)
          </button>
        </div>

        {/* Input Controls */}
        {calcMode === 'HOURS' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Requested Hours <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              {pillOptions.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handlePillSelect(h)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    selectedPill === h
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/30'
                      : 'bg-zinc-800 text-gray-300 border-zinc-700 hover:bg-zinc-750 hover:text-white'
                  }`}
                >
                  {h}h ({h * 60}m)
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPill('custom')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  selectedPill === 'custom'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/30'
                    : 'bg-zinc-800 text-gray-300 border-zinc-700 hover:bg-zinc-750 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={10000}
                value={requestedHours || ''}
                onChange={handleCustomHoursChange}
                placeholder="Enter requested hours"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono pointer-events-none">
                = {((requestedHours || 0) * 60).toLocaleString()} mins
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Budget / Recharge Amount (₹ Incl. 18% GST) <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              {[50000, 100000, 250000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    const e = { target: { value: amt.toString() } } as any;
                    handleAmountChange(e);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    amountRupees === amt
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/30'
                      : 'bg-zinc-800 text-gray-300 border-zinc-700 hover:bg-zinc-750 hover:text-white'
                  }`}
                >
                  ₹{(amt / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2 text-sm text-gray-400 font-mono">₹</span>
              <input
                type="number"
                min={1000}
                step={500}
                value={amountRupees || ''}
                onChange={handleAmountChange}
                placeholder="Enter amount in INR"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3.5 py-2 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Live Financial Breakdown Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/40 via-zinc-900 to-indigo-950/30 border border-blue-500/30 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Plan Rate:</span>
            <span className="font-mono text-gray-200">₹{HOURLY_RATE.toLocaleString('en-IN')}/hr (₹53/min)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Subtotal ({requestedHours}h):</span>
            <span className="font-mono text-white">₹{baseCost.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">GST (18%):</span>
            <span className="font-mono text-amber-300">₹{gstAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="pt-2 border-t border-white/10 flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-gray-200 block uppercase tracking-wider">Total Amount to Pay</span>
              <span className="text-[10px] text-gray-400 font-mono">Effective: +{requestedHours}h ({Math.round(requestedHours * 60)} min)</span>
            </div>
            <span className="text-lg font-black text-emerald-400 font-mono">
              ₹{totalPayable.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* PO / Payment Reference */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
            PO / Payment Reference
          </label>
          <input
            type="text"
            maxLength={255}
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="e.g. PO-2026-0914 or Bank Wire #48291"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Receipt File Upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
            Payment Receipt / Invoice Proof (Image or PDF)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/jpg,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {receiptDataUrl ? (
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                {receiptFileType.startsWith('image/') ? (
                  <img
                    src={receiptDataUrl}
                    alt="Receipt preview"
                    className="w-12 h-12 object-cover rounded-lg border border-white/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-rose-400" />
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-medium text-white truncate">{receiptFileName}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{receiptFileSize}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveReceipt}
                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                title="Remove uploaded receipt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border border-dashed border-zinc-700 hover:border-blue-500/60 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer group"
            >
              <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              <span className="text-xs text-gray-300 font-medium group-hover:text-white">
                Click to attach receipt (PNG, JPG, PDF)
              </span>
              <span className="text-[10px] text-gray-500">Max size: 5MB</span>
            </button>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Notes / Purpose
            </label>
            <span className="text-[11px] font-mono text-gray-500">
              {notes.length}/255
            </span>
          </div>
          <textarea
            maxLength={255}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for top-up request, urgency, or department details..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                <span>Submit Top-Up Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RequestRechargeModal;
