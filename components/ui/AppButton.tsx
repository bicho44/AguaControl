import React from 'react';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const AppButton: React.FC<AppButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  type = 'button',
  ...props 
}) => {
  // Mapeo de variantes a clases nativas de Pico.css
  const variantClasses = {
    primary: "",
    secondary: "secondary",
    danger: "contrast", // Pico usa contrast para acciones de alto impacto
    success: "success", 
    outline: "outline"
  };

  return (
    <button 
      type={type}
      className={`${variantClasses[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading}
      {...props}
    >
      {!isLoading && children}
    </button>
  );
};

export default AppButton;