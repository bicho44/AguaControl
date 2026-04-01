
import React, { useState, useCallback } from 'react';
import Modal from './Modal';
import AppInput from './ui/AppInput';
import AppButton from './ui/AppButton';
import { MapIcon } from './icons/MapIcon';
import { useNotification } from '../context/NotificationContext';
import { TipoTelefono } from '../types';
import { useFormShortcuts } from '../hooks/useFormShortcuts';

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

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault(); e.stopPropagation();
        }
        if (!nombre.trim()) return;
        setIsSaving(true);
        try {
            await onSave({ nombre, direccion, telefono, ...coords });
            setNombre(''); setDireccion(''); setTelefono(''); setCoords({});
            onClose();
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    }, [nombre, direccion, telefono, coords, onSave, onClose]);

    useFormShortcuts({
        onSave: handleSubmit,
        onCancel: onClose
    });

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Nuevo Cliente Rápido"
            style={{ maxWidth: '450px' }}
        >
            <form onSubmit={handleSubmit} style={{ margin: 0 }}>
                <AppInput label="Nombre del Cliente" value={nombre} onChange={e => setNombre(e.target.value)} required />
                <div style={{ position: 'relative' }}>
                    <AppInput label="Dirección de Entrega" value={direccion} onChange={e => setDireccion(e.target.value)} />
                    <button 
                        type="button" 
                        onClick={handleGetLocation} 
                        disabled={isLocating} 
                        className="outline"
                        style={{ 
                            position: 'absolute', 
                            right: '0.5rem', 
                            top: '2.25rem', 
                            padding: '0.25rem', 
                            margin: 0, 
                            width: 'auto', 
                            border: 'none', 
                            background: 'transparent',
                            color: 'var(--pico-muted-color)'
                        }}
                    >
                        <MapIcon style={{ width: '1.5rem', height: '1.5rem' }} />
                    </button>
                </div>
                <AppInput label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton variant="primary" type="submit" isLoading={isSaving}>
                        Crear <small style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '0.25rem', fontWeight: 'normal' }}>(Alt+Enter)</small>
                    </AppButton>
                </div>
            </form>
        </Modal>
    );
};

export default QuickClientModal;
