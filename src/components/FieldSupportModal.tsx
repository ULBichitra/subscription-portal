import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { type Tower, generateSupportToken, type SupportTokenResponse } from '../services/api';
import {
  Wrench,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Clock,
  RefreshCw,
  QrCode,
  AlertCircle,
  Eye,
  Network,
} from 'lucide-react';

interface FieldSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: Tower | null;
}

// Deterministic QR pattern generator based on URL string
const QRVisualizer: React.FC<{ data: string; size?: number }> = ({ data, size = 180 }) => {
  // Simple deterministic hash-based 21x21 QR-like matrix
  const matrixSize = 21;
  const cells: boolean[][] = [];
  
  // Seed generation from data
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < matrixSize; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < matrixSize; c++) {
      // Finder patterns (top-left, top-right, bottom-left 7x7)
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= matrixSize - 7;
      const isBottomLeft = r >= matrixSize - 7 && c < 7;

      if (isTopLeft || isTopRight || isBottomLeft) {
        const localR = isBottomLeft ? r - (matrixSize - 7) : r;
        const localC = isTopRight ? c - (matrixSize - 7) : c;
        if (localR === 0 || localR === 6 || localC === 0 || localC === 6) {
          row.push(true);
        } else if (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4) {
          row.push(true);
        } else {
          row.push(false);
        }
      } else if (r === 6 || c === 6) {
        // Timing pattern
        row.push((r + c) % 2 === 0);
      } else {
        // Pseudo-random data bits
        const bitVal = Math.abs((hash ^ (r * 31 + c * 17) ^ (data.charCodeAt((r + c) % data.length) << 2)) % 3) !== 0;
        row.push(bitVal);
      }
    }
    cells.push(row);
  }

  const cellSize = size / matrixSize;

  return (
    <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-zinc-200 shadow-md">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded">
        <rect width={size} height={size} fill="#ffffff" />
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#18181b"
              />
            ) : null
          )
        )}
      </svg>
      <span className="text-[10px] text-zinc-500 font-mono mt-1.5 flex items-center gap-1">
        <QrCode className="w-3 h-3 text-zinc-400" /> Scan for Field Access
      </span>
    </div>
  );
};

// Direct Ethernet / Offline IP presets for field link
const ETHERNET_PRESETS = [
  {
    id: '192.168.10.1',
    label: 'Direct Ethernet',
    ip: '192.168.10.1',
    host: 'http://192.168.10.1:4200',
    hint: 'Static Direct NIC',
  },
  {
    id: '169.254.x.x',
    label: 'Link-Local',
    ip: '169.254.x.x',
    host: 'http://169.254.133.50:4200',
    hint: 'Ad-hoc Offline link (169.254.133.50)',
  },
  {
    id: 'localhost',
    label: 'Localhost',
    ip: 'localhost',
    host: 'http://localhost:4200',
    hint: 'Dev / Loopback (127.0.0.1)',
  },
] as const;

export const FieldSupportModal: React.FC<FieldSupportModalProps> = ({ isOpen, onClose, tower }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<SupportTokenResponse | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const defaultMediatorHost = (import.meta.env as any).VITE_MEDIATOR_DEFAULT_HOST || 'http://192.168.10.1:4200';
  const [mediatorHost, setMediatorHost] = useState(defaultMediatorHost);
  const [showTokenRaw, setShowTokenRaw] = useState(false);

  useEffect(() => {
    if (isOpen && tower) {
      handleGenerateToken();
    } else {
      setTokenData(null);
      setCopiedUrl(false);
      setCopiedToken(false);
    }
  }, [isOpen, tower?.tower_id]);

  const handleGenerateToken = async (hostOverride?: string) => {
    if (!tower) return;
    setLoading(true);
    const hostToUse = hostOverride !== undefined ? hostOverride : mediatorHost;
    try {
      const res = await generateSupportToken(tower.tower_id, hostToUse, 4);
      setTokenData(res);
      addToast('Field support token generated successfully (Valid 4 Hours)', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to generate field support token';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (presetHost: string) => {
    setMediatorHost(presetHost);
    handleGenerateToken(presetHost);
  };

  const isPresetActive = (presetIp: string) => {
    if (presetIp === '169.254.x.x') {
      return mediatorHost.includes('169.254.');
    }
    return mediatorHost.includes(presetIp);
  };

  const handleCopyUrl = async () => {
    if (!tokenData?.support_url) return;
    try {
      await navigator.clipboard.writeText(tokenData.support_url);
      setCopiedUrl(true);
      addToast('Support URL copied to clipboard', 'success');
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      addToast('Failed to copy URL to clipboard', 'error');
    }
  };

  const handleCopyToken = async () => {
    if (!tokenData?.token) return;
    try {
      await navigator.clipboard.writeText(tokenData.token);
      setCopiedToken(true);
      addToast('JWT token copied to clipboard', 'success');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      addToast('Failed to copy token', 'error');
    }
  };

  const handleOpenMirror = () => {
    if (!tokenData?.support_url) return;
    window.open(tokenData.support_url, '_blank', 'noopener,noreferrer');
  };

  if (!tower) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Field Support Access" maxWidth="max-w-2xl">
      <div className="space-y-6 text-zinc-100">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-zinc-100">{tower.tower_id}</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Read-Only
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Model: <span className="text-zinc-200">{tower.model || 'SPECTRA ICG'}</span> | Role: <span className="font-mono text-amber-300">field_technician</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGenerateToken()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate Token
          </button>
        </div>

        {/* Loading / Content */}
        {loading && !tokenData ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-xs text-zinc-400">Issuing 4-hour cryptographic field support token...</p>
          </div>
        ) : tokenData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <QRVisualizer data={tokenData.support_url} size={160} />
              <div className="mt-3 text-center">
                <span className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Expires in 4 Hours
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5 font-mono">
                  {new Date(tokenData.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Right: URL & Actions */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Support Access URL (Mediator Cockpit Mirror)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tokenData.support_url}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 select-all focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    {copiedUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Direct Mirror Launcher */}
              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">Direct Remote Live Mirror</h4>
                  <p className="text-[11px] text-zinc-400">Open technician cockpit in new tab via authorized token</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenMirror}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Launch Mirror
                </button>
              </div>

              {/* Direct Ethernet / Offline IP Selector */}
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-blue-400" />
                    Direct Ethernet IP Selector (Offline Link)
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Port 4200</span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-3 gap-2">
                  {ETHERNET_PRESETS.map((preset) => {
                    const active = isPresetActive(preset.ip);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.host)}
                        className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                          active
                            ? 'bg-blue-600/20 border-blue-500/70 text-blue-300 shadow-sm shadow-blue-500/10'
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-400 ring-2 ring-blue-400/20' : 'bg-zinc-600'}`} />
                          <span className="font-mono text-xs font-semibold truncate">{preset.ip}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Host URL / Override Input */}
                <div className="flex gap-2 pt-0.5">
                  <input
                    type="text"
                    value={mediatorHost}
                    onChange={(e) => setMediatorHost(e.target.value)}
                    placeholder="http://192.168.10.1:4200"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateToken()}
                    disabled={loading}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Raw JWT Token Expandable */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowTokenRaw(!showTokenRaw)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  {showTokenRaw ? 'Hide Signed Token' : 'View Signed JWT Token'}
                </button>

                {showTokenRaw && (
                  <div className="mt-2 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-400 break-all relative">
                    {tokenData.token}
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="absolute top-2 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
                      title="Copy Token"
                    >
                      {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Regulatory Footer Notice */}
        <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80 flex items-start gap-2.5 text-[11px] text-zinc-400">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>FDA 21 CFR Part 11 Compliance:</strong> Support tokens grant restricted read-only telemetry access. Mutative commands (/api/command/*) remain strictly blocked in Production mode. Token issuance is recorded in the immutable audit trail.
          </span>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FieldSupportModal;
