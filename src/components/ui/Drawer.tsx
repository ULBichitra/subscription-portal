import React from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, width }) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Drawer Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full ${width || 'max-w-md'} bg-gray-900/95 border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col glass-panel backdrop-blur-xl">
          <div className="px-6 py-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default Drawer;
