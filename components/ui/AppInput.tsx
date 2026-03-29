
import React from 'react';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AppInput: React.FC<AppInputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <label className="form-control w-full">
      {label && (
        <div className="label">
          <span className="label-text font-bold">{label}</span>
        </div>
      )}
      <input
        className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className}`}
        {...props}
      />
      {error && (
        <div className="label">
          <span className="label-text-alt text-error">{error}</span>
        </div>
      )}
    </label>
  );
};

export default AppInput;
