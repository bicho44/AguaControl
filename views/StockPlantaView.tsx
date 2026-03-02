
import React, { useState, useMemo } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import AppButton from '../components/ui/AppButton';
import SearchableSelect from '../components/SearchableSelect';
import { Producto, MovimientoStockPlanta, TipoProducto } from '../types';
import { useNotification } from '../context/NotificationContext';
import { getLocalDateString } from '../utils/dateUtils';

interface StockPlantaViewProps {
    productos: Producto[];
    movimientos: MovimientoStockPlanta[];
    addMovimiento: (mov: Omit<MovimientoStockPlanta, 'id'>) => Promise<string>;
}

const StockPlantaView: React.FC<StockPlantaViewProps> = ({ productos, movimientos, addMovimiento }) => {
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newMov, setNewMov] = useState<Partial<MovimientoStockPlanta>>({
        fecha: getLocalDateString(),
        tipo: 'entrada',
        concepto: 'Producción',
        cantidad: 0,
        esEnvase: false
    });

    const productosOptions = useMemo(() => 
        productos
            .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
            .map(p => ({ value: p.id, label: p.nombre })), 
    [productos]);

    const handleSave = async () => {
        if (!newMov.productoId || !newMov.cantidad || newMov.cantidad <= 0) {
            showNotification('Complete todos los campos correctamente', 'error');
            return;
        }

        try {
            await addMovimiento(newMov as Omit<MovimientoStockPlanta, 'id'>);
            showNotification('Movimiento registrado correctamente', 'success');
            setIsModalOpen(false);
            setNewMov({
                fecha: getLocalDateString(),
                tipo: 'entrada',
                concepto: 'Producción',
                cantidad: 0,
                esEnvase: false
            });
        } catch (e) {
            showNotification('Error al registrar movimiento', 'error');
        }
    };

    const sortedMovimientos = useMemo(() => 
        [...movimientos].sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime()),
    [movimientos]);

    const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

    return (
        <div className="space-y-6 pt-12 md:pt-0">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter italic">Stock Permanente en Planta</h1>
                <AppButton onClick={() => setIsModalOpen(true)}>+ Registrar Movimiento</AppButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {productos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).map(p => (
                    <Card key={p.id} title={p.nombre} compact>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                <p className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Llenos</p>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{p.stockPlanta || 0}</p>
                            </div>
                            {p.tipo === TipoProducto.RETORNABLE && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-100 dark:border-yellow-800">
                                    <p className="text-[9px] font-black uppercase text-yellow-600 dark:text-yellow-400">Vacíos</p>
                                    <p className="text-2xl font-black text-yellow-700 dark:text-yellow-300">{p.stockEnvases || 0}</p>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <Card title="Historial de Movimientos de Planta">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Concepto</th>
                                <th className="px-4 py-3 text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMovimientos.map(m => (
                                <tr key={m.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50">
                                    <td className="px-4 py-3 font-mono text-xs">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                    <td className="px-4 py-3 font-bold">
                                        {productosMap.get(m.productoId)?.nombre}
                                        {m.esEnvase && <span className="ml-2 text-[8px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded uppercase font-black">Envase</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                            m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 
                                            m.tipo === 'salida' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {m.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{m.concepto}</td>
                                    <td className={`px-4 py-3 text-right font-black ${m.tipo === 'entrada' ? 'text-green-600' : m.tipo === 'salida' ? 'text-red-600' : 'text-gray-600'}`}>
                                        {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '-' : ''}{m.cantidad}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isModalOpen && (
                <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title="Registrar Movimiento de Planta">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Fecha</label>
                                <input 
                                    type="date" 
                                    value={newMov.fecha} 
                                    onChange={e => setNewMov({...newMov, fecha: e.target.value})}
                                    className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Tipo de Stock</label>
                                <select 
                                    value={newMov.esEnvase ? 'envase' : 'lleno'}
                                    onChange={e => setNewMov({...newMov, esEnvase: e.target.value === 'envase'})}
                                    className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="lleno">Producto Lleno</option>
                                    <option value="envase">Envase Vacío</option>
                                </select>
                            </div>
                        </div>

                        <SearchableSelect 
                            label="Producto"
                            options={productosOptions}
                            value={newMov.productoId || ''}
                            onChange={val => setNewMov({...newMov, productoId: val})}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Operación</label>
                                <select 
                                    value={newMov.tipo}
                                    onChange={e => setNewMov({...newMov, tipo: e.target.value as any})}
                                    className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="entrada">Entrada (+)</option>
                                    <option value="salida">Salida (-)</option>
                                    <option value="ajuste">Ajuste Manual (=)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Cantidad</label>
                                <input 
                                    type="number" 
                                    value={newMov.cantidad}
                                    onChange={e => setNewMov({...newMov, cantidad: parseInt(e.target.value) || 0})}
                                    className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Concepto / Motivo</label>
                            <input 
                                type="text" 
                                value={newMov.concepto}
                                onChange={e => setNewMov({...newMov, concepto: e.target.value})}
                                placeholder="Ej: Compra a proveedor, Producción del día, Rotura..."
                                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <AppButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                            <AppButton onClick={handleSave}>Confirmar Movimiento</AppButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default StockPlantaView;
