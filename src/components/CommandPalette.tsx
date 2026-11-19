import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  AlertCircle,
  ShieldAlert,
  FileText,
  Wrench,
  Shield,
  Activity,
  Inbox,
  Users,
  UserCog,
  PlusCircle,
  CornerDownLeft,
  Search,
  X,
  Calculator,
  Receipt,
  Sliders
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Administration';
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateComplaint?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenCreateComplaint,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    // Quick Actions


    {
      id: 'action-submit-complaint',
      title: 'Submit Customer Complaint',
      subtitle: 'Register customer adverse event or malfunction ticket',
      category: 'Actions',
      icon: PlusCircle,
      keywords: ['complaint', 'ticket', 'quality', 'fda', 'defect', 'issue'],
      action: () => {
        onClose();
        if (onOpenCreateComplaint) {
          onOpenCreateComplaint();
        } else {
          navigate('/complaints');
        }
      }
    },

    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Dashboard & Fleet Telemetry',
      subtitle: 'Real-time telemetry HUD, die temp, and session statistics',
      category: 'Navigation',
      icon: LayoutDashboard,
      keywords: ['home', 'telemetry', 'stats', 'hud', 'overview'],
      action: () => {
        onClose();
        navigate('/dashboard');
      }
    },
    {
      id: 'nav-towers',
      title: 'Fleet Device Management',
      subtitle: 'View, register, suspend or inspect towers',
      category: 'Navigation',
      icon: Server,
      keywords: ['towers', 'devices', 'hardware', 'fleet', 'serial'],
      action: () => {
        onClose();
        navigate('/towers');
      }
    },
    {
      id: 'nav-complaints',
      title: 'Customer Complaints & Quality',
      subtitle: 'Customer issue reporting and CAPA investigation management',
      category: 'Navigation',
      icon: AlertCircle,
      keywords: ['complaints', 'quality', 'mdr', 'capa', 'regulations', 'fda'],
      action: () => {
        onClose();
        navigate('/complaints');
      }
    },
    {
      id: 'nav-roi-studio',
      title: 'Commercial ROI & Cost Advantage Studio',
      subtitle: 'Hospital 5-year variable rate simulation and executive proposal generator',
      category: 'Navigation',
      icon: Calculator,
      keywords: ['roi', 'calculator', 'commercial', 'savings', 'proposal', 'advantage', 'lumina', 'spectra'],
      action: () => {
        onClose();
        navigate('/roi-studio');
      }
    },
    {
      id: 'nav-invoices',
      title: 'Invoices & GST Billing Management',
      subtitle: 'Tax invoices, HSN 997312 leasing, 18% GST breakdown & settlements',
      category: 'Navigation',
      icon: Receipt,
      keywords: ['invoices', 'billing', 'gst', 'tax', 'receipts', 'payments', 'hsn', '997312'],
      action: () => {
        onClose();
        navigate('/invoices');
      }
    },

    {
      id: 'nav-subscriptions',
      title: 'Subscription Plans & Leases',
      subtitle: 'Manage active customer subscriptions and lease contracts',
      category: 'Navigation',
      icon: Activity,
      keywords: ['subscriptions', 'plans', 'leases', 'prepaid', 'postpaid'],
      action: () => {
        onClose();
        navigate('/subscriptions');
      }
    },
    {
      id: 'nav-pricing-config',
      title: 'Commercial Pricing Configuration',
      subtitle: 'Admin matrix editor for 5-year variable rates and custom hospital plans',
      category: 'Administration',
      icon: Sliders,
      keywords: ['pricing', 'matrix', 'rates', 'variable', 'step-down', 'contracts', 'advance'],
      action: () => {
        onClose();
        navigate('/pricing-config');
      }
    },
    {
      id: 'nav-requests',
      title: 'Recharge & Plan Requests',
      subtitle: 'Review incoming customer top-up and tier modification requests',
      category: 'Navigation',
      icon: Inbox,
      keywords: ['requests', 'approvals', 'pending', 'orders'],
      action: () => {
        onClose();
        navigate('/requests');
      }
    },
    {
      id: 'nav-audit',
      title: 'Cryptographic Audit Trail',
      subtitle: '21 CFR Part 11 immutable append-only logs & HMAC signatures',
      category: 'Navigation',
      icon: ShieldAlert,
      keywords: ['audit', 'trail', 'security', 'hmac', 'compliance'],
      action: () => {
        onClose();
        navigate('/audit');
      }
    },
    {
      id: 'nav-logs',
      title: 'System & Security Logs',
      subtitle: 'Live ICD frame events, delta store sequences, and server logs',
      category: 'Navigation',
      icon: FileText,
      keywords: ['logs', 'system', 'diagnostics', 'icd', 'frames'],
      action: () => {
        onClose();
        navigate('/logs');
      }
    },
    {
      id: 'nav-support',
      title: 'Offline Maintenance & Field Support',
      subtitle: 'Generate field support bypass codes and offline diagnostic credentials',
      category: 'Navigation',
      icon: Wrench,
      keywords: ['field', 'support', 'bypass', 'offline', 'maintenance'],
      action: () => {
        onClose();
        navigate('/support');
      }
    },

    // Administration
    {
      id: 'nav-customers',
      title: 'Customer Directory',
      subtitle: 'Hospital institutions and distributor accounts',
      category: 'Administration',
      icon: Users,
      keywords: ['customers', 'hospitals', 'distributors', 'accounts'],
      action: () => {
        onClose();
        navigate('/customers');
      }
    },
    {
      id: 'nav-users',
      title: 'User Management',
      subtitle: 'Provision portal accounts, role assignments, and invitations',
      category: 'Administration',
      icon: UserCog,
      keywords: ['users', 'roles', 'credentials', 'members'],
      action: () => {
        onClose();
        navigate('/users');
      }
    },
    {
      id: 'nav-rbac',
      title: 'Access Control & RBAC Matrix',
      subtitle: 'View role-based authorization matrix and permissions',
      category: 'Administration',
      icon: Shield,
      keywords: ['rbac', 'matrix', 'permissions', 'access', 'security'],
      action: () => {
        onClose();
        navigate('/rbac');
      }
    }
  ], [navigate, onClose, onOpenCreateComplaint]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(lower);
      const matchSub = cmd.subtitle?.toLowerCase().includes(lower);
      const matchCategory = cmd.category.toLowerCase().includes(lower);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(lower));
      return matchTitle || matchSub || matchCategory || matchKeywords;
    });
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl bg-zinc-950/90 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />

        {/* Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
          <Search className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, action, or navigate (e.g. 'overdraft', 'fda', 'towers')..."
            className="flex-1 bg-transparent border-none text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-400 bg-white/10 rounded border border-white/10 shadow-sm">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar text-sm"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No matching commands or navigation items found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  data-index={idx}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/40 text-white shadow-[inset_0_0_15px_rgba(59,130,246,0.15)]'
                      : 'hover:bg-white/5 border border-transparent text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                          : 'bg-white/5 text-gray-400 border border-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {cmd.title}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                            cmd.category === 'Actions'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : cmd.category === 'Administration'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {cmd.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 flex-shrink-0">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[10px]">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">↵</kbd>
              <span>Execute</span>
            </span>
          </div>
          <div className="text-gray-500 font-medium">
            CCP SOTA Modernization HUD
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
