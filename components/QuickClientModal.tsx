
import React, { useState } from 'react';
import Modal from './Modal';
import AppInput from './ui/AppInput';
import AppButton from './ui/AppButton';
import { MapIcon } from './icons/MapIcon';
import { useNotification } from '../context/NotificationContext';
import { TipoTelefono } from '../types';

interface QuickClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { nombre: string; direccion: string; telefono: string; lat?: number; lng?: number }) => Promise<void>;
}

const QuickClientModal: React.FC<QuickClientModalProps> = ({ isOpen, onClose, onSave }) => {
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');
    const [telefono, setTelefono] = useState('');
    const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const { showNotification } = useNotification();

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            showNotification('Tu navegador no soporta geolocalización', 'error');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCoords({ lat: latitude, lng: longitude });
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    if (data && data.address) {
                        const road = data.address.road || '';
                        const houseNumber = data.address.house_number || '';
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const estimatedAddr = `${road} ${houseNumber}${city ? `, ${city}` : ''}`.trim();
                        setDireccion(estimatedAddr || data.display_name);
                        showNotification('Dirección estimada por GPS', 'success');
                    }
                } catch (error) { showNotification('Error al ubicar dirección.', 'error'); } 
                finally { setIsLocating(false); }
            },
            (error) => { showNotification('Error GPS.', 'error'); setIsLocating(false); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!nombre.trim()) return;
        setIsSaving(true);
        try {
            await onSave({ nombre, direccion, telefono, ...coords });
            setNombre(''); setDireccion(''); setTelefono(''); setCoords({});
            onClose();
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Nuevo Cliente Rápido</h3>
                <AppInput label="Nombre del Cliente" value={nombre} onChange={e => setNombre(e.target.value)} required />
                <div className="relative">
                    <AppInput label="Dirección de Entrega" value={direccion} onChange={e => setDireccion(e.target.value)} />
                    <button type="button" onClick={handleGetLocation} disabled={isLocating} className="absolute right-2 top-8 p-1.5 rounded-lg text-gray-400 hover:text-primary-600"><MapIcon className="w-6 h-6" /></button>
                </div>
                <AppInput label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
                <div className="flex justify-end gap-2 pt-4">
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton variant="primary" type="submit" isLoading={isSaving}>Crear</AppButton>
                </div>
            </form>
        </Modal>
    );
};

export default QuickClientModal;
