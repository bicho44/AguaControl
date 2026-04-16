
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Producto, 
  Cliente, 
  Usuario, 
  MetodoPago, 
  Remito, 
  Movimiento, 
  PagoDetalle,
  TipoVendedor
} from '../types';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import SearchableSelect from './SearchableSelect';
import { PlusIcon, TrashIcon, ShoppingCartIcon, ArrowDownCircleIcon, ArrowUpCircleIcon } from 'lucide-react';
import { getLocalDateString } from '../utils/dateUtils';

interface CajaActionFormProps {
  initialType?: OperationType;
  productos: Producto[];
  clientes: Cliente[];
  vendedores: Usuario[];
  currentUser: Usuario;
  onSaveRemito?: (remito: any) => Promise<void>;
  onSavePago?: (pago: any) => Promise<void>;
  onSaveGasto?: (gasto: any) => Promise<void>;
  onClose: () => void;
  hideTypeSelector?: boolean;
  fixedVendedorId?: string;
  fixedClienteId?: string;
}

type OperationType = 'VENTA' | 'COBRO' | 'GASTO';

const CajaActionForm: React.FC<CajaActionFormProps> = ({
  initialType = 'VENTA',
  productos,
  clientes,
  vendedores,
  currentUser,
  onSaveRemito,
  onSavePago,
  onSaveGasto,
  onClose,
  hideTypeSelector = false,
  fixedVendedorId,
  fixedClienteId
}) => {
  const [type, setType] = useState<OperationType>(initialType);
  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADO COMÚN ---
  const [fecha, setFecha] = useState(getLocalDateString());
  const [pagos, setPagos] = useState<PagoDetalle[]>([{ monto: 0, metodo: MetodoPago.EFECTIVO }]);

  // --- ESTADO VENTA ---
  const [movimientos, setMovimientos] = useState<Movimiento[]>([{ productoId: '', entregados: 1, recibidos: 0 }]);

  // --- ESTADO COBRO/GASTO ---
  const [concepto, setConcepto] = useState('');
  const [montoTotal, setMontoTotal] = useState(0);
  const [entidadId, setEntidadId] = useState(fixedVendedorId || fixedClienteId || ''); 

  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  // Cálculo del total de la venta
  const totalVenta = useMemo(() => {
    return movimientos.reduce((sum, m) => {
      const prod = productosMap.get(m.productoId);
      if (!prod) return sum;
      const precioEsp = currentUser.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
      const defaultPrice = currentUser.tipo === TipoVendedor.EXTERNO ? (prod.precioReventa || prod.precio) : prod.precio;
      const precio = precioEsp || defaultPrice;
      return sum + (m.entregados * precio);
    }, 0);
  }, [movimientos, productosMap, currentUser]);

  // Sincronizar pago con total
  useEffect(() => {
    if (type === 'VENTA') {
      if (pagos.length === 1) {
        setPagos([{ ...pagos[0], monto: totalVenta }]);
      }
    } else {
      if (pagos.length === 1) {
        setPagos([{ ...pagos[0], monto: montoTotal }]);
      }
    }
  }, [totalVenta, montoTotal, type]);

  const handleAddMovimiento = () => setMovimientos([...movimientos, { productoId: '', entregados: 1, recibidos: 0 }]);
  const handleRemoveMovimiento = (index: number) => setMovimientos(movimientos.filter((_, i) => i !== index));

  const handleAddPago = () => setPagos([...pagos, { monto: 0, metodo: MetodoPago.EFECTIVO }]);
  const handleRemovePago = (index: number) => setPagos(pagos.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (type === 'VENTA') {
        if (movimientos.some(m => !m.productoId)) throw new Error('Seleccione productos');
        const remitoData = {
          fecha,
          vendedorId: currentUser.id,
          clienteId: null,
          puntoVenta: '0001',
          numero: `VM-${Date.now().toString().slice(-6)}`,
          movimientos: movimientos.map(m => {
            const prod = productosMap.get(m.productoId);
            const precioEsp = currentUser.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
            const defaultPrice = currentUser.tipo === TipoVendedor.EXTERNO ? (prod.precioReventa || prod.precio) : prod.precio;
            return { ...m, precioUnitario: precioEsp || defaultPrice };
          }),
          pagos,
          esVentaMostrador: true
        };
        await onSaveRemito(remitoData);
      } else if (type === 'COBRO') {
        if (!montoTotal || !concepto) throw new Error('Complete los datos');
        const pagoData = {
          fecha,
          vendedorId: fixedVendedorId || currentUser.id,
          clienteId: fixedClienteId || entidadId || null,
          concepto,
          pagos,
          monto: montoTotal // Para compatibilidad
        };
        if (onSavePago) await onSavePago(pagoData);
      } else if (type === 'GASTO') {
        if (!montoTotal || !concepto) throw new Error('Complete los datos');
        const gastoData = {
          fecha,
          concepto,
          vendedorId: fixedVendedorId || entidadId || currentUser.id,
          pagos,
          monto: montoTotal
        };
        if (onSaveGasto) await onSaveGasto(gastoData);
      }
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* TABS DE OPERACIÓN */}
      {!hideTypeSelector && (
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {(['VENTA', 'COBRO', 'GASTO'] as OperationType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-tighter rounded-lg transition-all ${
                type === t 
                  ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'VENTA' && <ShoppingCartIcon className="w-4 h-4" />}
              {t === 'COBRO' && <ArrowDownCircleIcon className="w-4 h-4" />}
              {t === 'GASTO' && <ArrowUpCircleIcon className="w-4 h-4" />}
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AppInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {type === 'GASTO' && !fixedVendedorId && (
          <AppSelect 
            label="Responsable del Gasto" 
            value={entidadId} 
            onChange={(e) => setEntidadId(e.target.value)}
            options={[
              { value: currentUser.id, label: `Mí (${currentUser.nombre})` },
              ...vendedores.filter(v => v.id !== currentUser.id).map(v => ({ value: v.id, label: v.nombre }))
            ]}
          />
        )}
        {type === 'COBRO' && !fixedClienteId && (
          <SearchableSelect
            label="Cliente (Opcional)"
            value={entidadId}
            onChange={setEntidadId}
            options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
            placeholder="Seleccione cliente si es pago de deuda..."
          />
        )}
      </div>

      {type === 'VENTA' ? (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Productos</p>
          {movimientos.map((m, idx) => (
            <div key={idx} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border dark:border-gray-700">
              <div className="flex-1">
                <AppSelect
                  value={m.productoId}
                  onChange={(e) => {
                    const newMovs = [...movimientos];
                    newMovs[idx].productoId = e.target.value;
                    setMovimientos(newMovs);
                    // Auto-focus cantidad
                    setTimeout(() => document.getElementById(`qty-${idx}`)?.focus(), 10);
                  }}
                  options={productos.map(p => ({ value: p.id, label: p.nombre }))}
                  placeholder="Seleccionar producto..."
                />
              </div>
              <div className="w-24">
                <AppInput
                  id={`qty-${idx}`}
                  type="number"
                  value={m.entregados}
                  onChange={(e) => {
                    const newMovs = [...movimientos];
                    newMovs[idx].entregados = Number(e.target.value);
                    setMovimientos(newMovs);
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <button type="button" onClick={() => handleRemoveMovimiento(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={handleAddMovimiento} className="text-xs font-bold text-primary-600 flex items-center gap-1 hover:underline">
            <PlusIcon className="w-3 h-3" /> Agregar otro producto
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <AppInput 
            label="Concepto / Referencia" 
            value={concepto} 
            onChange={(e) => setConcepto(e.target.value)} 
            placeholder={type === 'COBRO' ? 'Ej: Pago de deuda, Entrega de efectivo...' : 'Ej: Combustible, Luz, Almuerzo...'}
          />
          <AppInput 
            label="Monto Total" 
            type="number" 
            value={montoTotal} 
            onChange={(e) => setMontoTotal(Number(e.target.value))} 
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}

      {/* PAGOS */}
      <div className="space-y-3 pt-4 border-t dark:border-gray-700">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Forma de Pago</p>
          <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase">Total a Rendir</p>
            <p className="text-xl font-black text-primary-600">${(type === 'VENTA' ? totalVenta : montoTotal).toLocaleString()}</p>
          </div>
        </div>
        
        {pagos.map((p, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              <AppSelect
                value={p.metodo}
                onChange={(e) => {
                  const newPagos = [...pagos];
                  newPagos[idx].metodo = e.target.value as MetodoPago;
                  setPagos(newPagos);
                }}
                options={Object.values(MetodoPago).map(m => ({ value: m, label: m }))}
              />
            </div>
            <div className="w-32">
              <AppInput
                type="number"
                value={p.monto}
                onChange={(e) => {
                  const newPagos = [...pagos];
                  newPagos[idx].monto = Number(e.target.value);
                  setPagos(newPagos);
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            {pagos.length > 1 && (
              <button type="button" onClick={() => handleRemovePago(idx)} className="p-2 text-red-500">
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={handleAddPago} className="text-xs font-bold text-primary-600 flex items-center gap-1 hover:underline">
          <PlusIcon className="w-3 h-3" /> Dividir pago
        </button>
      </div>

      <div className="flex gap-3 pt-6">
        <AppButton variant="secondary" onClick={onClose} className="flex-1" type="button">Cancelar</AppButton>
        <AppButton className="flex-1" type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando...' : `Confirmar ${type}`}
        </AppButton>
      </div>
    </form>
  );
};

export default CajaActionForm;
