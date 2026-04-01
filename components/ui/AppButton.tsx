
import React, { useEffect, useRef } from 'react';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const AppButton: React.FC<AppButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  type = 'button', // Ahora por defecto es button, no submit
  ...props 
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determinar si es un botón de cancelar
  const isCancel = React.Children.toArray(children).some(
    child => typeof child === 'string' && (child.toLowerCase().includes('cancelar') || child.toLowerCase().includes('cerrar'))
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!buttonRef.current) return;
      if (props.disabled || isLoading) return;

      // Solo actuar si el botón es visible
      if (buttonRef.current.offsetParent === null) return;

      // Si hay un modal abierto, solo los botones dentro del último modal deberían reaccionar
      const modals = document.querySelectorAll('.fixed.inset-0.z-\\[60\\]');
      if (modals.length > 0) {
        const topModal = modals[modals.length - 1];
        if (!topModal.contains(buttonRef.current)) {
          return;
        }
      }

      // Submit: Alt + Enter
      if (type === 'submit' && e.altKey && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        buttonRef.current.click();
      }

      // Cancel: Esc
      if (isCancel && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        buttonRef.current.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [type, isCancel, props.disabled, isLoading]);

  const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-sm";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/20",
    secondary: "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-red-500/20",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-green-500/20",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-none"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs h-[32px]",
    md: "px-5 py-2.5 text-sm h-[46px]",
    lg: "px-8 py-4 text-base h-[56px]"
  };

  return (
    <button 
      ref={buttonRef}
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Cargando...
        </>
      ) : (
        <>
          {children}
          {type === 'submit' && !isCancel && (
            <span className="opacity-60 text-[10px] ml-1 font-normal hidden sm:inline">(Alt+Enter)</span>
          )}
          {isCancel && (
            <span className="opacity-60 text-[10px] ml-1 font-normal hidden sm:inline">(Esc)</span>
          )}
        </>
      )}
    </button>
  );
};

export default AppButton;
