
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RegistroPago, Gasto, Cliente, Usuario, Remito, VentaVendedor, Factura, Producto, MetodoPago, TipoVendedor, CombinedMovement } from '../types';
import plugins from '../plugins';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import CajaUnifiedForm from '../components/CajaUnifiedForm';
import RemitoForm from '../components/RemitoForm';
import { getLocalDateString } from '../utils/dateUtils';
import { PlusIcon } from 'lucide-react';
import MarkdownPreview from '../components/ui/MarkdownPreview';

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
  dataStore?: any;  // Exponer el store para los plugins
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
  currentUser: Usuario | null;
}

const CajaView: React.FC<CajaViewProps> = ({
    registrosPago, gastos, clientes, vendedores, remitos, facturas, ventasVendedor, productos, dataStore,
    addPagoManual, addGasto, addVentaVendedor, addRemito, addCliente, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateRemito, updateVentaVendedor,
    currentUser
}) => {
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionInitialType, setActionInitialType] = useState<'VENTA' | 'COBRO' | 'GASTO'>('VENTA');
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'ingreso' | 'gasto', data: any, isEdit: boolean }>({ type: 'ingreso', data: {}, isEdit: false });
  const [isLegacyModalOpen, setIsLegacyModalOpen] = useState(false); // Para edición de registros viejos
  const [remitoModalData, setRemitoModalData] = useState<any>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [movimientoParaBorrar, setMovimientoParaBorrar] = useState<CombinedMovement | null>(null);
  
  // FILTROS DE FECHA
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [hideCtaCte, setHideCtaCte] = useState(true);
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
        setIsActionModalOpen(false);
    } catch (e) {
        console.error(e);
        showNotification('Error al guardar venta.', 'error');
    }
  };

  const openActionModal = useCallback((type: 'VENTA' | 'COBRO' | 'GASTO' = 'VENTA') => {
    setActionInitialType(type);
    setIsActionModalOpen(true);
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'v' || e.key === 'V') && !isActionModalOpen && !isRemitoModalOpen) { e.preventDefault(); openActionModal('VENTA'); }
        else if (e.altKey && (e.key === 'c' || e.key === 'C') && !isActionModalOpen && !isRemitoModalOpen) { e.preventDefault(); openActionModal('COBRO'); } 
        else if (e.altKey && (e.key === 'g' || e.key === 'G') && !isActionModalOpen && !isRemitoModalOpen) { e.preventDefault(); openActionModal('GASTO'); }
        else if (e.altKey && (e.key === 'n' || e.key === 'N') && !isActionModalOpen && !isRemitoModalOpen) { e.preventDefault(); openActionModal('VENTA'); }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isActionModalOpen, isRemitoModalOpen, openActionModal]);

  // --- OBTENCIÓN DE MOVIMIENTOS EXTRA DE PLUGINS ---
  const extraMovementsFromPlugins = useMemo(() => {
     let extra: CombinedMovement[] = [];
     plugins.filter(p => !p.isEnabled || p.isEnabled(dataStore?.empresaSettings)).forEach(plugin => {
        if (plugin.getCajaMovements) {
            extra = [...extra, ...plugin.getCajaMovements(dataStore)];
        }
     });
     return extra;
  }, [dataStore, plugins]);

  // Balance Diario
  const todayStr = useMemo(() => getLocalDateString(), []);
  const dailyBalances = useMemo(() => {
      const dailyPagos = registrosPago.filter(p => p.fecha === todayStr);
      const dailyGastos = gastos.filter(g => g.fecha === todayStr);
      const dailyExtra = extraMovementsFromPlugins.filter(m => m.fecha === todayStr);

      const balancesPorMetodo = (Object.values(MetodoPago) as MetodoPago[]).reduce((acc, metodo) => { acc[metodo] = 0; return acc; }, {} as Record<MetodoPago, number>);
      dailyPagos.forEach(p => balancesPorMetodo[p.metodo] += p.monto);
      dailyGastos.forEach(g => g.pagos.forEach(p => balancesPorMetodo[p.metodo] -= p.monto));
      dailyExtra.forEach(m => {
          m.pagos.forEach(p => {
              if (m.type === 'ingreso') balancesPorMetodo[p.metodo] += p.monto;
              else balancesPorMetodo[p.metodo] -= p.monto;
          });
      });
      const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
      return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos, extraMovementsFromPlugins, todayStr]);

  // Balance Total Histórico
  const totalBalances = useMemo(() => {
      const balancesPorMetodo = (Object.values(MetodoPago) as MetodoPago[]).reduce((acc, metodo) => { acc[metodo] = 0; return acc; }, {} as Record<MetodoPago, number>);
      registrosPago.forEach(p => balancesPorMetodo[p.metodo] += p.monto);
      gastos.forEach(g => g.pagos.forEach(p => balancesPorMetodo[p.metodo] -= p.monto));
      extraMovementsFromPlugins.forEach(m => {
          m.pagos.forEach(p => {
              if (m.type === 'ingreso') balancesPorMetodo[p.metodo] += p.monto;
              else balancesPorMetodo[p.metodo] -= p.monto;
          });
      });
      const total = Object.values(balancesPorMetodo).reduce((sum, monto) => sum + monto, 0);
      return { ...balancesPorMetodo, total };
  }, [registrosPago, gastos, extraMovementsFromPlugins]);

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
          const vendorObj = r?.vendedorId ? vendedoresMap.get(r.vendedorId) : null;
          const vendorName = vendorObj?.nombre || 'N/A';
          const clientName = r?.clienteId 
            ? (clientesMap.get(r.clienteId)?.nombre || 'N/A') 
            : (r?.esVentaMostrador ? `${vendorName} - Venta Mostrador` : (vendorName || 'Venta Stock'));
          concepto = r?.clienteId ? `${clientName} (#${r?.puntoVenta}-${r?.numero})` : `${clientName}`;
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
                    const vendorObj = r.vendedorId ? vendedoresMap.get(r.vendedorId) : null;
                    const vendorName = vendorObj?.nombre || 'N/A';
                    const clientName = r.clienteId 
                        ? (clientesMap.get(r.clienteId)?.nombre || 'N/A') 
                        : (r.esVentaMostrador ? `${vendorName} - Venta Mostrador` : (vendorName || 'Venta Stock'));
                    allMovements.push({
                        id: r.id,
                        fecha: r.fecha,
                        type: 'ingreso',
                        concepto: r.clienteId ? `${clientName} (#${r.puntoVenta}-${r.numero} Cta. Cte.)` : `${clientName} (Cta. Cte.)`,
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

    // Procesar Movimientos Extra de Plugins
    extraMovementsFromPlugins.forEach(m => {
        const d = new Date(m.fecha + 'T00:00:00').getTime();
        if (d >= filterFrom && d <= filterTo) {
            allMovements.push(m);
        }
    });

    return allMovements
        .filter(m => !hideCtaCte || !m.isCtaCtePura)
        .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime() || b.id.localeCompare(a.id));
  }, [gastos, registrosPago, extraMovementsFromPlugins, remitos, remitosMap, ventasVendedorMap, clientesMap, vendedoresMap, facturasMap, dateFilter, productosMap, getRemitoTotal, hideCtaCte]);

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
        <AppButton variant="primary" onClick={() => openActionModal('VENTA')} className="!py-3 !px-6 shadow-xl hover:scale-105 transition-all">
          <PlusIcon className="w-5 h-5 mr-2" /> NUEVO MOVIMIENTO
        </AppButton>
      </div>
      
      {renderBalanceSection(dailyBalances, `Arqueo de Caja del Día (${new Date().toLocaleDateString('es-AR')})`, true)}
      {renderBalanceSection(totalBalances, 'Acumulado Histórico', false)}

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border dark:border-gray-700 shadow-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                    className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${!hideCtaCte ? 'bg-primary-500' : 'bg-gray-300'}`} 
                    onClick={() => setHideCtaCte(!hideCtaCte)}
                >
                    <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${!hideCtaCte ? 'translate-x-5' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary-600 leading-none">Ventas Crédito</span>
                    <span className="text-[9px] text-gray-400 font-bold">{hideCtaCte ? 'OCULTAS' : 'VISIBLES'}</span>
                </div>
            </label>
          </div>

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
                                                        setIsLegacyModalOpen(true);
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
                                                            setIsLegacyModalOpen(true);
                                                        }
                                                    } else { 
                                                        const original=mov.original as RegistroPago[]; 
                                                        const p1=original[0]; 
                                                        if (p1.origen.tipo === 'remito') {
                                                            setRemitoModalData(remitosMap.get(p1.origen.id));
                                                            setIsRemitoModalOpen(true);
                                                        } else {
                                                            setModalConfig({type:'ingreso', isEdit:true, data:{...p1, pagos:original.map(p=>({monto:p.monto, metodo:p.metodo}))}}); 
                                                            setIsLegacyModalOpen(true);
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
                                                <div className="md:col-span-2 flex flex-col gap-4">
                                                    {(mov.original as any).observaciones && (
                                                        <div className="bg-white/40 dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Observaciones</p>
                                                            <MarkdownPreview value={(mov.original as any).observaciones} />
                                                        </div>
                                                    )}
                                                    <div className="flex justify-end">
                                                        {!isEditDisabled && <AppButton variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setMovimientoParaBorrar(mov); }} className="!py-1 shadow-sm">Eliminar Registro</AppButton>}
                                                    </div>
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

      {isActionModalOpen && (
        <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} className="max-w-4xl">
          <CajaUnifiedForm 
            initialType={actionInitialType === 'VENTA' ? 'VENTA' : (actionInitialType === 'GASTO' ? 'GASTO' : 'VENTA')}
            productos={productos}
            clientes={clientes}
            vendedores={vendedores}
            currentUser={currentUser || vendedores[0]}
            remitos={remitos}
            registrosPago={registrosPago}
            causasRecambio={[]}
            onSaveRemito={handleSaveRemito}
            onSaveGasto={addGasto}
            onAddCliente={handleAddQuickClient}
            onClose={() => setIsActionModalOpen(false)}
          />
        </Modal>
      )}

      {isLegacyModalOpen && (
        <Modal isOpen={isLegacyModalOpen} onClose={() => setIsLegacyModalOpen(false)} className="max-w-4xl">
            {/* Solo se usa para editar registros viejos que no encajan en el nuevo form */}
            <p className="p-4 text-xs text-gray-400">Modo Edición Avanzada</p>
            {/* Aquí podrías re-importar MovimientoCajaForm si fuera estrictamente necesario, 
                pero intentaremos que todo pase por el nuevo o por RemitoForm */}
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
                {(!Array.isArray(movimientoParaBorrar.original) && "proveedorId" in movimientoParaBorrar.original) ? (
                    <>
                        <p className="text-gray-500">
                            Esto es un pago a proveedor. Para eliminarlo, dirígete a la sección de Proveedores.
                        </p>
                        <div className="flex justify-center gap-3">
                            <AppButton variant="secondary" onClick={() => setMovimientoParaBorrar(null)}>Entendido</AppButton>
                        </div>
                    </>
                ) : (
                    <>
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
                    </>
                )}
            </div>
        </Modal>
      )}
    </div>
  );
};

export default CajaView;
