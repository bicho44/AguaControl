
import React, { useState, useMemo, useEffect } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, PagoDetalle, MetodoPago, Factura, Producto, TipoVendedor, MovimientoVenta, EstadoProducto, EstadoCliente, TipoTelefono, TipoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { CubeIcon } from '../components/icons/CubeIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

interface CajaViewProps {
  registrosPago: RegistroPago[];
  gastos: Gasto[];
  clientes: Cliente[];
  vendedores: Usuario[];
  remitos: Remito[];
  facturas: Factura[];
  ventasVendedor: VentaVendedor[];
  productos: Producto[];
  addPagoManual: (pagoData: {
    fecha: string;
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
    pagos: PagoDetalle[];
  }) => Promise<void>;
  addGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
  addVentaVendedor: (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => Promise<void>;
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'>) => Promise<void>;
  updateRegistroPago: (updatedPago: RegistroPago) => Promise<void>;
  updateGasto: (updatedGasto: Gasto) => Promise<void>;
  deleteRegistroPago: (pagoId: string) => Promise<void>;
  deleteGasto: (gastoId: string) => Promise<void>;
  updateRemito: (remito: Remito & { pagos?: PagoDetalle[] }) => Promise<void>;
  updateVentaVendedor: (venta: VentaVendedor & { pagos?: PagoDetalle[] }) => Promise<void>;
}

interface CombinedMovement {
  id: string;
  fecha: string;
  type: 'ingreso' | 'gasto';
  concepto: string;
  pagos: PagoDetalle[];
  total: number;
  original: Gasto | RegistroPago[];
  ventaId?: string;
}

const MovimientoCajaForm: React.FC<{
  movimiento: any;
  type: 'ingreso' | 'gasto';
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  onSave: (data: any, isVenta: boolean) => void;
  onAddCliente: (data: any) => Promise<void>;
  onClose: () => void;
  isEdit: boolean;
}> = ({ movimiento, type, onSave, onAddCliente, onClose, isEdit, clientes, vendedores, productos, ventasVendedor }) => {
  const [formData, setFormData] = useState<any>(movimiento || { pagos: [] });
  const [isVentaMode, setIsVentaMode] = useState(false);
  const [movimientosVenta, setMovimientosVenta] = useState<MovimientoVenta[]>([]);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');

  const selectedVendedor = useMemo(() => vendedores.find(v => v.id === formData.vendedorId), [formData.vendedorId, vendedores]);
  const selectedCliente = useMemo(() => clientes.find(c => c.id === formData.clienteId), [formData.clienteId, clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  useEffect(() => {
    if (isEdit && formData?.origen?.tipo === 'venta_vendedor') {
        const ventaOriginal = ventasVendedor.find(v => v.id === formData.origen.id);
        if (ventaOriginal) {
            setIsVentaMode(true);
            setMovimientosVenta(ventaOriginal.movimientos || []);
        }
    } 
  }, [isEdit, formData, ventasVendedor]);

  const totalVentaCalculado = useMemo(() => {
    if (!isVentaMode) return 0;
    
    return movimientosVenta.reduce((sum, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return sum;
        
        const especialCliente = selectedCliente?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
        const especialVendedor = selectedVendedor?.preciosEspeciales?.find(p => p.productoId === mov.productoId)?.precio;
        
        const precioSugerido = especialCliente ?? especialVendedor ?? (selectedVendedor?.tipo === TipoVendedor.EXTERNO ? (prod.precioReventa ?? prod.precio) : prod.precio);
        const precioFinal = mov.precioUnitario ?? precioSugerido;
                       
        return sum + (mov.cantidad * precioFinal);
    }, 0);
  }, [movimientosVenta, selectedVendedor, selectedCliente, isVentaMode, productosMap]);

  useEffect(() => {
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
      const newClient = {
          nombre: quickClientName,
          telefonos: [{ tipo: TipoTelefono.CEL, numero: quickClientPhone }],
          sucursales: [{ id: 'main', nombre: 'Casa Central', direccion: 'Venta Mostrador' }],
          estado: EstadoCliente.ACTIVO
      };
      await onAddCliente(newClient);
      setIsQuickClientOpen(false);
      setQuickClientName('');
      setQuickClientPhone('');
  };

  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
    newPagos[index] = { ...newPagos[index], [field]: updatedValue };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  };

  const handleMovimientoChange = (index: number, field: keyof MovimientoVenta, value: any) => {
    const newMovs = [...movimientosVenta];
    newMovs[index] = { ...newMovs[index], [field]: (field === 'cantidad' || field === 'recibidos' || field === 'precioUnitario') ? (Number(value) || 0) : value };
    setMovimientosVenta(newMovs);
  };

  const addMovimiento = () => setMovimientosVenta([...movimientosVenta, { productoId: '', cantidad: 1, recibidos: 0 }]);
  const removeMovimiento = (index: number) => setMovimientosVenta(prev => prev.filter((_, i) => i !== index));

  const addPago = () => {
    setFormData((prev: any) => ({ ...prev, pagos: [...(prev.pagos || []), { monto: 0, metodo: MetodoPago.EFECTIVO }] }));
  };

  const removePago = (index: number) => {
    setFormData((prev: any) => ({ ...prev, pagos: prev.pagos?.filter((_: any, i: number) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVentaMode) {
      const ventaData = {
        ...formData,
        movimientos: movimientosVenta.filter(m => m.productoId && m.cantidad > 0),
        pagos: formData.pagos
      };
      onSave(ventaData, true);
    } else {
      onSave(formData, false);
    }
  };

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const vendedorOptions = useMemo(() => vendedores.map(v => ({ value: v.id, label: v.nombre })), [vendedores]);
  const productosOptions = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
         <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? 'Ingreso' : 'Gasto'}
         </h2>
         {type === 'ingreso' && !isEdit && (
            <button 
                onClick={() => setIsVentaMode(!isVentaMode)}
                className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-tighter border-2 transition-colors ${isVentaMode ? 'bg-primary-600 border-primary-600 text-white' : 'bg-transparent border-gray-300 text-gray-400 hover:border-primary-500 hover:text-primary-500'}`}
            >
                {isVentaMode ? '✓ Venta de Stock Activa' : '+ Venta de Stock (Baja Inventario)'}
            </button>
         )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AppInput label="Fecha" type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} required />
            <AppInput label="Concepto / Referencia" type="text" name="concepto" placeholder="Ej: Venta de Mostrador, Pago de Deuda..." value={formData.concepto || ''} onChange={handleChange} required={!isVentaMode} />
        </div>

        {type === 'ingreso' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Cliente</label>
                        {!isEdit && (
                            <button type="button" onClick={() => setIsQuickClientOpen(!isQuickClientOpen)} className="text-[10px] font-black text-primary-600 hover:underline underline-offset-2">
                                {isQuickClientOpen ? '✕ Cerrar' : '+ Nuevo Cliente Rápido'}
                            </button>
                        )}
                    </div>
                    {isQuickClientOpen ? (
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/10 rounded-md border border-primary-200 dark:border-primary-800 space-y-2 animate-fade-in-down">
                            <AppInput placeholder="Nombre completo" value={quickClientName} onChange={e => setQuickClientName(e.target.value)} className="!bg-white dark:!bg-gray-700"/>
                            <div className="flex gap-2">
                                <AppInput placeholder="Teléfono" value={quickClientPhone} onChange={e => setQuickClientPhone(e.target.value)} className="!bg-white dark:!bg-gray-700"/>
                                <AppButton type="button" size="sm" onClick={handleQuickClientSave} disabled={!quickClientName}>Crear</AppButton>
                            </div>
                        </div>
                    ) : (
                        <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Seleccionar cliente (Opcional)" disabled={isEdit} />
                    )}
                </div>
                <div>
                    <SearchableSelect label="Atendido por" options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Vendedor / Operador" disabled={isEdit} />
                </div>
            </div>
        )}

        {isVentaMode && (
            <fieldset className="border-2 border-primary-500 pt-4 bg-primary-50/30 dark:bg-primary-900/10 p-4 rounded-xl shadow-inner">
                <legend className="text-sm font-black text-primary-600 px-3 bg-white dark:bg-gray-800 rounded-full border-2 border-primary-500 flex items-center gap-2">
                    <CubeIcon className="w-4 h-4"/> DETALLE DE PRODUCTOS Y ENVASES
                </legend>
                <div className="space-y-4 md:space-y-3 mt-2">
                    <div className="hidden md:grid md:grid-cols-[2fr,80px,80px,100px,auto] gap-2 text-[10px] font-black text-gray-400 uppercase text-center">
                        <span className="text-left pl-2">Producto</span>
                        <span>Venta</span>
                        <span>Retira</span>
                        <span>P. Unit.</span>
                        <span></span>
                    </div>
                    {movimientosVenta.map((mov, index) => {
                        const prod = productosMap.get(mov.productoId);
                        const isRetornable = prod?.tipo === TipoProducto.RETORNABLE;
                        
                        return (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,80px,80px,100px,auto] gap-2 md:gap-2 items-center animate-fade-in bg-white md:bg-transparent dark:bg-gray-700/50 md:dark:bg-transparent p-3 md:p-0 rounded-lg border md:border-0 border-primary-100 dark:border-gray-600">
                                <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleMovimientoChange(index, 'productoId', v)} placeholder="Producto..." />
                                
                                <div className="grid grid-cols-3 gap-2 md:contents">
                                    <div className="flex flex-col md:block">
                                        <span className="md:hidden text-[10px] uppercase font-bold text-gray-500 text-center">Venta</span>
                                        <AppInput type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} className="text-center font-bold" min="1" />
                                    </div>
                                    <div className="flex flex-col md:block">
                                        <span className="md:hidden text-[10px] uppercase font-bold text-gray-500 text-center">Retira</span>
                                        <AppInput 
                                            type="number" 
                                            value={mov.recibidos || 0} 
                                            onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} 
                                            className={`text-center font-bold ${isRetornable ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-30 cursor-not-allowed'}`} 
                                            min="0" 
                                            disabled={!isRetornable}
                                        />
                                    </div>
                                    <div className="flex flex-col md:block">
                                        <span className="md:hidden text-[10px] uppercase font-bold text-gray-500 text-center">Precio</span>
                                        <AppInput type="number" value={mov.precioUnitario || ''} onChange={(e) => handleMovimientoChange(index, 'precioUnitario', e.target.value)} className="text-right font-mono" placeholder="$" />
                                    </div>
                                </div>
                                <div className="flex justify-end md:block">
                                    <AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} className="!p-2"><TrashIcon className="h-5 w-5"/></AppButton>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-primary-200 dark:border-primary-800">
                        <AppButton variant="secondary" size="sm" onClick={addMovimiento} className="border-dashed border-2">+ AGREGAR PRODUCTO</AppButton>
                        <div className="text-right">
                            <span className="text-[10px] text-gray-500 uppercase font-black block">Total Venta Sugerido</span>
                            <span className="text-2xl font-black text-primary-700 dark:text-primary-400 tracking-tighter">${totalVentaCalculado.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </fieldset>
        )}

        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-sm font-bold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-widest mb-2">Detalle de Cobro</legend>
            <div className="space-y-3 mt-2 max-h-40 overflow-y-auto pr-2">
                {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
                    <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                        <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} className="font-black text-lg text-green-700 dark:text-green-400" placeholder="0.00" step="0.01" required />
                        <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                        <AppButton variant="danger" size="sm" onClick={() => removePago(index)} className="!p-2"><TrashIcon className="h-5 w-5"/></AppButton>
                    </div>
                ))}
            </div>
            <AppButton variant="secondary" size="sm" onClick={addPago} className="mt-3 w-full border-dashed border-2">+ Agregar otro medio de pago</AppButton>
        </fieldset>

        <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
            <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
            <AppButton type="submit" variant="primary">Confirmar Operación</AppButton>
        </div>
      </form>
    </div>
  )
}


const CajaView: React.FC<CajaViewProps> = ({
    registrosPago, gastos, clientes, vendedores, remitos, facturas, ventasVendedor, productos,
    addPagoManual, addGasto, addVentaVendedor, addCliente, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateRemito, updateVentaVendedor
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [movimientoParaBorrar, setMovimientoParaBorrar] = useState<CombinedMovement | null>(null);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const vendedoresMap = useMemo(() => new Map(vendedores.map(v => [v.id, v])), [vendedores]);
  const remitosMap = useMemo(() => new Map(remitos.map(r => [r.id, r])), [remitos]);
  const ventasVendedorMap = useMemo(() => new Map(ventasVendedor.map(v => [v.id, v])), [ventasVendedor]);
  const facturasMap = useMemo(() => new Map(facturas.map(f => [f.id, f])), [facturas]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const balances: Record<string, number> = useMemo(() => {
    const balancesPorMetodo = Object.values(MetodoPago).reduce((acc, metodo) => {
        acc[metodo] = 0;
        return acc;
    }, {} as Record<MetodoPago, number>);

    registrosPago.forEach(pago => {
        balancesPorMetodo[pago.metodo] += pago.monto;
    });
    gastos.forEach(gasto => {
        gasto.pagos.forEach(pago => {
            balancesPorMetodo[pago.metodo] -= pago.monto;
        });
    });

    const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
    return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos]);

  const combinedMovements = useMemo(() => {
    const allMovements: CombinedMovement[] = [];

    gastos.forEach(gasto => {
      allMovements.push({
        id: gasto.id,
        fecha: gasto.fecha,
        type: 'gasto',
        concepto: `${gasto.concepto}${gasto.nroRecibo ? ` (Recibo: ${gasto.nroRecibo})` : ''}`,
        pagos: gasto.pagos,
        total: gasto.pagos.reduce((sum, p) => sum + p.monto, 0),
        original: gasto,
      });
    });

    const otherPayments = registrosPago.filter(p => p.origen.tipo !== 'factura');
    const invoicePayments = registrosPago.filter(p => p.origen.tipo === 'factura');

    const pagosAgrupados = otherPayments.reduce((acc: Record<string, RegistroPago[]>, pago) => {
      const key = pago.origen.id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pago);
      return acc;
    }, {});

    Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
      if (grupo.length === 0) return;
      const primerPago = grupo[0];
      let concepto = '';
      let ventaId = undefined;

      switch (primerPago.origen.tipo) {
        case 'remito':
          const remito = remitosMap.get(primerPago.origen.id);
          concepto = `Remito ${remito?.puntoVenta}-${remito?.numero} (${clientesMap.get(primerPago.clienteId!)?.nombre || 'N/A'})`;
          break;
        case 'venta_vendedor':
           const venta = ventasVendedorMap.get(primerPago.origen.id);
           const cliName = venta?.clienteId ? clientesMap.get(venta.clienteId)?.nombre : undefined;
           concepto = `Venta de Stock ${cliName ? `(${cliName})` : `(${vendedoresMap.get(primerPago.vendedorId!)?.nombre || 'Local'})`}`;
           ventaId = primerPago.origen.id;
          break;
        case 'pago_manual':
           concepto = `${primerPago.concepto || 'Ingreso Manual'} (${clientesMap.get(primerPago.clienteId!)?.nombre || vendedoresMap.get(primerPago.vendedorId!)?.nombre || 'N/A'})`;
          break;
      }
      allMovements.push({
        id: primerPago.origen.id,
        fecha: primerPago.fecha,
        type: 'ingreso',
        concepto,
        pagos: grupo.map(p => ({ metodo: p.metodo, monto: p.monto })),
        total: grupo.reduce((sum, p) => sum + p.monto, 0),
        original: grupo,
        ventaId
      });
    });

    invoicePayments.forEach(pago => {
        const factura = facturasMap.get(pago.origen.id);
        const concepto = `Cobro Factura ${factura?.numero || 'N/A'} (${clientesMap.get(pago.clienteId!)?.nombre || 'N/A'})`;
        allMovements.push({
            id: pago.id,
            fecha: pago.fecha,
            type: 'ingreso',
            concepto,
            pagos: [{ metodo: pago.metodo, monto: pago.monto }],
            total: pago.monto,
            original: [pago],
        });
    });
    
    return allMovements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id.localeCompare(a.id));
  }, [gastos, registrosPago, remitosMap, ventasVendedorMap, clientesMap, vendedoresMap, facturasMap]);

  const handleOpenModal = (type: 'ingreso' | 'gasto', isEdit = false, data: CombinedMovement | null = null) => {
    if (isEdit && data) {
      if (type === 'gasto') {
        setModalConfig({ type, isEdit, data: data.original as Gasto });
      } else {
        if (Array.isArray(data.original)) {
          const original: RegistroPago[] = data.original;
          const primerPago = original[0];
          setModalConfig({
            type, isEdit, data: {
              id: primerPago.id,
              fecha: data.fecha,
              concepto: data.concepto,
              clienteId: primerPago.clienteId,
              vendedorId: primerPago.vendedorId,
              origen: primerPago.origen,
              original: data.original,
              pagos: original.map(p => ({ monto: p.monto, metodo: p.metodo }))
            }
          });
        }
      }
    } else {
      // FIX: Se limpia la lógica de fecha para evitar errores de tipo string/date
      const todayStr = new Date().toISOString().split('T')[0];
      setModalConfig({ 
        type, 
        isEdit, 
        data: { 
            fecha: todayStr, 
            pagos: [{ monto: 0, metodo: MetodoPago.EFECTIVO }] 
        } 
      });
    }
    setIsModalOpen(true);
  };
  
  const handleSave = (data: any, isVenta: boolean) => {
    try {
        if (modalConfig.isEdit) {
          if (modalConfig.type === 'gasto') {
            updateGasto(data);
          } else {
            const originalData = modalConfig.data.original;
            if (Array.isArray(originalData)) {
                const primerPago = originalData[0];
                if (primerPago.origen.tipo === 'pago_manual') {
                    const updatedPago = { ...primerPago, ...data, monto: data.pagos[0].monto, metodo: data.pagos[0].metodo };
                    updateRegistroPago(updatedPago);
                } else if (primerPago.origen.tipo === 'remito') {
                    const remito = remitosMap.get(primerPago.origen.id);
                    if (remito) {
                       const updatedPagosDetalle = data.pagos.map((p: any) => ({monto: p.monto, metodo: p.metodo}));
                       updateRemito({ ...remito, pagos: updatedPagosDetalle });
                    }
                } else if (primerPago.origen.tipo === 'venta_vendedor') {
                     const venta = ventasVendedorMap.get(primerPago.origen.id);
                     if (venta) {
                        const updatedPagosDetalle = data.pagos.map((p: any) => ({monto: p.monto, metodo: p.metodo}));
                        updateVentaVendedor({
                            ...venta, 
                            movimientos: data.movimientos, 
                            pagos: updatedPagosDetalle 
                        });
                     }
                }
            }
          }
        } else {
          if (isVenta) {
            addVentaVendedor(data);
          } else if (modalConfig.type === 'gasto') {
            addGasto(data);
          } else {
            addPagoManual(data);
          }
        }
        showNotification('Operación guardada con éxito.', 'success');
        setIsModalOpen(false);
    } catch(e) {
        showNotification('Error al guardar el movimiento.', 'error');
    }
  };

  const handleAddQuickClient = async (clientData: any) => {
      try {
          await addCliente(clientData);
          showNotification('Cliente registrado correctamente.', 'success');
      } catch (e) {
          showNotification('Error al crear el cliente.', 'error');
      }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Caja & Administración</h1>
        <div className="flex gap-2">
            <AppButton variant="success" onClick={() => handleOpenModal('ingreso')}>
                + Ingreso / Venta
            </AppButton>
            <AppButton variant="danger" onClick={() => handleOpenModal('gasto')}>
                - Registrar Gasto
            </AppButton>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        {Object.entries(balances).map(([metodo, monto]) => (
            <div key={metodo} className={`p-4 rounded-lg border-2 ${metodo === 'total' ? 'bg-primary-600 border-primary-700 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${metodo === 'total' ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>{metodo === 'total' ? 'Caja Total' : metodo}</p>
                <p className={`text-2xl font-black ${metodo === 'total' ? '' : 'text-gray-800 dark:text-gray-200'}`}>${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th className="px-6 py-3 w-24">Fecha</th>
                        <th className="px-6 py-3">Operación / Cliente</th>
                        <th className="px-6 py-3 text-right">Ingreso</th>
                        <th className="px-6 py-3 text-right">Gasto</th>
                        <th className="px-6 py-3 w-16"><span className="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody>
                    {combinedMovements.map(mov => {
                        const isExpanded = expandedRowId === mov.id;
                        const isEditDisabled = mov.type === 'ingreso' && Array.isArray(mov.original) && mov.original[0].origen.tipo === 'factura';
                        const linkedVenta = mov.ventaId ? ventasVendedorMap.get(mov.ventaId) : null;

                        return (
                            <React.Fragment key={mov.id}>
                                <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}>
                                    <td className="px-6 py-4">{new Date(mov.fecha + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 dark:text-white">{mov.concepto}</span>
                                        {linkedVenta && <span className="bg-primary-100 text-primary-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">Stock</span>}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-green-600">{mov.type === 'ingreso' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right font-black text-red-600">{mov.type === 'gasto' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(mov.type, true, mov); }}
                                            className="text-blue-500 hover:text-blue-700 p-2 disabled:opacity-30 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                            disabled={isEditDisabled}
                                        >
                                            <PencilIcon />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setMovimientoParaBorrar(mov); }}
                                            className="text-red-500 hover:text-red-700 p-2 disabled:opacity-30 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                                            disabled={isEditDisabled}
                                        >
                                            <TrashIcon />
                                        </button>
                                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                                        <td colSpan={5} className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Detalle de Cobro</h4>
                                                    <ul className="space-y-2">
                                                        {mov.pagos.map((p, index) => (
                                                            <li key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                                                                <span className="text-gray-600 dark:text-gray-300 font-medium">{p.metodo}</span>
                                                                <span className="font-black text-gray-900 dark:text-white">${p.monto.toLocaleString()}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                
                                                {linkedVenta && (
                                                   <div>
                                                      <h4 className="text-[10px] font-black text-primary-400 uppercase tracking-widest mb-3">Productos y Envases (Integridad Stock)</h4>
                                                      <div className="space-y-2">
                                                         {linkedVenta.movimientos.map((m, idx) => {
                                                            const p = productosMap.get(m.productoId);
                                                            return (
                                                              <div key={idx} className="flex justify-between items-center p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800">
                                                                 <div>
                                                                    <p className="text-primary-800 dark:text-primary-200 font-black text-sm">{p?.nombre || 'Producto'}</p>
                                                                    {m.recibidos ? <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-tighter">Envases recuperados: {m.recibidos}</p> : null}
                                                                 </div>
                                                                 <div className="text-right">
                                                                    <p className="text-lg font-black text-primary-700 dark:text-primary-300">x {m.cantidad}</p>
                                                                    <p className="text-[10px] text-gray-400 font-mono">${(m.precioUnitario || p?.precio || 0).toLocaleString()} c/u</p>
                                                                 </div>
                                                              </div>
                                                            );
                                                         })}
                                                      </div>
                                                   </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </Card>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-4xl">
            <MovimientoCajaForm
                type={modalConfig.type}
                movimiento={modalConfig.data}
                isEdit={modalConfig.isEdit}
                onSave={handleSave}
                onAddCliente={handleAddQuickClient}
                onClose={() => setIsModalOpen(false)}
                clientes={clientes}
                vendedores={vendedores}
                productos={productos}
                ventasVendedor={ventasVendedor}
            />
        </Modal>
      )}

      {movimientoParaBorrar && (
        <Modal isOpen={!!movimientoParaBorrar} onClose={() => setMovimientoParaBorrar(null)}>
            <div className="p-4 text-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">¿Eliminar Movimiento?</h2>
                <p className="text-gray-500 mb-6">Si esta operación generó movimientos de stock (Venta Directa), estos también serán eliminados para mantener la integridad.</p>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setMovimientoParaBorrar(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={() => {
                        if (movimientoParaBorrar.type === 'gasto') deleteGasto(movimientoParaBorrar.id);
                        else (movimientoParaBorrar.original as RegistroPago[]).forEach(p => deleteRegistroPago(p.id));
                        setMovimientoParaBorrar(null);
                        showNotification('Operación eliminada.', 'success');
                    }}>Sí, Eliminar</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default CajaView;
