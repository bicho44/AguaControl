import React, { useState } from 'react';
import { EstadoFactura, Factura, Remito, RegistroPago, Producto, Cliente } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, FileText, Receipt, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface TransactionRowProps {
    item: any;
    type: 'factura' | 'remito';
    payments: RegistroPago[];
    total: number;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ item, type, payments, total }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const pagado = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
    const saldo = total - pagado;
    
    const isPaid = type === 'factura' ? item.estado === EstadoFactura.PAGADO : (saldo <= 0 && total > 0);
    const isPartial = pagado > 0 && saldo > 0;

    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden mb-3 transition-all hover:shadow-md bg-white dark:bg-gray-800">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="p-4 cursor-pointer flex items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                        type === 'factura' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20'
                    }`}>
                        {type === 'factura' ? <FileText className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">
                            {type === 'factura' 
                                ? `Factura ${item.puntoVenta !== undefined && item.numeroComprobante !== undefined ? `${item.puntoVenta.toString().padStart(4, '0')}-${item.numeroComprobante.toString().padStart(8, '0')}` : (item.numero || 'S/N')}` 
                                : `Remito ${item.puntoVenta}-${item.numero}`}
                        </h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                            {new Date(item.fecha + 'T00:00:00').toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                        <p className="font-black text-gray-900 dark:text-white">${total.toLocaleString()}</p>
                        <div className="flex items-center justify-end gap-1">
                            {isPaid ? (
                                <span className="text-[10px] font-bold text-green-500 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> PAGADO</span>
                            ) : isPartial ? (
                                <span className="text-[10px] font-bold text-orange-500 flex items-center gap-0.5"><Clock className="w-3 h-3" /> PARCIAL (-${saldo.toLocaleString()})</span>
                            ) : (
                                <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> PENDIENTE</span>
                            )}
                        </div>
                    </div>
                    {payments.length > 0 && (
                        <div className="text-gray-400">
                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && payments.length > 0 && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-4 space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pagos Imputados</p>
                            {payments.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            {new Date(p.fecha + 'T00:00:00').toLocaleDateString()} - {p.metodo}
                                        </p>
                                    </div>
                                    <p className="text-xs font-black text-gray-900 dark:text-white">+ ${p.monto.toLocaleString()}</p>
                                </div>
                            ))}
                            <div className="pt-2 flex justify-between border-t border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] font-bold text-gray-500">TOTAL PAGADO</p>
                                <p className="text-[10px] font-black text-green-600">${pagado.toLocaleString()}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface AccountStatementProps {
    cliente: Cliente;
    facturas: Factura[];
    remitos: Remito[];
    productos: Producto[];
    registrosPago: RegistroPago[];
    showTitle?: boolean;
}

export const AccountStatement: React.FC<AccountStatementProps> = ({ cliente, facturas, remitos, productos, registrosPago, showTitle = true }) => {
    const productosMap = new Map(productos.map(p => [p.id, p]));
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

    const getRemitoTotal = (r: Remito) => {
        return r.movimientos.reduce((sum: number, mov: any) => {
            const prod = productosMap.get(mov.productoId);
            if (!prod) return sum;
            const precio = mov.precioUnitario ?? preciosEspecialesMap.get(mov.productoId) ?? prod.precio;
            return sum + (mov.entregados * precio);
        }, 0);
    };

    const timelineItems = [
        ...facturas
            .filter(f => f.clienteId === cliente.id)
            .map(f => ({ ...f, _type: 'factura' as const, _total: f.monto })),
        ...remitos
            .filter(r => r.clienteId === cliente.id && !r.facturaId && !r.esAjuste)
            .map(r => ({ ...r, _type: 'remito' as const, _total: getRemitoTotal(r) }))
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const deudaTotal = timelineItems.reduce((sum, item) => {
        if (item._type === 'factura' && item.estado === EstadoFactura.ANULADO) return sum;
        const subPagado = (item.pagoIds || []).reduce((ps: number, id: string) => {
            const pago = registrosPago.find(p => p.id === id);
            return ps + (pago?.monto || 0);
        }, 0);
        return sum + (item._total - subPagado);
    }, 0);

    return (
        <div className="space-y-6">
            {showTitle && (
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter leading-none">Cuenta Corriente</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">{cliente.nombre}</p>
                    </div>
                    <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-xl">
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Saldo Deuda</p>
                        <p className="text-3xl font-black">${deudaTotal.toLocaleString()}</p>
                    </div>
                </header>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between px-4 mb-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Timeline de Transacciones</h3>
                </div>

                {timelineItems.length > 0 ? (
                    timelineItems.map(item => (
                        <TransactionRow 
                            key={item.id}
                            item={item}
                            type={item._type}
                            total={item._total}
                            payments={(item.pagoIds || []).map((id: string) => registrosPago.find(p => p.id === id)).filter(Boolean)}
                        />
                    ))
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-12 text-center text-gray-400 italic">
                        Sin movimientos registrados
                    </div>
                )}
            </div>
        </div>
    );
};
