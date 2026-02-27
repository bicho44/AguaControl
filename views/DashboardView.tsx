
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import Card from '../components/Card';
import Modal from '../components/Modal';
import AppButton from '../components/ui/AppButton';
import { Remito, Producto, TipoProducto, RegistroPago, Gasto, MetodoPago, Usuario, Cliente, VentaVendedor, DiaSemana, EmpresaSettings, TipoVendedor, Rol, PagoDetalle, EstadoCliente, CausaRecambio, PlanillaDiaria } from '../types';
import LeafletMap from '../components/LeafletMap';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getLocalDateString } from '../utils/dateUtils';
// Importamos formularios
import RemitoForm from '../components/RemitoForm';
import MovimientoCajaForm from '../components/MovimientoCajaForm';

interface DashboardViewProps {
  remitos: Remito[];
  productos: Producto[];
  registrosPago: RegistroPago[];
  gastos: Gasto[];
  usuarios: Usuario[];
  clientes: Cliente[];
  ventasVendedor: VentaVendedor[];
  empresaSettings?: EmpresaSettings;
  causasRecambio: CausaRecambio[];
  planillas: PlanillaDiaria[];
  // New props for actions
  addRemito?: (remito: any) => Promise<void>;
  addPagoManual?: (pago: any) => Promise<void>;
  addVentaVendedor?: (venta: any) => Promise<void>;
  addCliente?: (cliente: any) => Promise<string>;
}

// ----------------------------------------------------------------------
// SUB-COMPONENTES PARA ESTILOS Y REUTILIZACION
// ----------------------------------------------------------------------

const StatsCard: React.FC<{
  title: string;
  stats: { byProduct: { [key: string]: number } };
}> = ({ title, stats }) => (
  <Card title={title}>
    <div className="space-y-2 min-h-[120px]">
      {Object.keys(stats.byProduct).length > 0 ? (
        Object.entries(stats.byProduct)
        .sort(([, valueA], [, valueB]) => (valueB as number) - (valueA as number))
        .map(([name, value]) => (
          <div key={name} className="flex justify-between items-center text-base">
            <span className="text-gray-600 dark:text-gray-300 truncate pr-2 font-medium">{name}</span>
            <span className="font-black text-lg text-primary-600 dark:text-primary-400">{value}</span>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center h-[120px] opacity-40">
           <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L7 14m10 0v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1" /></svg>
          <p className="text-center text-[10px] uppercase font-black tracking-tighter">Sin movimientos</p>
        </div>
      )}
    </div>
  </Card>
);

const lightTooltipStyle = {
    backgroundColor: '#f3f4f6', // Gris muy claro (Slate 50)
    border: '1px solid #d1d5db',
    borderRadius: '0.75rem',
    color: '#111827', // Texto negro
    fontSize: '12px',
    fontWeight: 'bold',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    zIndex: 100
};

// ----------------------------------------------------------------------
// DASHBOARD PARA VENDEDOR INTERNO (EMPLEADO)
// ----------------------------------------------------------------------
const InternalVendorDashboard: React.FC<{ 
    user: Usuario, 
    remitos: Remito[], 
    productosMap: Map<string, Producto>,
    planillas: PlanillaDiaria[],
    clientes: Cliente[],
    onOpenRemito: (clienteId?: string) => void 
}> = ({ user, remitos, productosMap, planillas, clientes, onOpenRemito }) => {
    // Filtrar remitos del vendedor
    const misRemitos = useMemo(() => remitos.filter(r => r.vendedorId === user.id && !r.esAjuste), [remitos, user.id]);
    
    const todayStr = useMemo(() => getLocalDateString(), []);
    const currentDay = useMemo(() => {
        const days = [DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];
        return days[new Date().getDay()];
    }, []);

    // Cálculo de Entregas Hoy/Ayer
    const { entregasTotal, chartData, entregasHoy, entregasAyer } = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);

        const remitosMes = misRemitos.filter(r => new Date(r.fecha).getTime() >= startOfMonth.getTime());
        
        let totalEntregado = 0;
        let cantHoy = 0;
        let cantAyer = 0;
        const dataPorDia: Record<string, number> = {};

        // Procesar Histórico Mes
        remitosMes.forEach(r => {
            const day = new Date(r.fecha + 'T00:00:00').getDate();
            if (!dataPorDia[day]) dataPorDia[day] = 0;

            r.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod && prod.tipo === TipoProducto.RETORNABLE) {
                    totalEntregado += m.entregados;
                    dataPorDia[day] += m.entregados;
                }
            });
        });

        // Procesar Hoy y Ayer
        misRemitos.forEach(r => {
            const rDate = r.fecha.split('T')[0];
            if (rDate === todayStr || rDate === yesterdayStr) {
                r.movimientos.forEach(m => {
                    const p = productosMap.get(m.productoId);
                    if (p && p.tipo === TipoProducto.RETORNABLE) {
                        if (rDate === todayStr) cantHoy += m.entregados;
                        else cantAyer += m.entregados;
                    }
                });
            }
        });
        
        const chart = Object.keys(dataPorDia).map(day => ({ name: `Día ${day}`, entregas: dataPorDia[day] }));

        return { entregasTotal: totalEntregado, chartData: chart, entregasHoy: cantHoy, entregasAyer: cantAyer };
    }, [misRemitos, productosMap, todayStr]);

    // Control de Carga
    const cargaStatus = useMemo(() => {
        const planillaHoy = planillas.find(p => p.repartidorId === user.id && p.fecha === todayStr);
        if (!planillaHoy) return null;

        const cargaTotal: Record<string, number> = {};
        planillaHoy.cargaInicial.forEach(item => {
            cargaTotal[item.productoId] = (cargaTotal[item.productoId] || 0) + item.cantidad;
        });
        planillaHoy.recargas?.forEach(rec => {
            rec.items.forEach(item => {
                cargaTotal[item.productoId] = (cargaTotal[item.productoId] || 0) + item.cantidad;
            });
        });

        const entregadoHoy: Record<string, number> = {};
        misRemitos.filter(r => r.fecha === todayStr).forEach(r => {
            r.movimientos.forEach(m => {
                entregadoHoy[m.productoId] = (entregadoHoy[m.productoId] || 0) + m.entregados;
            });
        });

        return { cargaTotal, entregadoHoy };
    }, [user.id, planillas, todayStr, misRemitos]);

    // Listado de Visitas del Día
    const visitasDelDia = useMemo(() => {
        return clientes.filter(c => {
            return c.sucursales.some(s => {
                const assignedDriver = s.repartidoresPorDia?.[currentDay];
                if (assignedDriver) {
                    return assignedDriver === user.id;
                }
                // Fallback: si tiene el día marcado pero no tiene repartidor asignado, lo mostramos a todos los repartidores (o al menos al actual)
                return s.diasReparto?.includes(currentDay as DiaSemana);
            });
        }).map(c => {
            const visitado = misRemitos.some(r => r.clienteId === c.id && r.fecha === todayStr);
            return { ...c, visitado };
        });
    }, [user.id, clientes, currentDay, misRemitos, todayStr]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pr-12">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                    Rendimiento: <span className="text-primary-600">{user.nombre}</span>
                </h2>
                <AppButton onClick={() => onOpenRemito()} className="shadow-lg transform active:scale-95">
                    + Nuevo Remito Rápido
                </AppButton>
            </div>

            {/* CLIENTES A VISITAR HOY */}
            {visitasDelDia.length > 0 && (
                <Card title={`Ruta del Día (${currentDay})`} compact>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {visitasDelDia.map(cliente => (
                            <button 
                                key={cliente.id} 
                                onClick={() => !cliente.visitado && onOpenRemito(cliente.id)}
                                className={`p-2.5 rounded-xl border transition-all text-left flex items-center justify-between gap-2 ${
                                    cliente.visitado 
                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800 opacity-60 cursor-default' 
                                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-300 active:scale-[0.98]'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-xs truncate ${cliente.visitado ? 'text-green-700 dark:text-green-400 line-through' : 'text-gray-800 dark:text-white'}`}>
                                        {cliente.nombre}
                                    </p>
                                    <p className="text-[9px] text-gray-500 truncate">{cliente.sucursales[0]?.direccion}</p>
                                </div>
                                {cliente.visitado ? (
                                    <span className="bg-green-500 text-white p-0.5 rounded-full flex-shrink-0">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                ) : (
                                    <span className="text-[8px] font-black text-primary-600 uppercase tracking-tighter bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded flex-shrink-0">Visitar</span>
                                )}
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {/* CONTROL DE CARGA COMPACTO (DEBAJO DE RUTA) */}
            {cargaStatus && (
                <Card title="Control de Carga (Hoy)" compact>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(cargaStatus.cargaTotal).map(([prodId, cargaVal]) => {
                            const prod = productosMap.get(prodId);
                            const carga = cargaVal as number;
                            const entregado = cargaStatus.entregadoHoy[prodId] || 0;
                            const disponible = carga - entregado;
                            
                            return (
                                <div key={prodId} className="bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-xl border dark:border-gray-700 flex items-center gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-gray-400 uppercase truncate max-w-[70px] leading-tight">{prod?.nombre}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black leading-none">{entregado}</span>
                                            <span className="text-[9px] text-gray-400">/ {carga}</span>
                                        </div>
                                    </div>
                                    <div className={`flex flex-col items-center justify-center px-1.5 py-0.5 rounded-lg border ${disponible <= 5 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                        <span className="text-[8px] font-black uppercase leading-none">Disp.</span>
                                        <span className="text-xs font-black leading-none">{disponible}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CARD DE ENTREGAS HOY/AYER */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest text-center">Ritmo de Entrega (Envases)</h3>
                    </div>
                    <div className="flex-1 grid grid-cols-2 divide-x dark:divide-gray-700">
                        <div className="flex flex-col items-center justify-center p-4">
                            <span className="text-4xl font-black text-blue-600">{entregasHoy}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Hoy</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4">
                            <span className="text-4xl font-black text-gray-400">{entregasAyer}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Ayer</span>
                        </div>
                    </div>
                </div>

                <Card>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Mensual</p>
                        <p className="text-5xl font-black text-blue-600">{entregasTotal}</p>
                        <p className="text-xs text-gray-400 mt-2">Productos Retornables</p>
                    </div>
                </Card>
            </div>

            <Card title="Progreso Diario de Entregas">
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={lightTooltipStyle} />
                            <Area type="monotone" dataKey="entregas" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEntregas)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
};

// ----------------------------------------------------------------------
// DASHBOARD PARA VENDEDOR EXTERNO (REVENDEDOR)
// ----------------------------------------------------------------------
const ExternalVendorDashboard: React.FC<{ 
    user: Usuario, 
    ventas: VentaVendedor[], 
    pagos: RegistroPago[], 
    productosMap: Map<string, Producto>,
    onOpenStockPurchase: () => void,
    onOpenPago: () => void
}> = ({ user, ventas, pagos, productosMap, onOpenStockPurchase, onOpenPago }) => {
    const misVentas = useMemo(() => ventas.filter(v => v.vendedorId === user.id), [ventas, user.id]);
    
    const { totalComprado, totalPagado, saldoPendiente, historial, retiradosHoy, retiradosAyer } = useMemo(() => {
        let comprado = 0;
        const historialCombinado: any[] = [];
        const todayStr = getLocalDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);

        let hoy = 0;
        let ayer = 0;

        // 1. Sumar Compras (VentaVendedor)
        misVentas.forEach(v => {
            let totalVenta = 0;
            const vDate = v.fecha.split('T')[0];

            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;

                    // Contar envases retirados hoy/ayer (solo retornables)
                    if (prod.tipo === TipoProducto.RETORNABLE) {
                        if (vDate === todayStr) hoy += m.cantidad;
                        if (vDate === yesterdayStr) ayer += m.cantidad;
                    }
                }
            });
            comprado += totalVenta;
            historialCombinado.push({
                fecha: v.fecha,
                concepto: 'Compra de Stock',
                monto: -totalVenta, // Egreso para la cuenta corriente (Deuda)
                detalle: `${v.movimientos.length} productos`
            });
        });

        // 2. Sumar Pagos (RegistroPago vinculados a ventas de este vendedor)
        const misPagos = pagos.filter(p => p.vendedorId === user.id);
        
        let pagado = 0;
        misPagos.forEach(p => {
            pagado += p.monto;
            historialCombinado.push({
                fecha: p.fecha,
                concepto: `Pago (${p.metodo})`,
                monto: p.monto, // Ingreso para la cuenta corriente (Haber)
                detalle: p.concepto || '-'
            });
        });

        const deuda = comprado - pagado;

        // Ordenar historial
        historialCombinado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { totalComprado: comprado, totalPagado: pagado, saldoPendiente: deuda, historial: historialCombinado, retiradosHoy: hoy, retiradosAyer: ayer };
    }, [misVentas, pagos, user.id, productosMap, user.preciosEspeciales]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-2 pr-12">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                    Cuenta Corriente: <span className="text-primary-600">{user.nombre}</span>
                </h2>
                <div className="flex gap-2">
                    <AppButton onClick={onOpenPago} variant="success" className="shadow-lg">
                        $ Cargar Pago
                    </AppButton>
                    <AppButton onClick={onOpenStockPurchase} className="shadow-lg">
                        + Registrar Retiro de Mercadería
                    </AppButton>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className={`p-6 rounded-2xl border-2 shadow-xl flex flex-col items-center justify-center transition-all md:col-span-2 ${saldoPendiente > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Pendiente (Deuda)</p>
                    <p className={`text-4xl font-black tracking-tighter ${saldoPendiente > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>${saldoPendiente.toLocaleString()}</p>
                </div>

                {/* CARD DE RETIROS HOY/AYER (EXTERNO) */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700 flex flex-col md:col-span-2">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest text-center">Envases Retirados</h3>
                    </div>
                    <div className="flex-1 grid grid-cols-2 divide-x dark:divide-gray-700">
                        <div className="flex flex-col items-center justify-center p-4">
                            <span className="text-4xl font-black text-primary-600">{retiradosHoy}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Hoy</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4">
                            <span className="text-4xl font-black text-gray-400">{retiradosAyer}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Ayer</span>
                        </div>
                    </div>
                </div>
            </div>

            <Card title="Historial de Movimientos">
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Detalle</th><th className="px-4 py-3 text-right">Monto</th></tr>
                        </thead>
                        <tbody>
                            {historial.map((h, i) => (
                                <tr key={i} className="border-b dark:border-gray-700">
                                    <td className="px-4 py-3 font-mono text-xs">{new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                    <td className="px-4 py-3 font-bold">{h.concepto}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{h.detalle}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${h.monto < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {h.monto < 0 ? '-' : '+'}${Math.abs(h.monto).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

// ----------------------------------------------------------------------
// DASHBOARD PRINCIPAL (CONTAINER)
// ----------------------------------------------------------------------

const DashboardView: React.FC<DashboardViewProps> = ({ 
    remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings, causasRecambio, planillas,
    addRemito, addPagoManual, addVentaVendedor, addCliente
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  // States for Modals
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  // Nuevo state para la compra de stock del vendedor externo
  const [isStockPurchaseModalOpen, setIsStockPurchaseModalOpen] = useState(false);
  
  // Data for Modals
  const [newRemitoData, setNewRemitoData] = useState<any>(null);
  const [newPagoData, setNewPagoData] = useState<any>(null);
  const [newStockPurchaseData, setNewStockPurchaseData] = useState<any>(null);
  const [stickyVendedorId, setStickyVendedorId] = useState<string>(user?.id || '');

  const productosMap = useMemo(() => new Map<string, Producto>(productos.map(p => [p.id, p])), [productos]);
  const usuariosMap = useMemo(() => new Map<string, Usuario>(usuarios.map(u => [u.id, u])), [usuarios]);
  
  // FILTRADO DE CLIENTES POR TIPO DE VENDEDOR
  const visibleClientes = useMemo(() => {
      if (user?.tipo === TipoVendedor.EXTERNO) {
          return clientes.filter(c => c.creadoPor === user.id);
      }
      return clientes;
  }, [clientes, user]);

  // Handler para abrir Remito desde Dashboard (Solo internos)
  const handleOpenRemito = useCallback((clienteId?: string) => {
      const userRemitos = remitos; // Solo internos llegan acá
      const lastRemito = [...userRemitos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
      const defaultPto = lastRemito?.puntoVenta || '1';
      
      setNewRemitoData({
          fecha: getLocalDateString(),
          puntoVenta: defaultPto,
          numero: '',
          clienteId: clienteId || '',
          movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }],
          pagos: [],
          vendedorId: stickyVendedorId || user?.id
      });
      setIsRemitoModalOpen(true);
  }, [remitos, user, stickyVendedorId]);

  // Handler para abrir Pago desde Dashboard (Todos)
  const handleOpenPago = useCallback(() => {
      setNewPagoData({
          fecha: getLocalDateString(),
          vendedorId: user?.id,
          clienteId: null,
          concepto: 'Pago a Cuenta',
          pagos: [{ monto: 0, metodo: MetodoPago.EFECTIVO }]
      });
      setIsPagoModalOpen(true);
  }, [user]);

  // Handler para abrir Compra de Stock (Externos)
  const handleOpenStockPurchase = useCallback(() => {
      setNewStockPurchaseData({
          fecha: getLocalDateString(),
          vendedorId: user?.id,
          // No necesitamos clienteId porque es autocompra
          concepto: 'Retiro de Mercadería',
          pagos: [] // Inicialmente sin pago, genera deuda
      });
      setIsStockPurchaseModalOpen(true);
  }, [user]);

  // ATAJO DE TECLADO GLOBAL PARA NUEVO REMITO (Alt+N)
  useEffect(() => {
      const handleGlobalKeys = (e: KeyboardEvent) => {
          if (e.altKey && (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') && !isRemitoModalOpen && !isPagoModalOpen && !isStockPurchaseModalOpen) {
              // Permitir a Repartidores (Internos y Externos) y Administradores
              if (user?.rol === Rol.REPARTIDOR || user?.rol === Rol.ADMINISTRADOR) {
                  e.preventDefault();
                  handleOpenRemito();
              }
          }
      };
      window.addEventListener('keydown', handleGlobalKeys);
      return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isRemitoModalOpen, isPagoModalOpen, isStockPurchaseModalOpen, handleOpenRemito, user]);

  // Handler para Guardar Remito (Internos)
  const handleSaveRemito = async (remito: any) => {
      if (!addRemito) return;
      try {
          // Guardar el vendedor seleccionado para la próxima carga
          if (remito.vendedorId) {
              setStickyVendedorId(remito.vendedorId);
          }
          await addRemito(remito);
          showNotification('Remito creado exitosamente', 'success');
          setIsRemitoModalOpen(false);
      } catch (e) {
          showNotification('Error al crear remito', 'error');
      }
  };

  // Handler para Guardar Pago (Vendedor Externo)
  const handleSavePago = async (data: any) => {
      if (!addVentaVendedor) return;
      try {
          await addVentaVendedor({
              fecha: data.fecha,
              vendedorId: user?.id,
              movimientos: [],
              pagos: data.pagos
          });
          showNotification('Pago registrado correctamente', 'success');
          setIsPagoModalOpen(false);
      } catch (e) {
          showNotification('Error al registrar pago', 'error');
      }
  };

  // Handler para Guardar Compra de Stock (Vendedor Externo)
  const handleSaveStockPurchase = async (data: any) => {
      if (!addVentaVendedor) return;
      try {
          await addVentaVendedor({
              fecha: data.fecha,
              vendedorId: user?.id,
              clienteId: null, // Importante: Sin cliente final
              movimientos: data.movimientos,
              pagos: data.pagos
          });
          showNotification('Retiro de mercadería registrado.', 'success');
          setIsStockPurchaseModalOpen(false);
      } catch (e) {
          showNotification('Error al registrar retiro.', 'error');
      }
  };

  // Handler wrapper para addCliente
  const handleAddClienteWrapper = async (c: any) => {
      if(!addCliente) return "";
      return await addCliente({ ...c, creadoPor: user?.id });
  }

  // --- LÓGICA COMPARTIDA PARA ADMIN DASHBOARD ---
  // ... (Lógica de gráficos se mantiene igual)
  const consumableProductNames = useMemo(() => {
    return [...new Set(
        productos
        .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
        .map(p => p.nombre)
    )].sort();
  }, [productos]);

  const productColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    consumableProductNames.forEach((name) => {
        const product = productos.find(p => p.nombre === name);
        colors[name] = product?.color || "#9ca3af";
    });
    return colors;
  }, [consumableProductNames, productos]);

  const [visibleProducts, setVisibleProducts] = useState<string[]>([]);

  useEffect(() => {
      try {
          const saved = localStorage.getItem('dashboard_visible_products');
          const savedList = saved ? JSON.parse(saved) : [];
          if (savedList.length === 0) {
              setVisibleProducts(consumableProductNames);
              return;
          }
          setVisibleProducts(savedList.filter(name => consumableProductNames.includes(name)));
      } catch (e) {
          setVisibleProducts(consumableProductNames);
      }
  }, [consumableProductNames]);

  const toggleProductVisibility = (productName: string) => {
      setVisibleProducts(prev => {
          const newVisible = prev.includes(productName)
              ? prev.filter(p => p !== productName)
              : [...prev, productName];
          localStorage.setItem('dashboard_visible_products', JSON.stringify(newVisible));
          return newVisible;
      });
  };

  const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0);
  };

  const calculateStatsForPeriod = (remitosToProcess: Remito[], ventasToProcess: VentaVendedor[]) => {
    const byProduct: { [key: string]: number } = {};
    remitosToProcess.forEach(remito => {
        if (remito.esAjuste) return;
        remito.movimientos?.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) byProduct[producto.nombre] = (byProduct[producto.nombre] || 0) + (mov.entregados || 0);
        });
    });
    ventasToProcess.forEach(venta => {
        venta.movimientos?.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) byProduct[producto.nombre] = (byProduct[producto.nombre] || 0) + (mov.cantidad || 0);
        });
    });
    return { byProduct };
  };

  const {
    dailyStats,
    yesterdayStats,
    weeklyStats,
    monthlyStats,
    lastMonthStats,
    saldoEfectivo,
    saldoOtros,
    monthlySalesVolumeChartData,
    currentMonthDailySalesData,
    externalVendorsPieData,
    stockEnCalle,
    vendedoresComisiones
  } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

    const activeRemitos = remitos.filter(r => !r.esAjuste);
    const dailyRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha).getTime() === today.getTime());
    const yesterdayRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha).getTime() === yesterday.getTime());
    const weeklyRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha) >= startOfWeek);
    const monthlyRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha) >= startOfMonth);
    const lastMonthRemitos = activeRemitos.filter(r => { 
        const d = parseLocalDate(r.fecha); 
        return d >= startOfLastMonth && d <= endOfLastMonth; 
    });

    const dailyVentas = ventasVendedor.filter(v => parseLocalDate(v.fecha).getTime() === today.getTime());
    const yesterdayVentas = ventasVendedor.filter(v => parseLocalDate(v.fecha).getTime() === yesterday.getTime());
    const weeklyVentas = ventasVendedor.filter(v => parseLocalDate(v.fecha) >= startOfWeek);
    const monthlyVentas = ventasVendedor.filter(v => parseLocalDate(v.fecha) >= startOfMonth);
    const lastMonthVentas = ventasVendedor.filter(v => {
        const d = parseLocalDate(v.fecha);
        return d >= startOfLastMonth && d <= endOfLastMonth;
    });

    // Comisiones de Vendedores Internos (Mes Actual)
    const comisiones: { nombre: string, monto: number }[] = [];
    usuarios.filter(u => u.rol === Rol.REPARTIDOR && u.tipo === TipoVendedor.INTERNO).forEach(vendedor => {
        let totalComision = 0;
        const comisionesMap = new Map<string, number>();
        vendedor.comisiones?.forEach(c => comisionesMap.set(c.productoId, c.monto));

        monthlyRemitos.filter(r => r.vendedorId === vendedor.id).forEach(r => {
            r.movimientos.forEach(m => {
                const comisionRate = comisionesMap.get(m.productoId) || 0;
                totalComision += m.entregados * comisionRate;
            });
        });

        if (totalComision > 0) {
            comisiones.push({ nombre: vendedor.nombre, monto: totalComision });
        }
    });

    let sEfectivo = 0; let sOtros = 0;
    registrosPago.forEach(pago => {
        if (pago.metodo === MetodoPago.EFECTIVO) sEfectivo += (pago.monto || 0);
        else sOtros += (pago.monto || 0);
    });
    gastos.forEach(gasto => {
        gasto.pagos.forEach(pago => {
            if (pago.metodo === MetodoPago.EFECTIVO) sEfectivo -= (pago.monto || 0);
            else sOtros -= (pago.monto || 0);
        });
    });

    const monthlyHistoryData: any[] = [];
    
    for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthLabel = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthObj: any = { name: monthLabel, sortKey: monthKey };
        consumableProductNames.forEach(pName => {
            monthObj[pName] = 0;
        });
        activeRemitos.forEach(r => {
            const d = parseLocalDate(r.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                r.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) {
                        monthObj[prod.nombre] += m.entregados;
                    }
                });
            }
        });
        ventasVendedor.forEach(v => {
            const d = parseLocalDate(v.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                v.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) {
                        monthObj[prod.nombre] += m.cantidad;
                    }
                });
            }
        });
        monthlyHistoryData.push(monthObj);
    }

    const dailyEvolutionData: any[] = [];
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dayLabel = d.toString();
        const dayObj: any = { name: dayLabel };
        consumableProductNames.forEach(pName => {
            dayObj[`Carga - ${pName}`] = 0;
            dayObj[`Caja - ${pName}`] = 0;
        });
        monthlyRemitos.forEach(r => {
            if (parseLocalDate(r.fecha).getDate() === d) {
                r.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) dayObj[`Carga - ${prod.nombre}`] += m.entregados;
                });
            }
        });
        monthlyVentas.forEach(v => {
            if (parseLocalDate(v.fecha).getDate() === d) {
                v.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) dayObj[`Caja - ${prod.nombre}`] += m.cantidad;
                });
            }
        });
        dailyEvolutionData.push(dayObj);
    }

    const externalSalesMap = new Map<string, number>();
    monthlyVentas.forEach(v => {
        const vendor = usuariosMap.get(v.vendedorId);
        if (vendor?.tipo === TipoVendedor.EXTERNO) {
            const totalUnits = v.movimientos.reduce((s, m) => s + m.cantidad, 0);
            externalSalesMap.set(vendor.nombre, (externalSalesMap.get(vendor.nombre) || 0) + totalUnits);
        }
    });
    const externalVendorsPieData = Array.from(externalSalesMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // NUEVO CÁLCULO: Stock en calle (envases/equipos en poder de clientes)
    const counts: Record<string, number> = {};
    remitos.forEach(r => {
        r.movimientos.forEach(m => {
            const p = productosMap.get(m.productoId);
            // Solo contamos Retornables y Equipos como "Stock en Calle"
            if (p && (p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.EQUIPO)) {
                counts[p.nombre] = (counts[p.nombre] || 0) + (m.entregados - m.recibidos);
            }
        });
    });
    // Filtrar negativos o ceros y ordenar
    const stockEnCalle = Object.entries(counts)
        .filter(([_, val]) => val !== 0)
        .sort((a, b) => b[1] - a[1]);

    return {
        dailyStats: calculateStatsForPeriod(dailyRemitos, dailyVentas),
        yesterdayStats: calculateStatsForPeriod(yesterdayRemitos, yesterdayVentas),
        weeklyStats: calculateStatsForPeriod(weeklyRemitos, weeklyVentas),
        monthlyStats: calculateStatsForPeriod(monthlyRemitos, monthlyVentas),
        lastMonthStats: calculateStatsForPeriod(lastMonthRemitos, lastMonthVentas),
        saldoEfectivo: sEfectivo,
        saldoOtros: sOtros,
        monthlySalesVolumeChartData: monthlyHistoryData,
        currentMonthDailySalesData: dailyEvolutionData,
        externalVendorsPieData,
        stockEnCalle,
        vendedoresComisiones: comisiones
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, usuariosMap, consumableProductNames, usuarios]);

  const [mapMarkers, setMapMarkers] = useState<{ lat: number, lng: number, title: string }[]>([]);
  const [todayName, setTodayName] = useState<string>('');
  const [routeLine, setRouteLine] = useState<{ lat: number, lng: number }[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    const days = [DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];
    const name = days[new Date().getDay()];
    setTodayName(name);
    const markers: { lat: number, lng: number, title: string }[] = [];
    if (empresaSettings?.lat && empresaSettings?.lng) {
        markers.push({ lat: empresaSettings.lat, lng: empresaSettings.lng, title: "Fábrica" });
    }
    clientes.forEach(cliente => {
        cliente.sucursales.forEach(sucursal => {
            if (sucursal.diasReparto?.includes(name) && sucursal.lat && sucursal.lng) {
                markers.push({ lat: sucursal.lat, lng: sucursal.lng, title: `${cliente.nombre} (${sucursal.nombre})` });
            }
        });
    });
    setMapMarkers(markers);
  }, [clientes, empresaSettings]);

  const optimizeRoute = () => {
    if (mapMarkers.length < 2) return;
    let depot = mapMarkers[0];
    let unvisited = mapMarkers.slice(1);
    const optimizedPath = []; const orderedMarkers = [];
    let current = depot;
    optimizedPath.push({ lat: current.lat, lng: current.lng });
    orderedMarkers.push(current);
    while (unvisited.length > 0) {
        let nearestIdx = -1; let minDist = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
            const d = Math.sqrt(Math.pow(current.lat - unvisited[i].lat, 2) + Math.pow(current.lng - unvisited[i].lng, 2));
            if (d < minDist) { minDist = d; nearestIdx = i; }
        }
        if (nearestIdx !== -1) {
            const nearest = unvisited[nearestIdx];
            optimizedPath.push({ lat: nearest.lat, lng: nearest.lng });
            orderedMarkers.push(nearest);
            current = nearest;
            unvisited.splice(nearestIdx, 1);
        }
    }
    optimizedPath.push({ lat: depot.lat, lng: depot.lng });
    setMapMarkers(orderedMarkers);
    setRouteLine(optimizedPath);
    setIsOptimized(true);
  };

  const metricsOrder = ['hoy', 'ayer', 'semana', 'mes', 'mes_anterior'];
  const metricsComponents: Record<string, React.ReactNode> = {
    'hoy': <StatsCard title="Hoy" stats={dailyStats} />,
    'ayer': <StatsCard title="Ayer" stats={yesterdayStats} />,
    'semana': <StatsCard title="Esta Semana" stats={weeklyStats} />,
    'mes': <StatsCard title="Este Mes" stats={monthlyStats} />,
    'mes_anterior': <StatsCard title="Mes Anterior" stats={lastMonthStats} />
  };

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const shortName = (name: string) => name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');

  // ----------------------------------------------------------------------
  // RENDER PRINCIPAL CON SWITCH SEGÚN ROL
  // ----------------------------------------------------------------------

  if (!user) return <div className="p-4">Cargando perfil...</div>;

  // Render para Vendedores (usando los nuevos modales)
  const vendorDashboard = (
      <>
        {user.rol === Rol.REPARTIDOR && user.tipo === TipoVendedor.INTERNO && (
            <div className="space-y-4 pt-12 md:pt-0">
                <InternalVendorDashboard 
                    user={user} 
                    remitos={remitos} 
                    productosMap={productosMap} 
                    planillas={planillas}
                    clientes={clientes}
                    onOpenRemito={handleOpenRemito} 
                />
            </div>
        )}
        
        {user.rol === Rol.REPARTIDOR && user.tipo === TipoVendedor.EXTERNO && (
            <div className="space-y-4 pt-12 md:pt-0">
                <ExternalVendorDashboard 
                    user={user} 
                    ventas={ventasVendedor} 
                    pagos={registrosPago} 
                    productosMap={productosMap} 
                    onOpenStockPurchase={handleOpenStockPurchase} // AHORA: Retiro de Mercadería
                    onOpenPago={handleOpenPago}
                />
            </div>
        )}

        {/* MODAL REMITO COMPARTIDO (Solo Internos) */}
        {isRemitoModalOpen && (
            <Modal isOpen={isRemitoModalOpen} onClose={() => setIsRemitoModalOpen(false)}>
                <RemitoForm 
                    remito={newRemitoData} 
                    clientes={visibleClientes} // AHORA FILTRADOS POR USUARIO
                    vendedores={usuarios} 
                    productos={productos} 
                    currentUser={user} 
                    onSave={handleSaveRemito} 
                    onAddCliente={handleAddClienteWrapper} 
                    onClose={() => setIsRemitoModalOpen(false)} 
                    remitos={remitos} 
                    registrosPago={registrosPago} 
                    causasRecambio={causasRecambio}
                />
            </Modal>
        )}

        {/* MODAL PAGO CAJA (Para Externos) */}
        {isPagoModalOpen && (
            <Modal isOpen={isPagoModalOpen} onClose={() => setIsPagoModalOpen(false)} className="max-w-4xl">
                <MovimientoCajaForm 
                    type="ingreso" // Vendedor carga plata (pago de su deuda)
                    movimiento={newPagoData} 
                    isEdit={false} 
                    onSave={handleSavePago} 
                    onAddCliente={handleAddClienteWrapper} 
                    onClose={() => setIsPagoModalOpen(false)} 
                    clientes={visibleClientes} 
                    vendedores={usuarios} 
                    productos={productos} 
                    ventasVendedor={ventasVendedor} 
                />
            </Modal>
        )}

        {/* NUEVO MODAL COMPRA STOCK (Para Externos) */}
        {isStockPurchaseModalOpen && (
            <Modal isOpen={isStockPurchaseModalOpen} onClose={() => setIsStockPurchaseModalOpen(false)} className="max-w-4xl">
                <MovimientoCajaForm 
                    type="ingreso" // Contextual: Es un "ingreso" de venta para la empresa
                    movimiento={newStockPurchaseData} 
                    isEdit={false} 
                    onSave={handleSaveStockPurchase} 
                    onAddCliente={handleAddClienteWrapper} 
                    onClose={() => setIsStockPurchaseModalOpen(false)} 
                    clientes={[]} // No necesita clientes
                    vendedores={usuarios} 
                    productos={productos} 
                    ventasVendedor={ventasVendedor} 
                    initialVentaMode={true} // Forzar modo venta
                    hideClientSelector={true} // Ocultar selector de cliente (es autocompra)
                />
            </Modal>
        )}
      </>
  );

  if (user.rol === Rol.REPARTIDOR) return vendorDashboard;

  // 3. DASHBOARD ADMINISTRADOR
  return (
    <div className="space-y-8 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Dashboard Operativo</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-green-100 dark:border-green-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Efectivo Total</p>
              <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoEfectivo.toLocaleString('es-AR')}</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Caja Virtual / Bancos</p>
              <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoOtros.toLocaleString('es-AR')}</p>
          </div>
      </div>

      <div>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Entregas Consolidadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {metricsOrder.map(key => <div key={key}>{metricsComponents[key]}</div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
              <Card title="Evolución Diaria del Mes Actual">
                  <div className="px-4 pb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Filtro de Productos</p>
                        <div className="flex flex-wrap gap-2">
                            {consumableProductNames.map(name => {
                                const isVisible = visibleProducts.includes(name);
                                return (
                                    <button
                                        key={name}
                                        onClick={() => toggleProductVisibility(name)}
                                        className={`px-3 py-1.5 text-[11px] font-black rounded-xl border transition-all duration-200 flex items-center gap-2 ${
                                            isVisible 
                                            ? 'text-white shadow-md scale-105' 
                                            : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700/50 dark:text-gray-500 dark:border-gray-700 opacity-60 grayscale'
                                        }`}
                                        style={{ 
                                            backgroundColor: isVisible ? productColors[name] : undefined,
                                            borderColor: isVisible ? productColors[name] : undefined
                                        }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-white/40"></div>
                                        {name.toUpperCase()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                  <div className="h-80 px-2">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={currentMonthDailySalesData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} label={{ value: 'Día', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} labelFormatter={(l) => `Día ${l}`} />
                              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} formatter={(v) => v.replace('Carga - ', '📦 ').replace('Caja - ', '🏪 ').split(' ').map(w => w.length > 8 ? w.substring(0,5)+'.' : w).join(' ')} />
                              {consumableProductNames.map(name => visibleProducts.includes(name) && (
                                  <React.Fragment key={name}>
                                      <Line type="monotone" dataKey={`Carga - ${name}`} stroke={productColors[name]} strokeWidth={3} dot={false} name={`Carga - ${shortName(name)}`} />
                                      <Line type="monotone" dataKey={`Caja - ${name}`} stroke={productColors[name]} strokeWidth={1} strokeDasharray="3 3" dot={false} name={`Caja - ${shortName(name)}`} />
                                  </React.Fragment>
                              ))}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
          </div>

          <div className="lg:col-span-1">
              <Card title="Stock en Poder de Clientes">
                  <div className="overflow-y-auto max-h-[420px] pr-2">
                      <p className="text-[10px] text-gray-400 font-black uppercase mb-3">Activos pendientes de devolución</p>
                      {stockEnCalle.length > 0 ? (
                          <table className="w-full text-sm">
                              <tbody>
                                  {stockEnCalle.map(([name, count]) => (
                                      <tr key={name} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                          <td className="py-3 text-gray-600 dark:text-gray-300 font-medium text-xs">{name}</td>
                                          <td className="py-3 text-right font-black text-primary-600 dark:text-primary-400 text-base">{count.toLocaleString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-40 opacity-40">
                              <p className="text-xs font-bold uppercase">Sin stock pendiente</p>
                          </div>
                      )}
                  </div>
              </Card>
          </div>

          <div className="lg:col-span-2">
              <Card title="Volumen de Ventas (Histórico 12 Meses)">
                  <div className="h-80 px-2">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlySalesVolumeChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                              <Legend iconType="circle" formatter={(v) => shortName(v)} />
                              {consumableProductNames.map(name => visibleProducts.includes(name) && <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={3} dot={{ r: 4 }} name={shortName(name)} animationDuration={1000} />)}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
          </div>

          <div className="lg:col-span-1">
              <Card title="Comisiones Vendedores">
                  <div className="overflow-y-auto max-h-[420px] pr-2">
                      <p className="text-[10px] text-gray-400 font-black uppercase mb-3">Mes Actual (Internos)</p>
                      {vendedoresComisiones.length > 0 ? (
                          <table className="w-full text-sm">
                              <tbody>
                                  {vendedoresComisiones.map(v => (
                                      <tr key={v.nombre} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                          <td className="py-3 text-gray-600 dark:text-gray-300 font-medium text-xs">{v.nombre}</td>
                                          <td className="py-3 text-right font-black text-green-600 dark:text-green-400 text-base">${v.monto.toLocaleString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-40 opacity-40">
                              <p className="text-xs font-bold uppercase">Sin comisiones este mes</p>
                          </div>
                      )}
                  </div>
              </Card>
          </div>

          <div className="lg:col-span-1">
              <Card title="Vendedores Externos">
                  <div className="h-80 px-2 flex flex-col">
                      {externalVendorsPieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={externalVendorsPieData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey="value"
                                      label={({ value }) => `${value}`} // ETIQUETAS SIEMPRE VISIBLES
                                  >
                                      {externalVendorsPieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                                  <Legend verticalAlign="bottom" height={36} />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="flex-1 flex items-center justify-center text-gray-400 text-xs uppercase font-black">Sin ventas externas</div>
                      )}
                  </div>
              </Card>
          </div>
      </div>

      <div className="space-y-6">
          <Card title={`Ruta de Reparto: ${todayName}`}>
            <div className="p-2 space-y-4">
                {mapMarkers.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center px-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{mapMarkers.length} Puntos Georeferenciados.</p>
                            <button onClick={optimizeRoute} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full transition-all ${isOptimized ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white shadow-md'}`}>
                                {isOptimized ? 'Ruta Optimizada ✓' : 'Optimizar Recorrido'}
                            </button>
                        </div>
                        <LeafletMap markers={mapMarkers} height="450px" route={routeLine} />
                    </>
                ) : <div className="h-40 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-2xl">Sin repartos hoy</div>}
            </div>
          </Card>
      </div>
    </div>
  );
};

export default DashboardView;
