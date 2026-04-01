
import React from 'react';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, className = '', style, ...props }) => {
  const inputElement = (
    <input
      aria-invalid={error ? "true" : undefined}
      className={`bg-white ${className}`}
      style={{ backgroundColor: 'white', ...style }} // Refuerzo de fondo blanco solicitado
      {...props}
    />
  );

  if (label) {
    return (
      <label>
        {label}
        {inputElement}
        {error && <small style={{ color: 'var(--pico-error-color)' }}>{error}</small>}
      </label>
    );
  }

  return (
    <>
      {inputElement}
      {error && <small style={{ color: 'var(--pico-error-color)' }}>{error}</small>}
    </>
  );
};

export default AppInput;
