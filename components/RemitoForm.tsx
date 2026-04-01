
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoCliente, TipoTelefono, Recambio, CausaRecambio, TipoProducto, EstadoProducto } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import QuickClientModal from './QuickClientModal';

import { useFormShortcuts } from '../hooks/useFormShortcuts';

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
  causasRecambio: CausaRecambio[];
  isReadOnly?: boolean;
}

const RemitoForm: React.FC<RemitoFormProps> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onAddCliente, onClose, remitos, registrosPago, causasRecambio, isReadOnly = false }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>(() => {
      // Inicializar con los datos del remito para evitar que clienteId sea undefined en el primer render
      return { ...remito, pagos: remito.pagos || [] };
  });
  const [clienteSucursales, setClienteSucursales] = useState<Sucursal[]>([]);
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [clientStock, setClientStock] = useState<Record<string, number>>({});
  const { showNotification } = useNotification();

  const isNew = !remito.id;
  const isAdmin = currentUser.rol === Rol.ADMINISTRADOR;

  const clienteOptions = useMemo(() => {
    return clientes
        .filter(c => c.estado === EstadoCliente.ACTIVO || c.id === formData.clienteId)
        .map(c => ({ value: c.id, label: c.nombre }));
  }, [clientes, formData.clienteId]);

  const productosOptions = useMemo(() => 
    productos
      .filter(p => p.estado !== EstadoProducto.INACTIVO || p.id === formData.movimientos?.[0]?.productoId) // Permitir el producto actual si ya está guardado
      .map(p => ({ value: p.id, label: p.nombre })), 
  [productos, formData.movimientos]);

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
        const precio = mov.precioUnitario ?? preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return total + (mov.entregados * precio);
    }, 0);
  }, [clientes, productosMap]);

  useEffect(() => { 
    const initialPagos = remito.id ? (pagosMap.get(remito.id) || []).map(p => ({ monto: p.monto, metodo: p.metodo })) : (remito.pagos || []);
    setFormData({ ...remito, pagos: initialPagos }); 
  }, [remito, pagosMap]);

  useEffect(() => {
    if (isNew && formData.puntoVenta && !formData.numero) {
      const pto = formData.puntoVenta;
      const remitosMismoPto = remitos.filter(r => r.puntoVenta === pto);
      const usedNumbers = new Set<number>(remitosMismoPto.map(r => parseInt(r.numero) || 0));
      
      let nextNum = 1;
      if (usedNumbers.size > 0) {
        const nums: number[] = Array.from(usedNumbers);
        const maxNum = Math.max(...nums);
        nextNum = maxNum + 1;
      }
      
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }
      
      setFormData(prev => ({ ...prev, numero: nextNum.toString() }));
    }
  }, [formData.puntoVenta, isNew, remitos, formData.numero]);

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
        const remitosDelCliente = remitos.filter(r => r.clienteId === formData.clienteId && r.id !== formData.id && !r.esAjuste);
        const pagosDelCliente = registrosPago.filter(p => p.clienteId === formData.clienteId && p.origen.id !== formData.id);
        
        const totalRemitos = remitosDelCliente.reduce((sum, r) => sum + getRemitoTotal(r), 0);
        const totalPagos = pagosDelCliente.reduce((sum, p) => sum + p.monto, 0);
        
        setDeudaPendiente(Math.max(0, totalRemitos - totalPagos));
      } else setDeudaPendiente(0);

      // Calcular Stock del Cliente (Filtrar por sucursal si existe)
      const stock: Record<string, number> = {};
      remitos.filter(r => {
          if (r.clienteId !== formData.clienteId) return false;
          if (!formData.sucursalId) return true; // Si no hay sucursal seleccionada, mostrar total
          const rSucId = r.sucursalId || 'main'; // Tratar remitos sin sucursal como 'main'
          return rSucId === formData.sucursalId;
      }).forEach(r => {
          r.movimientos.forEach(m => {
              const prod = productosMap.get(m.productoId);
              if (prod?.tipo === TipoProducto.RETORNABLE) {
                  stock[m.productoId] = (stock[m.productoId] || 0) + (m.entregados - m.recibidos);
              }
          });
      });
      setClientStock(stock);

      // Pre-seleccionar productos si hay stock (Solo para remitos nuevos)
      if (isNew && formData.movimientos?.length === 1 && formData.movimientos[0].productoId === '') {
          const prodsWithStock = Object.entries(stock)
              .filter(([_, cant]) => (cant as number) !== 0)
              .map(([prodId, _]) => ({ productoId: prodId, entregados: 0, recibidos: 0 }));
          
          if (prodsWithStock.length > 0) {
              setFormData(prev => ({ ...prev, movimientos: prodsWithStock }));
          }
      }
    } else { setClienteSucursales([]); setIsCtaCte(false); setDeudaPendiente(0); setClientStock({}); }
  }, [formData.clienteId, formData.sucursalId, clientes, remitos, getRemitoTotal, registrosPago, formData.id, productosMap, isNew]);

  const totalRemito = useMemo(() => getRemitoTotal(formData), [formData, getRemitoTotal]);

  const prevPagosLength = React.useRef(formData.pagos?.length || 0);
  useEffect(() => {
    const currentLength = formData.pagos?.length || 0;
    if (currentLength > prevPagosLength.current && !isReadOnly) {
      const lastIndex = currentLength - 1;
      setTimeout(() => {
        const input = document.getElementById(`pago-monto-${lastIndex}`);
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement) {
            input.select();
          }
        }
      }, 100);
    }
    prevPagosLength.current = currentLength;
  }, [formData.pagos?.length, isReadOnly]);

  // Focus on the first quantity input when opening a pre-filled remito
  useEffect(() => {
    if (remito.clienteId && !isReadOnly) {
      let attempts = 0;
      const interval = setInterval(() => {
        const input = document.getElementById('primer-input-cantidad');
        if (input) {
          input.focus();
          // Select the text inside the input for easier overwriting
          if (input instanceof HTMLInputElement) {
            input.select();
          }
          attempts++;
          // Try a few times to ensure it sticks after any re-renders caused by stock calculation
          if (attempts > 3) {
            clearInterval(interval);
          }
        } else if (attempts > 15) {
          // Stop trying after 1.5 seconds if element never appears
          clearInterval(interval);
        } else {
          attempts++;
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [remito.clienteId, isReadOnly]);

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

  const addRecambio = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      recambios: [...(prev.recambios || []), { productoId: '', cantidad: 0, causaId: '' }]
    }));
  }, []);

  const removeRecambio = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recambios: (prev.recambios || []).filter((_, i) => i !== index)
    }));
  };

  const handleRecambioChange = (index: number, field: keyof Recambio, value: any) => {
    setFormData(prev => {
      const newRecambios = [...(prev.recambios || [])];
      newRecambios[index] = { ...newRecambios[index], [field]: field === 'cantidad' ? parseInt(value) || 0 : value };
      return { ...prev, recambios: newRecambios };
    });
  };

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
    } catch (e: any) { showNotification(e.message || 'Error.', 'error'); }
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
        numero: numeroLimpio,
        movimientos: formData.movimientos?.map(mov => {
            // Si ya tiene precio (ej: estamos editando un remito que ya lo guardó), lo mantenemos
            if (mov.precioUnitario !== undefined) return mov;
            
            // Si no tiene precio (remito nuevo o antiguo sin el campo), buscamos el precio actual
            const cliente = clientes.find(c => c.id === formData.clienteId);
            const producto = productosMap.get(mov.productoId);
            const precio = cliente?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio ?? producto?.precio ?? 0;
            
            return { ...mov, precioUnitario: precio };
        })
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

  useFormShortcuts({ onSave: handleSubmit, onCancel: onClose, isDisabled: isReadOnly });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly) return;
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
  }, [isReadOnly, addMovimiento, addPago, isCtaCte, formData]);
  
  return (
    <>
      <form onSubmit={handleSubmit} style={{ maxHeight: '85vh', overflowY: 'auto', paddingRight: '0.5rem', margin: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito {formData.esAjuste && '(Ajuste)'}</span>
                        {!isAdmin && formData.fecha && (
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--pico-muted-color)', backgroundColor: 'var(--pico-secondary-background)', padding: '0.125rem 0.5rem', borderRadius: '0.375rem', textTransform: 'none' }}>
                                {formData.fecha.split('-').reverse().join('/')}
                            </span>
                        )}
                    </h2>
                </div>
                {isAdmin && !isReadOnly && (
                    <div style={{ width: '50%', maxWidth: '160px' }}>
                        <SearchableSelect 
                            label="" 
                            placeholder="Vendedor" 
                            options={vendedores.map(v => ({value: v.id, label: v.nombre}))} 
                            value={formData.vendedorId || ''} 
                            onChange={v => setFormData({...formData, vendedorId: v})} 
                        />
                    </div>
                )}
            </div>
            
            <div className="grid" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
                <div style={{ minWidth: '80px' }}>
                    <AppInput label="Pto Vta" type="number" name="puntoVenta" value={formData.puntoVenta || ''} onChange={handleChange} required disabled={isReadOnly} style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}/>
                </div>
                <div style={{ minWidth: '120px' }}>
                    <AppInput label="Número" type="number" name="numero" value={formData.numero || ''} onChange={handleChange} required disabled={isReadOnly} style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}/>
                </div>
            </div>
            {isAdmin && (
                <div style={{ marginTop: '0.5rem' }}>
                    <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required disabled={isReadOnly} style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}/>
                </div>
            )}
        </div>

        {deudaPendiente > 0 && (
            <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', color: '#b45309', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 'bold', fontSize: '0.875rem', margin: 0 }}>Deuda Pendiente: ${deudaPendiente.toLocaleString()}</p>
            </div>
        )}
        
        <div className="grid" style={{ gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Cliente</label>
                    {!isReadOnly && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="outline" style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', padding: '0.125rem 0.25rem', width: 'auto', margin: 0, border: 'none' }}>+ Nuevo</button>}
                </div>
                <SearchableSelect 
                  options={clienteOptions} 
                  value={formData.clienteId || ''} 
                  onChange={(v) => handleSelectChange('clienteId', v)} 
                  disabled={isReadOnly}
                  autoFocus={!isReadOnly && !formData.clienteId}
                />
                {Object.keys(clientStock).length > 0 && (
                  <div style={{ marginTop: '0.375rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {Object.entries(clientStock).map(([prodId, cant]) => {
                      const prod = productosMap.get(prodId);
                      const cantidad = cant as number;
                      if (cantidad === 0) return null;
                      return (
                        <span key={prodId} style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 'bold', 
                            padding: '0.125rem 0.5rem', 
                            borderRadius: '9999px', 
                            border: '1px solid',
                            backgroundColor: cantidad > 0 ? '#eff6ff' : '#fef2f2',
                            color: cantidad > 0 ? '#1d4ed8' : '#b91c1c',
                            borderColor: cantidad > 0 ? '#bfdbfe' : '#fecaca'
                        }}>
                          {prod?.nombre}: {cantidad}
                        </span>
                      );
                    })}
                  </div>
                )}
                {currentAddress && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--pico-muted-color)', marginTop: '0.25rem', marginLeft: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 'bold' }}>Dirección:</span> {currentAddress}
                    </p>
                )}
            </div>
            {clienteSucursales.length > 1 && (
                <div>
                    <AppSelect label="Sucursal" name="sucursalId" value={formData.sucursalId || ''} onChange={handleChange} options={clienteSucursales.map(s=>({value:s.id, label:s.nombre}))} disabled={isReadOnly} required style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
            )}
        </div>

        <fieldset style={{ borderTop: '1px solid var(--pico-muted-border-color)', paddingTop: '0.75rem', marginTop: '1rem' }}>
          <legend style={{ fontSize: '0.875rem', fontWeight: 900, textTransform: 'uppercase', padding: '0 0.5rem' }}>Movimientos</legend>
          {(formData.movimientos || []).map((mov, index) => (
              <article key={index} style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--pico-card-background-color)', border: '1px solid var(--pico-muted-border-color)' }}>
                  <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleProductoChange(index, v)} disabled={isReadOnly} />
                  <div className="grid" style={{ marginTop: '0.5rem', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div>
                          <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--pico-muted-color)', marginBottom: '0.25rem', display: 'block' }}>Entrega</label>
                          <AppInput 
                            id={index === 0 ? "primer-input-cantidad" : undefined}
                            type="number" 
                            value={mov.entregados} 
                            onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} 
                            required 
                            disabled={isReadOnly} 
                            autoFocus={!isReadOnly && !!formData.clienteId && index === 0}
                            style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.125rem', padding: '0.375rem' }}
                          />
                      </div>
                      <div>
                          <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--pico-muted-color)', marginBottom: '0.25rem', display: 'block' }}>Recibe</label>
                          <AppInput 
                            type="number" 
                            value={mov.recibidos} 
                            onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} 
                            required 
                            disabled={isReadOnly} 
                            style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.125rem', padding: '0.375rem' }}
                          />
                      </div>
                      <div style={{ paddingBottom: '1rem' }}>
                          <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} disabled={isReadOnly} style={{ padding: '0.5rem', height: '2.5rem', width: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} type="button"><TrashIcon/></AppButton>
                      </div>
                  </div>
              </article>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addMovimiento} style={{ width: '100%', borderStyle: 'dashed', borderWidth: '2px', padding: '0.375rem 0.75rem' }}>+ Agregar Item <small style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '0.25rem', fontWeight: 'normal' }}>(Alt+I)</small></AppButton>}
        </fieldset>

        <fieldset style={{ borderTop: '1px solid var(--pico-muted-border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
          <legend style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ea580c', padding: '0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Recambios (Sin Cargo)
          </legend>
          {(formData.recambios || []).map((rec, index) => (
              <div key={index} className="grid" style={{ alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', backgroundColor: 'rgba(234, 88, 12, 0.05)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                  <SearchableSelect options={productosOptions} value={rec.productoId} onChange={(v) => handleRecambioChange(index, 'productoId', v)} disabled={isReadOnly} />
                  <AppInput type="number" value={rec.cantidad} onChange={(e) => handleRecambioChange(index, 'cantidad', e.target.value)} required disabled={isReadOnly} />
                  <AppSelect 
                    value={rec.causaId} 
                    onChange={(e) => handleRecambioChange(index, 'causaId', e.target.value)} 
                    options={causasRecambio.map(c => ({ value: c.id, label: c.nombre }))}
                    disabled={isReadOnly}
                  />
                  <AppButton variant="danger" size="sm" onClick={() => removeRecambio(index)} disabled={isReadOnly} style={{ padding: '0.5rem' }} type="button"><TrashIcon/></AppButton>
              </div>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addRecambio} style={{ width: '100%', borderStyle: 'dashed', borderWidth: '2px', borderColor: '#fed7aa', color: '#ea580c' }}>+ Agregar Recambio</AppButton>}
        </fieldset>

        {(!isCtaCte || (formData.pagos && formData.pagos.length > 0)) && !formData.esAjuste && (
            <fieldset style={{ borderTop: '1px solid var(--pico-muted-border-color)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                <legend style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--pico-primary)', textTransform: 'uppercase', padding: '0 0.5rem' }}>Información de Cobro</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(var(--pico-primary-rgb), 0.05)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--pico-primary-border)' }}>
                    {(formData.pagos || []).map((pago, index) => (
                        <div key={index} className="grid" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
                            <AppInput 
                                id={`pago-monto-${index}`}
                                label={index === 0 ? "Monto Pagado" : ""} 
                                type="number" 
                                value={pago.monto} 
                                onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} 
                                step="0.01" 
                                style={{ fontWeight: 900, color: '#16a34a' }} 
                                disabled={isReadOnly} 
                            />
                            <AppSelect label={index === 0 ? "Método" : ""} value={pago.metodo} onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} disabled={isReadOnly} />
                            <AppButton variant="danger" size="sm" onClick={() => removePago(index)} disabled={isReadOnly} style={{ padding: '0.5rem', marginBottom: '1rem' }}><TrashIcon style={{ width: '1.25rem', height: '1.25rem' }}/></AppButton>
                        </div>
                    ))}
                    {!isReadOnly && (
                        <AppButton variant="secondary" size="sm" onClick={addPago} style={{ width: '100%', borderStyle: 'dashed', borderWidth: '2px', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>+ Agregar Pago / Cobro <small style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '0.25rem', fontWeight: 'normal' }}>(Alt+P)</small></AppButton>
                    )}
                </div>
            </fieldset>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--pico-secondary-background)', borderRadius: '0.5rem', marginTop: '1rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>Total Remito: ${totalRemito.toLocaleString()}</span>
        </div>
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--pico-muted-border-color)', marginTop: '1rem' }}>
          <AppButton variant="secondary" onClick={onClose}>{isReadOnly ? 'Cerrar' : 'Cancelar'}</AppButton>
          {!isReadOnly && <AppButton variant="primary" type="submit" disabled={isSaving}>Guardar Remito <small style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '0.25rem', fontWeight: 'normal' }}>(Alt+Enter)</small></AppButton>}
        </footer>
      </form>
      <QuickClientModal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} onSave={handleSaveQuickClient} />
    </>
  )
}

export default RemitoForm;
