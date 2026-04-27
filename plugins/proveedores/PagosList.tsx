import React, { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import SearchableSelect from '../../components/SearchableSelect';
import Modal from '../../components/Modal';
import { PagoProveedor, FacturaProveedor, EstadoFacturaProveedor, MetodoPago } from '../../types';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { getLocalDateString } from '../../utils/dateUtils';

export const PagosList: React.FC = () => {
    const { pagosProveedor, facturasProveedor, proveedores } = useDataStore();
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<PagoProveedor>>({
        proveedorId: '',
        facturaProveedorId: '',
        monto: 0,
        fecha: getLocalDateString(new Date()),
        metodo: MetodoPago.EFECTIVO,
        observaciones: ''
    });

    const proveedoresOptions = useMemo(() => [
        { value: '', label: 'Seleccionar...' },
        ...proveedores.map(p => ({ value: p.id, label: p.nombre }))
    ], [proveedores]);

    const facturasOptions = useMemo(() => {
        if (!formData.proveedorId) return [{ value: '', label: 'Seleccione un proveedor primero' }];
        const facs = facturasProveedor.filter(f => f.proveedorId === formData.proveedorId && (f.estado === EstadoFacturaProveedor.PENDIENTE || f.estado === EstadoFacturaProveedor.PAGADO_PARCIAL));
        return [
            { value: '', label: 'Adelanto / A cuenta...' },
            ...facs.map(f => ({ value: f.id, label: `${f.numero} (Saldo: $${f.saldoPagar})` }))
        ];
    }, [formData.proveedorId, facturasProveedor]);

    const handleFacturaChange = (facId: string) => {
        const fac = facturasProveedor.find(f => f.id === facId);
        setFormData(prev => ({
            ...prev,
            facturaProveedorId: facId,
            monto: fac ? fac.saldoPagar : prev.monto // Autocomplete max amount
        }));
    };

    const handleSave = async () => {
        if (!formData.proveedorId || !formData.monto) {
            showNotification('Proveedor y monto son obligatorios', 'error');
            return;
        }

        try {
            const batch = writeBatch(db);
            
            // 1. Crear el pago
            const pagoRef = doc(collection(db, 'pagos_proveedor'));
            batch.set(pagoRef, formData);

            // 2. Afectar caja (Gasto)
            const gastoRef = doc(collection(db, 'gastos'));
            const prov = proveedores.find(p => p.id === formData.proveedorId);
            const provName = prov ? prov.nombre : 'Desconocido';
            const fac = facturasProveedor.find(f => f.id === formData.facturaProveedorId);
            const facNumber = fac ? fac.numero : 'Adelanto';
            
            batch.set(gastoRef, {
                fecha: formData.fecha,
                concepto: `Pago a Proveedor: ${provName} (Fac: ${facNumber})`,
                pagos: [{ monto: formData.monto, metodo: formData.metodo }],
                observaciones: formData.observaciones || ''
            });

            // 3. Actualizar factura si corresponde
            if (formData.facturaProveedorId && fac) {
                const newSaldo = fac.saldoPagar - formData.monto;
                let newEstado = fac.estado;
                if (newSaldo <= 0) {
                    newEstado = EstadoFacturaProveedor.PAGADO;
                } else if (formData.monto > 0) {
                    newEstado = EstadoFacturaProveedor.PAGADO_PARCIAL;
                }

                const facRef = doc(db, 'facturas_proveedor', fac.id);
                batch.update(facRef, {
                    saldoPagar: Math.max(0, newSaldo),
                    estado: newEstado
                });
            }

            await batch.commit();
            showNotification('Pago registrado con éxito', 'success');
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showNotification('Error al registrar pago', 'error');
        }
    };

    const openNew = () => {
        setFormData({ 
            proveedorId: '', 
            facturaProveedorId: '', 
            monto: 0, 
            fecha: getLocalDateString(new Date()), 
            metodo: MetodoPago.EFECTIVO,
            observaciones: ''
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Pagos Emitidos</h3>
                <AppButton onClick={openNew}>+ Registrar Pago</AppButton>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Proveedor</th>
                                <th className="px-4 py-3">Factura</th>
                                <th className="px-4 py-3">Importe</th>
                                <th className="px-4 py-3">Método</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {pagosProveedor.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(p => {
                                const prov = proveedores.find(pr => pr.id === p.proveedorId);
                                const fac = facturasProveedor.find(f => f.id === p.facturaProveedorId);
                                return (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3">{p.fecha}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{prov?.nombre || 'Desconocido'}</td>
                                        <td className="px-4 py-3">{fac?.numero || 'A Cuenta / Adelanto'}</td>
                                        <td className="px-4 py-3 font-bold text-green-600">${p.monto.toFixed(2)}</td>
                                        <td className="px-4 py-3">{p.metodo}</td>
                                    </tr>
                                )
                            })}
                            {pagosProveedor.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No hay pagos emitidos.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Pago a Proveedor">
                <div className="space-y-4">
                    <SearchableSelect label="Proveedor *" options={proveedoresOptions} value={formData.proveedorId || ''} onChange={(v) => setFormData({...formData, proveedorId: v})} />
                    
                    <SearchableSelect label="Asignar a Factura" options={facturasOptions} value={formData.facturaProveedorId || ''} onChange={handleFacturaChange} />

                    <div className="grid grid-cols-2 gap-4">
                        <AppInput label="Monto ($) *" type="number" value={formData.monto || ''} onChange={e => setFormData({...formData, monto: parseFloat(e.target.value) || 0})} className="bg-white" />
                        <AppSelect label="Método de Pago" value={formData.metodo} onChange={e => setFormData({...formData, metodo: e.target.value as MetodoPago})}>
                            {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                        </AppSelect>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <AppInput label="Fecha" type="date" value={formData.fecha || ''} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                    </div>

                    <AppInput label="Observaciones" value={formData.observaciones || ''} onChange={e => setFormData({...formData, observaciones: e.target.value})} />
                    
                    <p className="text-xs text-orange-500 font-bold">* Al registrar este pago, el importe impactará en la <span className="underline">Caja</span> de manera automática como un Gasto.</p>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <AppButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                        <AppButton onClick={handleSave}>Registrar y Afectar Caja</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PagosList;
