
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}

const Card: React.FC<CardProps> = ({ title, children, compact }) => {
  return (
    <div className={`card bg-white dark:bg-gray-800 shadow-md ${compact ? 'card-compact' : ''}`}>
      <div className="card-body p-4">
        {title && (
          <h2 className="card-title text-xl font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
};

export default Card;
