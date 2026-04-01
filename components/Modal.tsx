
import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, footer, style }) => {
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
    <dialog open={isOpen} onClick={onClose}>
      <article 
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', ...style }}
      >
        <header>
          <button 
            aria-label="Close" 
            rel="prev" 
            onClick={onClose}
          ></button>
          {title && <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>{title}</h3>}
        </header>
        <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {children}
        </div>
        {footer && <footer>{footer}</footer>}
      </article>
    </dialog>
  );
};

export default Modal;
