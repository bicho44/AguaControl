
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, TipoVendedor, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoProducto, EstadoCliente, TipoTelefono } from '../types';
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
import { MapIcon } from '../components/icons/MapIcon';

type PaymentStatus = 'facturado' | 'pagado' | 'pagado_parcial' | 'pendiente' | 'gratis' | 'ajuste';
type PaymentStatusFilter = 'todos' | 'pendiente' | 'pagado' | 'facturado' | 'ajuste';

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
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'>) => Promise<string>; 
}

const QuickClientModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { nombre: string; direccion: string; telefono: string; lat?: number; lng?: number }) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');
    const [telefono, setTelefono] = useState('');
    const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const { showNotification } = useNotification();

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            showNotification('Tu navegador no soporta geolocalización', 'error');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCoords({ lat: latitude, lng: longitude });
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    if (data && data.address) {
                        const road = data.address.road || '';
                        const houseNumber = data.address.house_number || '';
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const estimatedAddr = `${road} ${houseNumber}${city ? `, ${city}` : ''}`.trim();
                        setDireccion(estimatedAddr || data.display_name);
                        showNotification('Dirección estimada por GPS', 'success');
                    }
                } catch (error) { showNotification('Error al ubicar dirección.', 'success'); } 
                finally { setIsLocating(false); }
            },
            (error) => { showNotification('Error GPS.', 'error'); setIsLocating(false); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!nombre.trim()) return;
        setIsSaving(true);
        try {
            await onSave({ nombre, direccion, telefono, ...coords });
            setNombre(''); setDireccion(''); setTelefono(''); setCoords({});
            onClose();
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Nuevo Cliente Rápido</h3>
                <AppInput label="Nombre del Cliente" value={nombre} onChange={e => setNombre(e.target.value)} required />
                <div className="relative">
                    <AppInput label="Dirección de Entrega" value={direccion} onChange={e => setDireccion(e.target.value)} />
                    <button type="button" onClick={handleGetLocation} disabled={isLocating} className="absolute right-2 top-8 p-1.5 rounded-lg text-gray-400 hover:text-primary-600"><MapIcon className="w-6 h-6" /></button>
                </div>
                <AppInput label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
                <div className="flex justify-end gap-2 pt-4">
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton variant="primary" type="submit" isLoading={isSaving}>Crear</AppButton>
                </div>
            </form>
        </Modal>
    );
};

const RemitoForm: React.FC<{
  remito: Partial<Remito> & { pagos?: PagoDetalle[] };
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  currentUser: Usuario;
  onSave: (remito: (Omit<Remito, 'id' | 'pagoIds'> | Remito) & { pagos?: PagoDetalle[] }) => Promise<void>;
  onAddCliente: (cliente: Omit<Cliente, 'id' | 'estado'>) => Promise<string>;
  onClose: () => void;
  remitos: Remito[];
  registrosPago: RegistroPago[];
  isReadOnly?: boolean;
}> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onAddCliente, onClose, remitos, registrosPago, isReadOnly = false }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>({});
  const [clienteSucursales, setClienteSucursales] = useState<Sucursal[]>([]);
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const { showNotification } = useNotification();

  const isNew = !remito.id;
  const isAdmin = currentUser.rol === Rol.ADMINISTRADOR;

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const pagosMap = useMemo(() => {
      const map = new Map<string, RegistroPago[]>();
      registrosPago.forEach(pago => {
          if (pago.origen.tipo === 'remito') {
              const remitoId = pago.origen.id;
              if (!map.has(remitoId)) map.set(remitoId, []);
              map.get(remitoId)!.push(pago);
          }
      });
      return map;
  }, [registrosPago]);

  const getRemitoTotal = useCallback((r: Remito | Partial<Remito>) => {
    if (r.esAjuste) return 0;
    if (!r.clienteId || !r.movimientos) return 0;
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
    // Al cargar el remito para editar, si ya tiene pagos en la DB, los traemos al form
    const initialPagos = remito.id ? (pagosMap.get(remito.id) || []).map(p => ({ monto: p.monto, metodo: p.metodo })) : (remito.pagos || []);
    setFormData({ ...remito, pagos: initialPagos }); 
  }, [remito, pagosMap]);

  // Lógica de Auto-incremento al cambiar Punto de Venta
  useEffect(() => {
    if (isNew && formData.puntoVenta) {
      const pto = formData.puntoVenta;
      const remitosMismoPto = remitos.filter(r => r.puntoVenta === pto);
      if (remitosMismoPto.length > 0) {
        const lastNum = Math.max(...remitosMismoPto.map(r => parseInt(r.numero) || 0));
        setFormData(prev => ({ ...prev, numero: (lastNum + 1).toString() }));
      } else {
        setFormData(prev => ({ ...prev, numero: '1' }));
      }
    }
  }, [formData.puntoVenta, isNew, remitos]);

  useEffect(() => {
    if (formData.clienteId) {
      const cliente = clientes.find(c => c.id === formData.clienteId);
      const sucs = cliente?.sucursales || [];
      setClienteSucursales(sucs);
      if (sucs.length === 1 && formData.sucursalId !== sucs[0].id) setFormData(prev => ({ ...prev, sucursalId: sucs[0].id }));
      const tieneCtaCte = cliente?.tieneCuentaCorriente || false;
      setIsCtaCte(tieneCtaCte);
      if (!tieneCtaCte) {
        const remitosDelCliente = remitos.filter(r => r.clienteId === formData.clienteId && r.id !== formData.id);
        const deuda = remitosDelCliente.reduce((totalDeuda, r) => {
            const totalRemito = getRemitoTotal(r);
            const pagosDelRemito = pagosMap.get(r.id) || [];
            const totalPagado = pagosDelRemito.reduce((sum, p) => sum + p.monto, 0);
            return (totalRemito > totalPagado) ? totalDeuda + (totalRemito - totalPagado) : totalDeuda;
        }, 0);
        setDeudaPendiente(deuda);
      } else setDeudaPendiente(0);
    } else { setClienteSucursales([]); setIsCtaCte(false); setDeudaPendiente(0); }
  }, [formData.clienteId, clientes, remitos, getRemitoTotal, pagosMap, formData.id]);

  const totalRemito = useMemo(() => getRemitoTotal(formData), [formData, getRemitoTotal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if ((name === 'puntoVenta' || name === 'numero') && value !== '' && !/^\d*$/.test(value)) return;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => setFormData(prev => ({ ...prev, [name]: value }));
  const handleMovimientoChange = (index: number, field: keyof Movimiento, value: string) => {
    const newMovimientos = [...(formData.movimientos || [])];
    newMovimientos[index] = { ...newMovimientos[index], [field]: value === '' ? 0 : Number(value) };
    setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
  }
  const handleProductoChange = (index: number, productoId: string) => {
    const newMovimientos = [...(formData.movimientos || [])];
    newMovimientos[index] = { ...newMovimientos[index], productoId };
    setFormData(prev => ({ ...prev, movimientos: newMovimientos }));
  }
  const addMovimiento = () => setFormData(prev => ({...prev, movimientos: [...(prev.movimientos || []), { productoId: '', entregados: 0, recibidos: 0}]}));
  const removeMovimiento = (index: number) => setFormData(prev => ({...prev, movimientos: prev.movimientos?.filter((_, i) => i !== index)}));
  
  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    newPagos[index] = { ...newPagos[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  }
  const addPago = () => {
    const pagado = (formData.pagos || []).reduce((sum, p) => sum + p.monto, 0);
    setFormData(prev => ({...prev, pagos: [...(prev.pagos || []), { monto: Math.max(0, totalRemito - pagado), metodo: MetodoPago.EFECTIVO }]}));
  }
  const removePago = (index: number) => setFormData(prev => ({...prev, pagos: prev.pagos?.filter((_, i) => i !== index)}));

  const handleSaveQuickClient = async (data: any) => {
    try {
        const id = await onAddCliente({
            nombre: data.nombre,
            sucursales: [{ id: 'main', nombre: 'Casa Central', direccion: data.direccion, lat: data.lat, lng: data.lng, diasReparto: [] }],
            telefonos: data.telefono ? [{ tipo: TipoTelefono.CEL, numero: data.telefono }] : [],
            estado: EstadoCliente.ACTIVO
        });
        setFormData(prev => ({ ...prev, clienteId: id, sucursalId: 'main' }));
        showNotification('Cliente creado.', 'success');
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (isReadOnly) return;
    if (!formData.clienteId || !formData.vendedorId || !formData.movimientos?.length) return showNotification('Datos incompletos.', 'error');
    setIsSaving(true);
    await onSave(formData as Remito & { pagos: PagoDetalle[] });
    setIsSaving(false);
  };
  
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito {formData.esAjuste && '(Ajuste)'}</h2>
        {deudaPendiente > 0 && <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md"><p className="font-bold">Deuda Pendiente: ${deudaPendiente.toLocaleString()}</p></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
                <div className="flex justify-between items-end mb-1.5"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Cliente</label>{!isReadOnly && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-[10px] font-black text-primary-600 hover:underline uppercase">+ Nuevo Cliente</button>}</div>
                <SearchableSelect options={clientes.map(c=>({value:c.id, label:c.nombre}))} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} disabled={isReadOnly} />
            </div>
            {clienteSucursales.length > 1 && <div><AppSelect label="Sucursal" name="sucursalId" value={formData.sucursalId || ''} onChange={handleChange} options={clienteSucursales.map(s=>({value:s.id, label:s.nombre}))} disabled={isReadOnly} required /></div>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="flex gap-2">
              <div className="w-1/3">
                <AppInput label="Pto Venta" type="number" name="puntoVenta" value={formData.puntoVenta || ''} onChange={handleChange} required disabled={isReadOnly}/>
              </div>
              <div className="w-2/3">
                <AppInput label="Número" type="number" name="numero" value={formData.numero || ''} onChange={handleChange} required disabled={isReadOnly}/>
              </div>
            </div>
          </div>
          <div className="md:col-span-1">
            <AppInput 
              label="Fecha" 
              type="date" 
              name="fecha" 
              value={formData.fecha || ''} 
              onChange={handleChange} 
              required 
              disabled={isReadOnly || !isAdmin}
            />
            {!isAdmin && isNew && <p className="text-[10px] text-gray-400 mt-1">* Solo el administrador puede cargar fechas anteriores.</p>}
          </div>
        </div>
        <fieldset className="border-t dark:border-gray-600 pt-4">
          <legend className="text-lg font-bold text-gray-800 dark:text-white px-2 mb-2">Movimientos</legend>
          {(formData.movimientos || []).map((mov, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto] items-end md:items-center gap-2 mb-2">
                  <SearchableSelect options={productos.map(p=>({value:p.id, label:p.nombre}))} value={mov.productoId} onChange={(v) => handleProductoChange(index, v)} disabled={isReadOnly} />
                  <AppInput type="number" value={mov.entregados} onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} required disabled={isReadOnly} />
                  <AppInput type="number" value={mov.recibidos} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} required disabled={isReadOnly} />
                  <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} disabled={isReadOnly} className="!p-2" type="button"><TrashIcon/></AppButton>
              </div>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="w-full border-dashed border-2">+ Agregar Item</AppButton>}
        </fieldset>

        {(!isCtaCte || (formData.pagos && formData.pagos.length > 0)) && !formData.esAjuste && (
            <fieldset className="border-t dark:border-gray-600 pt-6">
                <legend className="text-lg font-black text-primary-600 uppercase tracking-tighter px-2 mb-4">Información de Cobro</legend>
                <div className="space-y-3 bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800">
                    {(formData.pagos || []).map((pago, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3 items-end">
                            <AppInput label={index === 0 ? "Monto Pagado" : ""} type="number" value={pago.monto} onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} step="0.01" className="font-black text-green-600" disabled={isReadOnly} />
                            <AppSelect label={index === 0 ? "Método" : ""} value={pago.metodo} onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} disabled={isReadOnly} />
                            <AppButton variant="danger" size="sm" onClick={() => removePago(index)} disabled={isReadOnly} className="!p-2 mb-1"><TrashIcon className="w-5 h-5"/></AppButton>
                        </div>
                    ))}
                    {!isReadOnly && (
                        <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 bg-white/50">+ Agregar Pago / Cobro</AppButton>
                    )}
                </div>
            </fieldset>
        )}

        <div className="flex justify-end items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"><span className="text-xl font-black">Total Remito: ${totalRemito.toLocaleString()}</span></div>
        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
          <AppButton variant="secondary" onClick={onClose}>{isReadOnly ? 'Cerrar' : 'Cancelar'}</AppButton>
          {!isReadOnly && <AppButton variant="primary" type="submit" disabled={isSaving}>Guardar Remito</AppButton>}
        </div>
      </form>
      <QuickClientModal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} onSave={handleSaveQuickClient} />
    </>
  )
}

const PaymentStatusBadge: React.FC<{ remito: any }> = ({ remito }) => {
    if (remito.esAjuste) return <span className="font-bold text-[10px] uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Carga Inicial</span>;
    switch (remito.paymentStatus) {
        case 'facturado': return <span className="font-bold text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">Facturado</span>;
        case 'pagado': return <span className="font-bold text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">Pagado</span>;
        case 'pagado_parcial': return <span className="font-bold text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">Parcial</span>;
        default: return <span className="font-bold text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full">Pendiente</span>;
    }
}

const RemitosView: React.FC<RemitosViewProps> = ({ remitos, clientes, vendedores, productos, registrosPago, currentUser, addRemito, updateRemito, deleteRemito, addCliente }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRemito, setEditingRemito] = useState<any>(null);
  const [clienteFilter, setClienteFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('todos');
  const [expandedRemitoId, setExpandedRemitoId] = useState<string | null>(null);
  const { showNotification } = useNotification();

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const pagosMap = useMemo(() => {
      const map = new Map<string, RegistroPago[]>();
      registrosPago.forEach(pago => {
          if (pago.origen.tipo === 'remito') {
              const remitoId = pago.origen.id;
              if (!map.has(remitoId)) map.set(remitoId, []);
              map.get(remitoId)!.push(pago);
          }
      });
      return map;
  }, [registrosPago]);

  const getRemitoTotal = useCallback((r: Remito) => {
    if (r.esAjuste) return 0;
    const c = clientesMap.get(r.clienteId);
    if (!c) return 0;
    const peMap = new Map(c.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    return r.movimientos.reduce((total, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return total;
        return total + (mov.entregados * (peMap.get(mov.productoId) ?? prod.precio));
    }, 0);
  }, [clientesMap, productosMap]);

  const processedRemitos = useMemo(() => {
    return remitos.map(r => {
      const pagos = pagosMap.get(r.id) || [];
      const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
      const totalRemito = getRemitoTotal(r);
      const cliente = clientesMap.get(r.clienteId);
      let status: PaymentStatus = 'pendiente';
      if (r.esAjuste) status = 'ajuste';
      else if (cliente?.tieneCuentaCorriente) status = r.facturaId ? 'facturado' : 'pendiente';
      else { const deuda = totalRemito - totalPagado; if (totalRemito <= 0.01) status = 'gratis'; else if (deuda <= 0.01) status = 'pagado'; else if (totalPagado > 0) status = 'pagado_parcial'; }
      return { ...r, totalPagado, totalRemito, paymentStatus: status, canBeDeleted: !r.pagoIds?.length && !r.facturaId, canBeEdited: !r.facturaId };
    });
  }, [remitos, pagosMap, getRemitoTotal, clientesMap]);

  const filteredRemitos = useMemo(() => {
    return processedRemitos.filter(r => {
        if (currentUser.rol === Rol.REPARTIDOR && r.vendedorId !== currentUser.id) return false;
        if (clienteFilter && r.clienteId !== clienteFilter) return false;
        if (paymentStatusFilter !== 'todos' && r.paymentStatus !== paymentStatusFilter) return false;
        return true;
    }).sort((a, b) => {
        // Ordenamiento por Pto Venta (DESC), luego Número (DESC), luego Fecha (DESC)
        const ptoA = parseInt(a.puntoVenta) || 0;
        const ptoB = parseInt(b.puntoVenta) || 0;
        if (ptoB !== ptoA) return ptoB - ptoA;

        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        if (numB !== numA) return numB - numA;

        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [processedRemitos, clienteFilter, paymentStatusFilter, currentUser]);

  const handleSave = async (r: any) => {
    try {
      if (r.id) await updateRemito(r);
      else await addRemito(r);
      showNotification('Guardado.', 'success');
      setIsFormOpen(false);
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const openNewModal = () => {
    // Buscar el punto de venta más recientemente usado para sugerirlo
    const lastRemito = [...remitos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
    const defaultPto = lastRemito?.puntoVenta || '1';

    setEditingRemito({ 
      fecha: new Date().toISOString().split('T')[0], 
      puntoVenta: defaultPto, 
      numero: '', 
      movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }], 
      pagos: [], 
      vendedorId: currentUser.id 
    });
    setIsFormOpen(true);
  }

  if (isFormOpen) return <div className="animate-fade-in"><div className="mb-6 flex items-center gap-4"><button onClick={() => setIsFormOpen(false)} className="p-2 -ml-2 text-gray-500 hover:bg-white rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button><h1 className="text-2xl font-black uppercase">Gestionar Remito</h1></div><Card><RemitoForm remito={editingRemito} clientes={clientes} vendedores={vendedores} productos={productos} currentUser={currentUser} onSave={handleSave} onAddCliente={addCliente} onClose={() => setIsFormOpen(false)} remitos={remitos} registrosPago={registrosPago} isReadOnly={!!editingRemito?.facturaId}/></Card></div>;

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center"><h1 className="text-3xl font-bold text-gray-800 dark:text-white">Remitos</h1><AppButton onClick={openNewModal}>+ Nuevo Remito</AppButton></div>
      <Card>
        <div className="p-4 border-b dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect label="Cliente" value={clienteFilter} onChange={setClienteFilter} options={[{value: "", label: "Todos"}, ...clientes.map(c=>({value:c.id, label:c.nombre}))]} />
            <AppSelect label="Estado" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as any)} options={[{value:"todos", label:"Todos"}, {value:"pendiente", label:"Pendientes"}, {value:"pagado", label:"Pagados"}, {value:"facturado", label:"Facturados"}, {value:"ajuste", label:"Carga Inicial"}]} />
        </div>
        <div className="space-y-2 p-2">
          {filteredRemitos.map(remito => (
            <div key={remito.id} className="bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedRemitoId(expandedRemitoId === remito.id ? null : remito.id)}>
                    <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Fecha</p><p className="font-medium text-sm">{new Date(remito.fecha + 'T00:00:00').toLocaleDateString()}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Cliente</p><p className="font-bold text-sm truncate">{clientesMap.get(remito.clienteId)?.nombre || 'N/A'}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Número</p><p className="font-medium text-sm font-mono">{remito.puntoVenta.padStart(4,'0')}-{remito.numero.padStart(8,'0')}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Estado</p><PaymentStatusBadge remito={remito} /></div>
                    </div>
                    <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); setEditingRemito(remito); setIsFormOpen(true); }} className="text-blue-500 p-2" disabled={!remito.canBeEdited}><PencilIcon/></button><ChevronDownIcon className={`h-5 w-5 transition-transform ${expandedRemitoId === remito.id ? 'rotate-180' : ''}`} /></div>
                </div>
                {expandedRemitoId === remito.id && (
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                        <table className="w-full text-xs text-left">
                            <thead className="text-gray-400 uppercase font-black"><tr><th className="py-2">Producto</th><th className="py-2 text-center">Entregados</th><th className="py-2 text-center">Retirados</th></tr></thead>
                            <tbody>{remito.movimientos.map((m, i)=>(<tr key={i} className="border-t dark:border-gray-700"><td className="py-2">{productosMap.get(m.productoId)?.nombre}</td><td className="py-2 text-center font-bold text-blue-600">{m.entregados}</td><td className="py-2 text-center text-gray-400">{m.recibidos}</td></tr>))}</tbody>
                        </table>
                    </div>
                )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default RemitosView;
