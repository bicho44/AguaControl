
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto, ComisionProducto, Gasto } from '../types';
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

import CajaUnifiedForm from '../components/CajaUnifiedForm';
import RemitoForm from '../components/RemitoForm';

// Force sync

interface UsuariosViewProps {
  usuarios: Usuario[];
  registrosPago: RegistroPago[];
  remitos: Remito[];
  clientes: Cliente[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  gastos: Gasto[];
  addUsuario: (usuario: Omit<Usuario, 'id'>) => void;
  updateUsuario: (usuario: Usuario) => void;
  addVentaVendedor: (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
  addPagoManual: (pago: any) => Promise<void>;
  addGasto: (gasto: any) => Promise<void>;
  addRemito: (remito: any) => Promise<void>;
  updateRegistroPago: (pago: RegistroPago) => Promise<void>;
  updateVentaVendedor: (venta: VentaVendedor) => Promise<void>;
  updateRemito: (remito: any) => Promise<void>;
  addPagoToFactura: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => Promise<void>;
  deleteRegistroPago: (id: string) => Promise<void>;
  deleteVentaVendedor: (id: string) => Promise<void>;
  deleteRemito: (id: string) => Promise<void>;
  causasRecambio: any[];
  facturas: any[];
}

const UsuarioForm: React.FC<{
  usuario: Partial<Usuario>;
  productos: Producto[];
  clientes: Cliente[];
  onSave: (usuario: Omit<Usuario, 'id'> | Usuario) => void;
  onClose: () => void;
}> = ({ usuario, productos, clientes, onSave, onClose }) => {
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

          {formData.rol === Rol.CLIENTE && (
              <fieldset className="border-t dark:border-gray-600 pt-4">
                  <legend className="text-xs font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest px-2 mb-2">Vincular con Cliente</legend>
                  <SearchableSelect 
                      options={clientes.filter(c => c.estado === 'Activo').map(c => ({value: c.id, label: c.nombre}))} 
                      value={formData.clienteId || ''} 
                      onChange={(v) => setFormData(prev => ({ ...prev, clienteId: v }))} 
                      placeholder="Seleccione un cliente..."
                  />
                  <p className="mt-1 text-[10px] text-gray-500 italic">Esto permitirá al usuario ver su estado de cuenta personal al iniciar sesión.</p>
              </fieldset>
          )}
          
          {isInternal && formData.rol !== Rol.CLIENTE && (
              <fieldset className="border-t dark:border-gray-600 pt-4">
                  <legend className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest px-2 mb-2">Comisiones por Producto</legend>
                  <div className="space-y-2">
                    {(formData.comisiones || []).map((comision, index) => (
                        <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                            <div className="flex-1 min-w-[150px]"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={comision.productoId} onChange={(v) => handleComisionChange(index, 'productoId', v)} /></div>
                            <div className="w-full sm:w-32"><AppInput type="number" value={comision.monto} onChange={(e) => handleComisionChange(index, 'monto', e.target.value)} step="0.01" placeholder="$ Comision" /></div>
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
                <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                    <div className="flex-1 min-w-[150px]"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={precio.productoId} onChange={(v) => handlePrecioEspecialChange(index, 'productoId', v)} /></div>
                    <div className="w-full sm:w-32"><AppInput type="number" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} step="0.01" /></div>
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
    gastos: Gasto[];
    remitos: Remito[];
    clientes: Cliente[];
    vendedores: Usuario[];
    productos: Producto[];
    productosMap: Map<string, Producto>;
    onClose: () => void;
    onSaveMovement: (data: any, type: 'REMITO' | 'PAGO' | 'GASTO') => Promise<void>;
    onSaveRemito: (remito: Remito) => Promise<void>;
    onDeletePayment: (id: string) => Promise<void>;
    onDeleteSale: (id: string) => Promise<void>;
    onDeleteRemito: (id: string) => Promise<void>;
    registrosPago: RegistroPago[];
    causasRecambio: any[];
    facturas: any[];
    onAddPagoToFactura: any;
}> = ({ 
    user, ventas, pagos, gastos, remitos, clientes, vendedores, productos, productosMap, 
    onClose, onSaveMovement, onSaveRemito, onDeletePayment, onDeleteSale, onDeleteRemito,
    registrosPago, causasRecambio, facturas, onAddPagoToFactura
}) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isRemitoOpen, setIsRemitoOpen] = useState(false);
    const [formConfig, setFormConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
    const [remitoData, setRemitoData] = useState<any>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { totalComprado, totalPagado, totalGastos, saldoPendiente, historial } = useMemo(() => {
        const misVentas = ventas.filter(v => v.vendedorId === user.id && !v.clienteId);
        const misRemitos = remitos.filter(r => r.vendedorId === user.id && !r.clienteId && !r.esAjuste);
        const misPagos = pagos.filter(p => p.vendedorId === user.id);
        const misGastos = gastos.filter(g => g.vendedorId === user.id);
        
        let comprado = 0;
        let totalG = 0;
        const historialCombinado: any[] = [];

        // 1. Ventas Históricas (VentaVendedor)
        misVentas.forEach(v => {
            let totalVenta = 0;
            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = (m.precioUnitario !== undefined && m.precioUnitario !== null) 
                        ? m.precioUnitario 
                        : (precioEsp || prod.precioReventa || prod.precio);
                    totalVenta += m.cantidad * precioFinal;
                }
            });
            comprado += totalVenta;
            historialCombinado.push({
                id: v.id,
                type: 'sale',
                fecha: v.fecha,
                concepto: 'Compra de Stock (Histórica)',
                monto: -totalVenta,
                detalle: `${v.movimientos.length} items`,
                original: v
            });
        });

        // 2. Ventas Unificadas (Remitos)
        misRemitos.forEach(r => {
            let totalRemito = 0;
            const defaultPriceType = user.tipo === TipoVendedor.EXTERNO ? 'reventa' : 'lista';

            r.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioSugerido = defaultPriceType === 'reventa' ? (prod.precioReventa || prod.precio) : prod.precio;
                    const precioFinal = m.precioUnitario || precioEsp || precioSugerido;
                    totalRemito += m.entregados * precioFinal;
                }
            });
            comprado += totalRemito;
            historialCombinado.push({
                id: r.id,
                type: 'remito',
                fecha: r.fecha,
                concepto: `Compra de Stock (#${r.puntoVenta}-${r.numero})`,
                monto: -totalRemito,
                detalle: `${r.movimientos.length} items`,
                original: r
            });
        });

        // Procesar Gastos asignados (Deuda)
        misGastos.forEach(g => {
            const montoGasto = g.pagos.reduce((sum, p) => sum + p.monto, 0);
            totalG += montoGasto;
            historialCombinado.push({
                id: g.id,
                type: 'expense',
                fecha: g.fecha,
                concepto: `Gasto Asignado: ${g.concepto}`,
                monto: -montoGasto,
                detalle: g.nroRecibo ? `Recibo: ${g.nroRecibo}` : '-',
                original: g
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
            
            let detalle = p1.concepto || '-';
            if (p1.clienteId) {
                const cli = clientes.find(c => c.id === p1.clienteId);
                detalle = `Cliente: ${cli?.nombre || 'N/A'}${p1.concepto ? ` - ${p1.concepto}` : ''}`;
            }

            historialCombinado.push({
                id: p1.origen.id,
                type: 'payment',
                fecha: p1.fecha,
                concepto: `Pago (${grupo.length > 1 ? 'Múltiple' : p1.metodo})`,
                monto: totalGrupo,
                detalle,
                original: grupo
            });
        });

        historialCombinado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { 
            totalComprado: comprado, 
            totalPagado: pagado, 
            totalGastos: totalG,
            saldoPendiente: (comprado + totalG) - pagado, 
            historial: historialCombinado 
        };
    }, [ventas, remitos, pagos, gastos, user.id, productosMap, user.preciosEspeciales, user.tipo, clientes]);

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
            setIsFormOpen(true);
        } else if (h.type === 'remito') {
            setRemitoData(h.original);
            setIsRemitoOpen(true);
        } else {
            const original = h.original as RegistroPago[];
            const p1 = original[0];
            setFormConfig({ 
                type: 'ingreso', 
                isEdit: true, 
                data: { ...p1, pagos: original.map(p => ({ monto: p.monto, metodo: p.metodo })) } 
            });
            setIsFormOpen(true);
        }
    };

    const handleDelete = async (id: string, type: string, original: any) => {
        if (!window.confirm('¿Seguro que deseas eliminar este registro? Se ajustará el saldo.')) return;
        setDeletingId(id);
        try {
            if (type === 'payment') {
                const pagosArray = original as RegistroPago[];
                await Promise.all(pagosArray.map(p => onDeletePayment(p.id)));
            } else if (type === 'sale') {
                await onDeleteSale(id);
            } else if (type === 'remito') {
                await onDeleteRemito(id);
            }
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
                        <CajaUnifiedForm 
                            initialType="VENTA"
                            productos={productos}
                            clientes={clientes}
                            vendedores={vendedores}
                            currentUser={user}
                            remitos={remitos}
                            registrosPago={registrosPago}
                            causasRecambio={[]}
                            onSaveRemito={async (r) => { 
                                await onSaveMovement(r, 'REMITO'); 
                                setIsFormOpen(false); 
                            }}
                            onSaveGasto={async (g) => { 
                                await onSaveMovement(g, 'GASTO'); 
                                setIsFormOpen(false); 
                            }}
                            onAddCliente={async () => ""}
                            onClose={() => setIsFormOpen(false)}
                        />
                    </Modal>
                )}

                {isRemitoOpen && (
                    <Modal isOpen={isRemitoOpen} onClose={() => setIsRemitoOpen(false)}>
                        <RemitoForm 
                            remito={remitoData}
                            clientes={[]} // Autocompra
                            vendedores={vendedores}
                            productos={productos}
                            currentUser={user}
                            onAddCliente={async () => ""}
                            onSave={async (r) => {
                                await onSaveRemito(r as Remito);
                                setIsRemitoOpen(false);
                            }}
                            onClose={() => setIsRemitoOpen(false)}
                            remitos={remitos}
                            registrosPago={registrosPago}
                            causasRecambio={causasRecambio}
                            facturas={facturas}
                            onAddPagoToFactura={onAddPagoToFactura}
                        />
                    </Modal>
                )}
            </div>
        </Modal>
    );
};

const UsuariosView: React.FC<UsuariosViewProps> = ({ 
    usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, gastos,
    addUsuario, updateUsuario, addVentaVendedor, addPagoManual, addGasto, updateRegistroPago, updateVentaVendedor, deleteRegistroPago, deleteVentaVendedor,
    addRemito, updateRemito, deleteRemito, addPagoToFactura, causasRecambio, facturas
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

  const handleSaveMovement = async (data: any, type: 'REMITO' | 'PAGO' | 'GASTO') => {
      try {
          if (type === 'REMITO') {
              if (data.id) await updateRemito(data);
              else await addRemito(data);
              showNotification('Operación de Stock registrada.', 'success');
          } else if (type === 'GASTO') {
              await addGasto(data);
              showNotification('Gasto registrado.', 'success');
          } else {
              if (data.id) await updateRegistroPago(data);
              else await addPagoManual(data);
              showNotification('Pago registrado.', 'success');
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
            <UsuarioForm usuario={editingUsuario} productos={productos} clientes={clientes} onSave={handleSaveUsuario} onClose={() => setEditingUsuario(null)} />
        </Modal>
      )}
      {viewAccountUser && (
          <VendorAccountModal 
            user={viewAccountUser} 
            ventas={ventasVendedor} 
            pagos={registrosPago} 
            gastos={gastos}
            remitos={remitos}
            clientes={clientes}
            vendedores={usuarios}
            productos={productos}
            productosMap={productosMap} 
            onClose={() => setViewAccountUser(null)} 
            onSaveMovement={handleSaveMovement}
            onSaveRemito={async (r) => {
                if (r.id) await updateRemito(r);
                else await addRemito(r);
                showNotification('Compra de stock actualizada.', 'success');
            }}
            onDeletePayment={deleteRegistroPago}
            onDeleteSale={deleteVentaVendedor}
            onDeleteRemito={deleteRemito}
            registrosPago={registrosPago}
            causasRecambio={causasRecambio}
            facturas={facturas}
            onAddPagoToFactura={addPagoToFactura}
          />
      )}
    </div>
  );
};

export default UsuariosView;