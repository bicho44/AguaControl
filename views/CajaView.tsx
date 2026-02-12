
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, PagoDetalle, MetodoPago, Factura, Producto, TipoVendedor, MovimientoVenta, EstadoProducto, EstadoCliente, TipoTelefono, TipoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { CubeIcon } from '../components/icons/CubeIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';
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
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'>) => Promise<string>;
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
  onAddCliente: (data: Omit<Cliente, 'id' | 'estado'>) => Promise<string>;
  onClose: () => void;
  isEdit: boolean;
}> = ({ movimiento, type, onSave, onAddCliente, onClose, isEdit, clientes, vendedores, productos, ventasVendedor }) => {
  const [formData, setFormData] = useState<any>(movimiento || { pagos: [] });
  const [isVentaMode, setIsVentaMode] = useState(false);
  const [movimientosVenta, setMovimientosVenta] = useState<MovimientoVenta[]>([]);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const { showNotification } = useNotification();

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
    onSave(isVentaMode ? { ...formData, movimientos: movimientosVenta.filter(m => m.productoId && m.cantidad > 0) } : formData, isVentaMode);
  }, [formData, isVentaMode, movimientosVenta, onSave]);

  // Atajos de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        if (isVentaMode) addMovimiento();
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        addPago();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVentaMode, addMovimiento, addPago, handleSubmit]);

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const vendedorOptions = useMemo(() => vendedores.map(v => ({ value: v.id, label: v.nombre })), [vendedores]);
  const productosOptions = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
         <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? 'Ingreso' : 'Gasto'}
         </h2>
         {type === 'ingreso' && !isEdit && (
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

        {type === 'ingreso' && (
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
                        <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Consumidor Final..." disabled={isEdit} />
                    )}
                </div>
                <SearchableSelect label="Vendedor / Atendido por" options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Seleccionar..." disabled={isEdit} />
            </div>
        )}

        {isVentaMode && (
            <fieldset className="border-2 border-primary-500 pt-4 bg-primary-50/20 dark:bg-primary-900/10 p-4 rounded-2xl shadow-inner">
                <legend className="text-xs font-black text-primary-600 px-3 bg-white dark:bg-gray-800 rounded-full border-2 border-primary-500 flex items-center gap-2">STOCK E INVENTARIO</legend>
                <div className="space-y-6 md:space-y-3 mt-2">
                    {movimientosVenta.map((mov, index) => {
                        const prod = productosMap.get(mov.productoId);
                        const isRetornable = prod?.tipo === TipoProducto.RETORNABLE;
                        return (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,100px,100px,120px,auto] gap-4 items-end bg-white dark:bg-gray-800 p-4 md:p-0 rounded-xl md:bg-transparent shadow-sm md:shadow-none border md:border-0 dark:border-gray-700">
                                <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1">Producto</p><SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleMovimientoChange(index, 'productoId', v)} /></div>
                                <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-center">Cantidad</p><AppInput type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} className="text-center font-black" /></div>
                                <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-center">Retira (Envase)</p><AppInput type="number" value={mov.recibidos || 0} onChange={(e) => handleMovimientoChange(index, 'recibidos', e.target.value)} disabled={!isRetornable} className="text-center font-black !bg-yellow-50 dark:!bg-yellow-900/10 text-yellow-700" /></div>
                                <div><p className="md:hidden text-[10px] font-black text-gray-400 uppercase mb-1 text-right">Precio Pactado</p><AppInput type="number" value={mov.precioUnitario || ''} onChange={(e) => handleMovimientoChange(index, 'precioUnitario', e.target.value)} className="text-right font-mono" placeholder="Unit..." /></div>
                                <div className="flex justify-end"><AppButton variant="danger" size="sm" onClick={() => removeMovimiento(index)} className="!p-2"><TrashIcon/></AppButton></div>
                            </div>
                        );
                    })}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
                        <AppButton variant="secondary" onClick={addMovimiento} className="w-full md:w-auto border-dashed border-2">+ Agregar Item <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+I)</span></AppButton>
                        <div className="text-right p-4 bg-primary-600 text-white rounded-2xl shadow-lg w-full md:w-auto min-w-[200px]">
                            <span className="text-[10px] font-black opacity-80 uppercase block">Total Sugerido</span>
                            <span className="text-3xl font-black tracking-tighter">${totalVentaCalculado.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </fieldset>
        )}

        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">Desglose de Pago</legend>
            <div className="space-y-3 mt-2">
                {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3">
                        <AppInput type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} className="font-black text-xl text-green-600 dark:text-green-400" step="0.01" required />
                        <AppSelect value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} options={Object.values(MetodoPago).map(m => ({value: m, label: m}))} />
                        <AppButton variant="danger" size="sm" onClick={() => {const newPagos = formData.pagos.filter((_:any, i:number) => i !== index); setFormData({...formData, pagos: newPagos});}} className="!p-2"><TrashIcon className="w-5 h-5"/></AppButton>
                    </div>
                ))}
                <AppButton variant="secondary" size="sm" onClick={addPago} className="w-full border-dashed border-2 py-3">+ Agregar otro método de pago <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+P)</span></AppButton>
            </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
            <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
            <AppButton variant="primary" type="submit" size="lg" className="px-12 shadow-xl">Confirmar Operación <span className="opacity-60 text-[10px] ml-2 font-normal">(Ctrl+Enter)</span></AppButton>
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

  const handleSave = async (data: any, isVenta: boolean) => {
    try {
        if (isVenta) {
            if (modalConfig.isEdit) {
                await updateVentaVendedor(data);
                showNotification('Venta actualizada.', 'success');
            } else {
                await addVentaVendedor(data);
                showNotification('Venta registrada.', 'success');
            }
        } else {
            if (modalConfig.type === 'gasto') {
                if (modalConfig.isEdit) {
                    await updateGasto(data);
                    showNotification('Gasto actualizado.', 'success');
                } else {
                    await addGasto(data);
                    showNotification('Gasto registrado.', 'success');
                }
            } else {
                if (modalConfig.isEdit) {
                    await updateRegistroPago(data);
                    showNotification('Registro actualizado.', 'success');
                } else {
                    await addPagoManual(data);
                    showNotification('Ingreso registrado.', 'success');
                }
            }
        }
        setIsModalOpen(false);
    } catch (e) {
        showNotification('Error al guardar.', 'error');
    }
  };

  const handleAddQuickClient = async (clienteData: any) => {
      try {
          await addCliente(clienteData);
          showNotification('Cliente creado.', 'success');
          return ""; 
      } catch (e) {
          showNotification('Error al crear cliente.', 'error');
          return "";
      }
  };

  const balances: Record<string, number> = useMemo(() => {
    const balancesPorMetodo = Object.values(MetodoPago).reduce((acc, metodo) => { acc[metodo] = 0; return acc; }, {} as Record<MetodoPago, number>);
    registrosPago.forEach(p => balancesPorMetodo[p.metodo] += p.monto);
    gastos.forEach(g => g.pagos.forEach(p => balancesPorMetodo[p.metodo] -= p.monto));
    return { ...balancesPorMetodo, total: Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0) };
  }, [registrosPago, gastos]);

  const combinedMovements = useMemo(() => {
    const allMovements: CombinedMovement[] = [];
    gastos.forEach(g => allMovements.push({ id: g.id, fecha: g.fecha, type: 'gasto', concepto: `${g.concepto}${g.nroRecibo ? ` (Rec: ${g.nroRecibo})` : ''}`, pagos: g.pagos, total: g.pagos.reduce((sum, p) => sum + p.monto, 0), original: g }));
    
    const otherPayments = registrosPago.filter(p => p.origen.tipo !== 'factura');
    const invoicePayments = registrosPago.filter(p => p.origen.tipo === 'factura');
    const pagosAgrupados = otherPayments.reduce((acc: Record<string, RegistroPago[]>, p) => { const k = p.origen.id; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc; }, {});

    Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
      const p1 = grupo[0];
      let concepto = ''; let ventaId = undefined;
      if (p1.origen.tipo === 'remito') {
          const r = remitosMap.get(p1.origen.id);
          concepto = `Remito ${r?.puntoVenta}-${r?.numero} (${clientesMap.get(p1.clienteId!)?.nombre || 'N/A'})`;
      } else if (p1.origen.tipo === 'venta_vendedor') {
          const v = ventasVendedorMap.get(p1.origen.id);
          concepto = `Venta Stock ${v?.clienteId ? `(${clientesMap.get(v.clienteId)?.nombre})` : `(${vendedoresMap.get(p1.vendedorId!)?.nombre || 'Local'})`}`;
          ventaId = p1.origen.id;
      } else concepto = `${p1.concepto || 'Ingreso Manual'} (${clientesMap.get(p1.clienteId!)?.nombre || vendedoresMap.get(p1.vendedorId!)?.nombre || 'N/A'})`;
      
      allMovements.push({ id: p1.origen.id, fecha: p1.fecha, type: 'ingreso', concepto, pagos: grupo.map(p => ({ metodo: p.metodo, monto: p.monto })), total: grupo.reduce((sum, p) => sum + p.monto, 0), original: grupo, ventaId });
    });

    invoicePayments.forEach(p => allMovements.push({ id: p.id, fecha: p.fecha, type: 'ingreso', concepto: `Cobro Fact ${facturasMap.get(p.origen.id)?.numero || 'N/A'} (${clientesMap.get(p.clienteId!)?.nombre || 'N/A'})`, pagos: [{ metodo: p.metodo, monto: p.monto }], total: p.monto, original: [p] }));
    return allMovements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id.localeCompare(a.id));
  }, [gastos, registrosPago, remitosMap, ventasVendedorMap, clientesMap, vendedoresMap, facturasMap]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Caja & Administración</h1>
        <div className="flex gap-2">
            <AppButton variant="primary" onClick={() => {setModalConfig({type: 'ingreso', isEdit: false, data: {fecha: new Date().toISOString().split('T')[0], pagos: [{monto: 0, metodo: MetodoPago.EFECTIVO}]}}); setIsModalOpen(true);}}>+ Ingreso / Venta</AppButton>
            <AppButton variant="danger" onClick={() => {setModalConfig({type: 'gasto', isEdit: false, data: {fecha: new Date().toISOString().split('T')[0], pagos: [{monto: 0, metodo: MetodoPago.EFECTIVO}]}}); setIsModalOpen(true);}}>- Gasto</AppButton>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(balances).map(([m, val]) => (
            <div key={m} className={`p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] ${m === 'total' ? 'bg-primary-600 border-primary-700 text-white shadow-xl col-span-2 lg:col-span-1' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${m === 'total' ? 'opacity-80' : 'text-gray-400'}`}>{m === 'total' ? 'Caja Total' : m}</p>
                <p className={`text-xl font-black ${m === 'total' ? '' : 'text-gray-800 dark:text-gray-200'}`}>${val.toLocaleString('es-AR')}</p>
            </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto p-2">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <tr><th className="px-4 py-3 w-24">Fecha</th><th className="px-4 py-3">Referencia</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                </thead>
                <tbody>
                    {combinedMovements.map(mov => {
                        const isExpanded = expandedRowId === mov.id;
                        const isEditDisabled = mov.type === 'ingreso' && Array.isArray(mov.original) && mov.original[0].origen.tipo === 'factura';
                        const linkedVenta = mov.ventaId ? ventasVendedorMap.get(mov.ventaId) : null;
                        return (
                            <React.Fragment key={mov.id}>
                                <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}>
                                    <td className="px-4 py-4">{new Date(mov.fecha + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 dark:text-white text-sm">{mov.concepto}</span>
                                        {linkedVenta && <span className="text-[9px] font-black text-primary-600 uppercase">Venta Directa de Stock</span>}
                                      </div>
                                    </td>
                                    <td className={`px-4 py-4 text-right font-black ${mov.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                                        {mov.type === 'ingreso' ? '+' : '-'}${mov.total.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right flex justify-end items-center gap-2">
                                        {!isEditDisabled && <button type="button" onClick={(e) => { e.stopPropagation(); if(mov.type==='gasto') setModalConfig({type:'gasto', isEdit:true, data:mov.original}); else { const original=mov.original as RegistroPago[]; const p1=original[0]; setModalConfig({type:'ingreso', isEdit:true, data:{...p1, pagos:original.map(p=>({monto:p.monto, metodo:p.metodo}))}}); } setIsModalOpen(true); }} className="text-blue-500 p-1"><PencilIcon /></button>}
                                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-100/50 dark:bg-gray-900/50">
                                        <td colSpan={4} className="p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle de Medios</p>
                                                    {mov.pagos.map((p, idx) => (<div key={idx} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700 text-xs font-bold shadow-sm"><span>{p.metodo}</span><span className="text-green-600">${p.monto.toLocaleString()}</span></div>))}
                                                </div>
                                                {linkedVenta && (
                                                   <div className="space-y-2">
                                                      <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Productos Entregados</p>
                                                      {linkedVenta.movimientos.map((m, idx) => {const p = productosMap.get(m.productoId); return (<div key={idx} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700 text-xs shadow-sm"><span>{p?.nombre} x {m.cantidad}</span><span className="font-mono text-gray-400">${(m.precioUnitario || p?.precio || 0).toLocaleString()} c/u</span></div>);})}
                                                   </div>
                                                )}
                                                <div className="md:col-span-2 flex justify-end">
                                                    {!isEditDisabled && <AppButton variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setMovimientoParaBorrar(mov); }} className="!py-1 shadow-sm">Eliminar Registro</AppButton>}
                                                </div>
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
            <MovimientoCajaForm type={modalConfig.type} movimiento={modalConfig.data} isEdit={modalConfig.isEdit} onSave={handleSave} onAddCliente={handleAddQuickClient} onClose={() => setIsModalOpen(false)} clientes={clientes} vendedores={vendedores} productos={productos} ventasVendedor={ventasVendedor} />
        </Modal>
      )}

      {movimientoParaBorrar && (
        <Modal isOpen={!!movimientoParaBorrar} onClose={() => setMovimientoParaBorrar(null)}>
            <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">¿Borrar de Caja?</h2>
                <p className="text-gray-500">Esta acción es irreversible y corregirá los balances de inmediato.</p>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setMovimientoParaBorrar(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={() => { if(movimientoParaBorrar.type==='gasto') deleteGasto(movimientoParaBorrar.id); else (movimientoParaBorrar.original as RegistroPago[]).forEach(p=>deleteRegistroPago(p.id)); setMovimientoParaBorrar(null); showNotification('Registro borrado.', 'success'); }}>Sí, Eliminar</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default CajaView;
