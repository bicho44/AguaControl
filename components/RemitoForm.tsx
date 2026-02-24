
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoCliente, TipoTelefono } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import QuickClientModal from './QuickClientModal';

interface RemitoFormProps {
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
}

const RemitoForm: React.FC<RemitoFormProps> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onAddCliente, onClose, remitos, registrosPago, isReadOnly = false }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>({});
  const [clienteSucursales, setClienteSucursales] = useState<Sucursal[]>([]);
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const { showNotification } = useNotification();

  const isNew = !remito.id;
  const isAdmin = currentUser.rol === Rol.ADMINISTRADOR;

  const clienteOptions = useMemo(() => {
    return clientes
        .filter(c => c.estado === EstadoCliente.ACTIVO || c.id === formData.clienteId)
        .map(c => ({ value: c.id, label: c.nombre }));
  }, [clientes, formData.clienteId]);

  const productosOptions = useMemo(() => productos.map(p => ({ value: p.id, label: p.nombre })), [productos]);

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
    const initialPagos = remito.id ? (pagosMap.get(remito.id) || []).map(p => ({ monto: p.monto, metodo: p.metodo })) : (remito.pagos || []);
    setFormData({ ...remito, pagos: initialPagos }); 
  }, [remito, pagosMap]);

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
      // Ordenar sucursales alfabéticamente
      const sucs = [...(cliente?.sucursales || [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
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

  // Obtener dirección actual para mostrar
  const currentAddress = useMemo(() => {
    if (!formData.clienteId) return null;
    const cliente = clientes.find(c => c.id === formData.clienteId);
    if (!cliente) return null;
    
    if (formData.sucursalId) {
        const suc = cliente.sucursales.find(s => s.id === formData.sucursalId);
        if (suc) return suc.direccion;
    }
    
    if (cliente.sucursales.length === 1) {
        return cliente.sucursales[0].direccion;
    }
    
    // Si tiene múltiples sucursales y no hay ninguna seleccionada, mostramos la primera como referencia o un texto
    if (cliente.sucursales.length > 1) {
        return "(Seleccione sucursal para ver dirección)";
    }

    return null;
  }, [formData.clienteId, formData.sucursalId, clientes]);

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
  
  const addMovimiento = useCallback(() => {
    setFormData(prev => ({...prev, movimientos: [...(prev.movimientos || []), { productoId: '', entregados: 0, recibidos: 0}]}));
  }, []);

  const removeMovimiento = (index: number) => setFormData(prev => ({...prev, movimientos: prev.movimientos?.filter((_, i) => i !== index)}));
  
  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    newPagos[index] = { ...newPagos[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  }
  
  const addPago = useCallback(() => {
    const pagado = (formData.pagos || []).reduce((sum, p) => sum + p.monto, 0);
    setFormData(prev => ({...prev, pagos: [...(prev.pagos || []), { monto: Math.max(0, totalRemito - pagado), metodo: MetodoPago.EFECTIVO }]}));
  }, [formData.pagos, totalRemito]);

  const removePago = (index: number) => setFormData(prev => ({...prev, pagos: prev.pagos?.filter((_, i) => i !== index)}));

  const handleSaveQuickClient = async (data: any) => {
    try {
        const id = await onAddCliente({
            nombre: data.nombre,
            sucursales: [{ id: 'main', nombre: 'Casa Central', direccion: data.direccion, lat: data.lat, lng: data.lng, diasReparto: [] }],
            telefonos: data.telefono ? [{ tipo: TipoTelefono.CEL, numero: data.telefono }] : [],
        });
        setFormData(prev => ({ ...prev, clienteId: id, sucursalId: 'main' }));
        showNotification('Cliente creado.', 'success');
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    if (!formData.clienteId || !formData.vendedorId || !formData.movimientos?.length) return showNotification('Datos incompletos.', 'error');
    
    // --- SANITIZACIÓN ---
    const puntoVentaLimpio = parseInt(formData.puntoVenta || '0').toString();
    const numeroLimpio = parseInt(formData.numero || '0').toString();

    const remitoFinal = {
        ...formData,
        puntoVenta: puntoVentaLimpio,
        numero: numeroLimpio
    };

    // --- VALIDACIÓN DE DUPLICADOS ---
    const pvActual = parseInt(puntoVentaLimpio);
    const numActual = parseInt(numeroLimpio);

    const existe = remitos.some(r => {
        if (formData.id && r.id === formData.id) return false;
        const rPV = parseInt(r.puntoVenta);
        const rNum = parseInt(r.numero);
        return rPV === pvActual && rNum === numActual;
    });

    if (existe) {
        showNotification(`¡Error! El remito ${puntoVentaLimpio}-${numeroLimpio} ya existe.`, 'error');
        return;
    }

    setIsSaving(true);
    await onSave(remitoFinal as Remito & { pagos: PagoDetalle[] });
    setIsSaving(false);
  }, [formData, isReadOnly, onSave, showNotification, remitos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        addMovimiento();
        return;
      }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if ((!isCtaCte || (formData.pagos && formData.pagos.length > 0)) && !formData.esAjuste) {
            addPago();
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadOnly, addMovimiento, addPago, handleSubmit, isCtaCte, formData]);
  
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito {formData.esAjuste && '(Ajuste)'}</h2>
            {isAdmin && !isReadOnly && (
                <div className="flex gap-2">
                    <SearchableSelect 
                        label="" 
                        placeholder="Cambiar Vendedor" 
                        options={vendedores.map(v => ({value: v.id, label: v.nombre}))} 
                        value={formData.vendedorId || ''} 
                        onChange={v => setFormData({...formData, vendedorId: v})} 
                    />
                </div>
            )}
        </div>
        {deudaPendiente > 0 && <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md"><p className="font-bold">Deuda Pendiente: ${deudaPendiente.toLocaleString()}</p></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
                <div className="flex justify-between items-end mb-1.5"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Cliente</label>{!isReadOnly && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-[10px] font-black text-primary-600 hover:underline uppercase">+ Nuevo Cliente</button>}</div>
                <SearchableSelect 
                  options={clienteOptions} 
                  value={formData.clienteId || ''} 
                  onChange={(v) => handleSelectChange('clienteId', v)} 
                  disabled={isReadOnly}
                  autoFocus={!isReadOnly}
                />
                {currentAddress && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 truncate">
                        <span className="font-bold">Dirección:</span> {currentAddress}
                    </p>
                )}
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
          </div>
        </div>
        <fieldset className="border-t dark:border-gray-600 pt-4">
          <legend className="text-lg font-bold text-gray-800 dark:text-white px-2 mb-2">Movimientos</legend>
          {(formData.movimientos || []).map((mov, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,auto] items-end md:items-center gap-2 mb-2">
                  <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleProductoChange(index, v)} disabled={isReadOnly} />
                  <AppInput type="number" value={mov.entregados} onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} required disabled={isReadOnly} />
                  <AppInput type="number" value={mov.recibidos} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} required disabled={isReadOnly} />
                  <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} disabled={isReadOnly} className="!p-2" type="button"><TrashIcon/></AppButton>
              </div>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="w-full border-dashed border-2">+ Agregar Item <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+I)</span></AppButton>}
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
                        <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 bg-white/50">+ Agregar Pago / Cobro <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+P)</span></AppButton>
                    )}
                </div>
            </fieldset>
        )}

        <div className="flex justify-end items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"><span className="text-xl font-black">Total Remito: ${totalRemito.toLocaleString()}</span></div>
        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
          <AppButton variant="secondary" onClick={onClose}>{isReadOnly ? 'Cerrar' : 'Cancelar'}</AppButton>
          {!isReadOnly && <AppButton variant="primary" type="submit" disabled={isSaving}>Guardar Remito <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>}
        </div>
      </form>
      <QuickClientModal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} onSave={handleSaveQuickClient} />
    </>
  )
}

export default RemitoForm;
