
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
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Seleccionar...", disabled = false, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobileMode, setIsMobileMode] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  // Detectar modo (Móvil/Tablet/Touch vs Desktop)
  useEffect(() => {
    const checkMode = () => {
        // Regla simple y estricta: Menos de 1024px es móvil/tablet -> Modal Full Screen
        setIsMobileMode(window.innerWidth < 1024);
    };
    checkMode();
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  // Posicionamiento para Desktop
  const updateDesktopPosition = useCallback(() => {
    if (!isOpen || isMobileMode || !wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const dropdownMaxHeight = 300; 

    const openUpwards = spaceBelow < dropdownMaxHeight && rect.top > spaceBelow;

    setDropdownStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        top: openUpwards ? 'auto' : `${rect.bottom + 5}px`,
        bottom: openUpwards ? `${viewportHeight - rect.top + 5}px` : 'auto',
        zIndex: 999999, // Z-Index máximo para superar cualquier frame
    });
  }, [isOpen, isMobileMode]);

  useEffect(() => {
    if (isOpen && !isMobileMode) {
        updateDesktopPosition();
        window.addEventListener('scroll', updateDesktopPosition, true);
        window.addEventListener('resize', updateDesktopPosition);
    }
    return () => {
        window.removeEventListener('scroll', updateDesktopPosition, true);
        window.removeEventListener('resize', updateDesktopPosition);
    };
  }, [isOpen, isMobileMode, updateDesktopPosition]);

  // Sincronizar término de búsqueda
  useEffect(() => {
    if (!isOpen) {
        setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [value, selectedOption, isOpen]);

  // Auto-focus en móvil
  useEffect(() => {
      if (isOpen && isMobileMode) {
          setTimeout(() => mobileInputRef.current?.focus(), 50);
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [isOpen, isMobileMode]);

  const filteredOptions = useMemo(() => options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  ), [options, searchTerm]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm(''); 
  };

  // --- RENDERIZADO DEL PORTAL ---

  // 1. Contenido Desktop (Dropdown Flotante)
  const renderDesktopContent = () => (
    <div 
        className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl animate-fade-in flex flex-col" 
        style={dropdownStyle}
    >
      {/* Contenedor con scroll, quitado el overflow del UL como pedido */}
      <div className="overflow-y-auto max-h-[300px]">
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
                {filteredOptions.map((option) => (
                <li
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-4 py-2.5 cursor-pointer text-sm border-b dark:border-gray-700 last:border-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
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
    </div>
  );

  // 2. Contenido Móvil (Modal Full Screen) - SIEMPRE visible completamente
  const renderMobileContent = () => (
      <div className="fixed inset-0 z-[999999] bg-gray-100 dark:bg-gray-900 flex flex-col animate-fade-in">
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm shrink-0 safe-top">
              <button 
                type="button"
                onClick={() => { setIsOpen(false); setSearchTerm(selectedOption ? selectedOption.label : ''); }}
                className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="relative flex-1">
                  <input
                      ref={mobileInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full border-none focus:ring-2 focus:ring-primary-500 text-base font-medium outline-none"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                  </div>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 pb-safe">
              {label && <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>}
              <div className="space-y-2">
                  {filteredOptions.length > 0 ? (
                      filteredOptions.map((option) => (
                          <div
                              key={option.value}
                              onClick={() => handleSelect(option.value)}
                              className={`px-4 py-4 rounded-xl text-base font-medium transition-all active:scale-[0.98] border shadow-sm ${
                                  option.value === value 
                                  ? 'bg-primary-600 text-white border-primary-600' 
                                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                              }`}
                          >
                              {option.label}
                          </div>
                      ))
                  ) : (
                      <div className="flex flex-col items-center justify-center pt-20 text-gray-400 space-y-2">
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
      
      <div 
        className="relative"
        onClick={() => { if (!disabled) setIsOpen(true); }}
      >
        <div 
            className={`
            w-full px-4 py-2.5 pr-10
            text-gray-900 dark:text-white 
            bg-gray-50 dark:bg-gray-700/50 
            border border-gray-300 dark:border-gray-600 
            rounded-lg 
            cursor-pointer
            flex items-center
            min-h-[44px]
            ${isOpen && !isMobileMode ? 'ring-2 ring-primary-500 border-primary-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-800' : ''}
            `}
        >
            <span className={`block truncate ${!selectedOption && !searchTerm ? 'text-gray-400' : ''}`}>
                {searchTerm || selectedOption?.label || placeholder}
            </span>
        </div>
        
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
          <ChevronDownIcon className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {isOpen && !disabled && createPortal(
          isMobileMode ? renderMobileContent() : renderDesktopContent(), 
          document.body
      )}
      
      {isOpen && !isMobileMode && (
          <div 
            className="fixed inset-0 z-[999990] bg-transparent" 
            onClick={() => { setIsOpen(false); setSearchTerm(selectedOption ? selectedOption.label : ''); }}
          />
      )}
    </div>
  );
};

export default SearchableSelect;
