import React, { useState, useMemo } from 'react';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import SearchableSelect from '../../components/SearchableSelect';
import { TipoProducto, MetodoPago, Producto } from '../../types';
import { PlusCircleIcon, TrashIcon } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/Modal';

const PedidosPluginView: React.FC<{ dataStore: any }> = ({ dataStore }) => {
    const { clientes = [], productos = [], pedidos = [], addPedido, updatePedido, deletePedido } = dataStore || {};
    const { showNotification } = useNotification();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [clienteId, setClienteId] = useState('');
    const [fechaEsperada, setFechaEsperada] = useState(new Date().toISOString().split('T')[0]);
    const [pagado, setPagado] = useState(false);
    const [estado, setEstado] = useState<'PENDIENTE'|'ENTREGADO'|'CANCELADO'>('PENDIENTE');
    const [observaciones, setObservaciones] = useState('');
    const [productosPedido, setProductosPedido] = useState<{productoId: string, cantidad: number, precioUnitario: number}[]>([]);
    
    const [pagos, setPagos] = useState<{monto: number, metodo: MetodoPago}[]>([{monto: 0, metodo: MetodoPago.EFECTIVO}]);

    const activeClients = useMemo(() => clientes.filter((c: any) => c.estado === 'Activo').map((c: any) => ({value: c.id, label: c.nombre})), [clientes]);
    const clientesMap = useMemo(() => new Map(clientes.map((c: any) => [c.id, c])), [clientes]);
    const productosMap = useMemo(() => new Map(productos.map((p: any) => [p.id, p])), [productos]);

    const addProductoToFlow = () => {
        setProductosPedido([...productosPedido, {productoId: '', cantidad: 1, precioUnitario: 0}]);
    };

    const handleProductChange = (index: number, f: string, v: any) => {
        const newProducts = [...productosPedido];
        if (f === 'productoId') {
            const prod = productosMap.get(v);
            newProducts[index] = {
                ...newProducts[index],
                [f]: v,
                precioUnitario: prod?.precio || 0
            };
        } else {
            newProducts[index] = { ...newProducts[index], [f]: v };
        }
        setProductosPedido(newProducts);
    };

    const removeProduct = (idx: number) => {
        setProductosPedido(productosPedido.filter((_, i) => i !== idx));
    };

    const totalMonto = productosPedido.reduce((s, p) => s + (p.cantidad * p.precioUnitario), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!clienteId || productosPedido.length === 0 || productosPedido.some(p => !p.productoId || p.cantidad <= 0)) {
            showNotification('Complete todos los campos de productos y seleccione un cliente', 'error');
            return;
        }

        const newPedido = {
            fechaCreacion: new Date().toISOString().split('T')[0],
            fechaEsperada,
            clienteId,
            estado: 'PENDIENTE',
            pagado,
            montoTotal: totalMonto,
            productos: productosPedido,
            observaciones
        };

        try {
            await addPedido(newPedido, pagado ? pagos : undefined);
            showNotification('Pedido registrado correctamente', 'success');
            setIsFormOpen(false);
            resetForm();
        } catch(err) {
            showNotification('Error al crear pedido', 'error');
        }
    };

    const resetForm = () => {
        setClienteId('');
        setFetchDate(new Date().toISOString().split('T')[0]);
        setPagado(false);
        setProductosPedido([]);
        setPagos([{monto: 0, metodo: MetodoPago.EFECTIVO}]);
        setObservaciones('');
    };
    
    const setFetchDate = (d: string) => setFechaEsperada(d);

    const handleCancelPedido = async (id: string) => {
        if (!confirm('¿Seguro quieres cancelar este pedido?')) return;
        try {
            await updatePedido(id, { estado: 'CANCELADO' });
            showNotification('Pedido cancelado', 'success');
        } catch (e) {
            showNotification('Error al cancelar', 'error');
        }
    };

    const groupedPedidos = useMemo(() => {
        return {
            PENDIENTE: pedidos?.filter((p: any) => p.estado === 'PENDIENTE') || [],
            CERRADOS: pedidos?.filter((p: any) => p.estado !== 'PENDIENTE') || []
        };
    }, [pedidos]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white uppercase tracking-tighter">Toma de Pedidos</h1>
                <AppButton onClick={() => setIsFormOpen(true)}>
                    <PlusCircleIcon className="w-4 h-4 mr-2" /> Nuevo Pedido
                </AppButton>
            </div>

            <Card title="Pedidos Pendientes" className="border-t-4 border-t-amber-500">
                {groupedPedidos.PENDIENTE.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 uppercase font-black text-sm tracking-widest bg-gray-50 dark:bg-gray-800 rounded-xl">
                        No hay pedidos pendientes
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedPedidos.PENDIENTE.map((p: any) => (
                            <div key={p.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">
                                            {clientesMap.get(p.clienteId)?.nombre || 'Cliente Inactivo'}
                                        </h3>
                                        <p className="text-xs text-amber-600 font-bold uppercase mt-1">Entrega: {new Date(p.fechaEsperada + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                                    </div>
                                    <div className="text-right">
                                        {p.pagado && <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-black uppercase inline-block mb-1">Pagado</span>}
                                        <p className="font-bold text-primary-600">${p.montoTotal.toLocaleString('es-AR')}</p>
                                    </div>
                                </div>
                                <ul className="text-sm space-y-1 pt-2 border-t dark:border-gray-700">
                                    {(p.productos || []).map((prod: any, idx: number) => (
                                        <li key={idx} className="flex justify-between text-gray-600 dark:text-gray-300">
                                            <span>{prod.cantidad}x {productosMap.get(prod.productoId)?.nombre || 'Prod'}</span>
                                        </li>
                                    ))}
                                </ul>
                                {p.observaciones && <p className="text-xs italic text-gray-500 bg-gray-50 p-2 rounded">{p.observaciones}</p>}
                                <div className="flex justify-end pt-2">
                                    <AppButton variant="secondary" size="sm" onClick={() => handleCancelPedido(p.id)}>Cancelar Pedido</AppButton>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Nuevo Pedido" size="xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-tighter">Cliente *</label>
                            <SearchableSelect options={activeClients} value={clienteId} onChange={setClienteId} />
                        </div>
                        <AppInput label="Fecha Esperada *" type="date" value={fechaEsperada} onChange={e => setFechaEsperada(e.target.value)} required />
                    </div>

                    <fieldset className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl space-y-3">
                        <legend className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Productos del Pedido</legend>
                        {productosPedido.map((prod, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={productos.filter((p: any) => p.estado === 'Activo').map((p: any) => ({value: p.id, label: p.nombre}))} 
                                        value={prod.productoId} 
                                        onChange={v => handleProductChange(idx, 'productoId', v)} 
                                    />
                                </div>
                                <div className="w-24">
                                    <AppInput type="number" value={prod.cantidad} onChange={e => handleProductChange(idx, 'cantidad', parseInt(e.target.value) || 0)} min={1} />
                                </div>
                                <AppButton variant="danger" className="!p-2 mt-1" onClick={() => removeProduct(idx)}>
                                    <TrashIcon className="w-4 h-4" />
                                </AppButton>
                            </div>
                        ))}
                        <AppButton variant="secondary" size="sm" onClick={addProductoToFlow} className="w-full border-dashed border-2">
                            + Agregar Producto Estimado
                        </AppButton>
                    </fieldset>

                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer font-bold mb-4">
                            <input type="checkbox" checked={pagado} onChange={e => setPagado(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span>El cliente ha pagado por adelantado este pedido</span>
                        </label>
                        {pagado && (
                            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                                <div className="text-sm font-bold text-gray-500 uppercase">Resumen: Total a registrar: ${(totalMonto).toLocaleString('es-AR')}</div>
                                {pagos.map((p, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="flex-1">
                                            <AppInput type="number" step="0.01" value={p.monto} onChange={e => {
                                                const ns = [...pagos];
                                                ns[idx].monto = parseFloat(e.target.value) || 0;
                                                setPagos(ns);
                                            }} />
                                        </div>
                                        <div className="flex-1">
                                            <select className="w-full p-2 border rounded-lg bg-white" value={p.metodo} onChange={e => {
                                                const ns = [...pagos];
                                                ns[idx].metodo = e.target.value as MetodoPago;
                                                setPagos(ns);
                                            }}>
                                                {Object.values(MetodoPago).map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <AppInput label="Observaciones (Opcional)" value={observaciones} onChange={e => setObservaciones(e.target.value)} />

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <AppButton variant="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</AppButton>
                        <AppButton type="submit">Guardar Pedido <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PedidosPluginView;
