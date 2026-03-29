
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}

const Card: React.FC<CardProps> = ({ title, children, compact }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 ${compact ? 'p-3' : 'p-6'}`}>
      {title && (
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
};

export default Card;
