
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Remito, Cliente, Usuario, Sucursal, MetodoPago, Producto, Movimiento, PagoDetalle, RegistroPago, Rol, EstadoCliente, TipoTelefono, Recambio, CausaRecambio, TipoProducto, EstadoProducto, Factura, TipoVendedor } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import QuickClientModal from './QuickClientModal';
import { getPendingFacturas, FacturaPendiente } from '../utils/invoiceUtils';
import { calculateRemitoTotal, shouldShowPaymentSection, calculateStockAtentivo } from '../utils/salesUtils';

import MarkdownEditor from './ui/MarkdownEditor';

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
  onVendedorChange?: (vendedorId: string) => void;
}

const RemitoForm: React.FC<RemitoFormProps> = ({ remito, clientes, vendedores, productos, currentUser, onSave, onAddCliente, onClose, remitos, registrosPago, causasRecambio, isReadOnly = false, facturas = [], onAddPagoToFactura, onVendedorChange }) => {
  const [formData, setFormData] = useState<Partial<Remito> & { pagos?: PagoDetalle[] }>(() => {
      // Inicializar con los datos del remito para evitar que clienteId sea undefined en el primer render
      return { ...remito, pagos: remito.pagos || [] };
  });
  const [isCtaCte, setIsCtaCte] = useState(false);
  const [deudaPendiente, setDeudaPendiente] = useState(0);
  const [pendingFacturas, setPendingFacturas] = useState<FacturaPendiente[]>([]);
  const [facturaPagos, setFacturaPagos] = useState<Record<string, PagoDetalle[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = React.useRef(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [clientStock, setClientStock] = useState<Record<string, number>>({});
  const [showRecambios, setShowRecambios] = useState(remito.recambios && remito.recambios.length > 0);
  const [showPrices, setShowPrices] = useState(false);
  const { showNotification } = useNotification();

  const isNew = !remito.id;
  const isAdmin = currentUser.rol === Rol.ADMINISTRADOR;

  const clienteSucursales = useMemo(() => {
    if (!formData.clienteId) return [];
    const cliente = clientes.find(c => c.id === formData.clienteId);
    return [...(cliente?.sucursales || [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [formData.clienteId, clientes]);

  const subjectOptions = useMemo(() => {
    const clients = clientes
        .filter(c => c.estado === EstadoCliente.ACTIVO || c.id === formData.clienteId)
        .map(c => ({ value: `client_${c.id}`, label: `👤 CLIENTE: ${c.nombre}`, originalId: c.id, type: 'client' }));
    
    const externals = vendedores
        .filter(v => v.tipo === TipoVendedor.EXTERNO)
        .map(v => ({ value: `vendor_${v.id}`, label: `🚚 VENDEDOR: ${v.nombre}`, originalId: v.id, type: 'vendor' }));
    
    return [...clients, ...externals];
  }, [clientes, vendedores, formData.clienteId]);

  const selectedSubjectValue = useMemo(() => {
    if (formData.clienteId) return `client_${formData.clienteId}`;
    if (formData.vendedorId && !formData.clienteId && formData.esVentaMostrador) return `vendor_${formData.vendedorId}`;
    return '';
  }, [formData.clienteId, formData.vendedorId, formData.esVentaMostrador]);

  const handleSubjectChange = (val: string) => {
    const option = subjectOptions.find(o => o.value === val);
    if (!option) {
        setFormData(prev => {
            // Keep the current vendor, just clear client info
            return { ...prev, clienteId: '', sucursalId: '' };
        });
        return;
    }
    
    if (option.type === 'client') {
        const clienteId = option.originalId;
        const cliente = clientes.find(c => c.id === clienteId);
        const sucs = cliente?.sucursales || [];
        const sucursalId = sucs.length === 1 ? sucs[0].id : '';
        
        setFormData(prev => {
            // If the current vendor is an external acting as the main subject (no client was selected),
            // we should probably revert the vendor to the main user or keep it?
            // Safer to just keep the currently assigned vendor if it's explicitly set.
            // But if they switch from Externo to Client, maybe the seller should remain that Externo or the sticky one.
            // Best is to leave the prev.vendedorId intact.
            return { ...prev, clienteId, sucursalId };
        });
    } else {
        const vendedorIdOver = option.originalId;
        setFormData(prev => ({ ...prev, clienteId: '', vendedorId: vendedorIdOver, sucursalId: '' }));
        onVendedorChange?.(vendedorIdOver);
    }
  };

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
    return calculateRemitoTotal(r, clientes, vendedores, productosMap);
  }, [clientes, vendedores, productosMap]);

  useEffect(() => { 
    const initialPagos = remito.id ? (pagosMap.get(remito.id) || []).map(p => ({ monto: p.monto, metodo: p.metodo })) : (remito.pagos || []);
    setFormData(prev => {
        // Prevent wiping progress. Only update pagos if they have actually changed from the outside.
        // This avoids resetting vendedorId, clienteId, and movimientos if a background Firebase sync triggers pagosMap change.
        return { ...prev, pagos: initialPagos };
    }); 
  }, [remito.id, remito.pagos, pagosMap]);

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
        // Calcular facturas pendientes usando la utilidad
        const pending = getPendingFacturas(formData.clienteId, facturas as Factura[], registrosPago);
        setPendingFacturas(pending);
      }

      // Calcular Stock del Cliente (Filtrar por sucursal si existe)
      const stock = calculateStockAtentivo(formData.clienteId!, true, formData.sucursalId, remitos, productosMap);
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
    } else if (formData.vendedorId && !formData.clienteId) {
        // Lógica para Vendedor Externo (Auto-compra)
        setIsCtaCte(true); // Los externos siempre tienen CC
        setDeudaPendiente(0);
        const stock = calculateStockAtentivo(formData.vendedorId!, false, undefined, remitos, productosMap);
        setClientStock(stock);
        setPendingFacturas([]);
    } else { setIsCtaCte(false); setDeudaPendiente(0); setClientStock({}); }
  }, [formData.clienteId, formData.vendedorId, formData.sucursalId, clientes, remitos, getRemitoTotal, registrosPago, formData.id, productosMap, isNew, facturas]);

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
          if (input instanceof HTMLInputElement) input.select();
        }
      }, 50);
    }
    prevPagosLength.current = currentLength;
  }, [formData.pagos?.length, isReadOnly]);

  // Efecto para scroll automático al final cuando se agregan movimientos
  const prevMovimientosLength = React.useRef(formData.movimientos?.length || 0);
  useEffect(() => {
    const currentLength = formData.movimientos?.length || 0;
    if (currentLength > prevMovimientosLength.current && !isReadOnly) {
        // En realidad no necesitamos scroll si el modal es largo y el navegador lo maneja
        // pero podemos enfocar el nuevo producto
    }
    prevMovimientosLength.current = currentLength;
  }, [formData.movimientos?.length, isReadOnly]);

  // Multi-step focus management (Desktop only)
  // Step 1: Initial focus on mount
  useEffect(() => {
    if (isReadOnly || window.innerWidth < 1024) return;
    const timer = setTimeout(() => {
      document.getElementById('client-select')?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [isReadOnly]);

  // Step 2 & 3: Flow transition (Client -> Branch? -> Quantity)
  useEffect(() => {
    if (isReadOnly || window.innerWidth < 1024 || !formData.clienteId) return;
    
    const needsBranch = clienteSucursales.length > 1;
    const hasBranch = !!formData.sucursalId;

    if (needsBranch && !hasBranch) {
      // Focus branch and WAIT for change
      setTimeout(() => {
        document.getElementById('sucursal-select')?.focus();
      }, 100);
    } else if (!needsBranch || hasBranch) {
      // Either branch is selected or none needed -> Focus Quantity
      setTimeout(() => {
        const input = document.getElementById('primer-input-cantidad');
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement) input.select();
        }
      }, 200);
    }
  }, [formData.clienteId, formData.sucursalId, clienteSucursales.length, isReadOnly]);

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
    const producto = productosMap.get(productoId);
    
    // Calcular precio por defecto
    let precio = producto?.precio || 0;
    if (formData.clienteId) {
        const cliente = clientes.find(c => c.id === formData.clienteId);
        const espec = cliente?.preciosEspeciales?.find(p => p.productoId === productoId);
        if (espec) precio = espec.precio;
    } else if (formData.vendedorId) {
        const vendedor = vendedores.find(v => v.id === formData.vendedorId);
        if (vendedor) {
            const espec = vendedor.preciosEspeciales?.find(p => p.productoId === productoId);
            if (espec) precio = espec.precio;
            else if (vendedor.tipo === TipoVendedor.EXTERNO) precio = producto?.precioReventa || producto?.precio || 0;
        }
    }

    newMovimientos[index] = { ...newMovimientos[index], productoId, precioUnitario: precio };
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
    
    // Si no es venta mostrador, requiere cliente
    const isVentaDirecta = formData.esVentaMostrador || (formData.vendedorId && !formData.clienteId);
    const isPurePayment = formData.pagos && formData.pagos.length > 0 && (!formData.movimientos || formData.movimientos.length === 0);
    
    if ((!isVentaDirecta && !formData.clienteId) || !formData.vendedorId || (!formData.movimientos?.length && !isPurePayment)) {
        return showNotification('Datos incompletos. Seleccione un cliente o vendedor y productos (o un pago).', 'error');
    }
    
    // --- SANITIZACIÓN ---
    const puntoVentaLimpio = parseInt(formData.puntoVenta || '0').toString();
    const numeroLimpio = parseInt(formData.numero || '0').toString();

    const remitoFinal = {
        ...formData,
        puntoVenta: puntoVentaLimpio,
        numero: numeroLimpio,
        movimientos: formData.movimientos?.map(mov => {
            // USAR EL PRECIO QUE YA TIENE EL MOVIMIENTO (Manual o defalteado en handleProductoChange)
            const producto = productosMap.get(mov.productoId);
            const precio = mov.precioUnitario ?? producto?.precio ?? 0;
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
      if (e.altKey && (e.key === 'i' || e.key === 'I' || e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        addMovimiento();
        return;
      }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        // Usar la misma lógica de visibilidad para permitir agregar pagos
        if (shouldShowPaymentSection(isCtaCte, !!formData.esVentaMostrador, formData.pagos?.length || 0, !!formData.esAjuste)) {
            addPago();
        }
        return;
      }
    };
    // Usar keydown en el window para capturar globalmente en el modal
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isReadOnly, addMovimiento, addPago, handleSubmit, isCtaCte, formData]);
  
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        {/* Header Section */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center px-1">
                <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter leading-none">
                    {formData.esVentaMostrador ? 'Mostrador' : (remito.id ? (isReadOnly ? 'Ver' : 'Editar') : 'Nuevo') + ' Remito'} {formData.esAjuste && '(Ajuste)'}
                </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <AppInput 
                  label="Fecha de Emisión" 
                  type="date" 
                  name="fecha" 
                  value={formData.fecha || ''} 
                  onChange={handleChange} 
                  required 
                  disabled={!isAdmin || isReadOnly} 
                />
                
                {!formData.esVentaMostrador ? (
                  <>
                    <AppInput label="Punto de Venta" type="number" name="puntoVenta" value={formData.puntoVenta || ''} onChange={handleChange} required disabled={isReadOnly} />
                    <AppInput label="Número de Remito" type="number" name="numero" value={formData.numero || ''} onChange={handleChange} required disabled={isReadOnly} />
                  </>
                ) : <div className="hidden lg:block lg:col-span-2"></div>}

                {isAdmin && !isReadOnly && (
                    <SearchableSelect 
                        label="Vendedor Asignado"
                        placeholder="Vendedor" 
                        options={vendedores.map(v => ({value: v.id, label: v.nombre}))} 
                        value={formData.vendedorId || ''} 
                        onChange={v => {
                            setFormData(prev => ({...prev, vendedorId: v}));
                            onVendedorChange?.(v);
                        }} 
                    />
                )}
            </div>
        </div>

        {deudaPendiente > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <p className="font-bold text-sm uppercase tracking-tight">Deuda Pendiente: ${deudaPendiente.toLocaleString()}</p>
            </div>
        )}
        
        {/* Cliente / Vendedor Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center h-4 px-1">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        {formData.esVentaMostrador ? 'Comprador / Responsable' : 'Cliente'}
                    </label>
                    {!isReadOnly && !formData.esVentaMostrador && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-[10px] font-black text-primary-600 hover:underline uppercase tracking-widest">+ Nuevo</button>}
                </div>
                <SearchableSelect 
                  id="client-select"
                  placeholder={formData.esVentaMostrador ? "Seleccionar Cliente o Vendedor Externo..." : "Seleccionar Cliente..."}
                  options={subjectOptions} 
                  value={selectedSubjectValue} 
                  onChange={handleSubjectChange} 
                  disabled={isReadOnly}
                  autoFocus={!isReadOnly && !formData.clienteId && !formData.vendedorId && window.innerWidth < 1024}
                />
                {Object.keys(clientStock).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(clientStock).map(([prodId, cant]) => {
                      const prod = productosMap.get(prodId);
                      const cantidad = cant as number;
                      if (cantidad === 0) return null;
                      return (
                        <span key={prodId} className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${cantidad > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {prod?.nombre}: {cantidad}
                        </span>
                      );
                    })}
                  </div>
                )}
                {currentAddress && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-1 truncate">
                        <span className="font-bold uppercase tracking-tighter">Dirección:</span> {currentAddress}
                    </p>
                )}
            </div>
            <div className={clienteSucursales.length <= 1 ? 'invisible md:visible' : ''}>
                <AppSelect 
                    id="sucursal-select"
                    label="Sucursal" 
                    name="sucursalId" 
                    value={formData.sucursalId || ''} 
                    onChange={handleChange} 
                    options={clienteSucursales.map(s=>({value:s.id, label:s.nombre}))} 
                    disabled={isReadOnly || clienteSucursales.length <= 1} 
                    required 
                />
            </div>
        </div>

        {/* Movimientos Section */}
        <fieldset className="border-t dark:border-gray-700 pt-3">
          <div className="flex justify-between items-end mb-2 px-1">
            <legend className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Movimientos / Productos</legend>
            {!isReadOnly && (
                <button 
                  type="button" 
                  onClick={() => setShowPrices(!showPrices)}
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-colors ${showPrices ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                    {showPrices ? 'Ocultar Precios' : 'Ver Precios'}
                </button>
            )}
          </div>
          
          {/* Desktop Headers */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-1 mb-2">
              <div className="col-span-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Producto</div>
              <div className="col-span-2 text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">Entrega</div>
              <div className="col-span-2 text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">Recibe</div>
              {showPrices && <div className="col-span-2 text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">Precio</div>}
              <div className={`col-span-1 ${!showPrices ? 'col-start-12' : ''}`}></div>
          </div>

          <div className="space-y-2 lg:space-y-1">
            {(formData.movimientos || []).map((mov, index) => (
                <div key={index} className="grid grid-cols-12 gap-1.5 lg:gap-3 p-2 lg:p-0 bg-gray-50 lg:bg-transparent dark:bg-gray-800/30 lg:dark:bg-transparent rounded-xl lg:rounded-none border lg:border-none border-gray-100 dark:border-gray-700 items-center">
                    <div className="col-span-12 lg:col-span-5">
                        <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleProductoChange(index, v)} disabled={isReadOnly} />
                    </div>
                    
                    <div className="col-span-5 lg:col-span-2 flex items-center gap-1">
                        <label className="lg:hidden text-[8px] font-black text-gray-400 uppercase w-8 text-right">Ent</label>
                        <AppInput 
                          id={index === 0 ? "primer-input-cantidad" : undefined}
                          type="number" 
                          value={mov.entregados} 
                          onChange={(e) => handleMovimientoChange(index, 'entregados', e.target.value)} 
                          required 
                          disabled={isReadOnly} 
                          className="text-center font-black !h-9 lg:!h-[46px]"
                        />
                    </div>
                    
                    <div className="col-span-5 lg:col-span-2 flex items-center gap-1">
                        <label className="lg:hidden text-[8px] font-black text-gray-400 uppercase w-8 text-right">Rec</label>
                        <AppInput 
                          type="number" 
                          value={mov.recibidos} 
                          onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} 
                          required 
                          disabled={isReadOnly} 
                          className="text-center !h-9 lg:!h-[46px]"
                        />
                    </div>

                    {showPrices && (
                        <div className="col-span-10 lg:col-span-2 flex items-center gap-1">
                            <label className="lg:hidden text-[8px] font-black text-gray-400 uppercase w-8 text-right">$$</label>
                            <AppInput 
                            type="number" 
                            value={mov.precioUnitario ?? 0}
                            onChange={(e) => handleMovimientoChange(index, 'precioUnitario', e.target.value)} 
                            required 
                            disabled={isReadOnly} 
                            className="text-center text-primary-600 font-bold !h-9 lg:!h-[46px]"
                            />
                        </div>
                    )}
                    
                    <div className={`col-span-2 lg:col-span-1 flex justify-center ${!showPrices ? 'lg:col-start-12' : ''}`}>
                        <button 
                            onClick={() => removeMovimiento(index)} 
                            disabled={isReadOnly} 
                            className="text-gray-300 hover:text-red-500 p-2 transition-colors disabled:opacity-30"
                            type="button"
                        >
                            <TrashIcon className="w-4 h-4 lg:w-5 lg:h-5"/>
                        </button>
                    </div>
                </div>
            ))}
          </div>
          {!isReadOnly && (
            <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="w-full mt-2 border-dashed border-2 bg-white/50 dark:bg-gray-800/50 py-2 h-10">
                + Item <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+M / Alt+I)</span>
            </AppButton>
          )}
        </fieldset>

        {/* Recambios Section */}
        <fieldset className="border-t dark:border-gray-700 pt-3">
          <div className="flex justify-between items-end mb-2 px-1">
            <legend className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">Recambios (Sin Cargo)</legend>
            {!showRecambios && (
              <AppButton variant="ghost" size="sm" onClick={() => setShowRecambios(true)} className="text-[10px] text-orange-600 font-black uppercase">+ Agregar Recambio</AppButton>
            )}
          </div>
          
          {showRecambios && (
            <>
              {/* Desktop Header Row */}
              <div className="hidden lg:grid grid-cols-12 gap-3 px-1 mb-2">
                  <div className="col-span-5 text-[9px] font-black text-orange-400/50 uppercase tracking-widest">Producto</div>
                  <div className="col-span-2 text-[9px] font-black text-orange-400/50 uppercase tracking-widest text-center">Cant.</div>
                  <div className="col-span-4 text-[9px] font-black text-orange-400/50 uppercase tracking-widest">Causa</div>
                  <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                {(formData.recambios || []).map((rec, index) => (
                    <div key={index} className="grid grid-cols-12 lg:grid-cols-12 gap-2 lg:gap-3 p-3 lg:p-0 bg-orange-50/50 lg:bg-transparent dark:bg-orange-900/10 lg:dark:bg-transparent rounded-xl lg:rounded-none border lg:border-none border-orange-100 dark:border-orange-900/30 items-end lg:items-center">
                        <div className="col-span-12 lg:col-span-5">
                            <label className="lg:hidden text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 mb-1 block">Producto</label>
                            <SearchableSelect options={productosOptions} value={rec.productoId} onChange={(v) => handleRecambioChange(index, 'productoId', v)} disabled={isReadOnly} />
                        </div>
                        <div className="col-span-4 lg:col-span-2">
                            <label className="lg:hidden text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 mb-1 block">Cant.</label>
                            <AppInput type="number" value={rec.cantidad} onChange={(e) => handleRecambioChange(index, 'cantidad', e.target.value)} required disabled={isReadOnly} className="text-center font-bold" />
                        </div>
                        <div className="col-span-6 lg:col-span-4">
                            <label className="lg:hidden text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 mb-1 block">Causa</label>
                            <AppSelect 
                                value={rec.causaId} 
                                onChange={(e) => handleRecambioChange(index, 'causaId', e.target.value)} 
                                options={causasRecambio.map(c => ({ value: c.id, label: c.nombre }))}
                                disabled={isReadOnly}
                            />
                        </div>
                        <div className="col-span-2 lg:col-span-1 flex justify-center text-center">
                            <AppButton variant="danger" size="sm" onClick={() => removeRecambio(index)} disabled={isReadOnly} className="w-full h-[42px] lg:h-[46px] flex items-center justify-center mb-0.5" type="button">
                                <TrashIcon className="w-4 h-4"/>
                            </AppButton>
                        </div>
                    </div>
                ))}
              </div>
              {!isReadOnly && (
                <AppButton variant="secondary" size="sm" onClick={addRecambio} className="w-full mt-4 border-dashed border-2 border-orange-200 dark:border-orange-800 text-orange-600 bg-white/50 dark:bg-orange-900/5">
                    + Nuevo Recambio
                </AppButton>
              )}
            </>
          )}
        </fieldset>

        {shouldShowPaymentSection(isCtaCte, !!formData.esVentaMostrador, formData.pagos?.length || 0, !!formData.esAjuste) && (
            <fieldset className="border-t dark:border-gray-700 pt-6">
                <legend className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] px-2 mb-4">Información de Cobro</legend>
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
                            <AppButton variant="danger" size="sm" onClick={() => removePago(index)} disabled={isReadOnly} className="w-full md:w-11 h-[46px] flex items-center justify-center mb-0.5"><TrashIcon className="w-5 h-5"/></AppButton>
                        </div>
                    ))}
                    {!isReadOnly && (
                        <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 bg-white/50">+ Agregar Pago / Cobro <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+P)</span></AppButton>
                    )}
                </div>
            </fieldset>
        )}

        {isCtaCte && pendingFacturas.length > 0 && !formData.esAjuste && (
            <fieldset className="border-t dark:border-gray-700 pt-6">
                <legend className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-2 mb-4">Pago de Facturas Pendientes</legend>
                <div className="space-y-4">
                    {pendingFacturas.map(factura => {
                        const pagosFactura = facturaPagos[factura.id] || [];
                        const totalPagadoFactura = pagosFactura.reduce((sum, p) => sum + p.monto, 0);
                        const saldoRestante = factura.saldoPendiente - totalPagadoFactura;

                        return (
                            <div key={factura.id} className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Factura #{factura.numero}</p>
                                        <p className="text-xs font-bold text-gray-500">{factura.fecha}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Pendiente</p>
                                        <p className="font-black text-blue-600">${factura.saldoPendiente.toLocaleString()}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    {pagosFactura.map((pago, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3 items-end">
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
                                            <AppButton variant="danger" size="sm" onClick={() => removeFacturaPago(factura.id, index)} disabled={isReadOnly} className="w-full md:w-11 h-[46px] flex items-center justify-center mb-0.5"><TrashIcon className="w-5 h-5"/></AppButton>
                                        </div>
                                    ))}
                                </div>
                                
                                {!isReadOnly && saldoRestante > 0 && (
                                    <AppButton variant="secondary" size="sm" onClick={() => addFacturaPago(factura.id, saldoRestante)} className="w-full border-dashed border-2 bg-white/50 text-blue-600 border-blue-200 mt-3">
                                        + Agregar Pago a Factura
                                    </AppButton>
                                )}
                            </div>
                        );
                    })}
                </div>
            </fieldset>
        )}

        <div className="flex justify-end items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total del Remito</p>
                <p className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter">${totalRemito.toLocaleString()}</p>
            </div>
        </div>

        <div className="px-2">
            <MarkdownEditor 
                value={formData.observaciones || ''} 
                onChange={(val) => setFormData(prev => ({ ...prev, observaciones: val }))}
                placeholder="Ej: Cliente solicitó entregar después de las 10hs..."
            />
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
          <AppButton variant="secondary" onClick={onClose} className="px-8">{isReadOnly ? 'Cerrar' : 'Cancelar'}</AppButton>
          {!isReadOnly && (
            <AppButton variant="primary" type="submit" disabled={isSaving} className="px-8">
                Guardar Remito <span className="opacity-60 text-[10px] ml-2 font-normal">(Ctrl+Enter)</span>
            </AppButton>
          )}
        </div>
      </form>
      <QuickClientModal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} onSave={handleSaveQuickClient} />
    </>
  )
}

export default RemitoForm;
