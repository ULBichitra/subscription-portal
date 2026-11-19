import React, { useMemo, useEffect, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface StatusDonutChartProps {
  data: DataPoint[];
  size?: number;
  strokeWidth?: number;
}

const StatusDonutChart: React.FC<StatusDonutChartProps> = ({ 
  data, 
  size = 160, 
  strokeWidth = 20 
}) => {
  const [animated, setAnimated] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  let currentOffset = 0;
  const arcs = data.map((item) => {
    const percentage = total > 0 ? item.value / total : 0;
    
    // We want the dashoffset to be negative to draw the arc correctly from the current position
    // For a circle, starting at top (-90deg), dashoffset shifts the starting point.
    // Actually, drawing segments requires dasharray to be "arcLength gapLength"
    const arcLength = percentage * circumference;
    const gapLength = circumference - arcLength;
    
    const arcDasharray = `${arcLength} ${gapLength}`;
    const arcDashoffset = -currentOffset;
    
    currentOffset += arcLength;
    
    return {
      ...item,
      percentage,
      arcDasharray,
      arcDashoffset,
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 p-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background Ring */}
          <circle
            className="text-white/5"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Data Arcs */}
          {arcs.map((arc, i) => (
            <circle
              key={i}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={arc.arcDasharray}
              strokeDashoffset={animated ? arc.arcDashoffset : circumference}
              className="transition-all duration-1000 ease-out"
              strokeLinecap={arc.value === total && total > 0 ? "round" : "butt"} // Only round if it's a full circle
              fill="transparent"
              r={radius}
              cx={size / 2}
              cy={size / 2}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold text-white">{total}</span>
          <span className="text-xs text-gray-400 font-medium">Total</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-col gap-3 min-w-[120px]">
        {data.map((item, i) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium text-gray-300">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{item.value}</span>
                <span className="text-xs text-gray-500 w-8 text-right">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusDonutChart;
