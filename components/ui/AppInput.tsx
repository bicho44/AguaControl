
import React from 'react';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <input
        className={`w-full h-[46px] px-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
          error ? 'border-red-500 focus:ring-red-500' : ''
        } ${props.type === 'date' ? '[&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100' : ''} ${className}`}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error && <small className="text-red-500 text-[10px] font-bold ml-1">{error}</small>}
    </div>
  );
};

export default AppInput;
