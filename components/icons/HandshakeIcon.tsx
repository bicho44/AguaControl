import React from 'react';

export const HandshakeIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V19C19 17.8954 18.1046 17 17 17H7C5.89543 17 5 17.8954 5 19V21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14L9 11L12 8M15 11L12 14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.0001L5 7.00006" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.0001L19 7.00006" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4.5L12 6.5L10 4.5" />
    </svg>
);