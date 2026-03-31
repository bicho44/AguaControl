
import React from 'react';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'contrast' | 'outline';
  isLoading?: boolean;
}

const AppButton: React.FC<AppButtonProps> = ({ 
  children, 
  variant, 
  isLoading, 
  className = '', 
  type = 'button',
  ...props 
}) => {
  // Pico.css usa clases como 'secondary', 'contrast', 'outline' directamente en el botón
  const variantClass = variant ? (variant === 'primary' ? '' : variant) : '';
  
  return (
    <button 
      type={type}
      className={`${variantClass} ${className}`.trim()}
      aria-busy={isLoading}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default AppButton;
