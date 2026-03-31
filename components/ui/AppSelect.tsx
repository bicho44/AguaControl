
import React from 'react';

interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

const AppSelect: React.FC<AppSelectProps> = ({ label, options, error, className = '', style, ...props }) => {
  const selectElement = (
    <select
      aria-invalid={error ? "true" : undefined}
      className={`bg-white ${className}`}
      style={{ backgroundColor: 'white', ...style }}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  if (label) {
    return (
      <label>
        {label}
        {selectElement}
        {error && <small style={{ color: 'var(--pico-error-color)' }}>{error}</small>}
      </label>
    );
  }

  return (
    <>
      {selectElement}
      {error && <small style={{ color: 'var(--pico-error-color)' }}>{error}</small>}
    </>
  );
};

export default AppSelect;
