import React from 'react';

interface DaisyCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const DaisyCard: React.FC<DaisyCardProps> = ({ title, children, className = "" }) => {
  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        {title && <h2 className="card-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default DaisyCard;
