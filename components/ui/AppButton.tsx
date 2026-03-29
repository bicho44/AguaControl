
import React from 'react';

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
  ...props 
}) => {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-error",
    success: "btn-success",
    ghost: "btn-ghost"
  };

  const sizes = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg"
  };

  return (
    <button 
      className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <span className="loading loading-spinner"></span> : null}
      {children}
    </button>
  );
};

export default AppButton;
