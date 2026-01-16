
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, TipoVendedor, Producto, Movimiento, TipoProducto, PagoDetalle, RegistroPago, Rol, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';

type PaymentStatus = 'facturado' | 'pagado' | 'pagado_parcial' | 'pendiente' | 'gratis';
type PaymentStatusFilter = 'todos' | 'pendiente' | 'pagado' | 'facturado';

interface RemitosViewProps {
  remitos: Remito[];
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  registrosPago: RegistroPago[];
  currentUser: Usuario;
  addRemito: (remito: Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] }) => Promise<void>;
  updateRemito: (remito: Remito & { pagos?: PagoDetalle[] }) => Promise<void>;
  deleteRemito: (remitoId: string) => Promise<void>;
}

const RemitoForm: React.FC<{
  remito: Partial<Remito> & { pagos?: PagoDetalle[] };
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  currentUser: Usuario;
  onSave: (remito: (Omit<Remito, 'id' | 'pagoIds'> | Remito) & { pagos?: PagoDetalle[] }) => Promise<void>;
  onClose: () => void;
  remitos: Remito[];
  registrosPago: RegistroPago[];
  isReadOnly?: boolean;
}> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onClose, remitos, registrosPago, isReadOnly = false }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>({});
  const [clienteSucursales, setClienteSucursales] = useState<Sucursal[]>([]);
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const pagosMap = useMemo(() => {
      const map = new Map<string, RegistroPago[]>();
      registrosPago.forEach(pago => {
          if (pago.origen.tipo === 'remito') {
              const remitoId = pago.origen.id;
              if (!map.has(remitoId)) {
                  map.set(remitoId, []);
              }
              map.get(remitoId)!.push(pago);
          }
      });
      return map;
  }, [registrosPago]);

  const getRemitoTotal = useCallback((r: Remito) => {
    const cliente = clientes.find(c => c.id === r.clienteId);
    if (!cliente) return 0;
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return r.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        const producto = productosMap.get(mov.productoId);
        if (!producto) return total;
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return total + (mov.entregados * precio);
    }, 0);
  }, [clientes, productosMap]);


  useEffect(() => {
    setFormData(remito);
  }, [remito]);

  useEffect(() => {
    if (formData.clienteId) {
      const cliente = clientes.find(c => c.id === formData.clienteId);
      setClienteSucursales(cliente?.sucursales || []);
      const tieneCtaCte = cliente?.tieneCuentaCorriente || false;
      setIsCtaCte(tieneCtaCte);
      
      if (!tieneCtaCte) {
        const remitosDelCliente = remitos.filter(r => r.clienteId === formData.clienteId && r.id !== formData.id);
        const deuda = remitosDelCliente.reduce((totalDeuda, r) => {
            const totalRemito = getRemitoTotal(r);
            const pagosDelRemito = pagosMap.get(r.id) || [];
            const totalPagado = pagosDelRemito.reduce((sum, p) => sum + p.monto, 0);
            
            if (totalRemito > totalPagado) {
                return totalDeuda + (totalRemito - totalPagado);
            }
            return totalDeuda;
        }, 0);
        setDeudaPendiente(deuda);
      } else {
        setDeudaPendiente(0);
      }

    } else {
      setClienteSucursales([]);
      setIsCtaCte(false);
      setDeudaPendiente(0);
    }
  }, [formData.clienteId, clientes, remitos, getRemitoTotal, pagosMap, formData.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if ((name === 'puntoVenta' || name === 'numero') && value !== '' && !/^\d*$/.test(value)) {
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMovimientoChange = (index: number, field: keyof Movimiento, value: string) => {
    const newMovimientos = [...(formData.movimientos || [])];
    const numValue = value === '' ? 0 : Number(value);
    newMovimientos[index] = { ...newMovimientos[index], [field]: numValue };
    setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
  }

  const handleProductoChange = (index: number, productoId: string) => {
    const newMovimientos = [...(formData.movimientos || [])];
    newMovimientos[index] = { ...newMovimientos[index], productoId };
    setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
  }
  
  const addMovimiento = () => {
      const newMovimiento: Movimiento = { productoId: '', entregados: 0, recibidos: 0};
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setIsSaving(true);
    await onSave(formData as Remito & { pagos: PagoDetalle[] });
    setIsSaving(false);
  };
  
  const vendedoresInternos = useMemo(() => vendedores.filter(v => v.tipo === TipoVendedor.INTERNO), [vendedores]);
  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const vendedoresInternosOptions = useMemo(() => vendedoresInternos.map(v => ({ value: v.id, label: v.nombre })), [vendedoresInternos]);
  
  const productosOptions = useMemo(() => {
    const productosActivos = productos.filter(p => p.estado === EstadoProducto.ACTIVO);
    const productosEnRemito = (formData.movimientos || [])
        .map(mov => productos.find(p => p.id === mov.productoId))
        .filter(p => p && p.estado === EstadoProducto.INACTIVO) as Producto[];
    const productosUnicos = [...new Map([...productosActivos, ...productosEnRemito].map(item => [item['id'], item])).values()];
    return productosUnicos.map(p => ({ value: p.id, label: p.nombre }));
  }, [productos, formData.movimientos]);


  const totalRemito = useMemo(() => {
    if (!formData.clienteId || !formData.movimientos) return 0;

    const cliente = clientes.find(c => c.id === formData.clienteId);
    if (!cliente) return 0;
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

    return formData.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        
        const producto = productos.find(p => p.id === mov.productoId);
        if (!producto) return total;
        
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        
        return total + (mov.entregados * precio);
    }, 0);
  }, [formData.clienteId, formData.movimientos, clientes, productos]);


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito</h2>
      
       {deudaPendiente > 0 && (
        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/50 dark:border-yellow-400 dark:text-yellow-300 rounded-md" role="alert">
          <p className="font-bold">Atención</p>
          <p>Este cliente tiene una deuda pendiente de ${deudaPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
            <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly}/>
        </div>
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Punto de Venta - Número</label>
            <div className="flex gap-2">
                <input type="number" name="puntoVenta" placeholder="1" value={formData.puntoVenta || ''} onChange={handleChange} required className="w-1/3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly}/>
                <input type="number" name="numero" placeholder="1234" value={formData.numero || ''} onChange={handleChange} required className="w-2/3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly}/>
            </div>
        </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
             <SearchableSelect
                options={clienteOptions}
                value={formData.clienteId || ''}
                onChange={(value) => handleSelectChange('clienteId', value)}
                placeholder="Seleccionar Cliente"
                disabled={isReadOnly}
             />
        </div>
        <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sucursal (Opcional)</label>
             <select name="sucursalId" value={formData.sucursalId || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly || clienteSucursales.length === 0}>
                <option value="">Casa Central / Única</option>
                {clienteSucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
             </select>
        </div>
    </div>
    
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repartidor (Internos)</label>
        <SearchableSelect
            options={vendedoresInternosOptions}
            value={formData.vendedorId || ''}
            onChange={(value) => handleSelectChange('vendedorId', value)}
            placeholder="Seleccionar Repartidor"
            disabled={isReadOnly || currentUser.rol === Rol.REPARTIDOR}
        />
    </div>

    <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Movimiento de Productos</legend>
        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto pr-2">
            <div className="grid grid-cols-[2fr,1fr,1fr,auto] items-center gap-x-2 text-center font-medium text-sm text-gray-500 dark:text-gray-400">
                <span>Producto</span>
                <span>Entregados</span>
                <span>Recibidos</span>
                <span></span>
            </div>
            {(formData.movimientos || []).map((mov, index) => (
                <div key={index} className="grid grid-cols-[2fr,1fr,1fr,auto] items-center gap-x-2">
                    <SearchableSelect
                        options={productosOptions}
                        value={mov.productoId}
                        onChange={(value) => handleProductoChange(index, value)}
                        placeholder="Seleccionar producto"
                        disabled={isReadOnly}
                    />
                    <input type="number" value={mov.entregados} onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} required min="0" className="w-full text-center p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly}/>
                    <input type="number" value={mov.recibidos} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} required min="0" className="w-full text-center p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={isReadOnly}/>
                    <button type="button" onClick={() => removeMovimiento(index)} className="text-red-500 hover:text-red-700 p-1" disabled={isReadOnly}><TrashIcon/></button>
                </div>
            ))}
        </div>
        {!isReadOnly && <button type="button" onClick={addMovimiento} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Producto</button>}
    </fieldset>

    <div className="flex justify-end items-center mt-4">
        <span className="text-xl font-bold text-gray-800 dark:text-white">
            Total Remito: ${totalRemito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
    </div>

    <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4 relative" disabled={isCtaCte || isReadOnly}>
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Cobranza (Opcional)</legend>
        {(isCtaCte || isReadOnly) && <div className="absolute inset-0 bg-gray-200/50 dark:bg-gray-800/50 flex items-center justify-center rounded-md -m-px"><p className="text-sm font-semibold text-gray-600 dark:text-gray-300 p-4 bg-white dark:bg-gray-700 rounded-md shadow">{isReadOnly ? 'No se puede modificar un remito facturado.' : 'El cobro se gestiona desde Cta. Corriente.'}</p></div>}
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
        {!isReadOnly && <button type="button" onClick={addPago} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Pago</button>}
    </fieldset>

      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500">{isReadOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!isReadOnly && <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Guardando...' : 'Guardar'}</button>}
      </div>
    </form>
  )
}

const PaymentStatusBadge: React.FC<{
  remito: { totalRemito: number, totalPagado: number, paymentStatus: PaymentStatus, facturaId?: string }
}> = ({ remito }) => {
    switch (remito.paymentStatus) {
        case 'facturado':
            return <span className="font-semibold text-sm text-yellow-600 dark:text-yellow-400">Facturado</span>;
        case 'pagado':
            return <span className="font-bold text-sm text-green-600 dark:text-green-400">Pagado</span>;
        case 'pagado_parcial':
            const deuda = remito.totalRemito - remito.totalPagado;
            return (
                <div>
                    <span className="font-semibold text-sm text-yellow-600 dark:text-yellow-400">Pago Parcial</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 font-mono">
                        Debe: ${deuda.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            );
        case 'pendiente':
             return (
                 <div>
                    <span className="font-semibold text-sm text-red-600 dark:text-red-400">Pendiente</span>
                     {remito.totalRemito > 0 && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 font-mono">
                           Total: ${remito.totalRemito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                     )}
                </div>
            )
        default:
             return <span className="font-semibold text-sm text-gray-500">-</span>;
    }
}


const RemitosView: React.FC<RemitosViewProps> = ({ remitos, clientes, vendedores, productos, registrosPago, currentUser, addRemito, updateRemito, deleteRemito }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRemito, setEditingRemito] = useState<Partial<Remito> & { pagos?: PagoDetalle[] } | null>(null);
  const [clienteFilter, setClienteFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('todos');
  const [expandedRemitoId, setExpandedRemitoId] = useState<string | null>(null);
  const [remitoParaBorrar, setRemitoParaBorrar] = useState<(typeof processedRemitos[0]) | null>(null);
  const { showNotification } = useNotification();

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const pagosMap = useMemo(() => new Map(registrosPago.map(p => [p.id, p])), [registrosPago]);

  const getRemitoTotal = useCallback((remito: Remito) => {
    const cliente = clientesMap.get(remito.clienteId);
    if (!cliente) return 0;
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return remito.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        const producto = productosMap.get(mov.productoId);
        if (!producto) return total;
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return total + (mov.entregados * precio);
    }, 0);
  }, [clientesMap, productosMap]);

  const processedRemitos = useMemo(() => {
    return remitos.map(remito => {
      const pagos = remito.pagoIds?.map(id => pagosMap.get(id)).filter(Boolean) as RegistroPago[] || [];
      const totalPagado = pagos.reduce((sum, pago) => sum + pago.monto, 0);
      const totalRemito = getRemitoTotal(remito);
      const cliente = clientesMap.get(remito.clienteId);
      
      let paymentStatus: PaymentStatus;
      
      if (cliente?.tieneCuentaCorriente) {
          paymentStatus = remito.facturaId ? 'facturado' : 'pendiente';
      } else {
          const deuda = totalRemito - totalPagado;
          if (totalRemito <= 0.01) {
              paymentStatus = 'gratis';
          } else if (deuda <= 0.01) {
              paymentStatus = 'pagado';
          } else if (totalPagado > 0) {
              paymentStatus = 'pagado_parcial';
          } else {
              paymentStatus = 'pendiente';
          }
      }

      const canBeDeleted = (!remito.pagoIds || remito.pagoIds.length === 0) && !remito.facturaId;
      const canBeEdited = !remito.facturaId;

      return { ...remito, pagos, totalPagado, totalRemito, paymentStatus, canBeDeleted, canBeEdited };
    });
  }, [remitos, pagosMap, getRemitoTotal, clientesMap]);


  const filteredRemitos = useMemo(() => {
    return processedRemitos.filter(r => {
        const clienteMatch = !clienteFilter || r.clienteId === clienteFilter;
        if (!clienteMatch) return false;

        const remitoDate = new Date(r.fecha + 'T00:00:00');
        const fromDate = dateFilter.from ? new Date(dateFilter.from + 'T00:00:00') : null;
        const toDate = dateFilter.to ? new Date(dateFilter.to + 'T00:00:00') : null;
        
        if (fromDate && remitoDate < fromDate) return false;
        if (toDate && remitoDate > toDate) return false;
        
        if (paymentStatusFilter !== 'todos') {
            if (paymentStatusFilter === 'pagado') {
                if (r.paymentStatus !== 'pagado') return false;
            } else if (paymentStatusFilter === 'pendiente') {
                if (r.paymentStatus !== 'pendiente' && r.paymentStatus !== 'pagado_parcial') return false;
            } else if (paymentStatusFilter === 'facturado') {
                if (r.paymentStatus !== 'facturado') return false;
            }
        }
        
        return true;
    }).sort((a, b) => {
        const dateComparison = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        if (dateComparison !== 0) return dateComparison;
        const puntoVentaComparison = parseInt(b.puntoVenta, 10) - parseInt(a.puntoVenta, 10);
        if (puntoVentaComparison !== 0) return puntoVentaComparison;
        return parseInt(b.numero, 10) - parseInt(a.numero, 10);
    });
  }, [processedRemitos, clienteFilter, dateFilter, paymentStatusFilter]);

  const handleSave = async (remito: (Omit<Remito, 'id' | 'pagoIds'> | Remito) & { pagos?: PagoDetalle[] }) => {
    try {
      if ('id' in remito && remito.id) {
        await updateRemito(remito as Remito & { pagos?: PagoDetalle[] });
        showNotification('Remito actualizado con éxito.', 'success');
      } else {
        await addRemito(remito as Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] });
        showNotification('Remito creado con éxito.', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
        console.error("Error saving remito:", error);
        const msg = error?.message || 'Error desconocido al guardar.';
        showNotification(`Error: ${msg}`, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!remitoParaBorrar) return;
    try {
        await deleteRemito(remitoParaBorrar.id);
        showNotification('Remito eliminado con éxito.', 'success');
    } catch (error) {
        const message = error instanceof Error ? error.message : "Un error desconocido ocurrió.";
        showNotification(message, 'error');
    }
    setRemitoParaBorrar(null);
  };

  const openNewModal = () => {
    const defaultProduct = productos.find(p => p.nombre === 'Bidón 20L Retornable');
    const defaultMovimientos: Movimiento[] = defaultProduct ? [{ productoId: defaultProduct.id, entregados: 0, recibidos: 0 }] : [];

    const sortedRemitos = [...remitos].sort((a, b) => {
        const dateComparison = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        if (dateComparison !== 0) return dateComparison;
        const puntoVentaComparison = parseInt(b.puntoVenta, 10) - parseInt(a.puntoVenta, 10);
        if (puntoVentaComparison !== 0) return puntoVentaComparison;
        return parseInt(b.numero, 10) - parseInt(a.numero, 10);
    });

    const lastRemito = sortedRemitos[0];
    const lastPuntoVenta = lastRemito ? lastRemito.puntoVenta : '1';
    const lastRemitoForPuntoVenta = sortedRemitos.find(r => r.puntoVenta === lastPuntoVenta);
    const nextNumero = lastRemitoForPuntoVenta ? (parseInt(lastRemitoForPuntoVenta.numero, 10) + 1).toString() : '1';

    setEditingRemito({
        fecha: new Date().toISOString().split('T')[0],
        puntoVenta: lastPuntoVenta,
        numero: nextNumero,
        movimientos: defaultMovimientos,
        pagos: [],
        vendedorId: currentUser.rol === Rol.REPARTIDOR ? currentUser.id : undefined,
    });
    setIsModalOpen(true);
  }

  const openEditModal = (remito: Remito) => {
    const pagos = remito.pagoIds?.map(id => pagosMap.get(id)).filter(Boolean) as RegistroPago[] || [];
    const pagosDetalle = pagos.map(p => ({ monto: p.monto, metodo: p.metodo }));
    
    setEditingRemito({...remito, pagos: pagosDetalle});
    setIsModalOpen(true);
  }

  const formatRemitoNumber = (puntoVenta: string, numero: string) => {
    return `${puntoVenta.padStart(4, '0')}-${numero.padStart(8, '0')}`;
  }

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Remitos</h1>
        <button onClick={openNewModal} className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">
          + Nuevo Remito
        </button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                    <option value="">Todos los Clientes</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                    <option value="todos">Todos los Estados de Pago</option>
                    <option value="pendiente">Pendientes</option>
                    <option value="pagado">Pagados</option>
                    <option value="facturado">Facturados</option>
                </select>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="text-sm font-medium">Desde:</label>
                    <input type="date" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({...prev, from: e.target.value}))} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="text-sm font-medium">Hasta:</label>
                    <input type="date" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({...prev, to: e.target.value}))} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                </div>
                <button onClick={() => {setClienteFilter(''); setDateFilter({ from: '', to: ''}); setPaymentStatusFilter('todos');}} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 w-full md:w-auto">Limpiar</button>
            </div>
        </div>
        <div className="space-y-2 p-2">
          {filteredRemitos.map(remito => {
            const isExpanded = expandedRemitoId === remito.id;
            const cliente = clientesMap.get(remito.clienteId);

            return (
              <div key={remito.id} className={`bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700`}>
                <div 
                  className="flex items-center p-4 cursor-pointer" 
                  onClick={() => setExpandedRemitoId(isExpanded ? null : remito.id)}
                  role="button"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedRemitoId(isExpanded ? null : remito.id)}}
                >
                  <div className={`flex-grow grid grid-cols-2 sm:grid-cols-4 gap-4 items-center`}>
                    <div>
                      <p className="text-xs text-gray-500">Fecha</p>
                      <p className="font-medium text-gray-900 dark:text-white">{new Date(remito.fecha + 'T00:00:00').toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cliente</p>
                      <p className="font-medium text-gray-900 dark:text-white truncate">{cliente?.nombre || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Número</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatRemitoNumber(remito.puntoVenta, remito.numero)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Estado</p>
                      <PaymentStatusBadge remito={remito} />
                    </div>
                  </div>
                  <div className="flex items-center pl-4">
                    <button onClick={(e) => { e.stopPropagation(); openEditModal(remito); }} className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed" disabled={!remito.canBeEdited} title={!remito.canBeEdited ? "No se puede editar un remito facturado" : "Editar remito"}><PencilIcon /></button>
                    <button onClick={(e) => { e.stopPropagation(); setRemitoParaBorrar(remito); }} className="text-red-500 hover:text-red-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed" disabled={!remito.canBeDeleted} title={!remito.canBeDeleted ? "No se puede borrar un remito pagado o facturado" : "Eliminar remito"}><TrashIcon /></button>
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalle de Movimientos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="py-2 px-2 font-normal">Producto</th>
                              <th className="py-2 px-2 font-normal text-center">Entregados</th>
                              <th className="py-2 px-2 font-normal text-center">Recibidos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {remito.movimientos.map((mov, index) => (
                              <tr key={index} className="border-t border-dashed dark:border-gray-700">
                                <td className="py-2 px-2">{productosMap.get(mov.productoId)?.nombre || 'N/A'}</td>
                                <td className="py-2 px-2 text-center">{mov.entregados}</td>
                                <td className="py-2 px-2 text-center">{mov.recibidos}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {remito.pagos && remito.pagos.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalle de Pagos</h4>
                         <ul className="space-y-1 text-sm">
                          {remito.pagos.map((pago) => (
                            <li key={pago.id} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                              <span>{pago.metodo}</span>
                              <span className="font-semibold">${pago.monto.toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
           {filteredRemitos.length === 0 && <p className="text-center py-4 text-gray-500">No se encontraron remitos con los filtros seleccionados.</p>}
        </div>
      </Card>
      
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <RemitoForm 
                remito={editingRemito || {}}
                clientes={clientes}
                vendedores={vendedores}
                productos={productos}
                currentUser={currentUser}
                onSave={handleSave}
                onClose={() => setIsModalOpen(false)}
                remitos={remitos}
                registrosPago={registrosPago}
                isReadOnly={!!editingRemito?.facturaId}
            />
        </Modal>
      )}

      {remitoParaBorrar && (
        <Modal isOpen={!!remitoParaBorrar} onClose={() => setRemitoParaBorrar(null)}>
            <div className="p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                    <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4">Confirmar Eliminación</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea eliminar permanentemente el remito <strong>{formatRemitoNumber(remitoParaBorrar.puntoVenta, remitoParaBorrar.numero)}</strong>?
                    <br />
                    Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={() => setRemitoParaBorrar(null)}
                        className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmDelete}
                        className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                        Sí, Eliminar
                    </button>
                </div>
            </div>
        </Modal>
      )}

    </div>
  )
}

export default RemitosView;
