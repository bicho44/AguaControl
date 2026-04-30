import React, { useState, useMemo } from 'react';
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
import { Eye, Edit, Trash2, CheckCircle2, FileDown, Search, Filter } from 'lucide-react';

import { PagoProveedorModal } from './PagoProveedorModal';
import { FacturaPreviewModal } from './FacturaPreviewModal';
// @ts-ignore
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const FacturasList: React.FC<{ pendingOnly?: boolean }> = ({ pendingOnly = false }) => {
    const { facturasProveedor, proveedores } = useDataStore();
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedFacturaForPago, setSelectedFacturaForPago] = useState<FacturaProveedor | null>(null);
    const [selectedFacturaForPreview, setSelectedFacturaForPreview] = useState<FacturaProveedor | null>(null);
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
        alicuotasIva: [],
        percepciones: 0,
        otrosImpuestos: [],
        total: 0,
        estado: EstadoFacturaProveedor.PENDIENTE,
        items: []
    });

    const [filtroProveedorId, setFiltroProveedorId] = useState<string>('');
    const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>('');
    const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>('');

    const proveedoresOptions = useMemo(() => [
        { value: '', label: 'Todos los Proveedores' },
        ...proveedores.map(p => ({ value: p.id, label: p.nombre }))
    ], [proveedores]);

    const filteredFacturas = useMemo(() => {
        let result = facturasProveedor;
        if (pendingOnly) {
            result = result.filter(f => f.estado === EstadoFacturaProveedor.PENDIENTE || f.estado === EstadoFacturaProveedor.PAGADO_PARCIAL);
        } else {
            if (filtroProveedorId) {
                result = result.filter(f => f.proveedorId === filtroProveedorId);
            }
            if (filtroFechaDesde) {
                result = result.filter(f => f.fechaEmision >= filtroFechaDesde);
            }
            if (filtroFechaHasta) {
                result = result.filter(f => f.fechaEmision <= filtroFechaHasta);
            }
        }
        return result.sort((a,b) => b.fechaEmision.localeCompare(a.fechaEmision));
    }, [facturasProveedor, pendingOnly, filtroProveedorId, filtroFechaDesde, filtroFechaHasta]);

    const calculateTotal = (data: Partial<FacturaProveedor>) => {
        const neto = parseFloat(String(data.subtotalNeto || 0));
        let totalIva = 0;
        
        if (data.alicuotasIva && data.alicuotasIva.length > 0) {
            totalIva = data.alicuotasIva.reduce((acc, curr) => acc + parseFloat(String(curr.importe || 0)), 0);
        } else {
            totalIva = parseFloat(String(data.importeIva || 0));
        }

        let totalOtros = 0;
        if (data.otrosImpuestos && data.otrosImpuestos.length > 0) {
            totalOtros = data.otrosImpuestos.reduce((acc, curr) => acc + parseFloat(String(curr.monto || 0)), 0);
        } else {
            totalOtros = parseFloat(String(data.percepciones || 0));
        }

        return Number((neto + totalIva + totalOtros).toFixed(2));
    };

    const addIva = () => {
        const currentIvas = Array.isArray(formData.alicuotasIva) ? formData.alicuotasIva : [];
        const updated = [...currentIvas, { alicuota: 21, importe: 0 }];
        const nextData = { ...formData, alicuotasIva: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const removeIva = (index: number) => {
        const currentIvas = Array.isArray(formData.alicuotasIva) ? formData.alicuotasIva : [];
        const updated = currentIvas.filter((_, i) => i !== index);
        // If we remove the last one and there was an original importeIva, maybe we want to keep it?
        // No, if user is using the list, they should use the list.
        const nextData = { ...formData, alicuotasIva: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const updateIva = (index: number, field: string, value: number) => {
        const currentIvas = Array.isArray(formData.alicuotasIva) ? formData.alicuotasIva : [];
        const updated = [...currentIvas];
        updated[index] = { ...updated[index], [field]: value };
        const nextData = { ...formData, alicuotasIva: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const addTax = () => {
        const currentTaxes = Array.isArray(formData.otrosImpuestos) ? formData.otrosImpuestos : [];
        const updated = [...currentTaxes, { nombre: '', monto: 0 }];
        const nextData = { ...formData, otrosImpuestos: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const removeTax = (index: number) => {
        const currentTaxes = Array.isArray(formData.otrosImpuestos) ? formData.otrosImpuestos : [];
        const updated = currentTaxes.filter((_, i) => i !== index);
        const nextData = { ...formData, otrosImpuestos: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const updateTax = (index: number, field: string, value: any) => {
        const currentTaxes = Array.isArray(formData.otrosImpuestos) ? formData.otrosImpuestos : [];
        const updated = [...currentTaxes];
        updated[index] = { ...updated[index], [field]: value };
        const nextData = { ...formData, otrosImpuestos: updated };
        setFormData({ ...nextData, total: calculateTotal(nextData) });
    };

    const handleSave = async () => {
        if (!formData.proveedorId || !formData.numero || !formData.total) {
            showNotification('Proveedor, número y total son obligatorios', 'error');
            return;
        }

        const dataToSave = {
            ...formData,
            saldoPagar: editingItem ? (formData.total! - (editingItem.total - editingItem.saldoPagar)) : formData.total // Initial balance is total
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
        setFormData({
            ...fac,
            alicuotasIva: fac.alicuotasIva || [],
            otrosImpuestos: fac.otrosImpuestos || []
        });
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
            alicuotasIva: [],
            percepciones: 0,
            otrosImpuestos: [],
            total: 0, 
            estado: EstadoFacturaProveedor.PENDIENTE,
            items: []
        });
        setIsModalOpen(true);
    };

    const handleExportCSV = () => {
        if (filteredFacturas.length === 0) {
            showNotification('No hay facturas para exportar', 'error');
            return;
        }

        const headers = [
            'Fecha Emision', 'Fecha Vto', 'Comprobante', 'Numero', 'Proveedor', 'CUIT', 'Neto', 'IVA', 'Alicuota', 'Percepciones', 'Total', 'Estado'
        ].join(',');

        const rows = filteredFacturas.map(f => {
            const prop = proveedores.find(p => p.id === f.proveedorId);
            return [
                f.fechaEmision,
                f.fechaVencimiento || '',
                f.tipoComprobante || 'A',
                f.numero,
                prop?.nombre || 'Desconocido',
                prop?.cuit || '',
                f.subtotalNeto || 0,
                f.importeIva || 0,
                f.alicuotaIva || 21,
                f.percepciones || 0,
                f.total || 0,
                f.estado || ''
            ].map(val => `"${val}"`).join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `informe_contador_facturas_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = () => {
        if (filteredFacturas.length === 0) {
            showNotification('No hay facturas para exportar', 'error');
            return;
        }

        const doc = new jsPDF();
        
        let totalNeto = 0;
        let totalIva = 0;
        let totalPerc = 0;
        let totalGral = 0;

        const tableData = filteredFacturas.map(f => {
            const prop = proveedores.find(p => p.id === f.proveedorId);
            totalNeto += Number(f.subtotalNeto || 0);
            totalIva += Number(f.importeIva || 0);
            totalPerc += Number(f.percepciones || 0);
            totalGral += Number(f.total || 0);

            return [
                f.fechaEmision,
                prop?.nombre || 'Desconocido',
                prop?.cuit || '',
                `${f.tipoComprobante} ${f.numero}`,
                `$${Number(f.subtotalNeto || 0).toFixed(2)}`,
                `$${Number(f.importeIva || 0).toFixed(2)}`,
                `$${Number(f.percepciones || 0).toFixed(2)}`,
                `$${Number(f.total || 0).toFixed(2)}`
            ];
        });

        // Add summary row
        tableData.push([
            'TOTALES',
            '', '', '',
            `$${totalNeto.toFixed(2)}`,
            `$${totalIva.toFixed(2)}`,
            `$${totalPerc.toFixed(2)}`,
            `$${totalGral.toFixed(2)}`
        ]);

        doc.setFontSize(18);
        doc.text('Informe de Facturas de Proveedores', 14, 22);
        
        doc.setFontSize(10);
        doc.text(`Fecha de emisión del reporte: ${new Date().toLocaleDateString()}`, 14, 30);
        if (filtroFechaDesde || filtroFechaHasta) {
             doc.text(`Período: ${filtroFechaDesde || 'Inicio'} al ${filtroFechaHasta || 'Fin'}`, 14, 35);
        }

        (doc as any).autoTable({
            startY: 45,
            head: [['Fecha', 'Proveedor', 'CUIT', 'Comprobante', 'Neto', 'IVA', 'Perc.', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data: any) => {
                const isLastRow = data.row.index === tableData.length - 1;
                if (isLastRow) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save(`informe_facturas_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="space-y-4">
            {!pendingOnly && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 gap-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Facturas Recibidas</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <AppButton variant="secondary" onClick={handleExportCSV}>
                            <FileDown className="w-4 h-4 mr-2 inline-block" />
                            Exportar Contador
                        </AppButton>
                        <AppButton variant="secondary" onClick={handleExportPDF}>
                            <FileDown className="w-4 h-4 mr-2 inline-block" />
                            Exportar Resumen (PDF)
                        </AppButton>
                        <AppButton onClick={openNew}>+ Ingresar Factura</AppButton>
                    </div>
                </div>
            )}

            {!pendingOnly && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <SearchableSelect 
                            options={proveedoresOptions} 
                            value={filtroProveedorId} 
                            onChange={v => setFiltroProveedorId(v)}
                            label=""
                            placeholder="Buscar proveedor..."
                        />
                    </div>
                    <div className="flex-none sm:w-40">
                        <AppInput 
                            type="date"
                            value={filtroFechaDesde}
                            onChange={e => setFiltroFechaDesde(e.target.value)}
                        />
                    </div>
                    <div className="flex-none sm:w-40">
                        <AppInput 
                            type="date"
                            value={filtroFechaHasta}
                            onChange={e => setFiltroFechaHasta(e.target.value)}
                        />
                    </div>
                    {(filtroProveedorId || filtroFechaDesde || filtroFechaHasta) && (
                        <div className="flex-none flex items-center">
                            <button 
                                onClick={() => { setFiltroProveedorId(''); setFiltroFechaDesde(''); setFiltroFechaHasta(''); }}
                                className="text-sm font-bold text-gray-500 hover:text-red-500 underline"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    )}
                </div>
            )}

            {pendingOnly && (
                <h3 className="text-lg font-bold dark:text-white">Próximos Vencimientos (Facturas Impagas)</h3>
            )}

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
                            {filteredFacturas.map(f => {
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
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => {
                                                    setSelectedFacturaForPreview(f);
                                                    setIsPreviewModalOpen(true);
                                                }} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow" title="Ver">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {f.estado !== EstadoFacturaProveedor.PAGADO && (
                                                    <button onClick={() => {
                                                        setSelectedFacturaForPago(f);
                                                        setIsPagoModalOpen(true);
                                                    }} className="p-1.5 text-green-500 hover:text-white hover:bg-green-600 rounded-lg transition-colors border border-transparent hover:border-green-500 shadow-sm hover:shadow" title="Pagar">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => openEdit(f)} className="p-1.5 text-primary-500 hover:text-white hover:bg-primary-600 rounded-lg transition-colors border border-transparent hover:border-primary-500 shadow-sm hover:shadow" title="Editar">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-500 hover:text-white hover:bg-red-600 rounded-lg transition-colors border border-transparent hover:border-red-500 shadow-sm hover:shadow" title="Eliminar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredFacturas.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No hay facturas cargadas en este período/filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <FacturaPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => {
                    setIsPreviewModalOpen(false);
                    setSelectedFacturaForPreview(null);
                }}
                factura={selectedFacturaForPreview}
                proveedor={proveedores.find(p => p.id === selectedFacturaForPreview?.proveedorId)}
            />

            <PagoProveedorModal 
                isOpen={isPagoModalOpen} 
                onClose={() => {
                    setIsPagoModalOpen(false);
                    setSelectedFacturaForPago(null);
                }} 
                initialFacturaId={selectedFacturaForPago?.id} 
                initialProveedorId={selectedFacturaForPago?.proveedorId} 
            />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Factura' : 'Ingresar Factura'}>
                <div className="space-y-4">
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
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between items-center">
                            Desglose de Importes
                            <div className="flex gap-2 text-[10px]">
                                <button onClick={addIva} className="text-primary-600 hover:bg-primary-50 px-2 py-0.5 rounded border border-primary-200 font-bold transition-colors">+ Agregar IVA</button>
                                <button onClick={addTax} className="text-amber-600 hover:bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold transition-colors">+ Agregar Imp/Perc</button>
                            </div>
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                            <AppInput 
                                label="Subtotal Neto ($)" 
                                type="number" 
                                value={formData.subtotalNeto || ''} 
                                onChange={e => {
                                    const nextData = {...formData, subtotalNeto: parseFloat(e.target.value) || 0};
                                    setFormData({...nextData, total: calculateTotal(nextData)});
                                }} 
                                className="bg-white" 
                            />
                            
                            {/* Alícuotas IVA */}
                            <div className="space-y-2">
                                {(formData.alicuotasIva?.length || 0) > 0 ? (
                                    <>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Detalle de IVA</p>
                                        {formData.alicuotasIva?.map((iva, idx) => (
                                            <div key={idx} className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <AppSelect 
                                                        label="Alicuota" 
                                                        value={String(iva.alicuota)} 
                                                        onChange={e => updateIva(idx, 'alicuota', parseFloat(e.target.value))} 
                                                        options={[{label:'21%', value:'21'}, {label:'10.5%', value:'10.5'}, {label:'27%', value:'27'}, {label:'0%', value:'0'}]} 
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <AppInput 
                                                        label="Importe ($)" 
                                                        type="number" 
                                                        value={iva.importe || ''} 
                                                        onChange={e => updateIva(idx, 'importe', parseFloat(e.target.value) || 0)} 
                                                        className="bg-white" 
                                                    />
                                                </div>
                                                <button onClick={() => removeIva(idx)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar IVA">×</button>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <AppSelect label="Alícuota" value={String(formData.alicuotaIva || 21)} onChange={e => setFormData({...formData, alicuotaIva: parseFloat(e.target.value) || 0})} options={[{label:'21%', value:'21'}, {label:'10.5%', value:'10.5'}, {label:'27%', value:'27'}, {label:'Exento', value:'0'}]} />
                                        <AppInput label="Importe IVA ($)" type="number" value={formData.importeIva || ''} onChange={e => {
                                            const nextData = {...formData, importeIva: parseFloat(e.target.value) || 0};
                                            setFormData({...nextData, total: calculateTotal(nextData)});
                                        }} className="bg-white" />
                                    </div>
                                )}
                            </div>

                            {/* Otros Impuestos / Percepciones */}
                            <div className="space-y-2">
                                {(formData.otrosImpuestos?.length || 0) > 0 ? (
                                    <>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Otros Impuestos / Percepciones</p>
                                        {formData.otrosImpuestos?.map((imp, idx) => (
                                            <div key={idx} className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <AppInput 
                                                        label="Concepto" 
                                                        value={imp.nombre} 
                                                        onChange={e => updateTax(idx, 'nombre', e.target.value)} 
                                                        placeholder="Ej: IIBB"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <AppInput 
                                                        label="Monto ($)" 
                                                        type="number" 
                                                        value={imp.monto || ''} 
                                                        onChange={e => updateTax(idx, 'monto', parseFloat(e.target.value) || 0)} 
                                                        className="bg-white" 
                                                    />
                                                </div>
                                                <button onClick={() => removeTax(idx)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar Impuesto">×</button>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <AppInput 
                                        label="Percepciones/Imp. ($)" 
                                        type="number" 
                                        value={formData.percepciones || ''} 
                                        onChange={e => {
                                            const nextData = {...formData, percepciones: parseFloat(e.target.value) || 0};
                                            setFormData({...nextData, total: calculateTotal(nextData)});
                                        }} 
                                        className="bg-white" 
                                    />
                                )}
                            </div>
                            
                            <AppInput 
                                label="Total ($) *" 
                                type="number" 
                                value={formData.total || ''} 
                                onChange={e => setFormData({...formData, total: parseFloat(e.target.value) || 0})} 
                                className="bg-white font-bold text-primary-600" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Conceptos / Detalle (Markdown)</label>
                        <textarea 
                            value={formData.observacionesMarkdown || ''} 
                            onChange={e => setFormData({...formData, observacionesMarkdown: e.target.value})}
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-full h-32 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Detalle de items adquiridos (soporta Markdown)..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Notas Internas</label>
                        <textarea 
                            value={formData.observaciones || ''} 
                            onChange={e => setFormData({...formData, observaciones: e.target.value})}
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-full h-16 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Notas o referencias internas..."
                        />
                    </div>
                    
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
