
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface SearchableSelectProps {
  options: { value: string; label: string; }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Seleccionar...", disabled = false, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  // Actualizar coordenadas cuando se abre
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Verificar click en el wrapper O en la lista (que ahora vive en el body)
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target as Node) &&
        listRef.current && !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm(selectedOption ? selectedOption.label : '');
      }
    }
    
    // Cerrar al hacer scroll para evitar que el dropdown quede "flotando" desalineado
    function handleScroll() {
        if(isOpen) setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // true para capturar scroll de contenedores internos
    window.addEventListener("resize", handleScroll);

    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleScroll);
    };
  }, [wrapperRef, selectedOption, isOpen]);
  
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

  // Renderizamos el dropdown usando un Portal para que "salga" de cualquier contenedor con overflow:hidden
  const dropdownContent = (
    <ul 
        ref={listRef}
        className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-2xl max-h-60 overflow-y-auto" 
        style={{ 
            top: coords.top + 4, 
            left: coords.left, 
            width: coords.width,
            // En móbile, aseguramos que no se salga de la pantalla
            maxWidth: '100vw'
        }}
        role="listbox"
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map((option, index) => (
          <li
            key={option.value}
            onClick={() => handleSelect(option.value)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={`px-4 py-3 cursor-pointer text-sm border-b dark:border-gray-700 last:border-0 ${
              index === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100' : 'text-gray-700 dark:text-gray-200'
            } ${
              option.value === value ? 'font-bold bg-primary-100 dark:bg-primary-900/50' : ''
            }`}
            role="option"
            aria-selected={option.value === value}
          >
            {option.label}
          </li>
        ))
      ) : (
         <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No se encontraron resultados</li>
      )}
    </ul>
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
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 pr-8
            text-gray-900 dark:text-white 
            bg-gray-50 dark:bg-gray-700/50 
            border border-gray-300 dark:border-gray-600 
            rounded-lg 
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
            disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            appearance-none
            transition-colors duration-200
            text-base md:text-sm
            ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          autoComplete="off" // Previene autocompletado del navegador que tapa la lista
        />
        <div 
            className="absolute inset-y-0 right-0 flex items-center px-3 cursor-pointer pointer-events-none" 
        >
          <ChevronDownIcon className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {/* El Portal renderiza el menú en el body */}
      {isOpen && !disabled && createPortal(dropdownContent, document.body)}
    </div>
  );
};

export default SearchableSelect;
