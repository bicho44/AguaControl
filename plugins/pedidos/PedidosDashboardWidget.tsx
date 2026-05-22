import React, { useMemo } from 'react';
import Card from '../../components/Card';
import { PackageSearchIcon } from 'lucide-react';

const PedidosDashboardWidget: React.FC<{ dataStore: any }> = ({ dataStore }) => {
    const { pedidos = [], clientes = [], productos = [] } = dataStore || {};

    const pedidosPendientes = useMemo(() => {
        return pedidos
            .filter((p: any) => p.estado === 'PENDIENTE')
            .sort((a: any, b: any) => new Date(a.fechaEsperada).getTime() - new Date(b.fechaEsperada).getTime());
    }, [pedidos]);

    const clientesMap = useMemo(() => new Map(clientes.map((c: any) => [c.id, c])), [clientes]);
    const productosMap = useMemo(() => new Map(productos.map((p: any) => [p.id, p])), [productos]);

    if (pedidosPendientes.length === 0) return null;

    return (
        <Card title="Pedidos Pendientes" className="border-t-4 border-t-amber-500">
            <div className="space-y-3">
                {pedidosPendientes.map((pedido) => (
                    <details key={pedido.id} className="group bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                        <summary className="flex items-center justify-between p-3 cursor-pointer list-none select-none">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-200">
                                    {clientesMap.get(pedido.clienteId)?.nombre || 'Cliente Bajas'}
                                </h4>
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase mt-1 flex items-center gap-1">
                                    <PackageSearchIcon className="w-3 h-3" />
                                    <span>Entrega Estimada: {new Date(pedido.fechaEsperada + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                {pedido.pagado && (
                                    <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold px-2 py-1 rounded">
                                        Pagado
                                    </span>
                                )}
                            </div>
                        </summary>
                        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                            <ul className="space-y-1">
                                {(pedido.productos || []).map((prod: any, idx: number) => (
                                    <li key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {prod.cantidad}x {productosMap.get(prod.productoId)?.nombre || 'Producto'}
                                        </span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                            ${(prod.cantidad * prod.precioUnitario).toLocaleString('es-AR')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {pedido.observaciones && (
                                <p className="mt-2 text-xs text-gray-500 italic bg-white dark:bg-gray-900 p-2 rounded">
                                    {pedido.observaciones}
                                </p>
                            )}
                        </div>
                    </details>
                ))}
            </div>
        </Card>
    );
};

export default PedidosDashboardWidget;
