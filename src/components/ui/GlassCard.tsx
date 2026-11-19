import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title, headerAction }) => {
  return (
    <div 
      className={`glass-panel border border-transparent backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)) padding-box, linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%) border-box'
      }}
    >
      {title && (
        <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-white/5 bg-black/10 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-3 sm:p-5">
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
