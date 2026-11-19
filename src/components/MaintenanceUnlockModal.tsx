import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { computeMaintenanceChallengeOtp, generateFieldSupportCode } from '../services/api';
import type { Tower } from '../services/api';
import { Key, ShieldCheck, Clock, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface MaintenanceUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  towers?: Tower[];
  defaultTowerId?: string;
}

export const MaintenanceUnlockModal: React.FC<MaintenanceUnlockModalProps> = ({
  isOpen,
  onClose,
  towers = [],
  defaultTowerId
}) => {
  const { addToast } = useToast();
  const [selectedTower, setSelectedTower] = useState(defaultTowerId || '');
  const [challengeNonce, setChallengeNonce] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isEmergencyGenerating, setIsEmergencyGenerating] = useState(false);
  const [emergencyCode, setEmergencyCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultTowerId) {
        setSelectedTower(defaultTowerId);
      } else if (towers.length > 0 && !selectedTower) {
        setSelectedTower(towers[0].tower_id);
      }
      if (!challengeNonce) {
        // Auto-generate a starter 8-char hex nonce for convenience
        const randomNonce = Math.random().toString(16).substring(2, 10).toUpperCase();
        setChallengeNonce(randomNonce);
      }
    }
  }, [isOpen, defaultTowerId, towers]);

  // Live countdown timer for OTP expiry
  useEffect(() => {
    if (!generatedOtp || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedOtp, secondsLeft]);

  const handleGenerateRandomNonce = () => {
    const randomNonce = Math.random().toString(16).substring(2, 10).toUpperCase().padStart(8, '0');
    setChallengeNonce(randomNonce);
  };

  const handleComputeOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTower = selectedTower.trim();
    const cleanNonce = challengeNonce.trim().toUpperCase();

    if (!cleanTower) {
      addToast('Please select or specify a target Tower ID.', 'error');
      return;
    }
    if (cleanNonce.length !== 8) {
      addToast('Challenge nonce must be exactly 8 alphanumeric characters.', 'error');
      return;
    }

    const res = computeMaintenanceChallengeOtp(cleanTower, cleanNonce);
    setGeneratedOtp(res.otp);
    setSecondsLeft(res.secondsRemaining);
    addToast(`Computed 6-digit maintenance OTP for ${cleanTower}`, 'success');
  };

  const handleCopyOtp = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addToast('Maintenance PIN copied to clipboard.', 'info');
  };

  const handleGenerateEmergencyFallback = async () => {
    const cleanTower = selectedTower.trim();
    if (!cleanTower) {
      addToast('Please specify a Tower ID.', 'error');
      return;
    }
    setIsEmergencyGenerating(true);
    try {
      const codeRes = await generateFieldSupportCode(cleanTower);
      setEmergencyCode(codeRes.code);
      addToast(`Emergency Master Code generated: ${codeRes.code}`, 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to generate emergency field code', 'error');
    } finally {
      setIsEmergencyGenerating(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSec = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Maintenance Unlock PIN Station">
      <div className="space-y-5 text-white text-sm">
        {/* Cockpit Intro Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-purple-500/30 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Challenge-Response Diagnostic Unlock</h4>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Computes a deterministic, time-locked 6-digit maintenance PIN bound to the tower's offline challenge nonce. Compliant with 21 CFR Part 11 audit logging.
            </p>
          </div>
        </div>

        {/* OTP Computation Form */}
        <form onSubmit={handleComputeOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Target Tower ID *
            </label>
            {towers.length > 0 ? (
              <select
                value={selectedTower}
                onChange={(e) => setSelectedTower(e.target.value)}
                className="w-full bg-black/60 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
                required
              >
                {towers.map((t) => (
                  <option key={t.tower_id} value={t.tower_id} className="bg-zinc-900 text-white">
                    {t.tower_id} {t.customer_name ? `(${t.customer_name})` : ''} - {t.is_online ? 'ONLINE' : 'OFFLINE'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedTower}
                onChange={(e) => setSelectedTower(e.target.value.toUpperCase())}
                placeholder="e.g. TOWER-001"
                className="w-full bg-black/60 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
                required
              >
              </input>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                8-Character Challenge Nonce *
              </label>
              <button
                type="button"
                onClick={handleGenerateRandomNonce}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Auto-Generate
              </button>
            </div>
            <input
              type="text"
              maxLength={8}
              value={challengeNonce}
              onChange={(e) => setChallengeNonce(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. A9F37C21"
              className="w-full bg-black/60 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-white font-mono text-base tracking-widest uppercase focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-zinc-500">
              <span>Enter 8-character string from offline tower UI</span>
              <span className={challengeNonce.length === 8 ? 'text-emerald-400 font-mono' : 'text-zinc-500 font-mono'}>
                {challengeNonce.length}/8 chars
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Key className="w-4 h-4" /> Compute 6-Digit Maintenance PIN
          </button>
        </form>

        {/* Computed PIN Display */}
        {generatedOtp && (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-emerald-500/20">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Authorized Maintenance PIN
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Clock className="w-3 h-3 animate-pulse" />
                <span>Expires in {formatCountdown(secondsLeft)}</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="font-mono text-3xl sm:text-4xl font-black text-white tracking-widest select-all">
                {generatedOtp.slice(0, 3)} {generatedOtp.slice(3)}
              </div>
              <button
                type="button"
                onClick={() => handleCopyOtp(generatedOtp)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? 'Copied' : 'Copy PIN'}</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mt-1">
              Enter this 6-digit code on tower touch panel to activate 60-minute diagnostic field service mode.
            </p>
          </div>
        )}

        {/* Emergency Master Token Fallback */}
        <div className="pt-3 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Alternative: Emergency Master Override Code</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateEmergencyFallback}
              disabled={isEmergencyGenerating}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEmergencyGenerating ? 'Generating...' : 'Request Master Code'}
            </button>
          </div>

          {emergencyCode && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-amber-300 tracking-wider">{emergencyCode}</span>
              <button
                type="button"
                onClick={() => handleCopyOtp(emergencyCode)}
                className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1 font-medium"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MaintenanceUnlockModal;
