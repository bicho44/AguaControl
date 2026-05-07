import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import SearchableSelect from '../../components/SearchableSelect';
import Modal from '../../components/Modal';
import { PagoProveedor, FacturaProveedor, EstadoFacturaProveedor, MetodoPago } from '../../types';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatFacturaNumber } from './FacturasList';

interface PagoProveedorModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProveedorId?: string;
    initialFacturaId?: string;
}

export const PagoProveedorModal: React.FC<PagoProveedorModalProps> = ({ isOpen, onClose, initialProveedorId, initialFacturaId }) => {
    const { pagosProveedor, facturasProveedor, proveedores } = useDataStore();
    const { showNotification } = useNotification();
    const [formData, setFormData] = useState<Partial<PagoProveedor>>({
        proveedorId: '',
        facturaProveedorId: '',
        monto: 0,
        fecha: getLocalDateString(new Date()),
        metodo: MetodoPago.EFECTIVO,
        observaciones: ''
    });
    const [afectarCaja, setAfectarCaja] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                proveedorId: initialProveedorId || '',
                facturaProveedorId: initialFacturaId || '',
                monto: 0,
                fecha: getLocalDateString(new Date()),
                metodo: MetodoPago.EFECTIVO,
                observaciones: ''
            });
            setAfectarCaja(true);

            if (initialFacturaId) {
                const fac = facturasProveedor.find(f => f.id === initialFacturaId);
                if (fac) {
                    setFormData(prev => ({ ...prev, proveedorId: fac.proveedorId, monto: fac.saldoPagar || 0 }));
                }
            }
        }
    }, [isOpen, initialFacturaId, initialProveedorId, facturasProveedor]);

    const proveedoresOptions = useMemo(() => [
        { value: '', label: 'Seleccionar...' },
        ...proveedores.map(p => ({ value: p.id, label: p.nombre }))
    ], [proveedores]);

    const facturasOptions = useMemo(() => {
        if (!formData.proveedorId) return [{ value: '', label: 'Seleccione un proveedor primero' }];
        const facs = facturasProveedor.filter(f => f.proveedorId === formData.proveedorId && (f.estado === EstadoFacturaProveedor.PENDIENTE || f.estado === EstadoFacturaProveedor.PAGADO_PARCIAL));
        return [
            { value: '', label: 'Adelanto / A cuenta...' },
            ...facs.map(f => ({ value: f.id, label: `${formatFacturaNumber(f)} (Saldo: $${f.saldoPagar?.toFixed(2) || '0.00'})` }))
        ];
    }, [formData.proveedorId, facturasProveedor]);

    const handleFacturaChange = (facId: string) => {
        const fac = facturasProveedor.find(f => f.id === facId);
        setFormData(prev => ({
            ...prev,
            facturaProveedorId: facId,
            monto: fac ? fac.saldoPagar : prev.monto
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

            // 2. Afectar caja (Gasto) si corresponde
            const prov = proveedores.find(p => p.id === formData.proveedorId);
            const fac = facturasProveedor.find(f => f.id === formData.facturaProveedorId);
            
            if (afectarCaja) {
                const gastoRef = doc(collection(db, 'gastos'));
                const provName = prov ? prov.nombre : 'Desconocido';
                const facNumber = fac ? formatFacturaNumber(fac) : 'Adelanto';
                
                batch.set(gastoRef, {
                    fecha: formData.fecha,
                    concepto: `Pago a Proveedor: ${provName} (Fac: ${facNumber})`,
                    pagos: [{ monto: formData.monto, metodo: formData.metodo }],
                    observaciones: formData.observaciones || ''
                });
            }

            // 3. Actualizar factura si corresponde
            if (formData.facturaProveedorId && fac) {
                const newSaldo = (fac.saldoPagar || 0) - (formData.monto || 0);
                let newEstado = fac.estado;
                if (newSaldo <= 0) {
                    newEstado = EstadoFacturaProveedor.PAGADO;
                } else if ((formData.monto || 0) > 0) {
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
            onClose();
        } catch (e) {
            console.error(e);
            showNotification('Error al registrar pago', 'error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pago a Proveedor">
            <div className="space-y-4">
                <SearchableSelect label="Proveedor *" options={proveedoresOptions} value={formData.proveedorId || ''} onChange={(v) => setFormData({...formData, proveedorId: v})} />
                
                <SearchableSelect label="Asignar a Factura" options={facturasOptions} value={formData.facturaProveedorId || ''} onChange={handleFacturaChange} />

                <div className="grid grid-cols-2 gap-4">
                    <AppInput label="Monto ($) *" type="number" step="0.01" value={formData.monto || ''} onChange={e => setFormData({...formData, monto: parseFloat(e.target.value) || 0})} className="bg-white" />
                    <AppSelect 
                        label="Método de Pago" 
                        value={formData.metodo as string} 
                        onChange={e => setFormData({...formData, metodo: e.target.value as MetodoPago})}
                        options={Object.values(MetodoPago).map(m => ({ value: m, label: m }))}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <AppInput label="Fecha" type="date" value={formData.fecha || ''} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                </div>

                <AppInput label="Observaciones" value={formData.observaciones || ''} onChange={e => setFormData({...formData, observaciones: e.target.value})} />
                
                <div className="flex items-center gap-2 px-2">
                    <input 
                        type="checkbox" 
                        id="afectarCaja" 
                        checked={afectarCaja} 
                        onChange={(e) => setAfectarCaja(e.target.checked)}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="afectarCaja" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                        Afectar Caja (Crear como Gasto)
                    </label>
                </div>

                {afectarCaja && <p className="text-xs text-orange-500 font-bold px-2">* El importe impactará en la <span className="underline">Caja</span> de manera automática como un Gasto.</p>}

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton onClick={handleSave}>Registrar Pago</AppButton>
                </div>
            </div>
        </Modal>
    );
};
