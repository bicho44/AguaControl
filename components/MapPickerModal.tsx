
import React, { useState } from 'react';
import Modal from './Modal';
import LeafletMap from './LeafletMap';

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
    const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
    );
    const [previewAddress, setPreviewAddress] = useState<string>(initialAddress);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);

    // Cuando el mapa nos avisa que cambió la posición (click o drag)
    const handleMapPositionChange = async (lat: number, lng: number) => {
        setCurrentPos({ lat, lng });
        setIsResolvingAddress(true);
        try {
            // Geocodificación Inversa SOLO para mostrar en el modal
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
            onConfirm(currentPos.lat, currentPos.lng, previewAddress);
        }
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md text-sm text-blue-800 dark:text-blue-200">
                    <p>Mueva el pin a la posición exacta.</p>
                </div>

                <LeafletMap
                    initialLat={initialLat}
                    initialLng={initialLng}
                    editMode={true}
                    onPositionChange={handleMapPositionChange}
                    height="400px"
                />

                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                    <p className="text-xs text-gray-500 uppercase font-bold">Dirección detectada en el punto:</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white min-h-[1.25rem]">
                        {isResolvingAddress ? "Calculando..." : previewAddress || "Haga clic en el mapa para ubicar"}
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!currentPos}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Confirmar Ubicación
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MapPickerModal;
