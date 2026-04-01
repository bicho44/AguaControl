
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

import MovimientoCajaForm from '../components/MovimientoCajaForm';

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
  addPagoManual: (pago: any) => Promise<void>;
  updateRegistroPago: (pago: RegistroPago) => Promise<void>;
  updateVentaVendedor: (venta: VentaVendedor) => Promise<void>;
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
      <hgroup>
        <h2 style={{ margin: 0 }}>{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
        <p>Configuración de acceso y comisiones</p>
      </hgroup>
      <div className="space-y-4">
          <AppInput label="Nombre Completo" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
          <AppInput label="Correo Electrónico" type="email" name="email" value={formData.email || ''} onChange={handleChange} required />
          <AppInput label="Contraseña" type="password" name="password" placeholder="Solo para cambiar..." onChange={handleChange} />
          <div className="grid">
              <AppSelect label="Rol" name="rol" value={formData.rol || ''} onChange={handleChange} options={Object.values(Rol).map(r => ({value: r, label: r}))} required />
              <AppSelect label="Tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} options={[{value: TipoVendedor.INTERNO, label: 'Interno (Empleado)'}, {value: TipoVendedor.EXTERNO, label: 'Externo (Revendedor)'}]} required />
          </div>
          
          {isInternal && (
              <fieldset className="pt-4">
                  <legend className="text-xs font-black uppercase tracking-widest px-2 mb-2">Comisiones por Producto</legend>
                  <div className="space-y-2">
                    {(formData.comisiones || []).map((comision, index) => (
                        <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                            <div className="flex-1 min-w-[150px]"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={comision.productoId} onChange={(v) => handleComisionChange(index, 'productoId', v)} /></div>
                            <div className="w-full sm:w-32"><AppInput type="number" value={comision.monto} onChange={(e) => handleComisionChange(index, 'monto', e.target.value)} step="0.01" placeholder="$ Comision" /></div>
                            <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, comisiones: formData.comisiones?.filter((_,i)=>i!==index)})} className="!p-2" style={{ marginBottom: '1rem' }}><TrashIcon/></AppButton>
                        </div>
                    ))}
                    <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, comisiones: [...(formData.comisiones || []), {productoId: '', monto: 0}]})} className="w-full border-dashed border-2">+ Agregar Comisión Específica</AppButton>
                  </div>
              </fieldset>
          )}
      </div>

      {isExternal && (
        <fieldset className="pt-4">
            <legend className="text-xs font-black uppercase tracking-widest px-2 mb-2">Precios de Reventa Especiales</legend>
            <div className="space-y-2">
            {(formData.preciosEspeciales || []).map((precio, index) => (
                <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                    <div className="flex-1 min-w-[150px]"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={precio.productoId} onChange={(v) => handlePrecioEspecialChange(index, 'productoId', v)} /></div>
                    <div className="w-full sm:w-32"><AppInput type="number" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} step="0.01" /></div>
                    <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: formData.preciosEspeciales?.filter((_,i)=>i!==index)})} className="!p-2" style={{ marginBottom: '1rem' }}><TrashIcon/></AppButton>
                </div>
            ))}
            <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: [...(formData.preciosEspeciales || []), {productoId: '', precio: 0}]})} className="w-full border-dashed border-2">+ Agregar Precio</AppButton>
            </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
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
    clientes: Cliente[];
    vendedores: Usuario[];
    productos: Producto[];
    productosMap: Map<string, Producto>;
    onClose: () => void;
    onSaveMovement: (data: any, isVenta: boolean) => Promise<void>;
    onDeletePayment: (id: string) => Promise<void>;
    onDeleteSale: (id: string) => Promise<void>;
}> = ({ user, ventas, pagos, clientes, vendedores, productos, productosMap, onClose, onSaveMovement, onDeletePayment, onDeleteSale }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formConfig, setFormConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
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
                detalle: `${v.movimientos.length} items`,
                original: v
            });
        });

        // Agrupar pagos por origen.id para que coincida con la lógica de edición de Caja
        const pagosAgrupados = misPagos.reduce((acc: Record<string, RegistroPago[]>, p) => {
            const k = p.origen.id;
            if (!acc[k]) acc[k] = [];
            acc[k].push(p);
            return acc;
        }, {});

        let pagado = 0;
        Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
            const p1 = grupo[0];
            const totalGrupo = grupo.reduce((sum, p) => sum + p.monto, 0);
            pagado += totalGrupo;
            historialCombinado.push({
                id: p1.origen.id,
                type: 'payment',
                fecha: p1.fecha,
                concepto: `Pago (${grupo.length > 1 ? 'Múltiple' : p1.metodo})`,
                monto: totalGrupo,
                detalle: p1.concepto || '-',
                original: grupo
            });
        });

        historialCombinado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { totalComprado: comprado, totalPagado: pagado, saldoPendiente: comprado - pagado, historial: historialCombinado };
    }, [ventas, pagos, user.id, productosMap, user.preciosEspeciales]);

    const handleOpenNewPayment = () => {
        setFormConfig({
            type: 'ingreso',
            isEdit: false,
            data: { 
                fecha: getLocalDateString(), 
                vendedorId: user.id,
                pagos: [{ monto: 0, metodo: MetodoPago.EFECTIVO }] 
            }
        });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (h: any) => {
        if (h.type === 'sale') {
            setFormConfig({ type: 'ingreso', isEdit: true, data: h.original });
        } else {
            const original = h.original as RegistroPago[];
            const p1 = original[0];
            setFormConfig({ 
                type: 'ingreso', 
                isEdit: true, 
                data: { ...p1, pagos: original.map(p => ({ monto: p.monto, metodo: p.metodo })) } 
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, type: string, original: any) => {
        if (!window.confirm('¿Seguro que deseas eliminar este registro? Se ajustará el saldo.')) return;
        setDeletingId(id);
        try {
            if (type === 'payment') {
                const pagosArray = original as RegistroPago[];
                await Promise.all(pagosArray.map(p => onDeletePayment(p.id)));
            }
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

                <div className="flex justify-end">
                    <AppButton onClick={handleOpenNewPayment}>+ Registrar Cobro</AppButton>
                </div>

                <div className="overflow-x-auto max-h-96 border rounded-xl dark:border-gray-700">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Movimiento</th>
                                <th className="px-4 py-3">Detalle</th>
                                <th className="px-4 py-3 text-right">Importe</th>
                                <th className="px-4 py-3 w-20"></th>
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
                                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                                        <button onClick={() => handleOpenEdit(h)} className="text-blue-500 p-1" title="Editar"><PencilIcon className="w-4 h-4" /></button>
                                        <button 
                                            onClick={() => handleDelete(h.id, h.type, h.original)}
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

                {isFormOpen && (
                    <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} className="max-w-4xl">
                        <MovimientoCajaForm 
                            type={formConfig.type} 
                            movimiento={formConfig.data} 
                            isEdit={formConfig.isEdit} 
                            onSave={async (data, isVenta) => {
                                await onSaveMovement(data, isVenta);
                                setIsFormOpen(false);
                            }} 
                            onAddCliente={async () => ""} // No habilitado aquí
                            onClose={() => setIsFormOpen(false)} 
                            clientes={clientes} 
                            vendedores={vendedores} 
                            productos={productos} 
                            ventasVendedor={ventas}
                            hideClientSelector={true} // Forzar contexto de vendedor
                        />
                    </Modal>
                )}
            </div>
        </Modal>
    );
};

const UsuariosView: React.FC<UsuariosViewProps> = ({ 
    usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, 
    addUsuario, updateUsuario, addVentaVendedor, addPagoManual, updateRegistroPago, updateVentaVendedor, deleteRegistroPago, deleteVentaVendedor 
}) => {
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

  const handleSaveMovement = async (data: any, isVenta: boolean) => {
      try {
          if (isVenta) {
              if (data.id) await updateVentaVendedor(data);
              else await addVentaVendedor(data);
              showNotification('Venta/Stock actualizado.', 'success');
          } else {
              if (data.id) await updateRegistroPago(data);
              else await addPagoManual(data);
              showNotification('Pago actualizado.', 'success');
          }
      } catch (e) {
          console.error(e);
          showNotification('Error al guardar movimiento.', 'error');
      }
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
      <div className="grid">
        <h1 style={{ margin: 0 }}>Usuarios del Sistema</h1>
        <div style={{ textAlign: 'right' }}>
            <AppButton onClick={openNewModal}>
                + Nuevo Usuario <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
            </AppButton>
        </div>
      </div>
      <div className="responsive-grid">
        {sortedUsuarios.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <div>
                  <h3 className="text-xl font-bold" style={{ margin: 0 }}>{u.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <mark className="secondary" style={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}>{u.rol}</mark>
                      <mark style={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold', backgroundColor: u.tipo === TipoVendedor.EXTERNO ? '#fff3e0' : '#e3f2fd', color: u.tipo === TipoVendedor.EXTERNO ? '#e65100' : '#0d47a1' }}>{u.tipo}</mark>
                  </div>
              </div>
              <div className="flex gap-1">
                   {/* MODIFICADO: AHORA SE MUESTRA PARA TODOS LOS REPARTIDORES, NO SOLO EXTERNOS */}
                   {(u.rol === Rol.REPARTIDOR || u.tipo === TipoVendedor.EXTERNO) && (
                       <button onClick={() => setViewAccountUser(u)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors" style={{ border: 'none', background: 'none' }} title="Gestión de Cuenta Corriente"><CashIcon /></button>
                   )}
                   <button onClick={() => setEditingUsuario(u)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-full transition-colors" style={{ border: 'none', background: 'none' }} title="Editar Usuario"><PencilIcon /></button>
              </div>
            </div>
            <div className="mt-4 p-3 border rounded-xl space-y-2">
                <p className="text-sm font-mono truncate" style={{ marginBottom: 0 }}>{u.email}</p>
                {u.tipo === TipoVendedor.INTERNO && u.comisiones && u.comisiones.length > 0 && (
                    <div className="text-xs p-2 rounded border border-dashed">
                        <p className="font-bold" style={{ marginBottom: '0.25rem' }}>Comisiones Configuradas:</p>
                        <ul className="list-disc list-inside" style={{ marginBottom: 0 }}>
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
            clientes={clientes}
            vendedores={usuarios}
            productos={productos}
            productosMap={productosMap} 
            onClose={() => setViewAccountUser(null)} 
            onSaveMovement={handleSaveMovement}
            onDeletePayment={deleteRegistroPago}
            onDeleteSale={deleteVentaVendedor}
          />
      )}
    </div>
  );
};

export default UsuariosView;