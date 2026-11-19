import React from 'react';
import { ShieldAlert, Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
  isExtending?: boolean;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
  isExtending = false,
}) => {
  if (!isOpen) return null;

  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
  const isUrgent = remainingSeconds <= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-2xl bg-[#0f1422] border p-6 shadow-2xl transition-all duration-300 ${
          isUrgent 
            ? 'border-rose-500/50 shadow-rose-950/50 shadow-2xl' 
            : 'border-amber-500/40 shadow-amber-950/40 shadow-xl'
        }`}
      >
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${
            isUrgent 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              Session Inactivity Alert
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              FDA 21 CFR Part 11 Compliance & Clinical Session Protection
            </p>
          </div>
        </div>

        {/* Content & Timer */}
        <div className="mt-5 space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Due to 15 minutes of inactivity, your secure portal session will terminate automatically to prevent unauthorized access.
          </p>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>TIME REMAINING:</span>
            </div>
            <div className={`text-2xl font-mono font-bold tracking-wider ${
              isUrgent ? 'text-rose-400 animate-pulse' : 'text-amber-400'
            }`}>
              00:{formattedSeconds}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onExtend}
            disabled={isExtending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-950 bg-cyan-400 hover:bg-cyan-300 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isExtending ? 'animate-spin' : ''}`} />
            <span>{isExtending ? 'Extending...' : 'Stay Signed In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;
