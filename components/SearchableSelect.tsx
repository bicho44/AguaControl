
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface SearchableSelectProps {
  options: { value: string; label: string; }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Seleccionar...", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(selectedOption ? selectedOption.label : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedOption]);
  
  useEffect(() => {
    setSearchTerm(selectedOption ? selectedOption.label : '');
  }, [value, selectedOption]);

  const filteredOptions = useMemo(() => options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  ), [options, searchTerm]);

  useEffect(() => {
    if (isOpen) {
        setHighlightedIndex(-1);
    }
  }, [searchTerm, isOpen]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedItem = listRef.current.children[highlightedIndex] as HTMLLIElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    const selected = options.find(opt => opt.value === optionValue);
    setSearchTerm(selected ? selected.label : '');
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    if (!isOpen) setIsOpen(true);
    
    if (newSearchTerm === '') {
        onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case 'Enter':
        if (isOpen) {
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else if (filteredOptions.length === 1) {
            handleSelect(filteredOptions[0].value);
          } else {
            setIsOpen(false);
          }
        }
        // If dropdown is closed, let the form submit
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm(selectedOption ? selectedOption.label : '');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm(selectedOption ? selectedOption.label : '');
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full p-2 pr-8 bg-gray-200 dark:bg-gray-700 rounded-md appearance-none"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        />
        <div 
            className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer" 
            onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {isOpen && !disabled && (
        <ul 
            className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto" 
            ref={listRef}
            role="listbox"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  index === highlightedIndex ? 'bg-primary-100 dark:bg-primary-900' : ''
                } ${
                  option.value === value ? 'bg-primary-50 dark:bg-primary-900/50 font-semibold' : ''
                }`}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </li>
            ))
          ) : (
             <li className="px-4 py-2 text-gray-500">No se encontraron resultados</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;