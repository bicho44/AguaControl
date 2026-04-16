
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Producto, MetodoPago, PagoDetalle, Movimiento, Usuario, Remito, TipoProducto } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';

interface VentaMostradorFormProps {
  productos: Producto[];
  currentUser: Usuario;
  onSave: (remito: any) => Promise<void>;
  onClose: () => void;
}

const VentaMostradorForm: React.FC<VentaMostradorFormProps> = ({ productos, currentUser, onSave, onClose }) => {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([{ productoId: '', entregados: 1, recibidos: 0 }]);
  const [pagos, setPagos] = useState<PagoDetalle[]>([{ monto: 0, metodo: MetodoPago.EFECTIVO }]);
  const [isSaving, setIsSaving] = useState(false);
  const { showNotification } = useNotification();

  const productosOptions = useMemo(() => 
    productos
      .filter(p => p.estado !== 'inactivo')
      .map(p => ({ value: p.id, label: p.nombre })), 
  [productos]);

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const totalVenta = useMemo(() => {
    return movimientos.reduce((total, mov) => {
      if (!mov.productoId) return total;
      const producto = productosMap.get(mov.productoId);
      if (!producto) return total;
      const precio = producto.precio || 0;
      return total + (mov.entregados * precio);
    }, 0);
  }, [movimientos, productosMap]);

  // Update payment amount automatically when total changes
  useEffect(() => {
    if (pagos.length === 1) {
      setPagos([{ ...pagos[0], monto: totalVenta }]);
    }
  }, [totalVenta]);

  const handleProductoChange = (index: number, productoId: string) => {
    const newMovimientos = [...movimientos];
    newMovimientos[index] = { ...newMovimientos[index], productoId };
    setMovimientos(newMovimientos);
    
    // Auto-focus quantity input
    setTimeout(() => {
      const input = document.getElementById(`cant-input-${index}`);
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement) input.select();
      }
    }, 50);
  };

  const handleCantidadChange = (index: number, value: string) => {
    const newMovimientos = [...movimientos];
    newMovimientos[index] = { ...newMovimientos[index], entregados: value === '' ? 0 : Number(value) };
    setMovimientos(newMovimientos);
  };

  const addMovimiento = () => {
    setMovimientos([...movimientos, { productoId: '', entregados: 1, recibidos: 0 }]);
  };

  const removeMovimiento = (index: number) => {
    if (movimientos.length > 1) {
      setMovimientos(movimientos.filter((_, i) => i !== index));
    }
  };

  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: any) => {
    const newPagos = [...pagos];
    newPagos[index] = { ...newPagos[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setPagos(newPagos);
  };

  const addPago = () => {
    const pagado = pagos.reduce((sum, p) => sum + p.monto, 0);
    setPagos([...pagos, { monto: Math.max(0, totalVenta - pagado), metodo: MetodoPago.EFECTIVO }]);
  };

  const removePago = (index: number) => {
    if (pagos.length > 1) {
      setPagos(pagos.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    const validMovimientos = movimientos.filter(m => m.productoId && m.entregados > 0);
    if (validMovimientos.length === 0) {
      return showNotification('Debe agregar al menos un producto.', 'error');
    }

    setIsSaving(true);
    try {
      const remitoData = {
        fecha: new Date().toISOString(),
        vendedorId: currentUser.id,
        clienteId: null, // Venta de mostrador
        sucursalId: null,
        puntoVenta: '0001',
        numero: '0', // El backend debería asignar el siguiente número o manejarlo
        movimientos: validMovimientos.map(m => ({
          ...m,
          precioUnitario: productosMap.get(m.productoId)?.precio || 0
        })),
        pagos: pagos.filter(p => p.monto > 0),
        esAjuste: false,
        esVentaMostrador: true // Flag para identificarla
      };

      await onSave(remitoData);
      onClose();
    } catch (error) {
      console.error(error);
      showNotification('Error al guardar la venta.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">
          Nueva Venta Mostrador
        </h2>
        <div className="text-right">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vendedor</p>
          <p className="text-xs font-bold text-primary-600">{currentUser.nombre}</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Productos</label>
        {movimientos.map((mov, index) => (
          <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-3 items-end bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex-1">
              <SearchableSelect 
                options={productosOptions} 
                value={mov.productoId} 
                onChange={(v) => handleProductoChange(index, v)}
                placeholder="Seleccionar Producto"
                autoFocus={index === 0}
              />
            </div>
            <div className="w-24">
              <AppInput 
                id={`cant-input-${index}`}
                type="number" 
                value={mov.entregados} 
                onChange={(e) => handleCantidadChange(index, e.target.value)}
                className="text-center font-bold"
                placeholder="Cant"
              />
            </div>
            <AppButton 
              variant="danger" 
              size="sm" 
              onClick={() => removeMovimiento(index)}
              className="h-[46px] w-11 flex items-center justify-center"
              type="button"
              disabled={movimientos.length === 1}
            >
              <TrashIcon className="w-5 h-5" />
            </AppButton>
          </div>
        ))}
        <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="w-full border-dashed border-2">
          + Agregar Producto
        </AppButton>
      </div>

      <div className="space-y-4 border-t dark:border-gray-700 pt-6">
        <label className="text-[10px] font-black text-primary-600 uppercase tracking-widest px-1">Cobro</label>
        <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800 space-y-3">
          {pagos.map((pago, index) => (
            <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-3 items-end">
              <AppInput 
                label={index === 0 ? "Monto" : ""}
                type="number" 
                value={pago.monto} 
                onChange={(e) => handlePagoChange(index, 'monto', e.target.value)}
                className="font-black text-green-600"
              />
              <AppSelect 
                label={index === 0 ? "Método" : ""}
                value={pago.metodo} 
                onChange={(e) => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)}
                options={Object.values(MetodoPago).map(m => ({ value: m, label: m }))}
              />
              <AppButton 
                variant="danger" 
                size="sm" 
                onClick={() => removePago(index)}
                className="h-[46px] w-11 flex items-center justify-center mb-0.5"
                type="button"
                disabled={pagos.length === 1}
              >
                <TrashIcon className="w-5 h-5" />
              </AppButton>
            </div>
          ))}
          <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 bg-white/50">
            + Agregar Otro Medio de Pago
          </AppButton>
        </div>
      </div>

      <div className="flex justify-between items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
        <div className="text-left">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total a Cobrar</p>
          <p className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter">${totalVenta.toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <AppButton variant="secondary" onClick={onClose} type="button">Cancelar</AppButton>
          <AppButton variant="primary" type="submit" disabled={isSaving} className="px-8">
            Finalizar Venta
          </AppButton>
        </div>
      </div>
    </form>
  );
};

export default VentaMostradorForm;
