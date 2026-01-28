
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, TipoVendedor, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

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
  const { showNotification } = useNotification();

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

    // VALIDACION ANTES DE GUARDAR
    if (!formData.clienteId) {
        showNotification('Debe seleccionar un cliente antes de guardar.', 'error');
        return;
    }

    if (!formData.vendedorId) {
        showNotification('Debe seleccionar un repartidor.', 'error');
        return;
    }

    if (!formData.movimientos || formData.movimientos.length === 0) {
        showNotification('Debe agregar al menos un producto al remito.', 'error');
        return;
    }

    const hasInvalidProducts = formData.movimientos.some(m => !m.productoId);
    if (hasInvalidProducts) {
        showNotification('Uno o más productos no han sido seleccionados correctamente.', 'error');
        return;
    }

    const hasNoQuantity = formData.movimientos.every(m => m.entregados === 0 && m.recibidos === 0);
    if (hasNoQuantity) {
        showNotification('El remito no puede estar vacío (entrega o retiro debe ser mayor a 0).', 'error');
        return;
    }

    setIsSaving(true);
    await onSave(formData as Remito & { pagos: PagoDetalle[] });
    setIsSaving(false);
  };
  
  const vendedoresInternos = useMemo(() => vendedores.filter(v => v.tipo === TipoVendedor.INTERNO), [vendedores]);
  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const vendedoresInternosOptions = useMemo(() => vendedoresInternos.map(v => ({ value: v.id, label: v.nombre })), [vendedoresInternos]);
  
  const sucursalOptions = useMemo(() => [
      { value: "", label: "Casa Central / Única" },
      ...clienteSucursales.map(s => ({ value: s.id, label: s.nombre }))
  ], [clienteSucursales]);

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
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito</h2>
      
       {deudaPendiente > 0 && (
        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/50 dark:border-yellow-400 dark:text-yellow-300 rounded-md" role="alert">
          <p className="font-bold">Cobranza Pendiente</p>
          <p>Este cliente debe ${deudaPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de entregas anteriores.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
            <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required disabled={isReadOnly}/>
        </div>
        <div className="md:col-span-2">
            <div className="flex gap-2">
                <div className="w-1/3">
                    <AppInput label="Punto Venta" type="number" name="puntoVenta" placeholder="1" value={formData.puntoVenta || ''} onChange={handleChange} required disabled={isReadOnly}/>
                </div>
                <div className="w-2/3">
                    <AppInput label="Número" type="number" name="numero" placeholder="1234" value={formData.numero || ''} onChange={handleChange} required disabled={isReadOnly}/>
                </div>
            </div>
        </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
             <SearchableSelect
                label="Cliente"
                options={clienteOptions}
                value={formData.clienteId || ''}
                onChange={(value) => handleSelectChange('clienteId', value)}
                placeholder="Seleccionar Cliente"
                disabled={isReadOnly}
             />
        </div>
        <div>
             <AppSelect 
                label="Sucursal (Opcional)"
                name="sucursalId" 
                value={formData.sucursalId || ''} 
                onChange={handleChange} 
                options={sucursalOptions}
                disabled={isReadOnly || clienteSucursales.length === 0}
             />
        </div>
    </div>
    
    <div>
        <SearchableSelect
            label="Repartidor (Internos)"
            options={vendedoresInternosOptions}
            value={formData.vendedorId || ''}
            onChange={(value) => handleSelectChange('vendedorId', value)}
            placeholder="Seleccionar Repartidor"
            disabled={isReadOnly || currentUser.rol === Rol.REPARTIDOR}
        />
    </div>

    <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4">
        <legend className="text-lg font-bold text-gray-800 dark:text-white px-2 mb-2">Movimiento de Productos</legend>
        <div className="space-y-6 md:space-y-2 mt-2">
            <div className="hidden md:grid md:grid-cols-[2fr,1fr,1fr,auto] items-center gap-x-2 text-center font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                <span className="text-left pl-2">Producto</span>
                <span>Entrega</span>
                <span>Retira</span>
                <span></span>
            </div>
            
            {(formData.movimientos || []).map((mov, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto] items-end md:items-center gap-4 md:gap-2 p-4 md:p-0 bg-gray-50 md:bg-transparent dark:bg-gray-700/30 md:dark:bg-transparent rounded-lg border md:border-0 dark:border-gray-600">
                    <div className="w-full">
                        <span className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Producto</span>
                        <SearchableSelect
                            options={productosOptions}
                            value={mov.productoId}
                            onChange={(value) => handleProductoChange(index, value)}
                            placeholder="Seleccionar producto..."
                            disabled={isReadOnly}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:contents">
                        <div>
                            <span className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block text-center">Entrega</span>
                            <AppInput 
                                type="number" 
                                value={mov.entregados} 
                                onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} 
                                required 
                                min="0" 
                                className="text-center font-bold text-lg md:text-base" 
                                disabled={isReadOnly}
                            />
                        </div>
                        <div>
                            <span className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block text-center">Retira</span>
                            <AppInput 
                                type="number" 
                                value={mov.recibidos} 
                                onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} 
                                required 
                                min="0" 
                                className="text-center font-bold text-lg md:text-base" 
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end md:block mt-2 md:mt-0">
                        <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} disabled={isReadOnly} className="!p-2" type="button"><TrashIcon className="w-5 h-5"/></AppButton>
                    </div>
                </div>
            ))}
        </div>
        {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="mt-6 md:mt-3 w-full border-dashed border-2 py-3 text-base" type="button">+ Agregar Producto</AppButton>}
    </fieldset>

    <div className="flex justify-end items-center mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <span className="text-xl md:text-2xl font-black text-gray-800 dark:text-white">
            Total: ${totalRemito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
    </div>

    <fieldset className="border-t border-gray-300 dark:border-gray-600 pt-4 relative" disabled={isCtaCte || isReadOnly}>
        <legend className="text-lg font-bold text-gray-800 dark:text-white px-2 mb-2">Cobranza (Opcional)</legend>
        {(isCtaCte || isReadOnly) && <div className="absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 flex items-center justify-center rounded-md z-10 backdrop-blur-[1px]"><p className="text-sm font-bold text-gray-600 dark:text-gray-300 p-3 bg-white dark:bg-gray-700 rounded-md shadow border dark:border-gray-600">{isReadOnly ? 'No se puede modificar un remito facturado.' : 'El cobro se gestiona desde Cta. Corriente.'}</p></div>}
        <div className="space-y-3 mt-2 max-h-40 overflow-y-auto pr-2">
            {(formData.pagos || []).map((pago, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                    <AppInput type="number" value={pago.monto || ''} onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} min="0" step="0.01" placeholder="Monto" />
                    <AppSelect value={pago.metodo} onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                    <AppButton variant="danger" size="sm" onClick={() => removePago(index)} className="!p-2" type="button"><TrashIcon className="h-5 w-5" /></AppButton>
                </div>
            ))}
        </div>
        {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addPago} className="mt-3 w-full border-dashed border-2" type="button">+ Agregar Pago</AppButton>}
    </fieldset>

      <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose} type="button">{isReadOnly ? 'Cerrar' : 'Cancelar'}</AppButton>
        {!isReadOnly && <AppButton variant="primary" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</AppButton>}
      </div>
    </form>
  )
}

const PaymentStatusBadge: React.FC<{
  remito: { totalRemito: number, totalPagado: number, paymentStatus: PaymentStatus, facturaId?: string }
}> = ({ remito }) => {
    switch (remito.paymentStatus) {
        case 'facturado':
            return <span className="font-bold text-xs text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30 px-2 py-1 rounded-full">Facturado</span>;
        case 'pagado':
            return <span className="font-bold text-xs text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 px-2 py-1 rounded-full">Pagado</span>;
        case 'pagado_parcial':
            const deuda = remito.totalRemito - remito.totalPagado;
            return (
                <div className="flex flex-col items-start">
                    <span className="font-bold text-xs text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30 px-2 py-1 rounded-full mb-1">Parcial</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono font-bold">
                        Debe: ${deuda.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </span>
                </div>
            );
        case 'pendiente':
             return (
                 <div className="flex flex-col items-start">
                    <span className="font-bold text-xs text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 px-2 py-1 rounded-full mb-1">Pendiente</span>
                     {remito.totalRemito > 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono font-bold">
                           ${remito.totalRemito.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                       </span>
                     )}
                </div>
            )
        default:
             return <span className="font-semibold text-xs text-gray-500">-</span>;
    }
}


const RemitosView: React.FC<RemitosViewProps> = ({ remitos, clientes, vendedores, productos, registrosPago, currentUser, addRemito, updateRemito, deleteRemito }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
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
        // SEGURIDAD: El repartidor solo ve sus remitos
        if (currentUser.rol === Rol.REPARTIDOR && r.vendedorId !== currentUser.id) return false;

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
  }, [processedRemitos, clienteFilter, dateFilter, paymentStatusFilter, currentUser]);

  // Resumen del día para el repartidor
  const statsHoy = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const remitosHoy = filteredRemitos.filter(r => r.fecha === today);
    
    const totals: Record<string, number> = {};
    remitosHoy.forEach(r => {
        r.movimientos.forEach(m => {
            const p = productosMap.get(m.productoId);
            if (p) {
                totals[p.nombre] = (totals[p.nombre] || 0) + m.entregados;
            }
        });
    });
    return totals;
  }, [filteredRemitos, productosMap]);

  const handleSave = async (remito: (Omit<Remito, 'id' | 'pagoIds'> | Remito) & { pagos?: PagoDetalle[] }) => {
    try {
      if ('id' in remito && remito.id) {
        await updateRemito(remito as Remito & { pagos?: PagoDetalle[] });
        showNotification('Remito actualizado con éxito.', 'success');
      } else {
        await addRemito(remito as Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] });
        showNotification('Remito creado con éxito.', 'success');
      }
      setIsFormOpen(false);
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

    // Determinar próximo número automáticamente basado en el último punto de venta usado
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
    setIsFormOpen(true);
  }

  const openEditModal = (remito: Remito) => {
    const pagos = remito.pagoIds?.map(id => pagosMap.get(id)).filter(Boolean) as RegistroPago[] || [];
    const pagosDetalle = pagos.map(p => ({ monto: p.monto, metodo: p.metodo }));
    
    setEditingRemito({...remito, pagos: pagosDetalle});
    setIsFormOpen(true);
  }

  const formatRemitoNumber = (puntoVenta: string, numero: string) => {
    return `${puntoVenta.padStart(4, '0')}-${numero.padStart(8, '0')}`;
  }

  if (isFormOpen) {
      return (
          <div className="animate-fade-in pb-12">
              <div className="mb-6 flex items-center gap-4">
                  <button type="button" onClick={() => setIsFormOpen(false)} className="p-2 -ml-2 text-gray-500 hover:bg-white dark:hover:bg-gray-800 rounded-full transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Gestionar Entrega</h1>
              </div>
              <Card>
                <RemitoForm 
                    remito={editingRemito || {}}
                    clientes={clientes}
                    vendedores={vendedores}
                    productos={productos}
                    currentUser={currentUser}
                    onSave={handleSave}
                    onClose={() => setIsFormOpen(false)}
                    remitos={remitos}
                    registrosPago={registrosPago}
                    isReadOnly={!!editingRemito?.facturaId}
                />
              </Card>
          </div>
      )
  }

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Remitos</h1>
        <AppButton onClick={openNewModal}>+ Nuevo Remito</AppButton>
      </div>

      {currentUser.rol === Rol.REPARTIDOR && Object.keys(statsHoy).length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Entregas de Hoy ({currentUser.nombre})</h3>
              <div className="flex flex-wrap gap-4">
                  {Object.entries(statsHoy).map(([name, count]) => (
                      <div key={name} className="flex flex-col">
                          <span className="text-xl font-black text-primary-600 dark:text-primary-400">{count}</span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{name}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SearchableSelect label="Filtrar Cliente" value={clienteFilter} onChange={setClienteFilter} options={[{value: "", label: "Todos los Clientes"}, ...clientes.map(c => ({value: c.id, label: c.nombre}))]} />
                <AppSelect label="Filtrar Estado" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)} options={[{value: "todos", label: "Todos los Estados"}, {value: "pendiente", label: "Pendientes"}, {value: "pagado", label: "Pagados"}, {value: "facturado", label: "Facturados"}]} />
            </div>
            {currentUser.rol === Rol.ADMINISTRADOR && (
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <AppInput type="date" label="Desde" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({...prev, from: e.target.value}))} />
                    <AppInput type="date" label="Hasta" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({...prev, to: e.target.value}))} />
                    <AppButton variant="secondary" onClick={() => {setClienteFilter(''); setDateFilter({ from: '', to: ''}); setPaymentStatusFilter('todos');}}>Limpiar</AppButton>
                </div>
            )}
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
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Fecha</p>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{new Date(remito.fecha + 'T00:00:00').toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Cliente</p>
                      <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{cliente?.nombre || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Número</p>
                      <p className="font-medium text-gray-900 dark:text-white font-mono text-sm">{formatRemitoNumber(remito.puntoVenta, remito.numero)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Estado</p>
                      <PaymentStatusBadge remito={remito} />
                    </div>
                  </div>
                  <div className="flex items-center pl-2 gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEditModal(remito); }} className="text-blue-500 hover:text-blue-700 p-2 disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" disabled={!remito.canBeEdited} title={!remito.canBeEdited ? "No se puede editar un remito facturado" : "Editar remito"}><PencilIcon /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setRemitoParaBorrar(remito); }} className="text-red-500 hover:text-red-700 p-2 disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" disabled={!remito.canBeDeleted} title={!remito.canBeDeleted ? "No se puede borrar un remito pagado o facturado" : "Eliminar remito"}><TrashIcon /></button>
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Detalle de Movimientos</h4>
                      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th className="py-2 px-3 font-medium">Producto</th>
                              <th className="py-2 px-3 font-medium text-center">Entrega</th>
                              <th className="py-2 px-3 font-medium text-center">Retira</th>
                            </tr>
                          </thead>
                          <tbody>
                            {remito.movimientos.map((mov, index) => (
                              <tr key={index} className="border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                                <td className="py-2 px-3">{productosMap.get(mov.productoId)?.nombre || 'N/A'}</td>
                                <td className="py-2 px-3 text-center font-bold text-blue-600 dark:text-blue-400">{mov.entregados}</td>
                                <td className="py-2 px-3 text-center text-gray-500">{mov.recibidos}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {remito.pagos && remito.pagos.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Detalle de Cobranza</h4>
                         <ul className="space-y-1 text-sm">
                          {remito.pagos.map((pago, index) => (
                            <li key={index} className="flex justify-between p-2 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{pago.metodo}</span>
                              <span className="font-bold text-green-600 dark:text-green-400">${pago.monto.toLocaleString()}</span>
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
           {filteredRemitos.length === 0 && <p className="text-center py-8 text-gray-500 bg-white dark:bg-gray-800 rounded-lg border border-dashed dark:border-gray-700">No se encontraron remitos con los filtros seleccionados.</p>}
        </div>
      </Card>
      
      {remitoParaBorrar && (
        <Modal isOpen={!!remitoParaBorrar} onClose={() => setRemitoParaBorrar(null)}>
            <div className="p-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <TrashIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Confirmar Eliminación</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    ¿Está seguro de que desea eliminar permanentemente el remito <strong>{formatRemitoNumber(remitoParaBorrar.puntoVenta, remitoParaBorrar.numero)}</strong>?
                    <br />
                    Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-center space-x-4">
                    <AppButton variant="secondary" onClick={() => setRemitoParaBorrar(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={confirmDelete}>Sí, Eliminar</AppButton>
                </div>
            </div>
        </Modal>
      )}

    </div>
  )
}

export default RemitosView;
