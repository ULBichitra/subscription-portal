import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [justReconnected, setJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (justReconnected) {
    return (
      <div 
        role="status" 
        className="sticky top-0 z-50 w-full bg-emerald-950/95 border-b border-emerald-500/40 text-emerald-200 px-4 py-2 text-xs font-semibold backdrop-blur-xl shadow-lg flex items-center justify-center gap-2.5 transition-all duration-300"
      >
        <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
        <span>Clinical Gateway Reconnected · Live Telemetry Restored</span>
      </div>
    );
  }

  if (!isOffline) {
    return null;
  }

  return (
    <div 
      role="alert" 
      className="sticky top-0 z-50 w-full bg-amber-950/95 border-b border-amber-500/50 text-amber-200 px-4 py-2.5 text-xs font-semibold backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-center gap-2 sm:gap-4 transition-all duration-300"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <WifiOff className="w-4 h-4 text-amber-400" />
        <span className="font-bold tracking-tight">
          Clinical Gateway Offline · Viewing Cached Telemetry · Real-Time Sync Suspended
        </span>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100 text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
        title="Retry connection"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry Sync</span>
      </button>
    </div>
  );
};

export default OfflineBanner;
