import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, colorClass = "text-blue-400" }) => {
  return (
    <div className="glass-panel border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl p-6 transition-all hover:bg-white/10 hover:border-white/20 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-black/30 border border-white/5 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-shadow`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
        {trend && (
          <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trend.isPositive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
