
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
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 pr-12">
         <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter pr-12">
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? (hideClientSelector ? 'Compra' : 'Ingreso') : 'Gasto'}
         </h2>
         {type === 'ingreso' && !isEdit && !hideClientSelector && (
            <button type="button" onClick={() => setIsVentaMode(!isVentaMode)} className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-tighter border-2 transition-all ${isVentaMode ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : 'bg-transparent border-gray-300 text-gray-400'}`}>
                {isVentaMode ? '✓ Modo Venta de Stock' : '+ Venta de Mostrador'}
            </button>
         )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required />
            <AppInput label="Concepto / Referencia" type="text" name="concepto" placeholder="Ej: Venta local..." value={formData.concepto || ''} onChange={handleChange} required={!isVentaMode} />
        </div>

        {type === 'gasto' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-end mb-1">
                        <label className="text-xs font-black text-gray-500 uppercase px-1">Cliente</label>
                        {!isEdit && <button type="button" onClick={() => setIsQuickClientOpen(!isQuickClientOpen)} className="text-[10px] font-black text-primary-600 hover:underline">{isQuickClientOpen ? 'Cerrar' : '+ Cliente Rápido'}</button>}
                    </div>
                    {isQuickClientOpen ? (
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-200 dark:border-primary-800 space-y-2 animate-fade-in">
                            <AppInput value={quickClientName} onChange={e => setQuickClientName(e.target.value)} placeholder="Nombre..." />
                            <div className="flex gap-2">
                                <AppInput value={quickClientPhone} onChange={e => setQuickClientPhone(e.target.value)} placeholder="Tel..." />
                                <AppButton variant="primary" size="sm" onClick={handleQuickClientSave} disabled={!quickClientName}>Crear</AppButton>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Consumidor Final..." />
                            {clientAddress && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 px-1 truncate"><span className="font-bold">Dirección:</span> {clientAddress}</p>}
                        </div>
                    )}
                </div>
                <SearchableSelect label="Vendedor / Atendido por" options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Seleccionar..." />
            </div>
        )}

        {isVentaMode && (
            <fieldset className="border-2 border-primary-500 pt-4 bg-primary-50/20 dark:bg-primary-900/10 p-4 rounded-2xl shadow-inner">
                <legend className="text-xs font-black text-primary-600 px-3 bg-white dark:bg-gray-800 rounded-full border-2 border-primary-500 flex items-center gap-2">
                    {hideClientSelector ? 'DETALLE DE LA COMPRA (Tu Stock)' : 'STOCK E INVENTARIO'}
                </legend>
                <div className="space-y-6 md:space-y-3 mt-2">
                    {movimientosVenta.map((mov, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,100px,100px,120px,auto] gap-4 items-end bg-white dark:bg-gray-800 p-4 md:p-0 rounded-xl md:bg-transparent shadow-sm md:shadow-none border md:border-0 dark:border-gray-700">
                            <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1">Producto</p><SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleMovimientoChange(index, 'productoId', v)} /></div>
                            <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-center">Cantidad</p><AppInput type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} className="text-center font-black" /></div>
                            {/* Ocultamos Retira Envase si es auto-compra externa, se asume que se lleva el producto entero */}
                            {!hideClientSelector ? (
                                <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-center">Retira (Envase)</p><AppInput type="number" value={mov.recibidos || 0} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} className="text-center font-black !bg-yellow-50 dark:!bg-yellow-900/10 text-yellow-700" /></div>
                            ) : <div></div>}
                            <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-right">Precio</p><AppInput type="number" value={mov.precioUnitario || ''} onChange={(e) => handleMovimientoChange(index, 'precioUnitario', e.target.value)} className="text-right font-mono" placeholder="Unit..." /></div>
                            <div className="flex justify-end"><AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} className="!p-2"><TrashIcon/></AppButton></div>
                        </div>
                    ))}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
                        <AppButton variant="secondary" onClick={addMovimiento} className="w-full md:w-auto border-dashed border-2">+ Agregar Item</AppButton>
                        <div className="text-right p-4 bg-primary-600 text-white rounded-2xl shadow-lg w-full md:w-auto min-w-[200px]">
                            <span className="text-[10px] font-black opacity-80 uppercase block">Total Calculado</span>
                            <span className="text-3xl font-black tracking-tighter">${totalVentaCalculado.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </fieldset>
        )}

        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">
                {hideClientSelector ? '¿Cuánto pagás ahora?' : 'Desglose de Pago'}
            </legend>
            <div className="space-y-3 mt-2">
                {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3">
                        <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} className="font-black text-xl text-green-600 dark:text-green-400" step="0.01" required />
                        <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                        <AppButton variant="danger" size="sm" onClick={() => {const newPagos = formData.pagos.filter((_:any, i:number) => i !== index); setFormData({...formData, pagos: newPagos});}} className="!p-2"><TrashIcon className="w-5 h-5"/></AppButton>
                    </div>
                ))}
                <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 py-3">+ Agregar otro método de pago</AppButton>
            </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
            <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
            <AppButton variant="primary" type="submit" size="lg" className="px-12 shadow-xl">
                Confirmar Operación <span className="ml-2 text-[10px] opacity-50 hidden md:inline">(Alt + Enter)</span>
            </AppButton>
        </div>
      </form>
    </div>
  )
}

export default MovimientoCajaForm;
