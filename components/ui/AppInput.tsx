
import React from 'react';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <label className={className}>
      {label}
      <input
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error && <small style={{ color: 'var(--pico-error-color)' }}>{error}</small>}
    </label>
  );
};

export default AppInput;
