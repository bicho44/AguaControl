
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../hooks/useDataStore';
import { EstadoFactura } from '../types';
import Card from '../components/Card';

const MyCustomerAccountView: React.FC = () => {
    const { user } = useAuth();
    const { clientes, facturas, remitos, productos, registrosPago } = useDataStore();

    const clienteId = user?.clienteId;
    const cliente = clientes.find(c => c.id === clienteId);

    if (!clienteId || !cliente) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cuenta no vinculada</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Su usuario no está vinculado a ninguna cuenta de cliente. Por favor, contacte con administración.</p>
            </div>
        );
    }

    const productosMap = new Map(productos.map(p => [p.id, p]));
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

    const getRemitoTotal = (r: any) => {
        return r.movimientos.reduce((sum: number, mov: any) => {
            const prod = productosMap.get(mov.productoId);
            if (!prod) return sum;
            const precio = mov.precioUnitario ?? preciosEspecialesMap.get(mov.productoId) ?? prod.precio;
            return sum + (mov.entregados * precio);
        }, 0);
    };

    // Facturas del cliente
    const facturasCliente = facturas
        .filter(f => f.clienteId === clienteId)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Remitos sin facturar
    const remitosSinFacturar = remitos
        .filter(r => r.clienteId === clienteId && !r.facturaId && !r.esAjuste)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Cálculo de Deuda Total
    const deudaTotal = facturasCliente
        .filter(f => f.estado !== EstadoFactura.PAGADO && f.estado !== EstadoFactura.ANULADO)
        .reduce((sum, f) => {
            const pagado = (f.pagoIds || []).reduce((ps, id) => {
                const pago = registrosPago.find(p => p.id === id);
                return ps + (pago?.monto || 0);
            }, 0);
            return sum + (f.monto - pagado);
        }, 0);

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white uppercase italic tracking-tighter">Mi Estado de Cuenta</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{cliente.nombre} | {cliente.cuit || 'S/C'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none">Saldo Pendiente</p>
                        <p className={`text-3xl font-black ${deudaTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            ${deudaTotal.toLocaleString('es-AR')}
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Facturas */}
                <Card title="Facturas y Comprobantes">
                    <div className="space-y-3">
                        {facturasCliente.length > 0 ? (
                            facturasCliente.map(f => {
                                const pagado = (f.pagoIds || []).reduce((s, id) => s + (registrosPago.find(p => p.id === id)?.monto || 0), 0);
                                const saldo = f.monto - pagado;
                                return (
                                    <div key={f.id} className="p-4 border dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-gray-200">{f.numero}</p>
                                            <p className="text-xs text-gray-500">{new Date(f.fecha + 'T00:00:00').toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900 dark:text-white">${f.monto.toLocaleString()}</p>
                                            <p className={`text-[10px] font-bold uppercase ${f.estado === EstadoFactura.PAGADO ? 'text-green-500' : 'text-orange-500'}`}>
                                                {f.estado} {saldo > 0 && `(Saldo: $${saldo.toLocaleString()})`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center py-8 text-gray-400 italic">No hay facturas registradas</p>
                        )}
                    </div>
                </Card>

                {/* Remitos Pendientes */}
                <Card title="Remitos sin Facturar">
                    <div className="space-y-3">
                        {remitosSinFacturar.length > 0 ? (
                            remitosSinFacturar.map(r => (
                                <div key={r.id} className="p-4 border dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">Remito {r.puntoVenta}-{r.numero}</p>
                                        <p className="text-xs text-gray-500">{new Date(r.fecha + 'T00:00:00').toLocaleDateString()}</p>
                                    </div>
                                    <p className="font-black text-primary-600 dark:text-primary-400">${getRemitoTotal(r).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-8 text-gray-400 italic">No hay remitos pendientes</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default MyCustomerAccountView;
