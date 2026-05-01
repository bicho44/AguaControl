import React, { useMemo, useState, useRef } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import { Proveedor, FacturaProveedor, PagoProveedor, EstadoFacturaProveedor } from '../../types';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, TrendingDown, TrendingUp, UploadCloud, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
            pagosAsociados: PagoProveedor[];
        };

        const movs: Movimiento[] = [];
        const facturasMap = new Map<string, Movimiento>();
        
        // Primero metemos las facturas
        facturas.forEach(f => {
            const mov: Movimiento = {
                id: f.id,
                fecha: f.fechaEmision,
                tipo: 'FACTURA',
                descripcion: `Factura ${f.tipoComprobante || ''} ${f.numero}`,
                debe: f.total,
                haber: 0,
                estado: f.estado,
                data: f,
                pagosAsociados: []
            };
            facturasMap.set(f.id, mov);
            movs.push(mov);
        });

        // Luego asociamos los pagos o los ponemos como huérfanos (adelantos)
        pagos.forEach(p => {
            if (p.facturaProveedorId && facturasMap.has(p.facturaProveedorId)) {
                const movFac = facturasMap.get(p.facturaProveedorId)!;
                movFac.pagosAsociados.push(p);
                movFac.haber += p.monto; // El haber de la factura se incrementa con sus pagos
            } else {
                movs.push({
                    id: p.id,
                    fecha: p.fecha,
                    tipo: 'PAGO',
                    descripcion: `Pago Adelanto (${p.metodo || ''})`,
                    debe: 0,
                    haber: p.monto,
                    data: p,
                    pagosAsociados: []
                });
            }
        });

        return movs.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }, [facturas, pagos]);

    let saldoAcumulado = 0;
    const movimientosConSaldo = movimientos.map(m => {
        saldoAcumulado += (m.debe - m.haber);
        return { ...m, saldo: saldoAcumulado };
    });

    const [expandedMovIds, setExpandedMovIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const next = new Set(expandedMovIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedMovIds(next);
    };

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
                <Card className="p-0 overflow-hidden">
                    <button className="w-full h-full p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setIsUploadModalOpen(true)}>
                        <div className="text-center">
                            <UploadCloud className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                            <p className="font-bold text-gray-700 dark:text-gray-300">Ingresar Factura</p>
                        </div>
                    </button>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden border-none shadow-none bg-transparent">
                <div className="space-y-3">
                    {movimientosConSaldo.map((m, idx) => {
                        const isExpanded = expandedMovIds.has(m.id);
                        const hasPagos = m.pagosAsociados.length > 0;
                        
                        return (
                            <div key={`${m.tipo}-${m.id}-${idx}`} className="group">
                                <div 
                                    className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg ${isExpanded ? 'ring-2 ring-primary-500/20 border-primary-500' : ''}`}
                                >
                                    <div 
                                        className="p-4 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 cursor-pointer"
                                        onClick={() => hasPagos && toggleExpand(m.id)}
                                    >
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <div className={`p-3 rounded-xl shrink-0 ${
                                                m.tipo === 'FACTURA' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-green-50 text-green-600 dark:bg-green-900/20'
                                            }`}>
                                                {m.tipo === 'FACTURA' ? <FileText className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">
                                                        {m.descripcion}
                                                    </h4>
                                                    {m.tipo === 'FACTURA' && (
                                                        <button onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFacturaForPreview(m.data);
                                                            setIsPreviewModalOpen(true);
                                                        }} className="opacity-0 group-hover:opacity-100 transition-all text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-black text-gray-500 uppercase tracking-widest">
                                                            Ver PDF
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">
                                                    {new Date(m.fecha + 'T00:00:00').toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Movimiento</p>
                                                <div className="flex flex-col">
                                                    {m.debe > 0 && <p className="font-black text-red-500">-$ {m.debe.toLocaleString()}</p>}
                                                    {m.haber > 0 && <p className="font-black text-green-600">+$ {m.haber.toLocaleString()}</p>}
                                                </div>
                                            </div>

                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Saldo</p>
                                                <p className="font-black text-gray-900 dark:text-white">$ {m.saldo.toLocaleString()}</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-center min-w-[80px]">
                                                    {m.tipo === 'FACTURA' && (
                                                        <>
                                                            {m.estado === EstadoFacturaProveedor.PENDIENTE && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedFacturaForPago(m.data); setIsPagoModalOpen(true); }}
                                                                    className="w-full px-3 py-1.5 text-[10px] font-black rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors uppercase tracking-widest"
                                                                >
                                                                    PAGAR
                                                                </button>
                                                            )}
                                                            {m.estado === EstadoFacturaProveedor.PAGADO_PARCIAL && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedFacturaForPago(m.data); setIsPagoModalOpen(true); }}
                                                                    className="w-full px-3 py-1.5 text-[10px] font-black rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors uppercase tracking-widest"
                                                                >
                                                                    PARCIAL
                                                                </button>
                                                            )}
                                                            {m.estado === EstadoFacturaProveedor.PAGADO && (
                                                                <span className="inline-block w-full px-3 py-1.5 text-[10px] font-black rounded-lg bg-green-100 text-green-600 uppercase tracking-widest text-center">
                                                                    PAGADO
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {m.tipo === 'PAGO' && (
                                                        <span className="inline-block w-full px-3 py-1.5 text-[10px] font-black rounded-lg bg-blue-100 text-blue-600 uppercase tracking-widest text-center">
                                                            ANTICIPO
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {hasPagos && (
                                                    <div className="text-gray-400">
                                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && hasPagos && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20"
                                            >
                                                <div className="p-4 pl-16 space-y-3">
                                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pagos imputados a esta factura</h5>
                                                    <div className="grid gap-2">
                                                        {m.pagosAsociados.map((p, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-gray-900 dark:text-white">Pago {p.metodo}</p>
                                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                                            {new Date(p.fecha + 'T00:00:00').toLocaleDateString()}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm font-black text-green-600">+$ {p.monto.toLocaleString()}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}

                    {movimientosConSaldo.length === 0 && (
                        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-400 italic font-medium">No se encontraron movimientos financieros para este proveedor.</p>
                        </div>
                    )}
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
