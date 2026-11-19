import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import FieldSupportModal from '../components/FieldSupportModal';
import { useToast } from '../components/ui/ToastProvider';
import {
  type Tower,
  getTowers
} from '../services/api';
import {
  Server,
  ArrowLeft,
  Wrench,
  ShieldCheck,
  Zap,
  Activity,
  Flame,
  FileText,
  AlertTriangle,
  QrCode
} from 'lucide-react';

export const TowerDetail: React.FC<{ towerId?: string }> = ({ towerId: propTowerId }) => {
  const { towerId: routeTowerId } = useParams<{ towerId: string }>();
  const towerId = propTowerId || routeTowerId;
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [tower, setTower] = useState<Tower | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    if (towerId) {
      loadTower();
    }
  }, [towerId]);

  const loadTower = async () => {
    setLoading(true);
    try {
      const towers = await getTowers();
      const match = towers.find(t => t.tower_id === towerId);
      if (match) {
        setTower(match);
      } else {
        addToast(`Tower ${towerId} not found`, 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to load tower details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <Server className="w-5 h-5 animate-pulse text-blue-400" />
          <span>Loading tower details...</span>
        </div>
      </div>
    );
  }

  if (!tower) {
    return (
      <div className="p-6 space-y-6">
        <button
          onClick={() => navigate('/towers')}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Towers
        </button>
        <GlassCard className="p-8 text-center text-zinc-400">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-200 mb-1">Tower Not Found</h3>
          <p className="text-xs">No tower was found matching identifier {towerId}.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/towers')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Towers
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-100 font-mono tracking-tight">{tower.tower_id}</h1>
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${
                tower.is_online
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tower.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              {tower.is_online ? 'LIVE / ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Model: <span className="text-zinc-200">{tower.model || 'SPECTRA ICG'}</span> | S/N: <span className="font-mono text-zinc-300">{tower.serial_number || 'N/A'}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            Field Support Access
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Live Balance</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {Math.floor((tower.live_balance_sec || 0) / 3600)}h {Math.floor(((tower.live_balance_sec || 0) % 3600) / 60)}m
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Plan: {tower.agreement_type || 'POSTPAID'}</span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Thermal Core</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {tower.die_temp_c ? `${tower.die_temp_c.toFixed(1)}°C` : 'NOMINAL'}
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">SoC Die Sensor</span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Hub State</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {tower.hub_state || 'READY'}
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Kiosk Interface</span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Total Surgeries</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {tower.total_surgeries || 0}
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">FDA Tracked Procedures</span>
        </GlassCard>
      </div>

      {/* Field Support Quick Action Banner */}
      <GlassCard className="p-5 border-amber-500/20 bg-amber-500/[0.03]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Field Support Remote Mirror</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate signed read-only session tokens for on-site biomedical engineers and technicians.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Generate Support Token & QR
          </button>
        </div>
      </GlassCard>

      {/* Support Modal */}
      <FieldSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        tower={tower}
      />
    </div>
  );
};

export default TowerDetail;
