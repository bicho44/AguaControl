
import React from 'react';

interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

const AppSelect: React.FC<AppSelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <select
        className={`w-full h-[46px] px-4 py-2.5 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all ${className}`}
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
