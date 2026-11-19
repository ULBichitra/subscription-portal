import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIdleTimeoutOptions {
  timeoutMs?: number;           // Total idle duration before logout (default: 15 min = 900,000 ms)
  warningThresholdMs?: number;  // Duration before timeout when warning modal appears (default: 60 sec = 60,000 ms)
  onLogout?: () => void;
  onExtend?: () => Promise<boolean>;
}

export interface UseIdleTimeoutReturn {
  isWarningOpen: boolean;
  remainingSeconds: number;
  extendSession: () => Promise<void>;
  logout: () => void;
}

export const useIdleTimeout = ({
  timeoutMs = 15 * 60 * 1000,
  warningThresholdMs = 60 * 1000,
  onLogout,
  onExtend,
}: UseIdleTimeoutOptions = {}): UseIdleTimeoutReturn => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor(warningThresholdMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const isWarningOpenRef = useRef<boolean>(false);
  isWarningOpenRef.current = isWarningOpen;

  const logout = useCallback(() => {
    setIsWarningOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('portal_token');
      localStorage.removeItem('portal_user');
      window.location.href = '/login?reason=idle_timeout';
    }
  }, [onLogout]);

  const recordActivity = useCallback(() => {
    if (!isWarningOpenRef.current) {
      lastActivityRef.current = Date.now();
    }
  }, []);

  const extendSession = useCallback(async () => {
    try {
      if (onExtend) {
        await onExtend();
      }
      lastActivityRef.current = Date.now();
      setIsWarningOpen(false);
      setRemainingSeconds(Math.floor(warningThresholdMs / 1000));
    } catch (err) {
      console.error('Failed to extend session', err);
      logout();
    }
  }, [onExtend, logout, warningThresholdMs]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleEvent = () => {
      if (!throttleTimeout) {
        recordActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000);
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleEvent, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeLeft = timeoutMs - elapsed;

      if (timeLeft <= 0) {
        logout();
      } else if (timeLeft <= warningThresholdMs) {
        setIsWarningOpen(true);
        setRemainingSeconds(Math.max(0, Math.ceil(timeLeft / 1000)));
      } else {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleEvent);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(checkInterval);
    };
  }, [timeoutMs, warningThresholdMs, recordActivity, logout]);

  return {
    isWarningOpen,
    remainingSeconds,
    extendSession,
    logout,
  };
};

export default useIdleTimeout;
