
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
        className={`w-full px-4 py-2.5 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-500 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default AppInput;
