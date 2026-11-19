import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative w-full ${maxWidth} max-h-[90vh] flex flex-col bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel`}>
        <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-70px)] custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
