
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <article>
      {title && (
        <header>
          <strong>{title}</strong>
        </header>
      )}
      {children}
    </article>
  );
};

export default Card;
