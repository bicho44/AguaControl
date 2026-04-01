
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
    <div style={{ width: '100%', position: 'relative' }} ref={wrapperRef}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.375rem', marginLeft: '0.25rem' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
            ref={inputRef}
            type="text"
            style={{ 
                width: '100%', 
                padding: '0.625rem 2.5rem 0.625rem 1rem', 
                margin: 0,
                backgroundColor: 'var(--pico-form-element-background-color)',
                borderColor: 'var(--pico-form-element-border-color)',
                borderRadius: '0.75rem',
                transition: 'all 0.2s ease'
            }}
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
                className="outline"
                style={{ 
                    position: 'absolute', 
                    inset: '0 2rem 0 auto', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0 0.25rem', 
                    color: 'var(--pico-muted-color)',
                    border: 'none',
                    background: 'transparent',
                    width: 'auto',
                    margin: 0
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1rem', width: '1rem' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </button>
        )}

        <div style={{ position: 'absolute', inset: '0 0 0 auto', display: 'flex', alignItems: 'center', padding: '0 0.75rem', pointerEvents: 'none' }}>
          <ChevronDownIcon style={{ height: '1.25rem', width: '1.25rem', color: 'var(--pico-muted-color)', transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>

      {isOpen && !disabled && createPortal(
          isMobileMode ? (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'var(--pico-background-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: 'var(--pico-card-background-color)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--pico-muted-border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setIsOpen(false)} className="outline" style={{ padding: '0.5rem', color: 'var(--pico-muted-color)', border: 'none', width: 'auto', margin: 0 }}><ChevronDownIcon style={{ transform: 'rotate(90deg)', width: '1.5rem', height: '1.5rem' }}/></button>
                    <input
                        ref={mobileInputRef}
                        type="text"
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => {setSearchTerm(e.target.value); setIsTyping(true);}}
                        placeholder="Buscar..."
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--pico-form-element-background-color)', borderRadius: '0.5rem', fontSize: '1.125rem', border: 'none', margin: 0 }}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {filteredOptions.map((opt) => (
                        <div key={opt.value} onClick={() => handleSelect(opt.value)} style={{ 
                            padding: '1rem', 
                            marginBottom: '0.5rem', 
                            borderRadius: '0.75rem', 
                            border: '1px solid var(--pico-muted-border-color)',
                            backgroundColor: opt.value === value ? 'var(--pico-primary-background)' : 'var(--pico-card-background-color)',
                            color: opt.value === value ? 'var(--pico-primary-inverse)' : 'inherit'
                        }}>
                            <p style={{ fontWeight: 'bold', margin: 0 }}>{opt.label}</p>
                        </div>
                    ))}
                </div>
            </div>
          ) : (
            <div style={{ 
                ...dropdownStyle,
                backgroundColor: 'var(--pico-card-background-color)', 
                border: '1px solid var(--pico-muted-border-color)', 
                borderRadius: '0.5rem', 
                boxShadow: 'var(--pico-card-box-shadow)', 
                overflowY: 'auto' 
            }}>
                <ul style={{ padding: '0.25rem 0', margin: 0, listStyle: 'none' }}>
                    {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                        <li 
                            key={opt.value} 
                            onClick={() => handleSelect(opt.value)} 
                            onMouseEnter={() => setHighlightedIndex(idx)} 
                            style={{ 
                                px: '1rem', 
                                padding: '0.625rem 1rem', 
                                cursor: 'pointer', 
                                fontSize: '0.875rem',
                                backgroundColor: idx === highlightedIndex ? 'rgba(var(--pico-primary-rgb), 0.1)' : 'transparent',
                                fontWeight: opt.value === value ? 'bold' : 'normal',
                                color: opt.value === value ? 'var(--pico-primary)' : 'inherit'
                            }}
                        >
                            {opt.label}
                        </li>
                    )) : <li style={{ padding: '0.75rem 1rem', color: 'var(--pico-muted-color)', textAlign: 'center' }}>Sin resultados</li>}
                </ul>
            </div>
          ), 
          document.body
      )}
      
      {isOpen && !isMobileMode && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'transparent' }} onClick={() => { setIsOpen(false); setIsTyping(false); }} />
      )}
    </div>
  );
};

export default SearchableSelect;
