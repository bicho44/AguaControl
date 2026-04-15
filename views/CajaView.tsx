
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, Factura, Producto, MetodoPago, TipoVendedor } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import MovimientoCajaForm from '../components/MovimientoCajaForm';
import RemitoForm from '../components/RemitoForm';
import { getLocalDateString } from '../utils/dateUtils';

// Force sync

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
    pagos: any[];
  }) => Promise<void>;
  addGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
  addVentaVendedor: (venta: any) => Promise<void>;
  addRemito: (remito: any) => Promise<void>;
  addCliente: (cliente: any) => Promise<string>;
  updateRegistroPago: (updatedPago: RegistroPago) => Promise<void>;
  updateGasto: (updatedGasto: Gasto) => Promise<void>;
  deleteRegistroPago: (pagoId: string) => Promise<void>;
  deleteGasto: (gastoId: string) => Promise<void>;
  updateRemito: (remito: Remito & { pagos?: any[] }) => Promise<void>;
  updateVentaVendedor: (venta: VentaVendedor & { pagos?: any[] }) => Promise<void>;
}

interface CombinedMovement {
  id: string;
  fecha: string;
  type: 'ingreso' | 'gasto';
  concepto: string;
  pagos: any[];
  total: number;
  original: Gasto | RegistroPago[] | VentaVendedor;
  ventaId?: string;
  isCtaCtePura?: boolean;
}

const CajaView: React.FC<CajaViewProps> = ({
    registrosPago, gastos, clientes, vendedores, remitos, facturas, ventasVendedor, productos,
    addPagoManual, addGasto, addVentaVendedor, addRemito, addCliente, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateRemito, updateVentaVendedor
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
  const [remitoModalData, setRemitoModalData] = useState<any>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [movimientoParaBorrar, setMovimientoParaBorrar] = useState<CombinedMovement | null>(null);
  
  // FILTROS DE FECHA
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  // PAGINACIÓN
  const [itemsLimit, setItemsLimit] = useState(50);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const vendedoresMap = useMemo(() => new Map(vendedores.map(v => [v.id, v])), [vendedores]);
  const remitosMap = useMemo(() => new Map(remitos.map(r => [r.id, r])), [remitos]);
  const ventasVendedorMap = useMemo(() => new Map(ventasVendedor.map(v => [v.id, v])), [ventasVendedor]);
  const facturasMap = useMemo(() => new Map(facturas.map(f => [f.id, f])), [facturas]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const getRemitoTotal = useCallback((r: Remito) => {
    if (r.esAjuste) return 0;
    let total = 0;
    const defaultPriceType = (r.vendedorId && vendedores.find(v => v.id === r.vendedorId)?.tipo === TipoVendedor.EXTERNO) ? 'reventa' : 'lista';
    
    r.movimientos?.forEach(m => {
        const p = productosMap.get(m.productoId);
        if (p) {
            const precioEsp = r.clienteId ? clientes.find(c => c.id === r.clienteId)?.preciosEspeciales?.find(pe => pe.productoId === m.productoId)?.precio : undefined;
            const precioSugerido = defaultPriceType === 'reventa' ? (p.precioReventa || p.precio) : p.precio;
            const precioFinal = m.precioUnitario || precioEsp || precioSugerido;
            total += m.entregados * precioFinal;
        }
    });
    return total;
  }, [productosMap, vendedores, clientes]);

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
                if (modalConfig.isEdit) { await updateGasto(data); showNotification('Gasto actualizado.', 'success'); }
                else { await addGasto(data); showNotification('Gasto registrado.', 'success'); }
            } else {
                if (modalConfig.isEdit) { await updateRegistroPago(data); showNotification('Registro actualizado.', 'success'); }
                else { await addPagoManual(data); showNotification('Ingreso registrado.', 'success'); }
            }
        }
        setIsModalOpen(false);
    } catch (e) { console.error(e); showNotification('Error al guardar.', 'error'); }
  };

  const handleAddQuickClient = async (clienteData: any) => {
      try { const id = await addCliente(clienteData); showNotification('Cliente creado.', 'success'); return id; }
      catch (e) { showNotification('Error al crear cliente.', 'error'); return ""; }
  };

  const handleSaveRemito = async (data: any) => {
    try {
        if (data.id) {
            await updateRemito(data);
            showNotification('Remito/Venta actualizado.', 'success');
        } else {
            await addRemito(data);
            showNotification('Remito/Venta registrado.', 'success');
        }
        setIsRemitoModalOpen(false);
    } catch (e) {
        console.error(e);
        showNotification('Error al guardar venta.', 'error');
    }
  };

  const openVentaModal = useCallback(() => {
    setRemitoModalData({
        fecha: getLocalDateString(),
        puntoVenta: '0001', // Punto de venta por defecto para caja
        movimientos: [{ productoId: '', entregados: 1, recibidos: 0 }],
        pagos: [{ monto: 0, metodo: MetodoPago.EFECTIVO }]
    });
    setIsRemitoModalOpen(true);
  }, []);

  const openIngresoModal = useCallback(() => {
    setModalConfig({type: 'ingreso', isEdit: false, data: {fecha: getLocalDateString(), pagos: [{monto: 0, metodo: MetodoPago.EFECTIVO}]}}); 
    setIsModalOpen(true);
  }, []);

  const openGastoModal = useCallback(() => {
    setModalConfig({type: 'gasto', isEdit: false, data: {fecha: getLocalDateString(), pagos: [{monto: 0, metodo: MetodoPago.EFECTIVO}]}}); 
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'v' || e.key === 'V') && !isModalOpen && !isRemitoModalOpen) { e.preventDefault(); openVentaModal(); }
        else if (e.altKey && (e.key === 'n' || e.key === 'N') && !isModalOpen && !isRemitoModalOpen) { e.preventDefault(); openIngresoModal(); } 
        else if (e.altKey && (e.key === 'g' || e.key === 'G') && !isModalOpen && !isRemitoModalOpen) { e.preventDefault(); openGastoModal(); }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isModalOpen, isRemitoModalOpen, openIngresoModal, openGastoModal, openVentaModal]);

  // Balance Diario
  const todayStr = useMemo(() => getLocalDateString(), []);
  const dailyBalances = useMemo(() => {
      const dailyPagos = registrosPago.filter(p => p.fecha === todayStr);
      const dailyGastos = gastos.filter(g => g.fecha === todayStr);
      const balancesPorMetodo = (Object.values(MetodoPago) as MetodoPago[]).reduce((acc, metodo) => { acc[metodo] = 0; return acc; }, {} as Record<MetodoPago, number>);
      dailyPagos.forEach(p => balancesPorMetodo[p.metodo] += p.monto);
      dailyGastos.forEach(g => g.pagos.forEach(p => balancesPorMetodo[p.metodo] -= p.monto));
      const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
      return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos, todayStr]);

  // Balance Total Histórico
  const totalBalances = useMemo(() => {
      const balancesPorMetodo = (Object.values(MetodoPago) as MetodoPago[]).reduce((acc, metodo) => { acc[metodo] = 0; return acc; }, {} as Record<MetodoPago, number>);
      registrosPago.forEach(p => balancesPorMetodo[p.metodo] += p.monto);
      gastos.forEach(g => g.pagos.forEach(p => balancesPorMetodo[p.metodo] -= p.monto));
      const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
      return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos]);

  // --- FILTRO Y PROCESAMIENTO DE MOVIMIENTOS ---
  const combinedMovements = useMemo(() => {
    const allMovements: CombinedMovement[] = [];
    const processedRemitoIds = new Set<string>();
    
    // Filtrar rango de fechas
    const filterFrom = dateFilter.from ? new Date(dateFilter.from + 'T00:00:00').getTime() : 0;
    const filterTo = dateFilter.to ? new Date(dateFilter.to + 'T23:59:59').getTime() : Infinity;

    // Procesar Gastos
    gastos.forEach(g => {
        const d = new Date(g.fecha + 'T00:00:00').getTime();
        if (d >= filterFrom && d <= filterTo) {
            const assignedUser = g.vendedorId ? vendedoresMap.get(g.vendedorId)?.nombre : null;
            allMovements.push({ 
                id: g.id, 
                fecha: g.fecha, 
                type: 'gasto', 
                concepto: `${g.concepto}${g.nroRecibo ? ` (Rec: ${g.nroRecibo})` : ''}${assignedUser ? ` - Asig: ${assignedUser}` : ''}`, 
                pagos: g.pagos, 
                total: g.pagos.reduce((sum, p) => sum + p.monto, 0), 
                original: g 
            });
        }
    });
    
    // Procesar Pagos
    const filteredPagos = registrosPago.filter(p => {
        const d = new Date(p.fecha + 'T00:00:00').getTime();
        return d >= filterFrom && d <= filterTo;
    });

    const otherPayments = filteredPagos.filter(p => p.origen.tipo !== 'factura');
    const invoicePayments = filteredPagos.filter(p => p.origen.tipo === 'factura');
    const pagosAgrupados = otherPayments.reduce((acc: Record<string, RegistroPago[]>, p) => { const k = p.origen.id; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc; }, {});

    Object.values(pagosAgrupados).forEach((grupo: RegistroPago[]) => {
      const p1 = grupo[0];
      let concepto = ''; let ventaId = undefined;
      
      if (p1.origen.tipo === 'remito') {
          processedRemitoIds.add(p1.origen.id);
          const r = remitosMap.get(p1.origen.id);
          const clientName = r?.clienteId ? (clientesMap.get(r.clienteId)?.nombre || 'N/A') : (vendedoresMap.get(r?.vendedorId!)?.nombre || 'Venta Stock');
          concepto = r?.clienteId ? `${clientName} (#${r?.puntoVenta}-${r?.numero})` : `${clientName} (Venta Stock)`;
          ventaId = p1.origen.id;
      } else if (p1.origen.tipo === 'venta_vendedor') {
          const v = ventasVendedorMap.get(p1.origen.id);
          const actorName = v?.clienteId ? (clientesMap.get(v.clienteId)?.nombre || 'N/A') : (vendedoresMap.get(p1.vendedorId!)?.nombre || 'Local');
          concepto = `${actorName} (Venta Stock Histórica)`;
          ventaId = p1.origen.id;
      } else {
          const nombreActor = clientesMap.get(p1.clienteId!)?.nombre || vendedoresMap.get(p1.vendedorId!)?.nombre || 'N/A';
          concepto = `${nombreActor} - ${p1.concepto || 'Ingreso Manual'}`;
      }
      
      allMovements.push({ 
          id: p1.origen.id, 
          fecha: p1.fecha, 
          type: 'ingreso', 
          concepto, 
          pagos: grupo.map(p => ({ metodo: p.metodo, monto: p.monto })), 
          total: grupo.reduce((sum, p) => sum + p.monto, 0), 
          original: grupo, 
          ventaId 
      });
    });

    invoicePayments.forEach(p => {
        const clientName = clientesMap.get(p.clienteId!)?.nombre || 'N/A';
        const invoiceNum = facturasMap.get(p.origen.id)?.numero || 'N/A';
        allMovements.push({ 
            id: p.id, 
            fecha: p.fecha, 
            type: 'ingreso', 
            concepto: `${clientName} (Cobro Fact ${invoiceNum})`, 
            pagos: [{ metodo: p.metodo, monto: p.monto }], 
            total: p.monto, 
            original: [p] 
        });
    });

    // Procesar Remitos en Cta. Cte. (Sin pagos registrados)
    remitos.forEach(r => {
        const d = new Date(r.fecha + 'T00:00:00').getTime();
        if (d >= filterFrom && d <= filterTo) {
            if (!processedRemitoIds.has(r.id) && !r.esAjuste) {
                const totalR = getRemitoTotal(r);
                if (totalR > 0) {
                    const clientName = r.clienteId ? (clientesMap.get(r.clienteId)?.nombre || 'N/A') : (vendedoresMap.get(r.vendedorId)?.nombre || 'Venta Stock');
                    allMovements.push({
                        id: r.id,
                        fecha: r.fecha,
                        type: 'ingreso',
                        concepto: r.clienteId ? `${clientName} (#${r.puntoVenta}-${r.numero} Cta. Cte.)` : `${clientName} (Venta Stock Cta. Cte.)`,
                        pagos: [{ metodo: MetodoPago.CTA_CTE, monto: totalR }],
                        total: totalR,
                        original: r,
                        ventaId: r.id,
                        isCtaCtePura: true
                    });
                }
            }
        }
    });

    return allMovements.sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime() || b.id.localeCompare(a.id));
  }, [gastos, registrosPago, remitos, remitosMap, ventasVendedorMap, clientesMap, vendedoresMap, facturasMap, dateFilter, productosMap, getRemitoTotal]);

  const displayedMovements = useMemo(() => combinedMovements.slice(0, itemsLimit), [combinedMovements, itemsLimit]);

  const renderBalanceSection = (data: Record<string, number>, title: string, isDaily: boolean) => (
      <div className="space-y-3">
          <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1 border-l-4 border-primary-500">{title}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(data).map(([m, val]) => {
                if (m !== 'total' && val === 0) return null;
                const isTotal = m === 'total';
                return (
                    <div key={m} className={`p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] ${isTotal ? 'bg-primary-600 border-primary-700 text-white shadow-xl col-span-2 lg:col-span-1' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${isTotal ? 'opacity-80' : 'text-gray-400'}`}>
                            {isTotal ? (isDaily ? 'Caja del Día' : 'Saldo Total') : m}
                        </p>
                        <p className={`text-xl font-black ${isTotal ? '' : 'text-gray-800 dark:text-gray-200'}`}>${val.toLocaleString('es-AR')}</p>
                    </div>
                );
            })}
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pt-12 md:pt-0 pb-12">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Caja & Administración</h1>
        <div className="flex gap-2">
            <AppButton variant="primary" onClick={openVentaModal}>+ Venta (Remito) <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+V)</span></AppButton>
            <AppButton variant="secondary" onClick={openIngresoModal}>+ Ingreso Manual <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span></AppButton>
            <AppButton variant="danger" onClick={openGastoModal}>- Gasto <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+G)</span></AppButton>
        </div>
      </div>
      
      {renderBalanceSection(dailyBalances, `Arqueo de Caja del Día (${new Date().toLocaleDateString('es-AR')})`, true)}
      {renderBalanceSection(totalBalances, 'Acumulado Histórico', false)}

      <div className="flex flex-col md:flex-row justify-end items-end gap-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <div className="flex flex-wrap gap-2 items-end w-full md:w-auto">
              <div className="flex-1 min-w-[140px]">
                  <AppInput type="date" label="Desde" value={dateFilter.from} onChange={e => setDateFilter({...dateFilter, from: e.target.value})} />
              </div>
              <div className="flex-1 min-w-[140px]">
                  <AppInput type="date" label="Hasta" value={dateFilter.to} onChange={e => setDateFilter({...dateFilter, to: e.target.value})} />
              </div>
              <div>
                  <AppButton variant="secondary" onClick={() => setDateFilter({from: '', to: ''})} title="Limpiar Filtros">Limpiar</AppButton>
              </div>
          </div>
      </div>

      <Card>
        <div className="overflow-x-auto p-2">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <tr><th className="px-4 py-3 w-24">Fecha</th><th className="px-4 py-3">Referencia</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                </thead>
                <tbody>
                    {displayedMovements.map(mov => {
                        const isExpanded = expandedRowId === mov.id;
                        // Deshabilitar edición si es un pago de factura (se debe hacer desde la vista de facturas)
                        const isEditDisabled = mov.type === 'ingreso' && Array.isArray(mov.original) && mov.original[0].origen.tipo === 'factura';
                        const linkedVenta = mov.ventaId ? ventasVendedorMap.get(mov.ventaId) : null;
                        const isPureCredit = mov.isCtaCtePura;

                        return (
                            <React.Fragment key={mov.id}>
                                <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : mov.id)}>
                                    <td className="px-4 py-4">{new Date(mov.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                    <td className="px-4 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 dark:text-white text-sm">{mov.concepto}</span>
                                        {linkedVenta && <span className="text-[9px] font-black text-primary-600 uppercase">Venta Directa de Stock</span>}
                                    </div>
                                    </td>
                                    <td className={`px-4 py-4 text-right font-black ${isPureCredit ? 'text-gray-400' : (mov.type === 'ingreso' ? 'text-green-600' : 'text-red-600')}`}>
                                        {isPureCredit ? '(Crédito)' : (mov.type === 'ingreso' ? '+' : '-')}${mov.total.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right flex justify-end items-center gap-2">
                                        {!isEditDisabled && (
                                            <AppButton 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if(mov.type==='gasto') {
                                                        setModalConfig({type:'gasto', isEdit:true, data:mov.original}); 
                                                        setIsModalOpen(true);
                                                    } else if (mov.ventaId && remitosMap.has(mov.ventaId)) {
                                                        // Si es un remito (venta unificada)
                                                        setRemitoModalData(remitosMap.get(mov.ventaId));
                                                        setIsRemitoModalOpen(true);
                                                    } else if (isPureCredit) {
                                                        // Si es crédito puro (VentaVendedor histórica o Remito sin pago)
                                                        if (remitosMap.has(mov.id)) {
                                                            setRemitoModalData(remitosMap.get(mov.id));
                                                            setIsRemitoModalOpen(true);
                                                        } else {
                                                            setModalConfig({type:'ingreso', isEdit:true, data: mov.original});
                                                            setIsModalOpen(true);
                                                        }
                                                    } else { 
                                                        const original=mov.original as RegistroPago[]; 
                                                        const p1=original[0]; 
                                                        if (p1.origen.tipo === 'remito') {
                                                            setRemitoModalData(remitosMap.get(p1.origen.id));
                                                            setIsRemitoModalOpen(true);
                                                        } else {
                                                            setModalConfig({type:'ingreso', isEdit:true, data:{...p1, pagos:original.map(p=>({monto:p.monto, metodo:p.metodo}))}}); 
                                                            setIsModalOpen(true);
                                                        }
                                                    } 
                                                }} 
                                                className="!p-1 !h-auto text-blue-500"
                                            >
                                                <PencilIcon />
                                            </AppButton>
                                        )}
                                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-100/50 dark:bg-gray-900/50">
                                        <td colSpan={4} className="p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle de Medios</p>
                                                    {mov.pagos.map((p, idx) => (<div key={idx} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700 text-xs font-bold shadow-sm"><span>{p.metodo}</span><span className={p.metodo === MetodoPago.CTA_CTE ? 'text-gray-500' : 'text-green-600'}>${p.monto.toLocaleString()}</span></div>))}
                                                </div>
                                                {(linkedVenta || isPureCredit) && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Productos Entregados</p>
                                                    {(linkedVenta || (mov.original as any)).movimientos.map((m: any, idx: number) => {
                                                        const p = productosMap.get(m.productoId); 
                                                        const cant = m.entregados !== undefined ? m.entregados : m.cantidad;
                                                        return (<div key={idx} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700 text-xs shadow-sm"><span>{p?.nombre} x {cant}</span><span className="font-mono text-gray-400">${(m.precioUnitario || p?.precio || 0).toLocaleString()} c/u</span></div>);
                                                    })}
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
            {displayedMovements.length < combinedMovements.length && (
                <div className="text-center p-4">
                    <AppButton 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setItemsLimit(prev => prev + 50)} 
                        className="text-primary-600 text-sm font-bold hover:underline"
                    >
                        Cargar más movimientos...
                    </AppButton>
                </div>
            )}
        </div>
      </Card>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-4xl">
            <MovimientoCajaForm type={modalConfig.type} movimiento={modalConfig.data} isEdit={modalConfig.isEdit} onSave={handleSave} onAddCliente={handleAddQuickClient} onClose={() => setIsModalOpen(false)} clientes={clientes} vendedores={vendedores} productos={productos} ventasVendedor={ventasVendedor} />
        </Modal>
      )}

      {isRemitoModalOpen && (
        <Modal isOpen={isRemitoModalOpen} onClose={() => setIsRemitoModalOpen(false)}>
            <RemitoForm 
                remito={remitoModalData} 
                clientes={clientes} 
                vendedores={vendedores} 
                productos={productos} 
                currentUser={vendedores[0]} // Fallback
                onSave={handleSaveRemito} 
                onAddCliente={handleAddQuickClient} 
                onClose={() => setIsRemitoModalOpen(false)} 
                remitos={remitos} 
                registrosPago={registrosPago} 
                causasRecambio={[]} 
            />
        </Modal>
      )}

      {movimientoParaBorrar && (
        <Modal isOpen={!!movimientoParaBorrar} onClose={() => setMovimientoParaBorrar(null)}>
            <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white pr-12">¿Borrar de Caja?</h2>
                <p className="text-gray-500">Esta acción es irreversible.</p>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setMovimientoParaBorrar(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={() => { 
                        if(movimientoParaBorrar.type==='gasto') deleteGasto(movimientoParaBorrar.id);
                        else if(movimientoParaBorrar.isCtaCtePura) deleteGasto(movimientoParaBorrar.id); 
                        else (movimientoParaBorrar.original as RegistroPago[]).forEach(p=>deleteRegistroPago(p.id)); 
                        
                        setMovimientoParaBorrar(null); showNotification('Registro borrado.', 'success'); 
                    }}>Sí, Eliminar</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default CajaView;
