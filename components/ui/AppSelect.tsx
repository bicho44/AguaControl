
import React from 'react';

interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

const AppSelect: React.FC<AppSelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <label className="form-control w-full">
      {label && (
        <div className="label">
          <span className="label-text font-bold">{label}</span>
        </div>
      )}
      <select
        className={`select select-bordered w-full ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
};

export default AppSelect;
