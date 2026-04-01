
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
  type = 'button',
  ...props 
}) => {
  // Pico.css uses semantic classes or attributes
  let picoClass = '';
  if (variant === 'secondary') picoClass = 'secondary';
  if (variant === 'ghost') picoClass = 'outline secondary';
  if (variant === 'danger') picoClass = 'contrast'; // Using contrast for danger in Pico
  if (variant === 'success') picoClass = 'primary'; // Default is primary

  // Custom size handling since Pico is mostly fluid
  const sizeStyle = size === 'sm' ? { padding: '0.25rem 0.5rem', fontSize: '0.8rem' } : 
                    size === 'lg' ? { padding: '1rem 2rem', fontSize: '1.2rem' } : {};

  return (
    <button 
      type={type}
      className={`${picoClass} ${className}`}
      style={{ ...sizeStyle, ...props.style }}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading}
      {...props}
    >
      {!isLoading && children}
    </button>
  );
};

export default AppButton;
