
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
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Seleccionar...", disabled = false, label, autoFocus = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobileMode, setIsMobileMode] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLLIElement | null)[]>([]);

  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  useEffect(() => {
    const checkMobile = () => setIsMobileMode(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredOptions = useMemo(() => options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  ), [options, searchTerm]);

  // Reset highlighted index when search or open changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm, isOpen]);

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

  useEffect(() => {
    if (!isOpen) {
        setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [selectedOption, isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
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
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current[highlightedIndex]) {
      optionsRef.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const renderDesktopContent = () => (
    <div 
        className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl overflow-y-auto animate-fade-in" 
        style={dropdownStyle}
        onMouseDown={(e) => e.preventDefault()}
    >
      {filteredOptions.length > 0 ? (
        <ul className="py-1">
            {filteredOptions.map((option, idx) => (
            <li
                key={option.value}
                ref={el => optionsRef.current[idx] = el}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                idx === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                } ${
                option.value === value ? 'font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'
                }`}
            >
                {option.label}
            </li>
            ))}
        </ul>
      ) : (
         <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No hay resultados</div>
      )}
    </div>
  );

  const renderMobileContent = () => (
      <div className="fixed inset-0 z-[100] bg-gray-100 dark:bg-gray-900 flex flex-col animate-fade-in">
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="relative flex-1">
                  <input
                      ref={mobileInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Buscar..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full border-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                  </div>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
              {label && <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>}
              <div className="space-y-1">
                  {filteredOptions.length > 0 ? (
                      filteredOptions.map((option, idx) => (
                          <div
                              key={option.value}
                              onClick={() => handleSelect(option.value)}
                              className={`px-4 py-4 rounded-xl text-lg transition-all active:scale-[0.98] border ${
                                  option.value === value 
                                  ? 'bg-primary-600 text-white border-primary-600' 
                                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm'
                              } ${idx === highlightedIndex ? 'ring-2 ring-primary-400' : ''}`}
                          >
                              <p className="font-bold">{option.label}</p>
                          </div>
                      ))
                  ) : (
                      <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
                          <SearchIcon className="w-12 h-12 opacity-20" />
                          <p>No se encontraron resultados</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
  );

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
            ref={inputRef}
            type="text"
            className={`
                w-full px-4 py-2.5 pr-10
                text-gray-900 dark:text-white 
                bg-gray-50 dark:bg-gray-700/50 
                border border-gray-300 dark:border-gray-600 
                rounded-xl
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-800
                transition-all duration-200 outline-none
            `}
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
                if (!disabled) {
                    setIsOpen(true);
                    if (!isMobileMode && inputRef.current && searchTerm) {
                        inputRef.current.select();
                    }
                }
            }}
            onClick={() => {
                if (!disabled && !isOpen) setIsOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={isMobileMode}
            autoFocus={autoFocus}
        />
        
        {value && !disabled && (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setSearchTerm('');
                    inputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-8 flex items-center px-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                tabIndex={-1}
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
          isMobileMode ? renderMobileContent() : renderDesktopContent(), 
          document.body
      )}
      
      {isOpen && !isMobileMode && (
          <div 
            className="fixed inset-0 z-[9998] bg-transparent" 
            onClick={() => {
                setIsOpen(false);
                if (selectedOption) {
                    setSearchTerm(selectedOption.label);
                } else {
                    setSearchTerm('');
                }
            }}
          />
      )}
    </div>
  );
};

export default SearchableSelect;
