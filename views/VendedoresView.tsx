
// views/UsuariosView.tsx

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';

interface UsuariosViewProps {
  usuarios: Usuario[];
  registrosPago: RegistroPago[];
  remitos: Remito[];
  clientes: Cliente[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  addUsuario: (usuario: Omit<Usuario, 'id'>) => void;
  updateUsuario: (usuario: Usuario) => void;
  addVentaVendedor: (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
}

const UsuarioForm: React.FC<{
  usuario: Partial<Usuario>;
  productos: Producto[];
  onSave: (usuario: Omit<Usuario, 'id'> | Usuario) => void;
  onClose: () => void;
}> = ({ usuario, productos, onSave, onClose }) => {
  const [formData, setFormData] = useState(usuario);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrecioEspecialChange = (index: number, field: 'productoId' | 'precio', value: string) => {
    const newPrecios = [...(formData.preciosEspeciales || [])];
    const updatedValue = field === 'precio' ? (value === '' ? 0 : Number(value)) : value;
    newPrecios[index] = { ...newPrecios[index], [field]: updatedValue };
    setFormData(prev => ({ ...prev, preciosEspeciales: newPrecios }));
  }

  const addPrecioEspecial = () => {
    const newPrecio = { productoId: '', precio: 0 };
    setFormData(prev => ({ ...prev, preciosEspeciales: [...(prev.preciosEspeciales || []), newPrecio] }));
  }

  const removePrecioEspecial = (index: number) => {
    setFormData(prev => ({ ...prev, preciosEspeciales: prev.preciosEspeciales?.filter((_, i) => i !== index) }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Usuario);
  };

  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto pr-2">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
      <input type="text" name="nombre" placeholder="Nombre" value={formData.nombre || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      <input type="email" name="email" placeholder="Email" value={formData.email || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      <input type="password" name="password" placeholder="Contraseña (dejar en blanco para no cambiar)" onChange={handleChange} className="w-full p-3 bg-gray-200 dark:bg-gray-700 rounded-md"/>
      
      <div className="grid grid-cols-2 gap-4">
        <select name="rol" value={formData.rol || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
            <option value="">Rol</option>
            {Object.values(Rol).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="tipo" value={formData.tipo || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
            <option value="">Tipo</option>
            <option value={TipoVendedor.INTERNO}>Interno</option>
            <option value={TipoVendedor.EXTERNO}>Externo</option>
        </select>
      </div>

      {formData.tipo === TipoVendedor.EXTERNO && (
        <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
            <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Precios de Reventa (Especiales)</legend>
            <p className="text-xs text-gray-500 mb-2 px-2">Si un producto no figura aquí, se usará el precio de lista.</p>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {(formData.preciosEspeciales || []).map((precio, index) => (
                <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                    <select value={precio.productoId} onChange={(e) => handlePrecioEspecialChange(index, 'productoId', e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-600 rounded-md text-sm" required>
                        <option value="">Seleccionar Producto</option>
                        {productosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="number" placeholder="Precio" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-600 rounded-md font-bold" step="0.01" min="0" required />
                    <button type="button" onClick={() => removePrecioEspecial(index)} className="text-red-500 p-2"><TrashIcon className="h-4 w-4" /></button>
                </div>
            ))}
            </div>
            <button type="button" onClick={addPrecioEspecial} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50">+ Agregar Precio de Reventa</button>
        </fieldset>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">Guardar Cambios</button>
      </div>
    </form>
  )
}

const VentaVendedorForm: React.FC<{
  usuarios: Usuario[];
  productos: Producto[];
  onSave: (venta: Omit<VentaVendedor, 'id'|'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
  onClose: () => void;
}> = ({ usuarios, productos, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<VentaVendedor> & { pagos?: PagoDetalle[] }>({
        fecha: new Date().toISOString().split('T')[0],
        movimientos: [],
        pagos: []
    });

    const vendedoresExternos = useMemo(() => usuarios.filter(v => v.tipo === TipoVendedor.EXTERNO), [usuarios]);
    const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMovimientoChange = (index: number, field: keyof MovimientoVenta, value: string) => {
        const newMovimientos = [...(formData.movimientos || [])];
        const numValue = value === '' ? 0 : Number(value);
        if (field === 'cantidad') {
            newMovimientos[index] = { ...newMovimientos[index], [field]: numValue };
        } else {
            newMovimientos[index] = { ...newMovimientos[index], [field]: value };
        }
        setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
    }

    const addMovimiento = () => {
        const newMovimiento: MovimientoVenta = { productoId: '', cantidad: 1 };
        setFormData(prev => ({...prev, movimientos: [...(prev.movimientos || []), newMovimiento]}));
    }

    const removeMovimiento = (index: number) => {
        setFormData(prev => ({...prev, movimientos: prev.movimientos?.filter((_, i) => i !== index)}));
    }

    const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
        const newPagos = [...(formData.pagos || [])];
        const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
        newPagos[index] = { ...newPagos[index], [field]: updatedValue };
        setFormData(prev => ({ ...prev, pagos: newPagos }));
    }

    const addPago = () => {
        const newPago: PagoDetalle = { monto: 0, metodo: MetodoPago.EFECTIVO };
        setFormData(prev => ({...prev, pagos: [...(prev.pagos || []), newPago]}));
    }

    const removePago = (index: number) => {
        setFormData(prev => ({...prev, pagos: prev.pagos?.filter((_, i) => i !== index)}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Omit<VentaVendedor, 'id'|'pagoIds'> & { pagos: PagoDetalle[] });
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Nueva Venta a Vendedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                <select name="vendedorId" value={formData.vendedorId || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                    <option value="">Seleccionar Vendedor Externo</option>
                    {vendedoresExternos.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
            </div>

            <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Productos Comprados</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {(formData.movimientos || []).map((mov, index) => (
                        <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                            <select value={mov.productoId} onChange={(e) => handleMovimientoChange(index, 'productoId', e.target.value)} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                                <option value="">Seleccionar Producto</option>
                                {productosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                            <input type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} required min="1" className="w-full text-center p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                            <button type="button" onClick={() => removeMovimiento(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addMovimiento} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Producto</button>
            </fieldset>

            <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Forma de Pago</legend>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                    {(formData.pagos || []).map((pago, index) => (
                        <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                            <input type="number" value={pago.monto || ''} onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} min="0" step="0.01" placeholder="Monto" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                            <select value={pago.metodo} onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                                {Object.values(MetodoPago).map(metodo => <option key={metodo} value={metodo}>{metodo}</option>)}
                            </select>
                            <button type="button" onClick={() => removePago(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addPago} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Pago</button>
            </fieldset>

            <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">Guardar Venta</button>
            </div>
        </form>
    )
}

const PagosVendedorModal: React.FC<{
    usuario: Usuario;
    pagos: RegistroPago[];
    clientesMap: Map<string, Cliente>;
    onClose: () => void;
}> = ({ usuario, pagos, clientesMap, onClose }) => {
    const total = useMemo(() => pagos.reduce((sum, p) => sum + p.monto, 0), [pagos]);

    return (
        <Modal isOpen={true} onClose={onClose} className="max-w-4xl">
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Cobranzas de {usuario.nombre}</h2>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">Total: ${total.toLocaleString()}</span>
                </div>
                
                {pagos.length > 0 ? (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2">Fecha</th>
                                <th className="px-4 py-2">Cliente</th>
                                <th className="px-4 py-2">Método</th>
                                <th className="px-4 py-2 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map(p => (
                                <tr key={p.id} className="border-b dark:border-gray-700">
                                    <td className="px-4 py-2">{new Date(p.fecha + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-4 py-2">{clientesMap.get(p.clienteId || '')?.nombre || 'Venta Mostrador'}</td>
                                    <td className="px-4 py-2">{p.metodo}</td>
                                    <td className="px-4 py-2 text-right font-bold">${p.monto.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-center py-8 text-gray-500">No hay registros de cobranza para este usuario.</p>
                )}
                
                <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md font-medium">Cerrar</button>
                </div>
            </div>
        </Modal>
    );
};

const ComprasVendedorModal: React.FC<{
    usuario: Usuario;
    ventas: VentaVendedor[];
    registrosPago: RegistroPago[];
    productosMap: Map<string, Producto>;
    onClose: () => void;
}> = ({ usuario, ventas, registrosPago, productosMap, onClose }) => {
    
    // 1. Preparar datos para el gráfico mensual (Últimos 6 meses)
    const chartData = useMemo(() => {
        const data: Record<string, number> = {};
        const months = [];
        const today = new Date();
        
        // Crear labels para los últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
            data[key] = 0;
            months.push(key);
        }

        const preciosEspecialesMap = new Map(usuario.preciosEspeciales?.map(p => [p.productoId, p.precio]));

        ventas.forEach(v => {
            const date = new Date(v.fecha + 'T00:00:00');
            const key = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
            
            if (data[key] !== undefined) {
                const totalVenta = v.movimientos.reduce((sum, m) => {
                    const prod = productosMap.get(m.productoId);
                    const precio = preciosEspecialesMap.get(m.productoId) ?? (prod?.precio || 0);
                    return sum + (m.cantidad * precio);
                }, 0);
                data[key] += totalVenta;
            }
        });

        return months.map(name => ({ name, total: data[name] }));
    }, [ventas, productosMap, usuario.preciosEspeciales]);

    const totalInvertido = useMemo(() => {
        const preciosEspecialesMap = new Map(usuario.preciosEspeciales?.map(p => [p.productoId, p.precio]));
        return ventas.reduce((sum, v) => {
            return sum + v.movimientos.reduce((mSum, m) => {
                const prod = productosMap.get(m.productoId);
                const precio = preciosEspecialesMap.get(m.productoId) ?? (prod?.precio || 0);
                return mSum + (m.cantidad * precio);
            }, 0);
        }, 0);
    }, [ventas, productosMap, usuario.preciosEspeciales]);

    return (
        <Modal isOpen={true} onClose={onClose} className="max-w-4xl">
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Compras de {usuario.nombre}</h2>
                        <p className="text-sm text-gray-500">Vendedor Externo</p>
                    </div>
                    <div className="text-right">
                         <span className="text-lg font-bold text-blue-600 dark:text-blue-400">Total Histórico: ${totalInvertido.toLocaleString()}</span>
                    </div>
                </div>

                {/* Gráfico de Evolución */}
                <Card title="Evolución Mensual de Compras ($)">
                    <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" opacity={0.2} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
                                <Tooltip 
                                    formatter={(val: number) => [`$${val.toLocaleString()}`, 'Total Mes']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#2563eb' : '#93c5fd'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Listado de Operaciones */}
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">Historial de Transacciones</h3>
                    <div className="space-y-2">
                        {ventas.map(v => {
                            const preciosEspecialesMap = new Map(usuario.preciosEspeciales?.map(p => [p.productoId, p.precio]));
                            const totalVenta = v.movimientos.reduce((sum, m) => {
                                const prod = productosMap.get(m.productoId);
                                const precio = preciosEspecialesMap.get(m.productoId) ?? (prod?.precio || 0);
                                return sum + (m.cantidad * precio);
                            }, 0);
                            
                            return (
                                <div key={v.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{new Date(v.fecha + 'T00:00:00').toLocaleDateString()}</p>
                                        <div className="flex gap-2 mt-1">
                                            {v.movimientos.map((m, idx) => (
                                                <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                    {m.cantidad} x {productosMap.get(m.productoId)?.nombre}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-gray-900 dark:text-white">${totalVenta.toLocaleString()}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {ventas.length === 0 && <p className="text-center py-8 text-gray-500 italic">No se han registrado compras aún.</p>}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="px-6 py-2 bg-primary-600 text-white rounded-md font-bold hover:bg-primary-700">Cerrar</button>
                </div>
            </div>
        </Modal>
    );
};


const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, addUsuario, updateUsuario, addVentaVendedor }) => {
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);
  const [isVentaModalOpen, setIsVentaModalOpen] = useState(false);
  const [viewingPagosUsuario, setViewingPagosUsuario] = useState<any | null>(null);
  const [viewingComprasUsuario, setViewingComprasUsuario] = useState<any | null>(null);
  const { showNotification } = useNotification();

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const usuarioStats = useMemo(() => {
    return usuarios.map(usuario => {
      if (usuario.tipo === TipoVendedor.INTERNO) {
        const usuarioPagos = registrosPago.filter(p => p.vendedorId === usuario.id)
            .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const totalCobrado = usuarioPagos.reduce((sum, p) => sum + p.monto, 0);
        const usuarioRemitos = remitos.filter(r => r.vendedorId === usuario.id);
        const productosEntregados = usuarioRemitos.reduce((sum, r) => sum + r.movimientos.reduce((movSum, mov) => movSum + mov.entregados, 0), 0);
        return { ...usuario, stats: { type: 'interno' as const, productosEntregados, totalCobrado, pagos: usuarioPagos }};
      } else { // EXTERNO
        const misVentas = ventasVendedor.filter(v => v.vendedorId === usuario.id)
            .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const productosComprados = misVentas.reduce((sum, venta) => sum + venta.movimientos.reduce((movSum, mov) => movSum + mov.cantidad, 0), 0);
        
        const misVentasIds = misVentas.map(v => v.id);
        const misPagos = registrosPago.filter(p => p.origen.tipo === 'venta_vendedor' && misVentasIds.includes(p.origen.id));
        const totalPagado = misPagos.reduce((sum, p) => sum + p.monto, 0);

        return { ...usuario, stats: { type: 'externo' as const, productosComprados, totalPagado, ventas: misVentas }};
      }
    });
  }, [usuarios, remitos, registrosPago, ventasVendedor]);
  
  const handleSaveUsuario = (usuario: Omit<Usuario, 'id'> | Usuario) => {
    try {
        if ('id' in usuario) {
          updateUsuario(usuario);
          showNotification('Usuario actualizado con éxito.', 'success');
        } else {
          addUsuario(usuario);
          showNotification('Usuario creado con éxito.', 'success');
        }
        setEditingUsuario(null);
    } catch (e) {
        showNotification('Error al guardar el usuario.', 'error');
        console.error(e);
    }
  };

  const handleSaveVenta = (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => {
    try {
        addVentaVendedor(venta);
        setIsVentaModalOpen(false);
        showNotification('Venta a vendedor registrada con éxito.', 'success');
    } catch (e) {
        showNotification('Error al registrar la venta.', 'error');
        console.error(e);
    }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestión de Usuarios</h1>
        <div className="space-x-2">
            <button onClick={() => setEditingUsuario({ rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO })} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">
                + Usuario
            </button>
            <button onClick={() => setIsVentaModalOpen(true)} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                + Venta a Externo
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarioStats.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-semibold">{u.nombre}</h3>
               <button onClick={() => setEditingUsuario(u)} className="text-gray-400 hover:text-primary-500">
                    <PencilIcon className="h-5 w-5" />
               </button>
            </div>
            <div className="space-y-3 mt-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{u.rol}</span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{u.email}</span>
                </div>
                 {u.stats.type === 'interno' ? (
                  <>
                    <p>Productos entregados: <span className="font-bold">{u.stats.productosEntregados}</span></p>
                    <p>Total cobrado: <span className="font-bold text-green-500">${u.stats.totalCobrado.toLocaleString()}</span></p>
                    <button onClick={() => setViewingPagosUsuario(u)} className="w-full text-center px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
                        Ver Cobranzas ({u.stats.pagos.length})
                    </button>
                  </>
                ) : (
                  <>
                    <p>Productos comprados: <span className="font-bold">{u.stats.productosComprados}</span></p>
                    <p>Total pagado: <span className="font-bold text-green-500">${u.stats.totalPagado.toLocaleString()}</span></p>
                    <button onClick={() => setViewingComprasUsuario(u)} className="w-full text-center px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
                        Ver Compras ({u.stats.ventas.length})
                    </button>
                  </>
                )}
            </div>
          </Card>
        ))}
      </div>

      {editingUsuario && (
        <Modal isOpen={!!editingUsuario} onClose={() => setEditingUsuario(null)}>
            <UsuarioForm
                usuario={editingUsuario}
                productos={productos}
                onSave={handleSaveUsuario}
                onClose={() => setEditingUsuario(null)}
            />
        </Modal>
      )}
      
      {isVentaModalOpen && (
          <Modal isOpen={isVentaModalOpen} onClose={() => setIsVentaModalOpen(false)}>
              <VentaVendedorForm
                usuarios={usuarios}
                productos={productos}
                onSave={handleSaveVenta}
                onClose={() => setIsVentaModalOpen(false)}
              />
          </Modal>
      )}

      {viewingPagosUsuario && (
          <PagosVendedorModal
            usuario={viewingPagosUsuario}
            pagos={viewingPagosUsuario.stats.pagos || []}
            clientesMap={clientesMap}
            onClose={() => setViewingPagosUsuario(null)}
          />
      )}

      {viewingComprasUsuario && (
          <ComprasVendedorModal
            usuario={viewingComprasUsuario}
            ventas={viewingComprasUsuario.stats.ventas || []}
            registrosPago={registrosPago}
            productosMap={productosMap}
            onClose={() => setViewingComprasUsuario(null)}
          />
      )}
    </div>
  );
};

export default UsuariosView;
