import React from 'react';

interface ProgressGaugeProps {
  used: number;
  total: number; // If total is null or 0, we can treat it as unlimited
  size?: number;
  strokeWidth?: number;
}

const ProgressGauge: React.FC<ProgressGaugeProps> = ({ 
  used, 
  total, 
  size = 120, 
  strokeWidth = 12 
}) => {
  const isUnlimited = total === 0 || total === null;
  const percentage = isUnlimited ? 0 : Math.min(Math.max(used / total, 0), 1);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = isUnlimited ? 0 : circumference - (percentage * circumference);

  // Determine color based on usage severity
  let colorClass = 'text-blue-500'; // Default / low usage
  if (!isUnlimited) {
    if (percentage > 0.9) colorClass = 'text-red-500';
    else if (percentage > 0.75) colorClass = 'text-yellow-500';
    else colorClass = 'text-green-500';
  } else {
    colorClass = 'text-emerald-500';
  }

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/5"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-1000 ease-out`}
        />
      </svg>
      
      {/* Inner Text */}
      <div className="absolute flex flex-col items-center justify-center inset-0">
        {isUnlimited ? (
          <>
            <span className="text-3xl font-light text-white">∞</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Unlimited</span>
          </>
        ) : (
          <>
            <span className="text-xl font-bold text-white">{Math.round(percentage * 100)}%</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Used</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ProgressGauge;
