
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PagoDetalle, MetodoPago, Cliente, Usuario, Producto, VentaVendedor, MovimientoVenta, TipoVendedor, TipoTelefono, EstadoProducto } from '../types';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { TrashIcon } from './icons/TrashIcon';

// Force sync

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
    hideClientSelector = false
}) => {
  const [formData, setFormData] = useState<any>(movimiento || { pagos: [] });
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const { showNotification } = useNotification();

  const selectedVendedor = useMemo(() => vendedores.find(v => v.id === formData.vendedorId), [formData.vendedorId, vendedores]);
  const selectedCliente = useMemo(() => clientes.find(c => c.id === formData.clienteId), [formData.clienteId, clientes]);
  
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

  const addPago = useCallback(() => {
      setFormData((prev: any) => ({...prev, pagos: [...(prev.pagos || []), {monto: 0, metodo: MetodoPago.EFECTIVO}]}));
  }, []);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData, false);
  }, [formData, onSave]);

  const vendedorOptions = useMemo(() => vendedores.map(v => ({ value: v.id, label: v.nombre })), [vendedores]);
  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 pr-12">
         <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter pr-12">
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? (hideClientSelector ? 'Cobro' : 'Ingreso Manual') : 'Gasto'}
         </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required />
            <AppInput label="Concepto / Referencia" type="text" name="concepto" placeholder="Ej: Pago de servicios..." value={formData.concepto || ''} onChange={handleChange} required />
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

        {type === 'ingreso' && !hideClientSelector && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-end mb-1">
                        <label className="text-xs font-black text-gray-500 uppercase px-1">Cliente (Opcional)</label>
                        {!isEdit && (
                            <AppButton 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsQuickClientOpen(!isQuickClientOpen)} 
                                className="!p-0 !h-auto text-[10px] font-black text-primary-600 hover:underline"
                            >
                                {isQuickClientOpen ? 'Cerrar' : '+ Cliente Rápido'}
                            </AppButton>
                        )}
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
                            <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Seleccionar cliente..." />
                        </div>
                    )}
                </div>
                <SearchableSelect label="Vendedor / Atendido por" options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Seleccionar..." />
            </div>
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
                Confirmar Operación <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span>
            </AppButton>
        </div>
      </form>
    </div>
  )
}

export default MovimientoCajaForm;
