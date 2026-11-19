import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import { CreateComplaintModal } from './CreateComplaintModal';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { refreshPortalToken } from '../services/api';

const Layout: React.FC = () => {
  const location = useLocation();
  const token = localStorage.getItem('portal_token');
  const userStr = localStorage.getItem('portal_user');
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCreateComplaintOpen, setIsCreateComplaintOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExtendingSession, setIsExtendingSession] = useState(false);

  const { isWarningOpen, remainingSeconds, extendSession, logout } = useIdleTimeout({
    timeoutMs: 15 * 60 * 1000,
    warningThresholdMs: 60 * 1000,
    onExtend: async () => {
      setIsExtendingSession(true);
      try {
        await refreshPortalToken();
        return true;
      } finally {
        setIsExtendingSession(false);
      }
    },
    onLogout: () => {
      localStorage.removeItem('portal_token');
      localStorage.removeItem('portal_user');
      window.location.href = '/login?reason=idle_timeout';
    }
  });
  
  useEffect(() => {
    const handleNetworkError = (e: any) => {
      setNetworkWarning(e.detail?.message || 'Server connection interrupted. Reconnecting...');
      const timer = setTimeout(() => {
        setNetworkWarning(null);
      }, 5000);
      return () => clearTimeout(timer);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    const handleOpenPalette = () => {
      setIsCommandPaletteOpen(true);
    };

    const handleToggleMobile = () => {
      setMobileMenuOpen((prev) => !prev);
    };

    window.addEventListener('portal:network-error', handleNetworkError);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('portal:open-command-palette', handleOpenPalette);
    window.addEventListener('portal:toggle-mobile-menu', handleToggleMobile);

    return () => {
      window.removeEventListener('portal:network-error', handleNetworkError);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('portal:open-command-palette', handleOpenPalette);
      window.removeEventListener('portal:toggle-mobile-menu', handleToggleMobile);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  let user: any;
  try {
    user = JSON.parse(userStr);
  } catch {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_user');
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans relative">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />

      {networkWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 backdrop-blur-md shadow-lg animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span>{networkWarning}</span>
        </div>
      )}

      <Sidebar 
        userRole={user.role} 
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <div className="flex flex-col flex-1 min-w-0 z-10 relative">
        <Header 
          user={user} 
          remainingSeconds={remainingSeconds}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenCreateComplaint={() => setIsCreateComplaintOpen(true)}
      />

      <CreateComplaintModal
        isOpen={isCreateComplaintOpen}
        onClose={() => setIsCreateComplaintOpen(false)}
        onSuccess={() => {}}
        currentUserCustomerId={user.customer_id}
        isHospitalAdmin={user.role === 'hospital_admin'}
      />

      <SessionTimeoutModal
        isOpen={isWarningOpen}
        remainingSeconds={remainingSeconds}
        onExtend={extendSession}
        onLogout={logout}
        isExtending={isExtendingSession}
      />
    </div>
  );
};

export default Layout;

