import React, { useState, useEffect } from 'react';
import { Download, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global listener capture so beforeinstallprompt is never lost regardless of React mount lifecycle
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
  });
}

/**
 * Universal standalone detection across Windows/Mac/Linux/Android/iOS Chrome, Edge, Safari, Electron
 */
export function isAppRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. CSS Display Mode Media Queries (Standard PWA)
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isWindowOverlay = window.matchMedia('(display-mode: window-controls-overlay)').matches;
  const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  if (isDisplayStandalone || isWindowOverlay || isMinimalUi || isFullscreen) {
    return true;
  }

  // 2. iOS Safari Standalone
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
    return true;
  }

  // 3. Android Trusted Web Activity (TWA)
  if (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://')) {
    return true;
  }

  // 4. In-App Window Marker via Query Param or Session Storage
  try {
    const search = window.location.search || '';
    if (search.includes('source=pwa') || search.includes('pwa=') || search.includes('mode=standalone')) {
      sessionStorage.setItem('univlabs_pwa_standalone_active', 'true');
      return true;
    }
    if (sessionStorage.getItem('univlabs_pwa_standalone_active') === 'true') {
      return true;
    }
  } catch {
    // Ignore storage restrictions
  }

  // 5. Electron / Native Shell wrapper
  if (
    (window as any).electron ||
    (window as any).ipcRenderer ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron'))
  ) {
    return true;
  }

  return false;
}

interface PwaInstallPromptProps {
  variant?: string;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isAppRunningStandalone());
  const [isInstalledOnDevice, setIsInstalledOnDevice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pwa_installed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Re-verify standalone state and attach media query change listeners
    const standaloneMode = isAppRunningStandalone();
    setIsStandalone(standaloneMode);

    const mqlStandalone = window.matchMedia('(display-mode: standalone)');
    const mqlOverlay = window.matchMedia('(display-mode: window-controls-overlay)');
    
    const handleMediaChange = () => {
      setIsStandalone(isAppRunningStandalone());
    };

    if (mqlStandalone.addEventListener) {
      mqlStandalone.addEventListener('change', handleMediaChange);
      mqlOverlay.addEventListener('change', handleMediaChange);
    }

    // Check device installation via browser API
    const checkInstalledState = async () => {
      const isMarkedInstalled = localStorage.getItem('pwa_installed') === 'true';
      let hasRelatedApps = false;
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const relatedApps = await (navigator as unknown as { getInstalledRelatedApps: () => Promise<any[]> }).getInstalledRelatedApps();
          hasRelatedApps = Array.isArray(relatedApps) && relatedApps.length > 0;
        } catch {
          // Ignore
        }
      }
      setIsInstalledOnDevice(isMarkedInstalled || hasRelatedApps);
    };

    checkInstalledState();

    const handlePromptReady = (e: Event) => {
      e.preventDefault();
      const promptEvent = ((e as CustomEvent).detail || e) as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setIsInstalledOnDevice(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      console.info('[UnivLabs PWA] Clinical Cockpit PWA installed successfully.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-available', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mqlStandalone.removeEventListener) {
        mqlStandalone.removeEventListener('change', handleMediaChange);
        mqlOverlay.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-available', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // If already running inside standalone app window, hide launcher completely
  if (isStandalone) {
    return null;
  }

  const handleActionClick = async () => {
    // If already installed on OS, launch standalone window experience
    if (isInstalledOnDevice) {
      window.open('/?source=pwa', '_blank', 'noopener,noreferrer');
      return;
    }

    // Direct 1-click browser acceptance prompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          localStorage.setItem('pwa_installed', 'true');
          setIsInstalledOnDevice(true);
        }
        setDeferredPrompt(null);
        globalDeferredPrompt = null;
      } catch (err) {
        console.warn('[UnivLabs PWA] Installation prompt error:', err);
      }
    } else {
      // Fallback launch
      window.open('/?source=pwa', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={handleActionClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
        isInstalledOnDevice
          ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/35 text-cyan-300 hover:text-cyan-200'
          : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-300 hover:text-emerald-200'
      }`}
      title={
        isInstalledOnDevice
          ? 'Open UnivLabs CCP in dedicated standalone application window'
          : 'Install UnivLabs Clinical Cockpit as a desktop/mobile standalone app'
      }
    >
      {isInstalledOnDevice ? (
        <>
          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          <span>Open in App</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Install App</span>
        </>
      )}
    </button>
  );
};

export default PwaInstallPrompt;
