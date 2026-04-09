
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoCliente, TipoTelefono, Recambio, CausaRecambio, TipoProducto, EstadoProducto } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import QuickClientModal from './QuickClientModal';

// Force sync

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
  facturas?: any[];
  onAddPagoToFactura?: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => Promise<void>;
}

const RemitoForm: React.FC<RemitoFormProps> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onAddCliente, onClose, remitos, registrosPago, causasRecambio, isReadOnly = false, facturas = [], onAddPagoToFactura }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>(() => {
      // Inicializar con los datos del remito para evitar que clienteId sea undefined en el primer render
      return { ...remito, pagos: remito.pagos || [] };
  });
  const [clienteSucursales, setClienteSucursales] = useState<Sucursal[]>([]);
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [pendingFacturas, setPendingFacturas] = useState<any[]>([]);
  const [facturaPagos, setFacturaPagos] = useState<Record<string, PagoDetalle[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = React.useRef(false);
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
        setPendingFacturas([]);
      } else {
        setDeudaPendiente(0);
        // Calcular facturas pendientes
        const facturasCliente = facturas.filter(f => f.clienteId === formData.clienteId && f.estado !== 'anulada');
        const pending = facturasCliente.map(f => {
            const pagosFactura = registrosPago.filter(p => p.origen.tipo === 'factura' && p.origen.id === f.id);
            const totalPagado = pagosFactura.reduce((sum, p) => sum + p.monto, 0);
            return { ...f, totalPagado, saldoPendiente: f.monto - totalPagado };
        }).filter(f => f.saldoPendiente > 0);
        setPendingFacturas(pending);
      }

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

  const handleFacturaPagoChange = (facturaId: string, index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    setFacturaPagos(prev => {
        const newPagos = { ...prev };
        if (!newPagos[facturaId]) newPagos[facturaId] = [];
        newPagos[facturaId][index] = { ...newPagos[facturaId][index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
        return newPagos;
    });
  };

  const addFacturaPago = (facturaId: string, maxMonto: number) => {
    setFacturaPagos(prev => {
        const newPagos = { ...prev };
        if (!newPagos[facturaId]) newPagos[facturaId] = [];
        const pagado = newPagos[facturaId].reduce((sum, p) => sum + p.monto, 0);
        newPagos[facturaId].push({ monto: Math.max(0, maxMonto - pagado), metodo: MetodoPago.EFECTIVO });
        return newPagos;
    });
  };

  const removeFacturaPago = (facturaId: string, index: number) => {
    setFacturaPagos(prev => {
        const newPagos = { ...prev };
        if (newPagos[facturaId]) {
            newPagos[facturaId] = newPagos[facturaId].filter((_, i) => i !== index);
        }
        return newPagos;
    });
  };

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
    if (isSavingRef.current) return;
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

    const remitoExistente = remitos.find(r => {
        if (formData.id && r.id === formData.id) return false;
        const rPV = parseInt(r.puntoVenta);
        const rNum = parseInt(r.numero);
        return rPV === pvActual && rNum === numActual;
    });

    if (remitoExistente) {
        const clienteExistente = clientes.find(c => c.id === remitoExistente.clienteId);
        const sucursalExistente = clienteExistente?.sucursales.find(s => s.id === remitoExistente.sucursalId);
        const nombreCliente = clienteExistente ? clienteExistente.nombre : 'Cliente Desconocido';
        const nombreSucursal = sucursalExistente ? sucursalExistente.nombre : 'Casa Central';
        
        showNotification(`¡Error! El remito ${puntoVentaLimpio}-${numeroLimpio} ya fue cargado a: ${nombreCliente} (${nombreSucursal}).`, 'error');
        return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    
    try {
        await onSave(remitoFinal as Remito & { pagos: PagoDetalle[] });

        // Procesar pagos de facturas
        if (onAddPagoToFactura && Object.keys(facturaPagos).length > 0) {
            for (const facturaId of Object.keys(facturaPagos)) {
                const pagos = facturaPagos[facturaId];
                if (pagos && pagos.length > 0) {
                    await onAddPagoToFactura(facturaId, formData.fecha || new Date().toISOString(), pagos);
                }
            }
        }
        onClose();
    } catch (error) {
        console.error("Error saving remito:", error);
        showNotification("Error al guardar el remito", "error");
    } finally {
        isSavingRef.current = false;
        setIsSaving(false);
    }
  }, [formData, isReadOnly, onSave, showNotification, remitos, onAddPagoToFactura, facturaPagos, clientes, productosMap, onClose]);

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
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto pr-2">
        <div className="flex flex-col mb-2">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter flex items-center gap-2 flex-wrap">
                        <span>{remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo'} Remito {formData.esAjuste && '(Ajuste)'}</span>
                        {!isAdmin && formData.fecha && (
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md normal-case tracking-normal">
                                {formData.fecha.split('-').reverse().join('/')}
                            </span>
                        )}
                    </h2>
                </div>
                {isAdmin && !isReadOnly && (
                    <div className="w-1/2 max-w-[160px]">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <div className="w-full">
                    <AppInput label="Pto Vta" type="number" name="puntoVenta" value={formData.puntoVenta || ''} onChange={handleChange} required disabled={isReadOnly} className="!py-1.5 !text-sm"/>
                </div>
                <div className="w-full">
                    <AppInput label="Número" type="number" name="numero" value={formData.numero || ''} onChange={handleChange} required disabled={isReadOnly} className="!py-1.5 !text-sm"/>
                </div>
                <div className="w-full">
                    <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required disabled={!isAdmin || isReadOnly} className="!py-1.5 !text-sm"/>
                </div>
            </div>
        </div>

        {deudaPendiente > 0 && <div className="p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md"><p className="font-bold text-sm">Deuda Pendiente: ${deudaPendiente.toLocaleString()}</p></div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
                <div className="flex justify-between items-end mb-1">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Cliente</label>
                    {!isReadOnly && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-[10px] font-black text-primary-600 hover:underline uppercase tracking-widest">+ Nuevo</button>}
                </div>
                <SearchableSelect 
                  options={clienteOptions} 
                  value={formData.clienteId || ''} 
                  onChange={(v) => handleSelectChange('clienteId', v)} 
                  disabled={isReadOnly}
                  autoFocus={!isReadOnly && !formData.clienteId}
                />
                {Object.keys(clientStock).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.entries(clientStock).map(([prodId, cant]) => {
                      const prod = productosMap.get(prodId);
                      const cantidad = cant as number;
                      if (cantidad === 0) return null;
                      return (
                        <span key={prodId} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cantidad > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {prod?.nombre}: {cantidad}
                        </span>
                      );
                    })}
                  </div>
                )}
                {currentAddress && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 truncate">
                        <span className="font-bold">Dirección:</span> {currentAddress}
                    </p>
                )}
            </div>
            <div className={clienteSucursales.length <= 1 ? 'invisible md:visible' : ''}>
                <AppSelect 
                    label="Sucursal" 
                    name="sucursalId" 
                    value={formData.sucursalId || ''} 
                    onChange={handleChange} 
                    options={clienteSucursales.map(s=>({value:s.id, label:s.nombre}))} 
                    disabled={isReadOnly || clienteSucursales.length <= 1} 
                    required 
                    className="!py-1.5 !text-sm" 
                />
            </div>
        </div>

        <fieldset className="border-t dark:border-gray-600 pt-3">
          <legend className="text-sm font-black text-gray-800 dark:text-white px-2 mb-2 uppercase tracking-wider">Movimientos</legend>
          {(formData.movimientos || []).map((mov, index) => (
              <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-2 mb-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 items-end">
                  <div className="lg:col-span-5">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Producto</label>
                      <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleProductoChange(index, v)} disabled={isReadOnly} />
                  </div>
                  <div className="lg:col-span-3">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Entrega</label>
                      <AppInput 
                        id={index === 0 ? "primer-input-cantidad" : undefined}
                        type="number" 
                        value={mov.entregados} 
                        onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} 
                        required 
                        disabled={isReadOnly} 
                        autoFocus={!isReadOnly && !!formData.clienteId && index === 0}
                        className="text-center font-bold text-lg !py-1.5"
                      />
                  </div>
                  <div className="lg:col-span-3">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Recibe</label>
                      <AppInput 
                        type="number" 
                        value={mov.recibidos} 
                        onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} 
                        required 
                        disabled={isReadOnly} 
                        className="text-center font-bold text-lg !py-1.5"
                      />
                  </div>
                  <div className="lg:col-span-1 flex justify-center">
                      <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} disabled={isReadOnly} className="!p-2 h-[46px] w-full flex items-center justify-center" type="button"><TrashIcon/></AppButton>
                  </div>
              </div>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="w-full border-dashed border-2 !py-1.5">+ Agregar Item <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+I)</span></AppButton>}
        </fieldset>

        <fieldset className="border-t dark:border-gray-600 pt-4 mt-4">
          <legend className="text-lg font-bold text-orange-600 dark:text-orange-400 px-2 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Recambios (Sin Cargo)
          </legend>
          {(formData.recambios || []).map((rec, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,2fr,auto] items-end md:items-center gap-2 mb-2 bg-orange-50 dark:bg-orange-900/10 p-2 rounded-lg">
                  <SearchableSelect options={productosOptions} value={rec.productoId} onChange={(v) => handleRecambioChange(index, 'productoId', v)} disabled={isReadOnly} />
                  <AppInput type="number" value={rec.cantidad} onChange={(e) => handleRecambioChange(index, 'cantidad', e.target.value)} required disabled={isReadOnly} />
                  <AppSelect 
                    value={rec.causaId} 
                    onChange={(e) => handleRecambioChange(index, 'causaId', e.target.value)} 
                    options={causasRecambio.map(c => ({ value: c.id, label: c.nombre }))}
                    disabled={isReadOnly}
                  />
                  <AppButton variant="danger" size="sm" onClick={() => removeRecambio(index)} disabled={isReadOnly} className="!p-2" type="button"><TrashIcon/></AppButton>
              </div>
          ))}
          {!isReadOnly && <AppButton variant="secondary" size="sm" onClick={addRecambio} className="w-full border-dashed border-2 border-orange-200 dark:border-orange-800 text-orange-600">+ Agregar Recambio</AppButton>}
        </fieldset>

        {(!isCtaCte || (formData.pagos && formData.pagos.length > 0)) && !formData.esAjuste && (
            <fieldset className="border-t dark:border-gray-600 pt-6">
                <legend className="text-lg font-black text-primary-600 uppercase tracking-tighter px-2 mb-4">Información de Cobro</legend>
                <div className="space-y-3 bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800">
                    {(formData.pagos || []).map((pago, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3 items-end">
                            <AppInput 
                                id={`pago-monto-${index}`}
                                label={index === 0 ? "Monto Pagado" : ""} 
                                type="number" 
                                value={pago.monto} 
                                onChange={(e) => handlePagoChange(index, 'monto', e.target.value)} 
                                step="0.01" 
                                className="font-black text-green-600" 
                                disabled={isReadOnly} 
                            />
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

        {isCtaCte && pendingFacturas.length > 0 && !formData.esAjuste && (
            <fieldset className="border-t dark:border-gray-600 pt-6">
                <legend className="text-lg font-black text-blue-600 uppercase tracking-tighter px-2 mb-4">Pago de Facturas Pendientes</legend>
                <div className="space-y-4">
                    {pendingFacturas.map(factura => {
                        const pagosFactura = facturaPagos[factura.id] || [];
                        const totalPagadoFactura = pagosFactura.reduce((sum, p) => sum + p.monto, 0);
                        const saldoRestante = factura.saldoPendiente - totalPagadoFactura;

                        return (
                            <div key={factura.id} className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <span className="font-bold text-blue-800 dark:text-blue-200">Factura #{factura.numero}</span>
                                        <span className="text-sm text-gray-500 ml-2">({factura.fecha})</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-600 dark:text-gray-400">Saldo Pendiente: ${factura.saldoPendiente.toLocaleString()}</div>
                                        <div className="font-bold text-blue-600">Restante: ${saldoRestante.toLocaleString()}</div>
                                    </div>
                                </div>
                                
                                {pagosFactura.map((pago, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3 items-end mb-2">
                                        <AppInput 
                                            label={index === 0 ? "Monto a Pagar" : ""} 
                                            type="number" 
                                            value={pago.monto} 
                                            onChange={(e) => handleFacturaPagoChange(factura.id, index, 'monto', e.target.value)} 
                                            step="0.01" 
                                            className="font-black text-green-600" 
                                            disabled={isReadOnly} 
                                        />
                                        <AppSelect label={index === 0 ? "Método" : ""} value={pago.metodo} onChange={(e) => handleFacturaPagoChange(factura.id, index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} disabled={isReadOnly} />
                                        <AppButton variant="danger" size="sm" onClick={() => removeFacturaPago(factura.id, index)} disabled={isReadOnly} className="!p-2 mb-1"><TrashIcon className="w-5 h-5"/></AppButton>
                                    </div>
                                ))}
                                
                                {!isReadOnly && saldoRestante > 0 && (
                                    <AppButton variant="secondary" size="sm" onClick={() => addFacturaPago(factura.id, saldoRestante)} className="w-full border-dashed border-2 bg-white/50 text-blue-600 border-blue-200 mt-2">
                                        + Agregar Pago a Factura
                                    </AppButton>
                                )}
                            </div>
                        );
                    })}
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
