import React from 'react';
import Modal from '../../components/Modal';
import { FacturaProveedor, Proveedor } from '../../types';
import AppButton from '../../components/ui/AppButton';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    factura: FacturaProveedor | null;
    proveedor: Proveedor | null | undefined;
}

export const FacturaPreviewModal: React.FC<Props> = ({ isOpen, onClose, factura, proveedor }) => {
    if (!factura) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalle de Factura" className="max-w-3xl">
            <div className="space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-4 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase">{proveedor?.nombre || 'Proveedor Desconocido'}</h2>
                        <p className="text-gray-500">CUIT: {proveedor?.cuit || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase">Comprobante</p>
                        <p className="text-xl font-bold text-gray-800 dark:text-white">
                            [{factura.tipoComprobante || 'A'}] {factura.numero}
                        </p>
                    </div>
                </div>

                {/* Dates & Status */}
                <div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border dark:border-gray-700">
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">F. Emisión</p>
                        <p className="font-medium dark:text-white">{factura.fechaEmision}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">F. Vencimiento</p>
                        <p className="font-medium dark:text-white">{factura.fechaVencimiento || '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Estado</p>
                        <span className="px-2 py-1 rounded text-xs font-bold bg-white dark:bg-gray-700 border">
                            {factura.estado}
                        </span>
                    </div>
                </div>

                {/* Markdown / Observaciones */}
                {(factura.observacionesMarkdown || factura.observaciones) && (
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase mb-2">Detalle / Conceptos</p>
                        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-xl text-sm prose dark:prose-invert max-w-none whitespace-pre-wrap">
                            {factura.observacionesMarkdown || factura.observaciones}
                        </div>
                    </div>
                )}

                {/* Importes */}
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-2">Desglose de Totales</p>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border dark:border-gray-700 space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Subtotal Neto</span>
                            <span className="font-medium dark:text-white">${factura.subtotalNeto?.toFixed(2) || '0.00'}</span>
                        </div>
                        
                        {/* IVAs */}
                        {(factura.alicuotasIva && factura.alicuotasIva.length > 0) ? (
                            factura.alicuotasIva.map((iva, idx) => (
                                <div key={idx} className="flex justify-between items-center pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                    <span className="text-gray-500">IVA ({iva.alicuota}%)</span>
                                    <span className="font-medium dark:text-white">${iva.importe?.toFixed(2)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">IVA ({factura.alicuotaIva || 21}%)</span>
                                <span className="font-medium dark:text-white">${factura.importeIva?.toFixed(2) || '0.00'}</span>
                            </div>
                        )}

                        {/* Otros Impuestos */}
                        {factura.otrosImpuestos && factura.otrosImpuestos.map((imp, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className="text-gray-500">{imp.nombre}</span>
                                <span className="font-medium dark:text-white">${imp.monto?.toFixed(2)}</span>
                            </div>
                        ))}

                        {/* Percepciones Legacy */}
                        {(!factura.otrosImpuestos || factura.otrosImpuestos.length === 0) && factura.percepciones ? (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">Otras Percepciones</span>
                                <span className="font-medium dark:text-white">${factura.percepciones?.toFixed(2)}</span>
                            </div>
                        ) : null}

                        <hr className="dark:border-gray-700" />
                        
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-bold uppercase text-gray-800 dark:text-white">Total</span>
                            <span className="font-black text-xl text-primary-600">${factura.total?.toFixed(2) || '0.00'}</span>
                        </div>
                        
                        <div className="flex justify-between items-center pt-1">
                            <span className="font-bold uppercase text-gray-800 dark:text-white">Saldo a Pagar</span>
                            <span className="font-black text-lg text-red-500">${factura.saldoPagar?.toFixed(2) || '0.00'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <AppButton onClick={onClose} variant="secondary">Cerrar</AppButton>
                </div>
            </div>
        </Modal>
    );
};
