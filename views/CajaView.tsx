
import React, { useState, useMemo, useEffect } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, PagoDetalle, MetodoPago, Factura, Producto, TipoVendedor, MovimientoVenta, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { CubeIcon } from '../components/icons/CubeIcon';

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
  ventaId?: string; // ID de la venta vinculada si existe
}

const MovimientoCajaForm: React.FC<{
  movimiento: any;
  type: 'ingreso' | 'gasto';
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[]; // Necesario para buscar la venta al editar
  onSave: (data: any, isVenta: boolean) => void;
  onClose: () => void;
  isEdit: boolean;
}> = ({ movimiento, type, onSave, onClose, isEdit, clientes, vendedores, productos, ventasVendedor }) => {
  const [formData, setFormData] = useState<any>(movimiento);
  const [isVentaMode, setIsVentaMode] = useState(false);
  const [movimientosVenta, setMovimientosVenta] = useState<MovimientoVenta[]>([]);

  const selectedVendedor = useMemo(() => vendedores.find(v => v.id === formData.vendedorId), [formData.vendedorId, vendedores]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  useEffect(() => {
    // 1. Detectar si es una venta existente al editar
    if (isEdit && formData.origen?.tipo === 'venta_vendedor') {
        const ventaOriginal = ventasVendedor.find(v => v.id === formData.origen.id);
        if (ventaOriginal) {
            setIsVentaMode(true);
            setMovimientosVenta(ventaOriginal.movimientos || []);
        }
    } 
    // 2. Si es nuevo, sugerir modo venta si el vendedor es externo
    else if (!isEdit && selectedVendedor?.tipo === TipoVendedor.EXTERNO) {
      setIsVentaMode(true);
    } 
    else if (!isEdit) {
      setIsVentaMode(false);
    }
  }, [selectedVendedor, isEdit, formData.origen, ventasVendedor]);

  const totalVentaCalculado = useMemo(() => {
    if (!isVentaMode || !selectedVendedor) return 0;
    
    const preciosEspecialesMap = new Map(selectedVendedor.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return movimientosVenta.reduce((sum, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return sum;
        
        const precio = preciosEspecialesMap.get(mov.productoId) 
                       ?? (prod.precioReventa ?? prod.precio);
                       
        return sum + (mov.cantidad * precio);
    }, 0);
  }, [movimientosVenta, selectedVendedor, isVentaMode, productosMap]);

  useEffect(() => {
    if (isVentaMode && !isEdit && formData.pagos?.length === 1) {
        const newPagos = [...formData.pagos];
        newPagos[0] = { ...newPagos[0], monto: totalVentaCalculado };
        setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
    }
  }, [totalVentaCalculado, isVentaMode, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handlePagoChange = (index: number, field: keyof PagoDetalle, value: string | MetodoPago) => {
    const newPagos = [...(formData.pagos || [])];
    const updatedValue = field === 'monto' ? (value === '' ? 0 : Number(value)) : value;
    newPagos[index] = { ...newPagos[index], [field]: updatedValue };
    setFormData((prev: any) => ({ ...prev, pagos: newPagos }));
  };

  const handleMovimientoChange = (index: number, field: keyof MovimientoVenta, value: any) => {
    const newMovs = [...movimientosVenta];
    newMovs[index] = { ...newMovs[index], [field]: field === 'cantidad' ? (Number(value) || 0) : value };
    setMovimientosVenta(newMovs);
  };

  const addMovimiento = () => setMovimientosVenta([...movimientosVenta, { productoId: '', cantidad: 1 }]);
  const removeMovimiento = (index: number) => setMovimientosVenta(movimientosVenta.filter((_, i) => i !== index));

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
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
         <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {isEdit ? 'Editar' : 'Registrar'} {type === 'ingreso' ? (isVentaMode ? 'Venta a Externo' : 'Ingreso') : 'Gasto'}
         </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" required />
        <input type="text" name="concepto" placeholder="Concepto" value={formData.concepto || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" required={!isVentaMode} />
      </div>

      {type === 'ingreso' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isEdit && <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(v) => handleSelectChange('clienteId', v)} placeholder="Asignar a Cliente (Opcional)" />}
          <SearchableSelect options={vendedorOptions} value={formData.vendedorId || ''} onChange={(v) => handleSelectChange('vendedorId', v)} placeholder="Vendedor / Operador" disabled={isEdit} />
        </div>
      )}

      {isVentaMode && (
        <fieldset className="border-t-2 border-primary-500 pt-4 bg-primary-50/30 dark:bg-primary-900/10 p-3 rounded-lg">
          <legend className="text-sm font-bold text-primary-600 px-2 flex items-center gap-1">
            <CubeIcon className="w-4 h-4"/> {isEdit ? 'EDITAR PRODUCTOS VENDIDOS' : 'PRODUCTOS VENDIDOS'}
          </legend>
          <div className="space-y-2 mt-2">
            {movimientosVenta.map((mov, index) => (
              <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                <SearchableSelect options={productosOptions} value={mov.productoId} onChange={(v) => handleMovimientoChange(index, 'productoId', v)} placeholder="Producto..." />
                <input type="number" value={mov.cantidad} onChange={(e) => handleMovimientoChange(index, 'cantidad', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 rounded-md text-center" min="1" />
                <button type="button" onClick={() => removeMovimiento(index)} className="text-red-500 p-1"><TrashIcon/></button>
              </div>
            ))}
            <div className="flex justify-between items-center mt-2">
                <button type="button" onClick={addMovimiento} className="text-xs font-bold text-primary-600 hover:underline">+ Agregar ítem de stock</button>
                <div className="text-right">
                    <span className="text-xs text-gray-500 uppercase font-bold">Total Sugerido: </span>
                    <span className="text-lg font-black text-primary-700 dark:text-primary-300">${totalVentaCalculado.toLocaleString()}</span>
                </div>
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="border-t dark:border-gray-600 pt-4">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Detalle de Cobro / Pago</legend>
        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
            {(formData.pagos || []).map((pago: PagoDetalle, index: number) => (
              <div key={index} className="flex gap-2 items-center">
                <input type="number" value={pago.monto} onChange={e => handlePagoChange(index, 'monto', e.target.value)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md font-bold" placeholder="Monto" step="0.01" required />
                <select value={pago.metodo} onChange={e => handlePagoChange(index, 'metodo', e.target.value as MetodoPago)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                  {Object.values(MetodoPago).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" onClick={() => removePago(index)} className="text-red-500 p-2"><TrashIcon className="h-5 w-5" /></button>
              </div>
            ))}
        </div>
        <button type="button" onClick={addPago} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600">+ Agregar forma de pago</button>
      </fieldset>

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600">Cancelar</button>
        <button type="submit" className="px-6 py-2 rounded-md bg-primary-600 text-white font-bold hover:bg-primary-700 shadow-lg">Confirmar Operación</button>
      </div>
    </form>
  )
}


const CajaView: React.FC<CajaViewProps> = ({
    registrosPago, gastos, clientes, vendedores, remitos, facturas, ventasVendedor, productos,
    addPagoManual, addGasto, addVentaVendedor, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateRemito, updateVentaVendedor
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [movimientoParaBorrar, setMovimientoParaBorrar] = useState<CombinedMovement | null>(null);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c.nombre])), [clientes]);
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

    // Gastos
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

    // Agrupar otros pagos
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
          concepto = `Remito ${remito?.puntoVenta}-${remito?.numero} (${clientesMap.get(primerPago.clienteId!) || 'N/A'})`;
          break;
        case 'venta_vendedor':
           concepto = `Venta de Stock (${vendedoresMap.get(primerPago.vendedorId!)?.nombre || 'N/A'})`;
           ventaId = primerPago.origen.id;
          break;
        case 'pago_manual':
           concepto = `${primerPago.concepto || 'Ingreso Manual'} (${clientesMap.get(primerPago.clienteId!) || vendedoresMap.get(primerPago.vendedorId!)?.nombre || 'N/A'})`;
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

    // Facturas
    invoicePayments.forEach(pago => {
        const factura = facturasMap.get(pago.origen.id);
        const concepto = `Cobro Factura ${factura?.numero || 'N/A'} (${clientesMap.get(pago.clienteId!) || 'N/A'})`;
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
      setModalConfig({ type, isEdit, data: { fecha: new Date().toISOString().split('T')[0], pagos: [{ monto: 0, metodo: MetodoPago.EFECTIVO }] } });
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
                        // ACTUALIZACIÓN DE PRODUCTOS AL EDITAR VENTA
                        updateVentaVendedor({
                            ...venta, 
                            movimientos: data.movimientos, // Actualizamos los productos/cantidades
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
        showNotification('Operación guardada y stock sincronizado.', 'success');
        setIsModalOpen(false);
    } catch(e) {
        showNotification('Error al guardar el movimiento.', 'error');
    }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Caja & HUB Administrativo</h1>
        <div className="space-x-2">
            <button onClick={() => handleOpenModal('ingreso')} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 font-bold shadow-sm">
                + Ingreso / Venta Stock
            </button>
            <button onClick={() => handleOpenModal('gasto')} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 font-bold shadow-sm">
                - Gasto / Salida
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        {Object.entries(balances).map(([metodo, monto]) => (
            <div key={metodo} className={`p-4 rounded-lg border-2 ${metodo === 'total' ? 'bg-primary-600 border-primary-700 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                <p className={`text-xs font-black uppercase tracking-widest ${metodo === 'total' ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>{metodo === 'total' ? 'Caja Total' : metodo}</p>
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
                        <th className="px-6 py-3">Operación</th>
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
                                        {linkedVenta && <span className="bg-primary-100 text-primary-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Stock</span>}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-green-600">{mov.type === 'ingreso' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right font-black text-red-600">{mov.type === 'gasto' ? `$${mov.total.toLocaleString()}` : ''}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(mov.type, true, mov); }}
                                            className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-30"
                                            disabled={isEditDisabled}
                                        >
                                            <PencilIcon />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setMovimientoParaBorrar(mov); }}
                                            className="text-red-500 hover:text-red-700 p-1 disabled:opacity-30"
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
                                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Detalle de Fondos</h4>
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
                                                      <h4 className="text-xs font-black text-primary-400 uppercase tracking-widest mb-3">Desglose de Productos (Stock)</h4>
                                                      <div className="space-y-2">
                                                         {linkedVenta.movimientos.map((m, idx) => {
                                                            const p = productosMap.get(m.productoId);
                                                            return (
                                                              <div key={idx} className="flex justify-between items-center p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800">
                                                                 <span className="text-primary-800 dark:text-primary-200 font-bold">{p?.nombre || 'Producto'}</span>
                                                                 <span className="text-lg font-black text-primary-700 dark:text-primary-300">x {m.cantidad}</span>
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
                <p className="text-gray-500 mb-6">Si esta operación generó movimientos de stock, estos también serán eliminados para mantener la integridad.</p>
                <div className="flex justify-center gap-3">
                    <button onClick={() => setMovimientoParaBorrar(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Cancelar</button>
                    <button onClick={() => {
                        if (movimientoParaBorrar.type === 'gasto') deleteGasto(movimientoParaBorrar.id);
                        else (movimientoParaBorrar.original as RegistroPago[]).forEach(p => deleteRegistroPago(p.id));
                        setMovimientoParaBorrar(null);
                        showNotification('Operación eliminada.', 'success');
                    }} className="px-4 py-2 bg-red-600 text-white rounded-md font-bold">Sí, Eliminar</button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default CajaView;
