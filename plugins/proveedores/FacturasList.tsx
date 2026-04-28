import React, { useState, useMemo, useRef } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import SearchableSelect from '../../components/SearchableSelect';
import Modal from '../../components/Modal';
import { FacturaProveedor, EstadoFacturaProveedor, Proveedor, ItemFacturaProveedor } from '../../types';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { getLocalDateString } from '../../utils/dateUtils';
import { extractFacturaData } from './ocrService';

export const FacturasList: React.FC = () => {
    const { facturasProveedor, proveedores } = useDataStore();
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingItem, setEditingItem] = useState<FacturaProveedor | null>(null);
    const [formData, setFormData] = useState<Partial<FacturaProveedor>>({
        proveedorId: '',
        numero: '',
        tipoComprobante: 'A',
        fechaEmision: getLocalDateString(new Date()),
        fechaVencimiento: getLocalDateString(new Date()),
        subtotalNeto: 0,
        importeIva: 0,
        alicuotaIva: 21,
        percepciones: 0,
        total: 0,
        estado: EstadoFacturaProveedor.PENDIENTE,
        items: []
    });

    const proveedoresOptions = useMemo(() => [
        { value: '', label: 'Seleccionar...' },
        ...proveedores.map(p => ({ value: p.id, label: p.nombre }))
    ], [proveedores]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        showNotification('Procesando factura con IA...', 'success');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const base64String = (event.target?.result as string).split(',')[1];
                    const extractedData = await extractFacturaData(base64String, file.type);
                    
                    // Match provider by CUIT or Name
                    let foundProvId = '';
                    if (extractedData.proveedorCuit || extractedData.proveedorNombre) {
                        const prov = proveedores.find(p => 
                            (extractedData.proveedorCuit && p.cuit && p.cuit.includes(extractedData.proveedorCuit)) ||
                            (extractedData.proveedorNombre && p.nombre.toLowerCase().includes(extractedData.proveedorNombre.toLowerCase()))
                        );
                        if (prov) foundProvId = prov.id;
                    }

                    setFormData({
                        ...formData,
                        proveedorId: foundProvId,
                        numero: extractedData.numero || '',
                        tipoComprobante: extractedData.tipoComprobante || 'A',
                        fechaEmision: extractedData.fechaEmision || getLocalDateString(new Date()),
                        fechaVencimiento: extractedData.fechaVencimiento || getLocalDateString(new Date()),
                        subtotalNeto: extractedData.subtotalNeto || 0,
                        importeIva: extractedData.importeIva || 0,
                        alicuotaIva: extractedData.alicuotaIva || 21,
                        percepciones: extractedData.percepciones || 0,
                        total: extractedData.total || 0,
                    });

                    showNotification('Datos extraídos correctamente ✨', 'success');
                } catch (error: any) {
                    console.error(error);
                    showNotification('Error extrayendo datos: ' + error.message, 'error');
                } finally {
                    setIsExtracting(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            setIsExtracting(false);
            showNotification('Error leyendo archivo', 'error');
        }
    };

    const handleSave = async () => {
        if (!formData.proveedorId || !formData.numero || !formData.total) {
            showNotification('Proveedor, número y total son obligatorios', 'error');
            return;
        }

        const dataToSave = {
            ...formData,
            saldoPagar: editingItem ? formData.saldoPagar : formData.total // Initial balance is total
        };

        try {
            if (editingItem) {
                await updateDoc(doc(db, 'facturas_proveedor', editingItem.id), dataToSave);
                showNotification('Factura actualizada', 'success');
            } else {
                await addDoc(collection(db, 'facturas_proveedor'), dataToSave);
                showNotification('Factura registrada', 'success');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showNotification('Error al guardar factura', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Seguro que desea eliminar esta factura? Los pagos asociados podrían quedar huérfanos.')) {
            try {
                await deleteDoc(doc(db, 'facturas_proveedor', id));
                showNotification('Factura eliminada', 'success');
            } catch (e) {
                console.error(e);
                showNotification('Error al eliminar', 'error');
            }
        }
    };

    const openEdit = (fac: FacturaProveedor) => {
        setEditingItem(fac);
        setFormData(fac);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingItem(null);
        setFormData({ 
            proveedorId: '', 
            numero: '', 
            tipoComprobante: 'A',
            fechaEmision: getLocalDateString(new Date()), 
            fechaVencimiento: getLocalDateString(new Date()), 
            subtotalNeto: 0,
            importeIva: 0,
            alicuotaIva: 21,
            percepciones: 0,
            total: 0, 
            estado: EstadoFacturaProveedor.PENDIENTE,
            items: []
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Facturas Recibidas</h3>
                <div className="flex items-center gap-4">
                    <input type="file" accept="image/*,.pdf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <AppButton variant="secondary" onClick={() => {
                         openNew();
                         // The click will be triggered from the modal, but if they click here it opens modal and triggers click
                         fileInputRef.current?.click();
                    }} disabled={isExtracting}>
                        {isExtracting ? 'Procesando...' : '✨ OCR Mágico'}
                    </AppButton>
                    <AppButton onClick={openNew}>+ Ingresar Factura</AppButton>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-4 py-3">Emisión</th>
                                <th className="px-4 py-3">Venc.</th>
                                <th className="px-4 py-3">Proveedor</th>
                                <th className="px-4 py-3">Número</th>
                                <th className="px-4 py-3">Importe</th>
                                <th className="px-4 py-3">Saldo</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {facturasProveedor.sort((a,b) => b.fechaEmision.localeCompare(a.fechaEmision)).map(f => {
                                const prov = proveedores.find(p => p.id === f.proveedorId);
                                return (
                                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3">{f.fechaEmision}</td>
                                        <td className="px-4 py-3">{f.fechaVencimiento}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{prov?.nombre || 'Desconocido'}</td>
                                        <td className="px-4 py-3">{f.numero}</td>
                                        <td className="px-4 py-3">${f.total.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-bold text-red-500">${(f.saldoPagar || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                f.estado === EstadoFacturaProveedor.PENDIENTE ? 'bg-orange-100 text-orange-700' :
                                                f.estado === EstadoFacturaProveedor.PAGADO ? 'bg-green-100 text-green-700' :
                                                f.estado === EstadoFacturaProveedor.PAGADO_PARCIAL ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {f.estado}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button onClick={() => openEdit(f)} className="text-primary-600 hover:text-primary-800 font-bold text-xs uppercase">Editar</button>
                                            <button onClick={() => handleDelete(f.id)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase">Eliminar</button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {facturasProveedor.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No hay facturas cargadas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Factura' : 'Ingresar Factura'}>
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <AppButton variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="w-full text-center">
                            {isExtracting ? 'Analizando con IA...' : '✨ Autocompletar con Factura (Subir Imagen)'}
                        </AppButton>
                    </div>
                    <SearchableSelect label="Proveedor *" options={proveedoresOptions} value={formData.proveedorId || ''} onChange={(v) => setFormData({...formData, proveedorId: v})} />
                    
                    <div className="grid grid-cols-3 gap-4">
                        <AppSelect label="Tipo" value={formData.tipoComprobante || 'A'} onChange={e => setFormData({...formData, tipoComprobante: e.target.value as any})} options={[{label:'Factura A', value:'A'}, {label:'Factura B', value:'B'}, {label:'Factura C', value:'C'}, {label:'Factura M', value:'M'}, {label:'Factura X', value:'X'}, {label:'Ticket', value:'Ticket'}]} />
                        <AppInput label="Nro de Factura *" value={formData.numero || ''} onChange={e => setFormData({...formData, numero: e.target.value})} className="col-span-2" autoFocus />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <AppInput label="Fecha Emisión" type="date" value={formData.fechaEmision || ''} onChange={e => setFormData({...formData, fechaEmision: e.target.value})} />
                        <AppInput label="Fecha Vencimiento" type="date" value={formData.fechaVencimiento || ''} onChange={e => setFormData({...formData, fechaVencimiento: e.target.value})} />
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Detalle de Importes</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <AppInput label="Subtotal Neto ($)" type="number" value={formData.subtotalNeto || ''} onChange={e => setFormData({...formData, subtotalNeto: parseFloat(e.target.value) || 0})} className="bg-white" />
                            <div className="grid grid-cols-2 gap-2">
                                <AppSelect label="Alícuota" value={String(formData.alicuotaIva || 21)} onChange={e => setFormData({...formData, alicuotaIva: parseFloat(e.target.value) || 0})} options={[{label:'21%', value:'21'}, {label:'10.5%', value:'10.5'}, {label:'27%', value:'27'}, {label:'Exento', value:'0'}]} />
                                <AppInput label="Importe IVA ($)" type="number" value={formData.importeIva || ''} onChange={e => setFormData({...formData, importeIva: parseFloat(e.target.value) || 0})} className="bg-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <AppInput label="Percepciones/Imp. ($)" type="number" value={formData.percepciones || ''} onChange={e => setFormData({...formData, percepciones: parseFloat(e.target.value) || 0})} className="bg-white" />
                            <AppInput label="Total ($) *" type="number" value={formData.total || ''} onChange={e => setFormData({...formData, total: parseFloat(e.target.value) || 0})} className="bg-white font-bold text-primary-600" />
                        </div>
                    </div>

                    <AppInput label="Observaciones" value={formData.observaciones || ''} onChange={e => setFormData({...formData, observaciones: e.target.value})} />
                    
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <AppButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                        <AppButton onClick={handleSave}>Guardar</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FacturasList;
