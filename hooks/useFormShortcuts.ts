
import { useEffect } from 'react';

interface FormShortcutsProps {
  onSave: () => void;
  onCancel?: () => void;
  isDisabled?: boolean;
}

export const useFormShortcuts = ({ onSave, onCancel, isDisabled = false }: FormShortcutsProps) => {
  useEffect(() => {
    if (isDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + Enter para Confirmar/Guardar
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        onSave();
      }
      
      // Escape para Cancelar/Cerrar
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCancel, isDisabled]);
};
