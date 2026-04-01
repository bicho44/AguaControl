
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PagoDetalle, MetodoPago, Cliente, Usuario, Producto, VentaVendedor, MovimientoVenta, TipoVendedor, TipoTelefono, EstadoProducto } from '../types';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';

import { useFormShortcuts } from '../hooks/useFormShortcuts';

interface MovimientoCajaFormProps {
  movimiento: any;
  type: 'ingreso' | 'gasto';
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  onSave: (data: any, isVenta: boolean) => void;
  onAddCliente: (data: Omit<Cliente, 'id' | 'estado'>) => Promise<string>;
  onClose: () => void;
  isEdit: boolean;
  initialVentaMode?: boolean; // Force start in Venta mode
  hideClientSelector?: boolean; // Hide client selector (for external vendors self-purchase)
}

const MovimientoCajaForm: React.FC<MovimientoCajaFormProps> = ({ 
    movimiento, type, onSave, onAddCliente, onClose, isEdit, 
    clientes, vendedores, productos, ventasVendedor,
    initialVentaMode = false,
    hideClientSelector = false
}) => {
  const [formData, setFormData] = useState<any>(movimiento || { pagos: [] });
  const [isVentaMode, setIsVentaMode] = useState(initialVentaMode);
  const [movimientosVenta, setMovimientosVenta] = useState<MovimientoVenta[]>([]);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const { showNotification } = useNotification();

  const selectedVendedor = useMemo(() => vendedores.find(v => v.id === formData.vendedorId), [formData.vendedorId, vendedores]);
  const selectedCliente = useMemo(() => clientes.find(c => c.id === formData.clienteId), [formData.clienteId, clientes]);
  const clientAddress = useMemo(() => {
      if (!selectedCliente) return null;
      // Mostrar la dirección de la primera sucursal (Casa Central) como referencia
      if (selectedCliente.sucursales.length > 0) return selectedCliente.sucursales[0].direccion;
      return null;
  }, [selectedCliente]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  useEffect(() => {
    if (isEdit) {
        if (formData?.origen?.tipo === 'venta_vendedor') {
            const ventaOriginal = ventasVendedor.find(v => v.id === formData.origen.id);
            if (ventaOriginal) {
                setIsVentaMode(true);
                setMovimientosVenta(ventaOriginal.movimientos || []);
            }
        } else if (formData && !formData.origen && formData.movimientos) {
            setIsVentaMode(true);
            setMovimientosVenta(formData.movimientos || []);
        }
    } else if (initialVentaMode) {
        setIsVentaMode(true);
    }
  }, [isEdit, formData, ventasVendedor, initialVentaMode]);

  const totalVentaCalculado = useMemo(() => {
    if (!isVentaMode) return 0;
    return movimientosVenta.reduce((sum, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return sum;
        const especialCliente = selectedCliente?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
        const especialVendedor = selectedVendedor?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
        // Prioridad: 1. Precio Manual (mov), 2. Especial Cliente, 3. Especial Vendedor, 4. Precio Reventa (si es externo), 5. Precio Lista
        const precioSugerido = especialCliente ?? especialVendedor ?? (selectedVendedor?.tipo === TipoVendedor.EXTERNO ? (prod.precioReventa ?? prod.precio) : prod.precio);
        const precioFinal = mov.precioUnitario ?? precioSugerido;
        return sum + (mov.cantidad * precioFinal);
    }, 0);
  }, [movimientosVenta, selectedVendedor, selectedCliente, isVentaMode, productosMap]);

  useEffect(() => {
    // Si estamos en modo venta y es nuevo, sugerir el pago total en efectivo por defecto
    if (isVentaMode && !isEdit && (!formData.pagos || formData.pagos.length === 0 || (formData.pagos.length === 1 && formData.pagos[0].monto === 0))) {
        setFormData((prev: any) => ({ ...prev, pagos: [{ monto: totalVentaCalculado, metodo: MetodoPago.EFECTIVO }] }));
    }
  }, [totalVentaCalculado, isVentaMode, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleQuickClientSave = async () => {
      if (!quickClientName) return;
      await onAddCliente({
          nombre: quickClientName,
          telefonos: [{ tipo: TipoTelefono.CEL, numero: quickClientPhone }],
          sucursales: [{ id: 'main', nombre: 'Casa Central', direccion: 'Venta Mostrador' }],
      });
      setIsQuickClientOpen(false);
      setQuickClientName(''); setQuickClientPhone('');
  };

  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    newPagos[index] = { ...newPagos[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  };

  const handleMovimientoChange = (index: number, field: keyof MovimientoVenta, value: any) => {
    const newMovs = [...movimientosVenta];
    newMovs[index] = { ...newMovs[index], [field]: (field === 'cantidad' || field === 'recibidos' || field === 'precioUnitario') ? (Number(value) || 0) : value };
    setMovimientosVenta(newMovs);
  };

  const addMovimiento = useCallback(() => setMovimientosVenta(prev => [...prev, { productoId: '', cantidad: 1, recibidos: 0 }]), []);
  const removeMovimiento = (index: number) => setMovimientosVenta(prev => prev.filter((_, i) => i !== index));

  const addPago = useCallback(() => {
      setFormData((prev: any) => ({...prev, pagos: [...(prev.pagos || []), {monto: 0, metodo: MetodoPago.EFECTIVO}]}));
  }, []);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVentaMode) {
        const idToUse = (isEdit && formData.origen?.id) ? formData.origen.id : formData.id;
        
        const payload = { 
            ...formData,
            id: idToUse,
            movimientos: movimientosVenta.filter(m => m.productoId && m.cantidad > 0).map(mov => {
                // Si ya tiene precio (ej: estamos editando), lo mantenemos
                if (mov.precioUnitario !== undefined && mov.precioUnitario !== 0) return mov;
                
                // Si no tiene precio, calculamos el precio sugerido actual para persistirlo
                const prod = productosMap.get(mov.productoId);
                if (!prod) return mov;
                const especialCliente = selectedCliente?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
                const especialVendedor = selectedVendedor?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
                const precioSugerido = especialCliente ?? especialVendedor ?? (selectedVendedor?.tipo === TipoVendedor.EXTERNO ? (prod.precioReventa ?? prod.precio) : prod.precio);
                
                return { ...mov, precioUnitario: precioSugerido };
            })
        };
        onSave(payload, true);
    } else {
        onSave(formData, false);
    }
  }, [formData, isVentaMode, movimientosVenta, onSave, isEdit, productosMap, selectedCliente, selectedVendedor]);

  useFormShortcuts({ onSave: handleSubmit, onCancel: onClose });

  const vendedorOptions = useMemo(() => vendedores.map(v => ({ value: v.id, label: v.nombre })), [vendedores]);
  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const productosOptions = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '85vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pico-muted-border-color)', paddingBottom: '0.5rem', paddingRight: '3rem' }}>
         <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--pico-color)', uppercase: 'true', letterSpacing: '-0.05em', margin: 0 }}>
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? (hideClientSelector ? 'Compra' : 'Ingreso') : 'Gasto'}
         </h2>
         {type === 'ingreso' && !isEdit && !hideClientSelector && (
            <button 
                type="button" 
                onClick={() => setIsVentaMode(!isVentaMode)} 
                className={isVentaMode ? '' : 'secondary outline'}
                style={{ 
                    padding: '0.25rem 1rem', 
                    borderRadius: '999px', 
                    fontSize: '0.625rem', 
                    fontWeight: 900, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    margin: 0,
                    transition: 'all 0.2s ease'
                }}
            >
                {isVentaMode ? '✓ Modo Venta de Stock' : '+ Venta de Mostrador'}
            </button>
         )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="grid">
            <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required />
            <AppInput label="Concepto / Referencia" type="text" name="concepto" placeholder="Ej: Venta local..." value={formData.concepto || ''} onChange={handleChange} required={!isVentaMode} />
        </div>

        {type === 'gasto' && (
            <div style={{ padding: '1rem', backgroundColor: 'rgba(128, 128, 128, 0.05)', borderRadius: 'var(--pico-border-radius)', border: '1px dashed var(--pico-muted-border-color)' }}>
                <SearchableSelect 
                    label="Asignar a Responsable (Opcional)" 
                    options={vendedorOptions} 
                    value={formData.vendedorId || ''} 
                    onChange={(v) => handleSelectChange('vendedorId', v)} 
                    placeholder="Sin asignar (Gasto General)" 
                />
            </div>
        )}

        {/* Solo mostramos cliente/vendedor si NO estamos en modo auto-compra externa */}
        {type === 'ingreso' && !hideClientSelector && (
            <div className="grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', padding: '0 0.25rem', margin: 0 }}>Cliente</label>
                        {!isEdit && (
                            <button 
                                type="button" 
                                onClick={() => setIsQuickClientOpen(!isQuickClientOpen)} 
                                className="contrast outline"
                                style={{ 
                                    fontSize: '0.625rem', 
                                    fontWeight: 900, 
                                    padding: '0.125rem 0.5rem',
                                    margin: 0,
                                    border: 'none',
                                    textDecoration: 'underline'
                                }}
                            >
                                {isQuickClientOpen ? 'Cerrar' : '+ Cliente Rápido'}
                            </button>
                        )}
                    </div>
                    {isQuickClientOpen ? (
                        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(var(--pico-primary-rgb), 0.05)', borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-primary-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <AppInput value={quickClientName} onChange={e => setQuickClientName(e.target.value)} placeholder="Nombre..." />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <AppInput value={quickClientPhone} onChange={e => setQuickClientPhone(e.target.value)} placeholder="Tel..." />
                                <AppButton variant="primary" size="sm" onClick={handleQuickClientSave} disabled={!quickClientName}>Crear</AppButton>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Consumidor Final..." />
                            {clientAddress && <p style={{ fontSize: '0.625rem', color: 'var(--pico-muted-color)', marginTop: '0.25rem', padding: '0 0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}><span style={{ fontWeight: 'bold' }}>Dirección:</span> {clientAddress}</p>}
                        </div>
                    )}
                </div>
                <SearchableSelect label="Vendedor / Atendido por" options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Seleccionar..." />
            </div>
        )}

        {isVentaMode && (
            <fieldset style={{ border: '2px solid var(--pico-primary)', paddingTop: '1rem', backgroundColor: 'rgba(var(--pico-primary-rgb), 0.02)', padding: '1rem', borderRadius: 'var(--pico-border-radius)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                <legend style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-primary)', padding: '0.25rem 0.75rem', backgroundColor: 'var(--pico-background-color)', borderRadius: '999px', border: '2px solid var(--pico-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
                    {hideClientSelector ? 'DETALLE DE LA COMPRA (Tu Stock)' : 'STOCK E INVENTARIO'}
                </legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {movimientosVenta.map((mov, index) => (
                        <div key={index} className="grid" style={{ alignItems: 'end', backgroundColor: 'var(--pico-card-background-color)', padding: '1rem', borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-muted-border-color)' }}>
                            <div><label style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Producto</label><SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleMovimientoChange(index, 'productoId', v)} /></div>
                            <div><label style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', marginBottom: '0.25rem', textAlign: 'center' }}>Cantidad</label><AppInput type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} style={{ textAlign: 'center', fontWeight: 900 }} /></div>
                            {/* Ocultamos Retira Envase si es auto-compra externa, se asume que se lleva el producto entero */}
                            {!hideClientSelector ? (
                                <div><label style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', marginBottom: '0.25rem', textAlign: 'center' }}>Retira (Envase)</label><AppInput type="number" value={mov.recibidos || 0} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} style={{ textAlign: 'center', fontWeight: 900, backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#856404' }} /></div>
                            ) : <div></div>}
                            <div><label style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', marginBottom: '0.25rem', textAlign: 'right' }}>Precio</label><AppInput type="number" value={mov.precioUnitario || ''} onChange={(e) => handleMovimientoChange(index, 'precioUnitario', e.target.value)} style={{ textAlign: 'right', fontFamily: 'var(--pico-font-family-mono)' }} placeholder="Unit..." /></div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} style={{ padding: '0.5rem' }}><TrashIcon/></AppButton></div>
                        </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <AppButton variant="secondary" onClick={addMovimiento} style={{ width: '100%', borderStyle: 'dashed', borderWidth: '2px' }}>+ Agregar Item</AppButton>
                        <div style={{ textAlign: 'right', padding: '1rem', backgroundColor: 'var(--pico-primary-background)', color: 'var(--pico-primary-inverse)', borderRadius: 'var(--pico-border-radius)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', width: '100%', minWidth: '200px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 900, opacity: 0.8, textTransform: 'uppercase', display: 'block' }}>Total Calculado</span>
                            <span style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.05em' }}>${totalVentaCalculado.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </fieldset>
        )}

        <fieldset style={{ borderTop: '1px solid var(--pico-muted-border-color)', paddingTop: '1rem' }}>
            <legend style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 0.5rem', marginBottom: '0.5rem' }}>
                {hideClientSelector ? '¿Cuánto pagás ahora?' : 'Desglose de Pago'}
            </legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
                    <div key={index} className="grid" style={{ gap: '0.75rem' }}>
                        <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--pico-primary)' }} step="0.01" required />
                        <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                        <AppButton variant="danger" size="sm" onClick={() => {const newPagos = formData.pagos.filter((_:any, i:number) => i !== index); setFormData({...formData, pagos: newPagos});}} style={{ padding: '0.5rem' }}><TrashIcon style={{ width: '20px', height: '20px' }}/></AppButton>
                    </div>
                ))}
                <AppButton variant="secondary" size="sm" onClick={addPago} style={{ width: '100%', borderStyle: 'dashed', borderWidth: '2px', padding: '0.75rem' }}>+ Agregar otro método de pago</AppButton>
            </div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--pico-muted-border-color)' }}>
            <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
            <AppButton variant="primary" type="submit" size="lg" style={{ paddingLeft: '3rem', paddingRight: '3rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Confirmar Operación <span style={{ marginLeft: '0.5rem', fontSize: '0.625rem', opacity: 0.5 }}>(Alt + Enter)</span>
            </AppButton>
        </div>
      </form>
    </div>
  )
}

export default MovimientoCajaForm;
