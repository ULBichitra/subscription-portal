import React from 'react';

export interface BarChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  barColor?: string;
}

const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  height = 200,
  barColor = '#3b82f6' // blue-500
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const padding = 20;
  const chartHeight = height - (padding * 2);

  return (
    <div className="w-full relative group" style={{ height: `${height}px` }}>
      <div className="absolute inset-0 flex items-end justify-between px-2 pb-6">
        {data.map((item, i) => {
          const percentage = (item.value / maxValue) * 100;
          return (
            <div key={i} className="relative flex flex-col items-center flex-1 mx-1 group/bar">
              {/* Tooltip */}
              <div className="absolute -top-8 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-xl border border-white/10">
                {item.value} min
              </div>
              
              {/* Bar */}
              <div className="w-full max-w-[40px] bg-white/5 rounded-t-sm overflow-hidden flex items-end h-[160px]" style={{ height: `${chartHeight}px` }}>
                <div 
                  className="w-full rounded-t-sm transition-all duration-1000 ease-out"
                  style={{ 
                    height: `${percentage}%`,
                    backgroundColor: barColor,
                    boxShadow: `0 0 10px ${barColor}40`
                  }}
                />
              </div>
              
              {/* Label */}
              <div className="absolute -bottom-6 text-[10px] text-gray-500 truncate w-full text-center">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarChart;
