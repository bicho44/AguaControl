
import React, { InputHTMLAttributes } from 'react';

interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, helperText, className = '', id, ...props }) => {
  const inputId = id || props.name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-4 py-2.5 
          text-gray-900 dark:text-white 
          bg-gray-50 dark:bg-gray-700/50 
          border border-gray-300 dark:border-gray-600 
          rounded-lg 
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none
          disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
          transition-colors duration-200
          placeholder-gray-400 dark:placeholder-gray-500
          text-base
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
        {...props}
      />
      {helperText && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-1">{helperText}</p>}
      {error && <p className="mt-1 text-xs text-red-600 font-medium ml-1">{error}</p>}
    </div>
  );
};

export default AppInput;
