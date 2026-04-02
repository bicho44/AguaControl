
import React, { useState } from 'react';
import Modal from './Modal';
import LeafletMap from './LeafletMap';
import { SearchIcon } from './icons/SearchIcon';

// Force sync

interface MapPickerModalProps {
    initialLat?: number;
    initialLng?: number;
    initialAddress: string;
    onConfirm: (lat: number, lng: number, address: string) => void;
    onClose: () => void;
    title?: string;
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({ 
    initialLat, 
    initialLng, 
    initialAddress, 
    onConfirm, 
    onClose,
    title = "Ubicación" 
}) => {
    // Estado de la posición actual (coordenadas)
    const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
    );
    // Dirección mostrada abajo (resultado del pin)
    const [previewAddress, setPreviewAddress] = useState<string>(initialAddress);
    // Texto del buscador (input superior)
    const [searchQuery, setSearchQuery] = useState<string>(initialAddress);
    const [isSearching, setIsSearching] = useState(false);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);
    
    // Nuevo estado: Controlar si sobrescribimos el texto
    const [overwriteAddress, setOverwriteAddress] = useState(false);

    // Búsqueda directa (Input -> Coordenadas)
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            // Agregamos contexto de país si no está presente para mejorar precisión
            const q = searchQuery.toLowerCase().includes('argentina') ? searchQuery : `${searchQuery}, Argentina`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const newLat = parseFloat(data[0].lat);
                const newLng = parseFloat(data[0].lon);
                
                // 1. Actualizamos posición (Mueve el mapa)
                setCurrentPos({ lat: newLat, lng: newLng });
                
                // 2. Actualizamos la vista previa con el dato oficial encontrado
                setPreviewAddress(data[0].display_name);
            } else {
                setPreviewAddress("Dirección no encontrada.");
            }
        } catch (error) {
            console.error("Error en búsqueda:", error);
        } finally {
            setIsSearching(false);
        }
    };

    // Cuando el mapa nos avisa que cambió la posición (click o drag del usuario)
    const handleMapPositionChange = async (lat: number, lng: number) => {
        setCurrentPos({ lat, lng });
        setIsResolvingAddress(true);
        try {
            // Geocodificación Inversa (Coordenadas -> Dirección)
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            
            if (data && data.address) {
                let direccion = "";
                const road = data.address.road || '';
                const number = data.address.house_number || '';
                const city = data.address.city || data.address.town || data.address.village || data.address.state_district || '';
                
                if (road) {
                    direccion = `${road} ${number}`;
                    if (city) direccion += `, ${city}`;
                } else {
                    direccion = data.display_name; // Fallback
                }
                setPreviewAddress(direccion);
            }
        } catch (error) {
            console.error("Error obteniendo dirección:", error);
        } finally {
            setIsResolvingAddress(false);
        }
    };

    const handleConfirm = () => {
        if (currentPos) {
            // Lógica clave: Si overwriteAddress es falso, devolvemos la dirección ORIGINAL, no la detectada.
            // Esto actualiza lat/lng pero deja el texto intacto.
            const finalAddress = overwriteAddress ? previewAddress : initialAddress;
            onConfirm(currentPos.lat, currentPos.lng, finalAddress);
        }
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="space-y-4">
                <div className="flex justify-between items-center pr-12">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white pr-12">{title}</h3>
                </div>

                {/* Buscador */}
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar calle, altura y ciudad..."
                            className="w-full pl-4 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                            autoFocus={!initialLat} // Autofocus si no hay ubicación previa
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-2.5">
                                <svg className="animate-spin h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                    </div>
                    <button 
                        type="submit" 
                        disabled={isSearching || !searchQuery}
                        className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        title="Buscar en el mapa"
                    >
                        <SearchIcon className="w-5 h-5" />
                    </button>
                </form>

                <LeafletMap
                    initialLat={currentPos?.lat} 
                    initialLng={currentPos?.lng}
                    editMode={true}
                    onPositionChange={handleMapPositionChange}
                    height="400px"
                />

                {/* Panel de Info y Decisión */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Dirección Detectada por GPS</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-white min-h-[1.25rem]">
                            {isResolvingAddress ? (
                                <span className="animate-pulse text-gray-400">Obteniendo dirección exacta...</span>
                            ) : (
                                previewAddress || <span className="text-gray-400 italic">Mueve el pin o busca una dirección...</span>
                            )}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <input 
                            type="checkbox" 
                            id="overwriteAddr" 
                            checked={overwriteAddress} 
                            onChange={(e) => setOverwriteAddress(e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
                        />
                        <label htmlFor="overwriteAddr" className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                            Actualizar el texto de la dirección con este resultado
                            <br/><span className="text-[10px] text-gray-400 font-normal">(Desmarcar para mantener tu dirección manual)</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!currentPos}
                        className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm shadow-lg shadow-primary-500/30 transition-all active:scale-95"
                    >
                        Confirmar Ubicación
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MapPickerModal;
