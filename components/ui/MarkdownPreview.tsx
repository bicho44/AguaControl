
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownPreviewProps {
    value?: string;
    className?: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ value, className = "" }) => {
    if (!value) return null;

    return (
        <div className={`prose prose-xs dark:prose-invert max-w-none break-words markdown-body ${className}`}>
            <ReactMarkdown>{value}</ReactMarkdown>
        </div>
    );
};

export default MarkdownPreview;
