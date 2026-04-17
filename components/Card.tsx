
import React from 'react';

// Force sync

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const Card: React.FC<CardProps> = ({ title, children, className = "", compact = false }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {title && (
        <div className={`border-b border-gray-200 dark:border-gray-700 ${compact ? 'p-2' : 'p-4'}`}>
          <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold text-gray-700 dark:text-gray-200`}>{title}</h2>
        </div>
      )}
      <div className={compact ? 'p-2' : 'p-4'}>
        {children}
      </div>
    </div>
  );
};

export default Card;
