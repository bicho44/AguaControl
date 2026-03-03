
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto, ComisionProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';
import { CashIcon } from '../components/icons/CashIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import SearchableSelect from '../components/SearchableSelect';
import { getLocalDateString } from '../utils/dateUtils';

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
  deleteRegistroPago: (id: string) => Promise<void>;
  deleteVentaVendedor: (id: string) => Promise<void>;
}

const UsuarioForm: React.FC<{
  usuario: Partial<Usuario>;
  productos: Producto[];
  onSave: (usuario: Omit<Usuario, 'id'> | Usuario) => void;
  onClose: () => void;
}> = ({ usuario, productos, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    comisiones: [],
    preciosEspeciales: [],
    ...usuario
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrecioEspecialChange = (index: number, field: 'productoId' | 'precio', value: string) => {
    const newPrecios = [...(formData.preciosEspeciales || [])];
    newPrecios[index] = { ...newPrecios[index], [field]: field === 'precio' ? (value === '' ? 0 : Number(value)) : value };
    setFormData(prev => ({ ...prev, preciosEspeciales: newPrecios }));
  }

  const handleComisionChange = (index: number, field: 'productoId' | 'monto', value: string) => {
    const newComisiones = [...(formData.comisiones || [])];
    newComisiones[index] = { ...newComisiones[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setFormData(prev => ({ ...prev, comisiones: newComisiones }));
  }

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData as Usuario);
  }, [formData, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);

  const isInternal = formData.tipo === TipoVendedor.INTERNO;
  const isExternal = formData.tipo === TipoVendedor.EXTERNO;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter pr-12">{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
      <div className="space-y-4">
          <AppInput label="Nombre Completo" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
          <AppInput label="Correo Electrónico" type="email" name="email" value={formData.email || ''} onChange={handleChange} required />
          <AppInput label="Contraseña" type="password" name="password" placeholder="Solo para cambiar..." onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4">
              <AppSelect label="Rol" name="rol" value={formData.rol || ''} onChange={handleChange} options={Object.values(Rol).map(r => ({value: r, label: r}))} required />
              <AppSelect label="Tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} options={[{value: TipoVendedor.INTERNO, label: 'Interno (Empleado)'}, {value: TipoVendedor.EXTERNO, label: 'Externo (Revendedor)'}]} required />
          </div>
          
          {isInternal && (
              <fieldset className="border-t dark:border-gray-600 pt-4">
                  <legend className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest px-2 mb-2">Comisiones por Producto</legend>
                  <div className="space-y-2">
                    {(formData.comisiones || []).map((comision, index) => (
                        <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={comision.productoId} onChange={(v) => handleComisionChange(index, 'productoId', v)} /></div>
                            <div className="w-32"><AppInput type="number" value={comision.monto} onChange={(e) => handleComisionChange(index, 'monto', e.target.value)} step="0.01" placeholder="$ Comision" /></div>
                            <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, comisiones: formData.comisiones?.filter((_,i)=>i!==index)})} className="!p-2"><TrashIcon/></AppButton>
                        </div>
                    ))}
                    <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, comisiones: [...(formData.comisiones || []), {productoId: '', monto: 0}]})} className="w-full border-dashed border-2 text-blue-600 border-blue-200">+ Agregar Comisión Específica</AppButton>
                  </div>
              </fieldset>
          )}
      </div>

      {isExternal && (
        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">Precios de Reventa Especiales</legend>
            <div className="space-y-2">
            {(formData.preciosEspeciales || []).map((precio, index) => (
                <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={precio.productoId} onChange={(v) => handlePrecioEspecialChange(index, 'productoId', v)} /></div>
                    <div className="w-32"><AppInput type="number" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} step="0.01" /></div>
                    <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: formData.preciosEspeciales?.filter((_,i)=>i!==index)})} className="!p-2"><TrashIcon/></AppButton>
                </div>
            ))}
            <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: [...(formData.preciosEspeciales || []), {productoId: '', precio: 0}]})} className="w-full border-dashed border-2">+ Agregar Precio</AppButton>
            </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit" className="px-8">Guardar Usuario <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>
  )
}

const VendorAccountModal: React.FC<{
    user: Usuario;
    ventas: VentaVendedor[];
    pagos: RegistroPago[];
    productosMap: Map<string, Producto>;
    onClose: () => void;
    onAddPayment: (pago: any) => void;
    onDeletePayment: (id: string) => Promise<void>;
    onDeleteSale: (id: string) => Promise<void>;
}> = ({ user, ventas, pagos, productosMap, onClose, onAddPayment, onDeletePayment, onDeleteSale }) => {
    const [isPaymentMode, setIsPaymentMode] = useState(false);
    const [paymentData, setPaymentData] = useState<{ monto: number, metodo: MetodoPago, concepto: string }>({ monto: 0, metodo: MetodoPago.EFECTIVO, concepto: '' });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { totalComprado, totalPagado, saldoPendiente, historial } = useMemo(() => {
        const misVentas = ventas.filter(v => v.vendedorId === user.id && !v.clienteId);
        const misPagos = pagos.filter(p => p.vendedorId === user.id && !p.clienteId);
        
        let comprado = 0;
        const historialCombinado: any[] = [];

        misVentas.forEach(v => {
            let totalVenta = 0;
            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;
                }
            });
            comprado += totalVenta;
            historialCombinado.push({
                id: v.id,
                type: 'sale',
                fecha: v.fecha,
                concepto: 'Compra de Stock',
                monto: -totalVenta,
                detalle: `${v.movimientos.length} items`
            });
        });

        let pagado = 0;
        misPagos.forEach(p => {
            pagado += p.monto;
            historialCombinado.push({
                id: p.id,
                type: 'payment',
                fecha: p.fecha,
                concepto: `Pago (${p.metodo})`,
                monto: p.monto,
                detalle: p.concepto || '-'
            });
        });

        historialCombinado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { totalComprado: comprado, totalPagado: pagado, saldoPendiente: comprado - pagado, historial: historialCombinado };
    }, [ventas, pagos, user.id, productosMap, user.preciosEspeciales]);

    const handleSavePayment = () => {
        onAddPayment({
            fecha: getLocalDateString(),
            vendedorId: user.id,
            clienteId: null, // Es un pago del vendedor, no de un cliente
            concepto: paymentData.concepto || 'Pago a Cuenta',
            pagos: [{ monto: paymentData.monto, metodo: paymentData.metodo }]
        });
        setIsPaymentMode(false);
    };

    const handleDelete = async (id: string, type: string) => {
        if (!window.confirm('¿Seguro que deseas eliminar este registro? Se ajustará el saldo.')) return;
        setDeletingId(id);
        try {
            if (type === 'payment') await onDeletePayment(id);
            if (type === 'sale') await onDeleteSale(id);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} className="max-w-4xl">
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4 pr-12">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Cuenta Corriente</h2>
                        <p className="text-primary-600 font-bold">{user.nombre} <span className="text-xs text-gray-400 font-normal">({user.tipo})</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-black text-gray-400">Saldo Deudor</p>
                        <p className={`text-3xl font-black ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>${saldoPendiente.toLocaleString()}</p>
                    </div>
                </div>

                {isPaymentMode ? (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border dark:border-gray-700 space-y-4 animate-fade-in">
                        <h3 className="font-bold text-lg">Registrar Nuevo Pago</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AppInput label="Monto" type="number" value={paymentData.monto} onChange={e => setPaymentData({...paymentData, monto: Number(e.target.value)})} autoFocus />
                            <AppSelect label="Método" options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} value={paymentData.metodo} onChange={e => setPaymentData({...paymentData, metodo: e.target.value as MetodoPago})} />
                            <AppInput label="Concepto / Nota" value={paymentData.concepto} onChange={e => setPaymentData({...paymentData, concepto: e.target.value})} className="md:col-span-2" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <AppButton variant="secondary" onClick={() => setIsPaymentMode(false)}>Cancelar</AppButton>
                            <AppButton variant="success" onClick={handleSavePayment} disabled={paymentData.monto <= 0}>Confirmar Ingreso</AppButton>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-end">
                        <AppButton onClick={() => setIsPaymentMode(true)}>+ Registrar Cobro</AppButton>
                    </div>
                )}

                <div className="overflow-x-auto max-h-96 border rounded-xl dark:border-gray-700">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Movimiento</th>
                                <th className="px-4 py-3">Detalle</th>
                                <th className="px-4 py-3 text-right">Importe</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {historial.map((h, i) => (
                                <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-3 font-mono text-xs">{new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                    <td className="px-4 py-3 font-bold">{h.concepto}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{h.detalle}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${h.monto < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {h.monto < 0 ? '-' : '+'}${Math.abs(h.monto).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleDelete(h.id, h.type)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            title="Eliminar registro (Corrección)"
                                            disabled={deletingId === h.id}
                                        >
                                            {deletingId === h.id ? '...' : <TrashIcon className="w-4 h-4" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {historial.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin movimientos registrados.</td></tr>}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                    <AppButton variant="secondary" onClick={onClose}>Cerrar</AppButton>
                </div>
            </div>
        </Modal>
    );
};

const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, addUsuario, updateUsuario, addVentaVendedor, deleteRegistroPago, deleteVentaVendedor }) => {
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);
  const [viewAccountUser, setViewAccountUser] = useState<Usuario | null>(null);
  const { showNotification } = useNotification();

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  // Ordenar usuarios alfabéticamente
  const sortedUsuarios = useMemo(() => {
      return [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [usuarios]);

  const handleSaveUsuario = (u: Omit<Usuario, 'id'> | Usuario) => {
    try {
        if ('id' in u) updateUsuario(u as Usuario);
        else addUsuario(u as Omit<Usuario, 'id'>);
        showNotification('Guardado con éxito.', 'success');
        setEditingUsuario(null);
    } catch (e) { showNotification('Error al guardar.', 'error'); }
  };

  const handleAddPayment = async (pagoData: any) => {
      addVentaVendedor({
          fecha: pagoData.fecha,
          vendedorId: pagoData.vendedorId,
          movimientos: [], // Sin movimientos de stock
          pagos: pagoData.pagos // Solo dinero entrando
      });
      showNotification('Pago registrado (Ingreso a Caja).', 'success');
  };

  const openNewModal = useCallback(() => {
    setEditingUsuario({ rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO });
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'n' || e.key === 'N') && !editingUsuario && !viewAccountUser) {
            e.preventDefault();
            openNewModal();
        }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [editingUsuario, viewAccountUser, openNewModal]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Usuarios del Sistema</h1>
        <AppButton onClick={openNewModal}>
            + Nuevo Usuario <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
        </AppButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedUsuarios.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{u.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-black uppercase tracking-tighter text-gray-500">{u.rol}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tighter ${u.tipo === TipoVendedor.EXTERNO ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{u.tipo}</span>
                  </div>
              </div>
              <div className="flex gap-1">
                   {/* MODIFICADO: AHORA SE MUESTRA PARA TODOS LOS REPARTIDORES, NO SOLO EXTERNOS */}
                   {(u.rol === Rol.REPARTIDOR || u.tipo === TipoVendedor.EXTERNO) && (
                       <button onClick={() => setViewAccountUser(u)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors" title="Gestión de Cuenta Corriente"><CashIcon /></button>
                   )}
                   <button onClick={() => setEditingUsuario(u)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-full transition-colors" title="Editar Usuario"><PencilIcon /></button>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700 space-y-2">
                <p className="text-sm font-mono truncate">{u.email}</p>
                {u.tipo === TipoVendedor.INTERNO && u.comisiones && u.comisiones.length > 0 && (
                    <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/10 p-2 rounded">
                        <p className="font-bold">Comisiones Configuradas:</p>
                        <ul className="list-disc list-inside">
                            {u.comisiones.slice(0, 3).map((c, i) => {
                                const prodName = productos.find(p => p.id === c.productoId)?.nombre || 'Producto';
                                return <li key={i}>{prodName}: ${c.monto}</li>;
                            })}
                            {u.comisiones.length > 3 && <li>... y {u.comisiones.length - 3} más</li>}
                        </ul>
                    </div>
                )}
            </div>
          </Card>
        ))}
      </div>
      {editingUsuario && (
        <Modal isOpen={!!editingUsuario} onClose={() => setEditingUsuario(null)}>
            <UsuarioForm usuario={editingUsuario} productos={productos} onSave={handleSaveUsuario} onClose={() => setEditingUsuario(null)} />
        </Modal>
      )}
      {viewAccountUser && (
          <VendorAccountModal 
            user={viewAccountUser} 
            ventas={ventasVendedor} 
            pagos={registrosPago} 
            productosMap={productosMap} 
            onClose={() => setViewAccountUser(null)} 
            onAddPayment={handleAddPayment}
            onDeletePayment={deleteRegistroPago}
            onDeleteSale={deleteVentaVendedor}
          />
      )}
    </div>
  );
};

export default UsuariosView;