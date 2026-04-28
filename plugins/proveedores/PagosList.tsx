import React, { useState } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import AppButton from '../../components/ui/AppButton';
import { PagoProveedorModal } from './PagoProveedorModal';

export const PagosList: React.FC = () => {
    const { pagosProveedor, facturasProveedor, proveedores } = useDataStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Pagos Emitidos</h3>
                <AppButton onClick={() => setIsModalOpen(true)}>+ Registrar Pago</AppButton>
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

            <PagoProveedorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default PagosList;
