
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SearchIcon } from './icons/SearchIcon';

interface SearchableSelectProps {
  options: { value: string; label: string; }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  autoFocus?: boolean;
  disableSort?: boolean; // Nueva prop para controlar el ordenamiento
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    placeholder = "Seleccionar...", 
    disabled = false, 
    label, 
    autoFocus = false,
    disableSort = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobileMode, setIsMobileMode] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLLIElement | null)[]>([]);

  // Ordenar opciones alfabéticamente por defecto
  const processedOptions = useMemo(() => {
      if (disableSort) return options;
      // Creamos una copia para no mutar el array original y ordenamos
      return [...options].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [options, disableSort]);

  // Buscamos la opción seleccionada cada vez que cambian las opciones o el valor
  const selectedOption = useMemo(() => processedOptions.find(option => option.value === value), [processedOptions, value]);

  // EL VALOR MOSTRADO: Si el usuario está escribiendo, mostramos lo que escribe.
  // Si no, mostramos el label EXACTO que viene de la base de datos.
  const displayValue = isTyping ? searchTerm : (selectedOption ? selectedOption.label : '');

  useEffect(() => {
    const checkMobile = () => setIsMobileMode(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const filteredOptions = useMemo(() => {
    const query = isTyping ? searchTerm.toLowerCase() : '';
    return processedOptions.filter(option =>
      option.label.toLowerCase().includes(query)
    );
  }, [processedOptions, searchTerm, isTyping]);

  const updateDropdownPosition = useCallback(() => {
    if (!isOpen || isMobileMode || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 300;
    const openUpwards = spaceBelow < 200 && spaceAbove > spaceBelow;

    setDropdownStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        top: openUpwards ? 'auto' : `${rect.bottom + 4}px`,
        bottom: openUpwards ? `${window.innerHeight - rect.top + 4}px` : 'auto',
        maxHeight: `${dropdownHeight}px`,
        zIndex: 9999,
    });
  }, [isOpen, isMobileMode]);

  useEffect(() => {
    if (isOpen) {
        updateDropdownPosition();
        window.addEventListener('scroll', updateDropdownPosition, true);
        window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setIsTyping(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (!isTyping && !value) {
            setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setIsTyping(false);
        break;
      case 'Tab':
        setIsOpen(false);
        setIsTyping(false);
        break;
    }
  };

  return (
    <div className="form-control w-full relative" ref={wrapperRef}>
      {label && (
        <label className="label">
          <span className="label-text font-bold">{label}</span>
        </label>
      )}
      <div className="relative">
        <input
            ref={inputRef}
            type="text"
            className="input input-bordered w-full pr-10"
            value={displayValue}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsTyping(true);
                if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
                if (!disabled) {
                    setIsOpen(true);
                    if (!isMobileMode && inputRef.current) inputRef.current.select();
                }
            }}
            onClick={() => { if (!disabled && !isOpen) setIsOpen(true); }}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={isMobileMode}
        />
        
        {value && !disabled && (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setSearchTerm('');
                    setIsTyping(false);
                    inputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-8 flex items-center px-1 text-gray-400 hover:text-gray-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </button>
        )}

        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
          <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && !disabled && createPortal(
          isMobileMode ? (
            <div className="fixed inset-0 z-[100] bg-base-100 flex flex-col animate-fade-in">
                <div className="bg-base-200 px-4 py-3 border-b border-base-300 flex items-center gap-3">
                    <button type="button" onClick={() => setIsOpen(false)} className="btn btn-ghost btn-circle"><ChevronDownIcon className="rotate-90 w-6 h-6"/></button>
                    <input
                        ref={mobileInputRef}
                        type="text"
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => {setSearchTerm(e.target.value); setIsTyping(true);}}
                        placeholder="Buscar..."
                        className="input input-bordered flex-1"
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredOptions.map((opt) => (
                        <div key={opt.value} onClick={() => handleSelect(opt.value)} className={`p-4 mb-2 rounded-xl border ${opt.value === value ? 'bg-primary text-primary-content' : 'bg-base-100'}`}>
                            <p className="font-bold">{opt.label}</p>
                        </div>
                    ))}
                </div>
            </div>
          ) : (
            <ul className="menu bg-base-100 rounded-box shadow-2xl border border-base-300" style={dropdownStyle}>
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                    <li key={opt.value} onClick={() => handleSelect(opt.value)} onMouseEnter={() => setHighlightedIndex(idx)} className={idx === highlightedIndex ? 'bg-base-200' : ''}>
                        <a className={opt.value === value ? 'font-bold bg-primary text-primary-content' : ''}>
                            {opt.label}
                        </a>
                    </li>
                )) : <li className="px-4 py-3 text-gray-400 text-center">Sin resultados</li>}
            </ul>
          ), 
          document.body
      )}
      
      {isOpen && !isMobileMode && (
          <div className="fixed inset-0 z-[9998] bg-transparent" onClick={() => { setIsOpen(false); setIsTyping(false); }} />
      )}
    </div>
  );
};

export default SearchableSelect;
