import React, { useEffect, useState } from 'react';

interface BalanceGaugeProps {
  remainingMin: number | null;
  totalMin?: number | null;
  size?: number;
  strokeWidth?: number;
  displayText?: string;
  subText?: string;
  isPulse?: boolean;
}

const BalanceGauge: React.FC<BalanceGaugeProps> = ({ 
  remainingMin, 
  totalMin = 1000, 
  size = 120, 
  strokeWidth = 10,
  displayText,
  subText = 'min',
  isPulse = false
}) => {
  const [offset, setOffset] = useState(0);

  // Fallback for null balance
  const isInfinite = remainingMin === null;
  const safeRemaining = Number.isFinite(Number(remainingMin)) ? Math.max(0, Number(remainingMin)) : 0;
  const safeTotalCandidate = Number.isFinite(Number(totalMin)) ? Math.max(1, Number(totalMin)) : 1000;
  const displayTotal = Math.max(safeTotalCandidate, safeRemaining, 1);

  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = radius * 2 * Math.PI;

  const percentage = isInfinite ? 100 : Math.min(100, Math.max(0, (safeRemaining / displayTotal) * 100));

  useEffect(() => {
    const progressOffset = circumference - (percentage / 100) * circumference;
    const timeout = setTimeout(() => {
      setOffset(Number.isFinite(progressOffset) ? progressOffset : 0);
    }, 100);
    return () => clearTimeout(timeout);
  }, [percentage, circumference]);

  let colorClass = "text-emerald-400";
  if (!isInfinite) {
    if (percentage <= 5) colorClass = "text-red-500";
    else if (percentage <= 20) colorClass = "text-amber-400";
  }

  return (
    <div className={`flex flex-col items-center justify-center relative ${isPulse ? 'animate-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-white/10"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={Number.isFinite(offset) ? offset : 0}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center px-1">
        {displayText !== undefined ? (
          <>
            <span className="text-base font-bold text-white font-mono leading-tight">{displayText}</span>
            {subText && <span className="text-[10px] text-gray-400 uppercase tracking-wider">{subText}</span>}
          </>
        ) : isInfinite ? (
          <span className="text-2xl font-bold text-white">∞</span>
        ) : (
          <>
            <span className="text-xl font-bold text-white font-mono">{safeRemaining}</span>
            <span className="text-xs text-gray-400">{subText}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default BalanceGauge;
