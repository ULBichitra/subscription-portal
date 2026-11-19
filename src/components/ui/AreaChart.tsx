import React, { useMemo } from 'react';
import type { ChartData } from './LineChart';

interface AreaChartProps {
  data?: ChartData[];
  height?: number;
  color?: string; // hex color
  minDomain?: number;
  maxDomain?: number;
  yUnit?: string;
  formatY?: (val: number) => string;
  tickCount?: number;
}

const AreaChart: React.FC<AreaChartProps> = ({ 
  data = [], 
  height = 200, 
  color = '#10b981', // emerald-500
  minDomain,
  maxDomain,
  yUnit = '',
  formatY,
  tickCount = 4
}) => {
  const sanitized = useMemo(() => {
    if (!data || !data.length) return [];
    return data.map(d => ({
      ...d,
      value: Number.isFinite(Number(d?.value)) ? Number(d.value) : 0
    }));
  }, [data]);

  const { effectiveMin, effectiveMax, ticks } = useMemo(() => {
    if (!sanitized.length) {
      const min = minDomain ?? 0;
      const max = maxDomain ?? 10;
      return { effectiveMin: min, effectiveMax: max, ticks: [] };
    }
    const vals = sanitized.map(d => d.value);
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);

    let min = minDomain !== undefined ? minDomain : (dataMin < 0 ? dataMin : 0);
    let max = maxDomain !== undefined ? maxDomain : (dataMax === min ? min + 1 : dataMax);
    if (min === max) {
      max = min + 1;
    }
    const range = max - min || 1;

    const count = Math.max(2, tickCount);
    const tickList: { value: number; yPercent: number; label: string }[] = [];

    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const val = min + ratio * range;
      const yPercent = 100 - (ratio * 100);
      let formatted = '';
      if (formatY) {
        formatted = formatY(val);
      } else if (yUnit === '₹') {
        formatted = `₹${Math.round(val).toLocaleString('en-IN')}`;
      } else if (yUnit) {
        formatted = `${Math.round(val * 10) / 10}${yUnit}`;
      } else {
        formatted = Number.isInteger(val) ? val.toString() : val.toFixed(1);
      }
      tickList.push({ value: val, yPercent, label: formatted });
    }

    return { effectiveMin: min, effectiveMax: max, ticks: tickList };
  }, [sanitized, minDomain, maxDomain, tickCount, formatY, yUnit]);

  const { pathPoints, areaPoints } = useMemo(() => {
    if (!sanitized.length) return { pathPoints: '', areaPoints: '' };
    const range = effectiveMax - effectiveMin || 1;

    if (sanitized.length === 1) {
      const y = 100 - (((sanitized[0].value - effectiveMin) / range) * 100);
      const safeY = Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 100;
      return {
        pathPoints: `0,${safeY} 100,${safeY}`,
        areaPoints: `0,${safeY} 100,${safeY} 100,100 0,100`
      };
    }

    const width = 100;
    const stepX = width / (sanitized.length - 1);
    
    const p = sanitized.map((d, i) => {
      const x = i * stepX;
      const y = 100 - (((d.value - effectiveMin) / range) * 100);
      const safeX = Number.isFinite(x) ? x : 0;
      const safeY = Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 100;
      return `${safeX},${safeY}`;
    }).join(' ');

    return {
      pathPoints: p,
      areaPoints: `${p} 100,100 0,100`
    };
  }, [sanitized, effectiveMin, effectiveMax]);

  return (
    <div className="w-full relative flex flex-col" style={{ height: `${height}px` }}>
      <div className="flex-1 relative w-full h-full flex">
        {/* Calibrated Y-Axis Labels */}
        <div className="w-10 sm:w-12 h-[calc(100%-24px)] relative flex-shrink-0 select-none pointer-events-none pr-1.5">
          {ticks.map((t, idx) => (
            <div
              key={idx}
              className="absolute right-1 text-[9px] font-mono text-gray-400 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${t.yPercent}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Chart Drawing Area */}
        <div className="flex-1 relative h-[calc(100%-24px)]">
          {sanitized.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">No data available</div>
          ) : (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`areaGradient-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Horizontal Grid lines aligned with ticks */}
              {ticks.map((t, idx) => (
                <line
                  key={idx}
                  x1="0"
                  y1={t.yPercent}
                  x2="100"
                  y2={t.yPercent}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.5"
                  strokeDasharray={idx > 0 && idx < ticks.length - 1 ? '2,2' : undefined}
                />
              ))}
              
              {/* Area Fill */}
              <polygon
                fill={`url(#areaGradient-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
                points={areaPoints}
                className="animate-in fade-in duration-700"
              />
              
              {/* The Line */}
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pathPoints}
                className="animate-in fade-in duration-700 delay-150"
              />
            </svg>
          )}

          {/* X-Axis Labels */}
          <div className="absolute top-[100%] pt-1 w-full flex justify-between px-0.5 text-[9px] text-gray-400">
            {sanitized.map((d, i) => {
              if (sanitized.length > 10 && i % Math.ceil(sanitized.length / 6) !== 0 && i !== sanitized.length - 1) {
                return <span key={i} className="opacity-0 w-0">{d.label}</span>;
              }
              return <span key={i} className="truncate max-w-[48px] text-center font-mono">{d.label}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaChart;
