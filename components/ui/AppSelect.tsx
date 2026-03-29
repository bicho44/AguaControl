
import React from 'react';

interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

const AppSelect: React.FC<AppSelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="w-full form-control">
      {label && (
        <label className="label">
          <span className="label-text font-bold text-gray-700 dark:text-gray-300">{label}</span>
        </label>
      )}
      <select
        className={`select select-bordered w-full ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default AppSelect;
