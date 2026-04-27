import React, { useState } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import Modal from '../../components/Modal';
import { Proveedor } from '../../types';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';

export const ProveedoresList: React.FC = () => {
    const { proveedores } = useDataStore();
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Proveedor | null>(null);
    const [formData, setFormData] = useState<Partial<Proveedor>>({
        nombre: '',
        cuit: '',
        telefono: '',
        email: '',
        direccion: '',
        activo: true
    });

    const handleSave = async () => {
        if (!formData.nombre) {
            showNotification('El nombre es obligatorio', 'error');
            return;
        }

        try {
            if (editingItem) {
                await updateDoc(doc(db, 'proveedores', editingItem.id), formData);
                showNotification('Proveedor actualizado', 'success');
            } else {
                await addDoc(collection(db, 'proveedores'), formData);
                showNotification('Proveedor creado', 'success');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showNotification('Error al guardar proveedor', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Seguro que desea eliminar este proveedor?')) {
            try {
                await deleteDoc(doc(db, 'proveedores', id));
                showNotification('Proveedor eliminado', 'success');
            } catch (e) {
                console.error(e);
                showNotification('Error al eliminar', 'error');
            }
        }
    };

    const openEdit = (prov: Proveedor) => {
        setEditingItem(prov);
        setFormData(prov);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingItem(null);
        setFormData({ nombre: '', cuit: '', telefono: '', email: '', direccion: '', activo: true });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Directorio de Proveedores</h3>
                <AppButton onClick={openNew}>+ Nuevo Proveedor</AppButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proveedores.map(p => (
                    <Card key={p.id} className="p-4 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-lg text-gray-800 dark:text-white">{p.nombre}</h4>
                            <p className="text-xs text-gray-500">{p.cuit || 'Sin CUIT'}</p>
                            <p className="text-sm mt-2"><span className="font-medium text-gray-500">Tel:</span> {p.telefono || '-'}</p>
                            <p className="text-sm"><span className="font-medium text-gray-500">Email:</span> {p.email || '-'}</p>
                        </div>
                        <div className="mt-4 flex gap-2 justify-end">
                            <AppButton variant="secondary" size="sm" onClick={() => openEdit(p)}>Editar</AppButton>
                            <AppButton variant="danger" size="sm" onClick={() => handleDelete(p.id)}>Eliminar</AppButton>
                        </div>
                    </Card>
                ))}
                {proveedores.length === 0 && (
                    <div className="col-span-full py-8 text-center text-gray-500">
                        No hay proveedores registrados.
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Proveedor' : 'Nuevo Proveedor'}>
                <div className="space-y-4">
                    <AppInput label="Nombre o Razón Social *" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} autoFocus />
                    <AppInput label="CUIT" value={formData.cuit || ''} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <AppInput label="Teléfono" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                        <AppInput label="Email" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <AppInput label="Dirección" value={formData.direccion || ''} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                    <div className="flex justify-end gap-3 pt-4">
                        <AppButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                        <AppButton onClick={handleSave}>Guardar</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProveedoresList;
