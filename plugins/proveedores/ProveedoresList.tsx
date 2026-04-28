import React, { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import Modal from '../../components/Modal';
import SearchableSelect from '../../components/SearchableSelect';
import { Proveedor } from '../../types';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { ProveedorCuentaCorriente } from './ProveedorCuentaCorriente';
import { Search, Edit2, Trash2, Eye } from 'lucide-react';

export const ProveedoresList: React.FC = () => {
    const { proveedores, clientes } = useDataStore();
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [clienteToImportId, setClienteToImportId] = useState('');
    const [editingItem, setEditingItem] = useState<Proveedor | null>(null);
    const [formData, setFormData] = useState<Partial<Proveedor>>({
        nombre: '',
        cuit: '',
        telefono: '',
        email: '',
        direccion: '',
        activo: true
    });

    const clienteOptions = useMemo(() => clientes.map(c => ({
        value: c.id,
        label: `${c.nombre} ${c.cuit ? `(${c.cuit})` : ''}`
    })), [clientes]);

    const filteredProveedores = useMemo(() => {
        return proveedores.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.cuit && p.cuit.includes(searchTerm)));
    }, [proveedores, searchTerm]);

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

    const handleImportCliente = async () => {
        if (!clienteToImportId) {
            showNotification('Debe seleccionar un cliente', 'error');
            return;
        }
        
        const cliente = clientes.find(c => c.id === clienteToImportId);
        if (!cliente) return;
        
        const exists = proveedores.find(p => p.nombre.toLowerCase().trim() === cliente.nombre.toLowerCase().trim() || (p.cuit && p.cuit === cliente.cuit));
        if (exists) {
            showNotification('Ya existe un proveedor con ese nombre o CUIT', 'error');
            return;
        }

        try {
            await addDoc(collection(db, 'proveedores'), {
                nombre: cliente.nombre,
                cuit: cliente.cuit || '',
                telefono: cliente.telefonos && cliente.telefonos.length > 0 ? cliente.telefonos[0] : '',
                email: cliente.emails && cliente.emails.length > 0 ? cliente.emails[0] : '',
                direccion: cliente.sucursales && cliente.sucursales.length > 0 ? cliente.sucursales[0].direccion : '',
                activo: true
            });
            showNotification('Cliente importado como Proveedor', 'success');
            setIsImportModalOpen(false);
            setClienteToImportId('');
        } catch (e) {
            console.error(e);
            showNotification('Error al importar cliente', 'error');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('¿Seguro que desea eliminar este proveedor?')) {
            try {
                await deleteDoc(doc(db, 'proveedores', id));
                showNotification('Proveedor eliminado', 'success');
            } catch (error) {
                console.error(error);
                showNotification('Error al eliminar', 'error');
            }
        }
    };

    const openEdit = (prov: Proveedor, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingItem(prov);
        setFormData(prov);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingItem(null);
        setFormData({ nombre: '', cuit: '', telefono: '', email: '', direccion: '', activo: true });
        setIsModalOpen(true);
    };

    if (selectedProveedor) {
        return <ProveedorCuentaCorriente proveedor={selectedProveedor} onBack={() => setSelectedProveedor(null)} />;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 gap-3">
                <div className="flex-1 w-full sm:w-auto relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar proveedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out dark:text-white"
                    />
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <AppButton variant="secondary" onClick={() => setIsImportModalOpen(true)}>Importar Cliente</AppButton>
                    <AppButton onClick={openNew}>+ Nuevo Proveedor</AppButton>
                </div>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Nombre / Razón Social</th>
                                <th className="px-4 py-3">CUIT</th>
                                <th className="px-4 py-3">Contacto</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProveedores.map(p => (
                                <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => setSelectedProveedor(p)}>
                                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                                        {p.nombre}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                        {p.cuit || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                                        {p.telefono && <div className="truncate"><span className="font-semibold text-gray-400">Tel:</span> {p.telefono}</div>}
                                        {p.email && <div className="truncate"><span className="font-semibold text-gray-400">Mail:</span> {p.email}</div>}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2 justify-end">
                                        <AppButton variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProveedor(p); }}>
                                            <Eye className="w-4 h-4" />
                                        </AppButton>
                                        <AppButton variant="secondary" size="sm" onClick={(e) => openEdit(p, e)}>
                                            <Edit2 className="w-4 h-4" />
                                        </AppButton>
                                        <AppButton variant="danger" size="sm" onClick={(e) => handleDelete(p.id, e)}>
                                            <Trash2 className="w-4 h-4" />
                                        </AppButton>
                                    </td>
                                </tr>
                            ))}
                            {filteredProveedores.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No se encontraron proveedores.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal para Crear / Editar Proveedor */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Proveedor' : 'Nuevo Proveedor'}>
                <div className="space-y-4">
                    <AppInput label="Nombre o Razón Social *" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} autoFocus />
                    <AppInput label="CUIT" value={formData.cuit || ''} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <AppInput label="Teléfono" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                        <AppInput label="Email" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <AppInput label="Dirección" value={formData.direccion || ''} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                    <AppInput label="Ingresos Brutos" value={formData.ingresosBrutos || ''} onChange={e => setFormData({...formData, ingresosBrutos: e.target.value})} />
                    <div className="flex justify-end gap-3 pt-4">
                        <AppButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                        <AppButton onClick={handleSave}>Guardar</AppButton>
                    </div>
                </div>
            </Modal>

            {/* Modal para Importar desde Clientes */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Cliente como Proveedor">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Seleccione un cliente existente para que sea agregado a la lista de proveedores. Se copiarán sus datos de contacto y CUIT.
                    </p>
                    <SearchableSelect 
                        label="Seleccionar Cliente" 
                        options={clienteOptions} 
                        value={clienteToImportId} 
                        onChange={setClienteToImportId} 
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <AppButton variant="secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</AppButton>
                        <AppButton onClick={handleImportCliente}>Importar como Proveedor</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProveedoresList;
