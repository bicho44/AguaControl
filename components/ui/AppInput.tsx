
import React from 'react';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2.5 
          bg-gray-50 dark:bg-gray-700/50 
          border border-gray-300 dark:border-gray-600 
          rounded-xl 
          text-gray-900 dark:text-white 
          placeholder-gray-400 dark:placeholder-gray-500
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          transition-all duration-200 outline-none
          disabled:opacity-50 disabled:bg-gray-200 dark:disabled:bg-gray-800
          ${error ? 'border-red-500 ring-1 ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 ml-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};

export default AppInput;
