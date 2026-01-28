
import React, { SelectHTMLAttributes } from 'react';

interface AppSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  error?: string;
}

const AppSelect: React.FC<AppSelectProps> = ({ label, options, placeholder, error, className = '', id, ...props }) => {
  const selectId = id || props.name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`
            w-full px-4 py-2.5 
            text-gray-900 dark:text-white 
            bg-gray-50 dark:bg-gray-700/50 
            border border-gray-300 dark:border-gray-600 
            rounded-lg 
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
            disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            appearance-none
            transition-colors duration-200
            text-base md:text-sm
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
          `}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom Arrow Icon */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 font-medium ml-1">{error}</p>}
    </div>
  );
};

export default AppSelect;
