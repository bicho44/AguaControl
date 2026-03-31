
import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialogRef.current?.close();
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog 
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      style={{ padding: 0, border: 'none', borderRadius: 'var(--pico-border-radius)', maxWidth: '90vw', width: '1000px' }}
    >
      <article style={{ margin: 0, width: '100%' }}>
        <header>
          <button 
            aria-label="Close" 
            rel="prev" 
            onClick={onClose}
            style={{ float: 'right', padding: '0.5rem', margin: 0, background: 'none', border: 'none', color: 'var(--pico-muted-color)' }}
          >
          </button>
          <strong style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.5 }}>Formulario</strong>
        </header>
        {children}
      </article>
    </dialog>
  );
};

export default Modal;
