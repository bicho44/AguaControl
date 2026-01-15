import React from 'react';

export const ReceiptIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4m6-4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293h4.172a1 1 0 00.707-.293l1.414-1.414A1 1 0 0116.414 4H18a2 2 0 012 2z" />
    </svg>
);
