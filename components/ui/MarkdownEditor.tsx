
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AppButton from './AppButton';
import { Bold, Italic, List, ListOrdered, Link, Eye, Code, Type } from 'lucide-react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    collapsedLabel?: string;
    initialCollapsed?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    placeholder = 'Escribe aquí...',
    label = 'Observaciones',
    collapsedLabel = '+ Agregar observaciones (Markdown)',
    initialCollapsed = true
}) => {
    const [isCollapsed, setIsCollapsed] = useState(initialCollapsed && !value);
    const [isPreview, setIsPreview] = useState(false);

    const insertText = (before: string, after: string = '') => {
        const textarea = document.getElementById('md-editor-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
        
        onChange(newText);
        
        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    if (isCollapsed && !value) {
        return (
            <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:underline px-2 py-1"
            >
                {collapsedLabel}
            </button>
        );
    }

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsPreview(!isPreview)}
                        className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border transition-all ${
                            isPreview ? 'bg-primary-100 text-primary-700 border-primary-200' : 'text-gray-400 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        {isPreview ? 'Editar' : 'Vista Previa'}
                    </button>
                    {initialCollapsed && (
                        <button
                            type="button"
                            onClick={() => {
                                if (!value || window.confirm('¿Deseas ocultar y borrar las observaciones?')) {
                                    if (!value) setIsCollapsed(true);
                                    else {
                                        onChange('');
                                        setIsCollapsed(true);
                                    }
                                }
                            }}
                            className="text-[9px] font-black text-red-400 uppercase tracking-tighter hover:text-red-600"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>

            <div className="border dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                {!isPreview && (
                    <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700 overflow-x-auto no-scrollbar">
                        <ToolbarButton icon={<Bold size={14} />} onClick={() => insertText('**', '**')} title="Negrita" />
                        <ToolbarButton icon={<Italic size={14} />} onClick={() => insertText('_', '_')} title="Cursiva" />
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <ToolbarButton icon={<Type size={14} />} onClick={() => insertText('### ')} title="Título" />
                        <ToolbarButton icon={<List size={14} />} onClick={() => insertText('- ')} title="Lista" />
                        <ToolbarButton icon={<ListOrdered size={14} />} onClick={() => insertText('1. ')} title="Lista Numerada" />
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                        <ToolbarButton icon={<Link size={14} />} onClick={() => insertText('[', '](url)')} title="Link" />
                        <ToolbarButton icon={<Code size={14} />} onClick={() => insertText('`', '`')} title="Código" />
                    </div>
                )}

                <div className="relative">
                    {isPreview ? (
                        <div className="p-4 min-h-[120px] prose prose-sm dark:prose-invert max-w-none break-words overflow-auto markdown-body">
                            <ReactMarkdown>{value || '_Sin contenido para previsualizar_'}</ReactMarkdown>
                        </div>
                    ) : (
                        <textarea
                            id="md-editor-textarea"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            className="w-full min-h-[120px] p-4 bg-transparent outline-none resize-y text-sm font-medium text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        />
                    )}
                    <div className="absolute bottom-2 right-4 pointer-events-none opacity-20">
                        <Code size={12} />
                    </div>
                </div>
            </div>
            <p className="text-[8px] text-gray-400 px-2 italic">Soporta Markdown (negrita, listas, links)</p>
        </div>
    );
};

interface ToolbarButtonProps {
    icon: React.ReactNode;
    onClick: () => void;
    title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, onClick, title }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-md text-gray-500 hover:text-primary-600 transition-colors"
    >
        {icon}
    </button>
);

export default MarkdownEditor;
