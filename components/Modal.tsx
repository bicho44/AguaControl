
import React, { useEffect } from 'react';

// Force sync

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, className, title }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Bloquear el scroll del body cuando el modal está abierto
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-sm p-0 sm:p-4 md:p-8 flex justify-center items-start"
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl p-4 sm:p-6 w-full relative transform transition-all animate-fade-in-up min-h-screen sm:min-h-0 sm:my-8 ${className || 'max-w-2xl'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Botón de cierre rápido */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-[70]"
          aria-label="Cerrar modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
};

export default Modal;
