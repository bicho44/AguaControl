
import React from 'react';

interface AppCardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const AppCard: React.FC<AppCardProps> = ({ title, children, footer, className = '' }) => {
  return (
    <article className={className}>
      {title && <header>{title}</header>}
      {children}
      {footer && <footer>{footer}</footer>}
    </article>
  );
};

export default AppCard;
