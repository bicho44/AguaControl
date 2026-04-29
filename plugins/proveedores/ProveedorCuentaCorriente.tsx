import React, { useMemo, useState, useRef } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import { Proveedor, FacturaProveedor, PagoProveedor, EstadoFacturaProveedor } from '../../types';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, TrendingDown, TrendingUp, UploadCloud } from 'lucide-react';
import Modal from '../../components/Modal';
import { extractFacturaData } from './ocrService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import { getLocalDateString } from '../../utils/dateUtils';
import { PagoProveedorModal } from './PagoProveedorModal';
import { FacturaPreviewModal } from './FacturaPreviewModal';

export const ProveedorCuentaCorriente: React.FC<{ 
    proveedor: Proveedor,
    onBack: () => void 
}> = ({ proveedor, onBack }) => {
    const { facturasProveedor, pagosProveedor } = useDataStore();
    const { showNotification } = useNotification();
    
    // Upload invoice state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedFacturaForPago, setSelectedFacturaForPago] = useState<FacturaProveedor | null>(null);
    const [selectedFacturaForPreview, setSelectedFacturaForPreview] = useState<FacturaProveedor | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Partial<FacturaProveedor>>({
        proveedorId: proveedor.id,
        numero: '',
        tipoComprobante: 'A',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: new Date().toISOString().split('T')[0],
        subtotalNeto: 0,
        importeIva: 0,
        alicuotaIva: 21,
        percepciones: 0,
        total: 0,
        estado: EstadoFacturaProveedor.PENDIENTE
    });

    const facturas = useMemo(() => facturasProveedor.filter(f => f.proveedorId === proveedor.id), [facturasProveedor, proveedor.id]);
    const pagos = useMemo(() => pagosProveedor.filter(p => p.proveedorId === proveedor.id), [pagosProveedor, proveedor.id]);

    const saldoTotal = facturas.filter(f => f.estado !== EstadoFacturaProveedor.PAGADO).reduce((acc, f) => acc + (f.saldoPagar || 0), 0);

    const movimientos = useMemo(() => {
        type Movimiento = {
            id: string;
            fecha: string;
            tipo: 'FACTURA' | 'PAGO';
            descripcion: string;
            debe: number;
            haber: number;
            estado?: string;
            data: any;
        };

        const movs: Movimiento[] = [];
        
        facturas.forEach(f => {
            movs.push({
                id: f.id,
                fecha: f.fechaEmision,
                tipo: 'FACTURA',
                descripcion: `Factura ${f.tipoComprobante || ''} ${f.numero}`,
                debe: f.total,
                haber: 0,
                estado: f.estado,
                data: f
            });
        });

        pagos.forEach(p => {
            movs.push({
                id: p.id,
                fecha: p.fecha,
                tipo: 'PAGO',
                descripcion: `Pago ${p.metodo || ''}`,
                debe: 0,
                haber: p.monto,
                data: p
            });
        });

        return movs.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }, [facturas, pagos]);

    let saldoAcumulado = 0;
    const movimientosConSaldo = movimientos.map(m => {
        saldoAcumulado += (m.debe - m.haber);
        return { ...m, saldo: saldoAcumulado };
    });

    // Upload logic reused from FacturasList
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
                    
                    setFormData({
                        ...formData,
                        numero: extractedData.numero || '',
                        tipoComprobante: extractedData.tipoComprobante || 'A',
                        fechaEmision: extractedData.fechaEmision || new Date().toISOString().split('T')[0],
                        fechaVencimiento: extractedData.fechaVencimiento || new Date().toISOString().split('T')[0],
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
            console.error(error);
            setIsExtracting(false);
            showNotification('Error al leer el archivo', 'error');
        }
    };

    const handleSaveInvoice = async () => {
        if (!formData.numero || !formData.total) {
            showNotification('Completar número y total de factura', 'error');
            return;
        }

        try {
            const dataToSave = {
                ...formData,
                saldoPagar: formData.total,
                estado: EstadoFacturaProveedor.PENDIENTE
            };
            
            await addDoc(collection(db, 'facturas_proveedor'), dataToSave);
            showNotification('Factura registrada con éxito', 'success');
            setIsUploadModalOpen(false);
            setFormData({
                proveedorId: proveedor.id,
                numero: '',
                tipoComprobante: 'A',
                fechaEmision: new Date().toISOString().split('T')[0],
                fechaVencimiento: new Date().toISOString().split('T')[0],
                subtotalNeto: 0,
                importeIva: 0,
                alicuotaIva: 21,
                percepciones: 0,
                total: 0,
                estado: EstadoFacturaProveedor.PENDIENTE
            });
        } catch (e) {
            console.error(e);
            showNotification('Error al guardar la factura', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <AppButton variant="secondary" onClick={onBack} size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                </AppButton>
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cuenta Corriente</h2>
                    <p className="text-sm text-gray-500">{proveedor.nombre} {proveedor.cuit && `(CUIT: ${proveedor.cuit})`}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="text-red-500 w-5 h-5" />
                        <span className="font-bold text-red-600 dark:text-red-400">Saldo Pendiente</span>
                    </div>
                    <p className="text-2xl font-black text-gray-800 dark:text-white">${saldoTotal.toFixed(2)}</p>
                </Card>
                <Card className="p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setIsUploadModalOpen(true)}>
                    <div className="text-center">
                        <UploadCloud className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                        <p className="font-bold text-gray-700 dark:text-gray-300">Cargar Factura</p>
                    </div>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Descripción</th>
                                <th className="px-4 py-3 text-right">Debe</th>
                                <th className="px-4 py-3 text-right">Haber</th>
                                <th className="px-4 py-3 text-right font-black">Saldo</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movimientosConSaldo.map((m, idx) => (
                                <tr key={`${m.tipo}-${m.id}-${idx}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.fecha}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {m.tipo === 'FACTURA' ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                                            <span className="flex-1">{m.descripcion}</span>
                                            {m.tipo === 'FACTURA' && (
                                                <button onClick={() => {
                                                    setSelectedFacturaForPreview(m.data);
                                                    setIsPreviewModalOpen(true);
                                                }} className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-bold uppercase transition">
                                                    Ver
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-bold">{m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-'}</td>
                                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-bold">{m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'}</td>
                                    <td className="px-4 py-3 text-right font-black text-gray-800 dark:text-white">${m.saldo.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">
                                        {m.tipo === 'FACTURA' && m.estado === EstadoFacturaProveedor.PENDIENTE && (
                                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 cursor-pointer" onClick={() => { setSelectedFacturaForPago(m.data); setIsPagoModalOpen(true); }}>Pagar</span>
                                        )}
                                        {m.tipo === 'FACTURA' && m.estado === EstadoFacturaProveedor.PAGADO_PARCIAL && (
                                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 cursor-pointer" onClick={() => { setSelectedFacturaForPago(m.data); setIsPagoModalOpen(true); }}>Pagar</span>
                                        )}
                                        {m.tipo === 'FACTURA' && m.estado === EstadoFacturaProveedor.PAGADO && (
                                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">Pagado</span>
                                        )}
                                        {m.tipo === 'PAGO' && (
                                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">Aplicado</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {movimientosConSaldo.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay movimientos registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <FacturaPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => {
                    setIsPreviewModalOpen(false);
                    setSelectedFacturaForPreview(null);
                }}
                factura={selectedFacturaForPreview}
                proveedor={proveedor}
            />

            <PagoProveedorModal 
                isOpen={isPagoModalOpen} 
                onClose={() => {
                    setIsPagoModalOpen(false);
                    setSelectedFacturaForPago(null);
                }} 
                initialFacturaId={selectedFacturaForPago?.id} 
                initialProveedorId={proveedor.id} 
            />

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Cargar Factura de Proveedor" className="max-w-2xl">
                <div className="space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-4">
                        <label className="block text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">1. Extraer datos con IA (Opcional)</label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                            disabled={isExtracting}
                        />
                        {isExtracting && <p className="text-xs text-purple-600 mt-2 font-bold animate-pulse">Analizando documento, por favor espere...</p>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t dark:border-gray-700 pt-4">
                        <AppSelect label="Tipo *)" value={formData.tipoComprobante || ''} onChange={e => setFormData({...formData, tipoComprobante: e.target.value as any})}
                            options={[
                                { value: 'A', label: 'Factura A' },
                                { value: 'B', label: 'Factura B' },
                                { value: 'C', label: 'Factura C' },
                                { value: 'M', label: 'Factura M' },
                                { value: 'Ticket', label: 'Ticket' },
                            ]}
                        />
                        <AppInput label="Número *" value={formData.numero || ''} onChange={e => setFormData({...formData, numero: e.target.value})} placeholder="0001-0000123" />
                        <AppInput label="Fecha Emisión" type="date" value={formData.fechaEmision || ''} onChange={e => setFormData({...formData, fechaEmision: e.target.value})} />
                        <AppInput label="Total *" type="number" step="0.01" value={formData.total || ''} onChange={e => setFormData({...formData, total: parseFloat(e.target.value)})} />
                        <AppInput label="Neto" type="number" step="0.01" value={formData.subtotalNeto || ''} onChange={e => setFormData({...formData, subtotalNeto: parseFloat(e.target.value)})} />
                        <AppInput label="IVA" type="number" step="0.01" value={formData.importeIva || ''} onChange={e => setFormData({...formData, importeIva: parseFloat(e.target.value)})} />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <AppButton variant="secondary" onClick={() => setIsUploadModalOpen(false)}>Cancelar</AppButton>
                        <AppButton disabled={isExtracting} onClick={handleSaveInvoice}>Guardar Factura</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
