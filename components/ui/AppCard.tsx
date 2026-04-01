
import React from 'react';

interface AppCardProps {
  title?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const AppCard: React.FC<AppCardProps> = ({ 
  title, 
  headerAction,
  footer, 
  children, 
  style,
  className = ''
}) => {
  return (
    <article style={style} className={className}>
      {(title || headerAction) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {typeof title === 'string' ? <h6 style={{ margin: 0 }}>{title}</h6> : title}
          {headerAction}
        </header>
      )}
      {children}
      {footer && (
        <footer>
          {footer}
        </footer>
      )}
    </article>
  );
};

export default AppCard;
