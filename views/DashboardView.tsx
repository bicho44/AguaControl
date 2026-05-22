
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar } from 'recharts';
import { 
  Calendar, 
  AlertTriangle, 
  Settings2, 
  X, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnimatePresence, motion } from 'motion/react';
import { ReactSortable } from 'react-sortablejs';
import Card from '../components/Card';
import Modal from '../components/Modal';
import AppButton from '../components/ui/AppButton';
import { Remito, Producto, TipoProducto, RegistroPago, Gasto, MetodoPago, Usuario, Cliente, VentaVendedor, DiaSemana, EmpresaSettings, TipoVendedor, Rol, PagoDetalle, EstadoCliente, CausaRecambio, PlanillaDiaria, MovimientoStockPlanta } from '../types';
import LeafletMap from '../components/LeafletMap';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getLocalDateString } from '../utils/dateUtils';
// Importamos formularios

import RemitoForm from '../components/RemitoForm';
import CajaUnifiedForm from '../components/CajaUnifiedForm';
import plugins from '../plugins';
import PluginErrorBoundary from '../components/PluginErrorBoundary';
import { useDataStore } from '../hooks/useDataStore';

// Force sync

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
  movimientosPlanta: MovimientoStockPlanta[];
  facturas?: any[];
  // New props for actions
  addRemito?: (remito: any) => Promise<void>;
  addPagoManual?: (pago: any) => Promise<void>;
  addGasto?: (gasto: any) => Promise<void>;
  addVentaVendedor?: (venta: any) => Promise<void>;
  addCliente?: (cliente: any) => Promise<string>;
  addPagoToFactura?: (facturaId: string, fecha: string, pagos: PagoDetalle[]) => Promise<void>;
  setCurrentView?: (view: any) => void;
}

// ----------------------------------------------------------------------
// SUB-COMPONENTES PARA ESTILOS Y REUTILIZACION
// ----------------------------------------------------------------------

const StatsCard: React.FC<{
  title: string;
  stats: { byProduct: { [key: string]: number } };
  productos: Producto[];
}> = ({ title, stats, productos }) => {
  const shortName = (name: string) => {
    const prod = productos.find(p => p.nombre === name);
    if (prod?.abreviatura) return prod.abreviatura;
    return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
  };

  return (
    <Card title={title}>
      <div className="space-y-2 min-h-[120px]">
        {Object.keys(stats.byProduct).length > 0 ? (
          Object.entries(stats.byProduct)
          .sort(([, valueA], [, valueB]) => (valueB as number) - (valueA as number))
          .map(([name, value]) => (
            <div key={name} className="flex justify-between items-center text-base">
              <span className="text-gray-600 dark:text-gray-300 truncate pr-2 font-medium">{shortName(name)}</span>
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
};

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
        
        const totalEntregado: Record<string, number> = {};
        const cantHoy: Record<string, number> = {};
        const cantAyer: Record<string, number> = {};
        const dataPorDia: Record<string, Record<string, number>> = {};

        // Procesar Histórico Mes
        remitosMes.forEach(r => {
            const day = new Date(r.fecha + 'T00:00:00').getDate();
            if (!dataPorDia[day]) dataPorDia[day] = {};

            r.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod && prod.tipo === TipoProducto.RETORNABLE) {
                    totalEntregado[prod.nombre] = (totalEntregado[prod.nombre] || 0) + m.entregados;
                    dataPorDia[day][prod.nombre] = (dataPorDia[day][prod.nombre] || 0) + m.entregados;
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
                        if (rDate === todayStr) {
                            cantHoy[p.nombre] = (cantHoy[p.nombre] || 0) + m.entregados;
                        } else {
                            cantAyer[p.nombre] = (cantAyer[p.nombre] || 0) + m.entregados;
                        }
                    }
                });
            }
        });
        
        const chart = Object.keys(dataPorDia).map(day => ({ name: `Día ${day}`, ...dataPorDia[day] }));

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-0 md:pr-12">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                    Rendimiento: <span className="text-primary-600">{user.nombre}</span>
                </h2>
                <AppButton onClick={() => onOpenRemito()} className="shadow-lg transform active:scale-95 w-full sm:w-auto">
                    + Nuevo Remito Rápido
                </AppButton>
            </div>

            {/* CLIENTES A VISITAR HOY */}
            {visitasDelDia.length > 0 && (
                <Card title={`Ruta del Día (${currentDay})`} compact>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {visitasDelDia.map(cliente => (
                            <button 
                                key={cliente.id} 
                                onClick={() => !cliente.visitado && onOpenRemito(cliente.id)}
                                className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between gap-2 h-full ${
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
                                <div key={prodId} className="bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-xl border dark:border-gray-700 flex items-center gap-2 min-w-[140px] flex-1 sm:flex-none">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-gray-400 uppercase truncate leading-tight">{prod?.nombre}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black leading-none">{entregado}</span>
                                            <span className="text-[9px] text-gray-400">/ {carga}</span>
                                        </div>
                                    </div>
                                    <div className={`flex flex-col items-center justify-center px-1.5 py-0.5 rounded-lg border flex-shrink-0 ${disponible <= 5 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
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
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest text-center">Ritmo de Entrega (Hoy vs Ayer)</h3>
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                        {Object.keys(entregasHoy).length > 0 || Object.keys(entregasAyer).length > 0 ? (
                            Array.from(new Set([...Object.keys(entregasHoy), ...Object.keys(entregasAyer)])).map(prodName => (
                                <div key={prodName} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{prodName}</span>
                                    <div className="flex gap-4 text-sm">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-blue-600">{entregasHoy[prodName] || 0}</span>
                                            <span className="text-[8px] uppercase text-gray-400">Hoy</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-gray-400">{entregasAyer[prodName] || 0}</span>
                                            <span className="text-[8px] uppercase text-gray-400">Ayer</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-xs text-gray-400 py-4 uppercase font-bold">Sin entregas</div>
                        )}
                    </div>
                </div>

                <Card>
                    <div className="flex flex-col py-2">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Total Mensual</p>
                        <div className="space-y-3 px-4">
                            {Object.keys(entregasTotal).length > 0 ? (
                                Object.entries(entregasTotal).map(([prodName, total]) => (
                                    <div key={prodName} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{prodName}</span>
                                        <span className="text-xl font-black text-blue-600">{total}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-xs text-gray-400 py-4 uppercase font-bold">Sin entregas este mes</div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            <Card title="Progreso Diario de Entregas">
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={lightTooltipStyle} />
                            {Object.keys(entregasTotal).map((prodName, idx) => {
                                const color = (Array.from(productosMap.values()) as any[]).find(p => p.nombre === prodName)?.color || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 4];
                                return (
                                    <Area key={prodName} type="monotone" dataKey={prodName} stroke={color} fillOpacity={0.1} fill={color} strokeWidth={2} name={prodName} />
                                );
                            })}
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
// ----------------------------------------------------------------------
// SUB-COMPONENTES PARA CUENTA CORRIENTE EXTERNA (VENDEDOR)
// ----------------------------------------------------------------------

const ExternalMovementRow: React.FC<{ 
    item: any; 
    productosMap: Map<string, Producto>;
}> = ({ item, productosMap }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const isCompra = item.type === 'compra';
    const hasSubItems = item.subItems && item.subItems.length > 0;
    
    // Calcular saldo para compras
    const totalPagado = (item.subItems || []).reduce((sum: number, sub: any) => sum + sub.monto, 0);
    const montoCompra = Math.abs(item.monto);
    const saldo = montoCompra - totalPagado;
    
    const isPaid = isCompra && saldo <= 0.01;
    const isPartial = isCompra && totalPagado > 0 && saldo > 0.01;

    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden mb-3 transition-all hover:shadow-md bg-white dark:bg-gray-800">
            <div 
                onClick={() => hasSubItems || isCompra ? setIsOpen(!isOpen) : null}
                className={`p-4 flex items-center justify-between gap-4 ${hasSubItems || isCompra ? 'cursor-pointer' : ''}`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                        item.type === 'compra' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 
                        item.type === 'pago' ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 
                        'bg-red-50 text-red-600 dark:bg-red-900/20'
                    }`}>
                        {item.type === 'compra' ? <FileText className="w-5 h-5" /> : 
                         item.type === 'pago' ? <Receipt className="w-5 h-5" /> : 
                         <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate text-sm">
                            {item.concepto}
                        </h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-none mt-1">
                            {new Date(item.fecha + 'T00:00:00').toLocaleDateString()} • {item.detalle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                        <p className={`font-black text-sm ${item.monto < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {item.monto < 0 ? '-' : '+'}${Math.abs(item.monto).toLocaleString()}
                        </p>
                        {isCompra && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                {isPaid ? (
                                    <span className="text-[9px] font-bold text-green-500 flex items-center gap-0.5 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="w-2.5 h-2.5" /> PAGADO</span>
                                ) : isPartial ? (
                                    <span className="text-[9px] font-bold text-orange-500 flex items-center gap-0.5 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-full"><Clock className="w-3 h-3" /> PARCIAL (-${saldo.toLocaleString()})</span>
                                ) : (
                                    <span className="text-[9px] font-bold text-red-500 flex items-center gap-0.5 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full"><AlertCircle className="w-2.5 h-2.5" /> PENDIENTE</span>
                                )}
                            </div>
                        )}
                    </div>
                    {(hasSubItems || isCompra) && (
                        <div className="text-gray-400">
                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-4 space-y-4">
                            {/* Detalle de Movimientos de la Compra */}
                            {isCompra && item.originalMovs && item.originalMovs.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Productos Retirados</p>
                                    <div className="grid grid-cols-1 gap-1">
                                        {item.originalMovs.map((m: any, idx: number) => {
                                            const prod = productosMap.get(m.productoId);
                                            const cant = m.cantidad || m.entregados || 0;
                                            return (
                                                <div key={idx} className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 px-2">
                                                    <span>{prod?.nombre || 'Producto'}</span>
                                                    <span className="font-bold">x{cant}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Pagos Imputados */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pagos Realizados</p>
                                {hasSubItems ? (
                                    item.subItems.map((sub: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                                    {new Date(sub.fecha + 'T00:00:00').toLocaleDateString()} - {sub.detalle}
                                                </p>
                                            </div>
                                            <p className="text-[11px] font-black text-green-600 dark:text-green-400">+ ${sub.monto.toLocaleString()}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[11px] text-gray-400 italic px-2">Sin pagos registrados para este movimiento.</p>
                                )}
                            </div>

                            {isCompra && (
                                <div className="pt-2 flex justify-between border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-gray-500">RESUMEN</p>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-green-600">PAGADO: ${totalPagado.toLocaleString()}</p>
                                        <p className={`text-[10px] font-black ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>SALDO: ${saldo.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ----------------------------------------------------------------------
// DASHBOARD PARA VENDEDOR EXTERNO (REVENDEDOR)
// ----------------------------------------------------------------------
const ExternalVendorDashboard: React.FC<{ 
    user: Usuario, 
    ventas: VentaVendedor[], 
    pagos: RegistroPago[], 
    gastos: Gasto[],
    remitos: Remito[],
    productosMap: Map<string, Producto>,
    onOpenStockPurchase: () => void,
    onOpenPago: () => void
}> = ({ user, ventas, pagos, gastos, remitos, productosMap, onOpenStockPurchase, onOpenPago }) => {
    const misVentas = useMemo(() => ventas.filter(v => v.vendedorId === user.id && !v.clienteId), [ventas, user.id]);
    const misRemitos = useMemo(() => remitos.filter(r => r.vendedorId === user.id && !r.clienteId && !r.esAjuste), [remitos, user.id]);

    const { totalComprado, totalPagado, totalGastos, saldoPendiente, historial, retiradosHoy, retiradosAyer } = useMemo(() => {
        let comprado = 0;
        let totalG = 0;
        const historialAgrupado: any[] = [];
        const todayStr = getLocalDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);

        const hoy: Record<string, number> = {};
        const ayer: Record<string, number> = {};

        // 1. Obtener Pagos del Vendedor
        const misPagos = pagos.filter(p => p.vendedorId === user.id && !p.clienteId);
        const allLinkedPagoIds = new Set<string>();

        // 2. Procesar Compras (VentaVendedor)
        misVentas.forEach(v => {
            let totalVenta = 0;
            const vDate = v.fecha.split('T')[0];

            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;
                    if (prod.tipo === TipoProducto.RETORNABLE) {
                        if (vDate === todayStr) hoy[prod.nombre] = (hoy[prod.nombre] || 0) + m.cantidad;
                        if (vDate === yesterdayStr) ayer[prod.nombre] = (ayer[prod.nombre] || 0) + m.cantidad;
                    }
                }
            });
            comprado += totalVenta;

            // Buscar pagos asociados por ID o por Origen
            const pagosDeVenta = misPagos.filter(p => 
                (v.pagoIds || []).includes(p.id) || 
                (p.origen?.tipo === 'VentaVendedor' && p.origen?.id === v.id)
            );
            pagosDeVenta.forEach(p => allLinkedPagoIds.add(p.id));

            historialAgrupado.push({
                id: v.id,
                fecha: v.fecha,
                concepto: 'Compra de Stock (Histórica)',
                monto: -totalVenta,
                detalle: `${v.movimientos.length} productos`,
                type: 'compra',
                originalMovs: v.movimientos,
                subItems: pagosDeVenta.map(p => ({
                    id: p.id,
                    fecha: p.fecha,
                    monto: p.monto,
                    detalle: `Pago (${p.metodo})`,
                    type: 'pago'
                }))
            });
        });

        // 3. Procesar Compras (Remitos)
        misRemitos.forEach(r => {
            let totalRemito = 0;
            const rDate = r.fecha.split('T')[0];
            const defaultPriceType = user.tipo === TipoVendedor.EXTERNO ? 'reventa' : 'lista';

            r.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioSugerido = defaultPriceType === 'reventa' ? (prod.precioReventa || prod.precio) : prod.precio;
                    const precioFinal = m.precioUnitario || precioEsp || precioSugerido;
                    totalRemito += m.entregados * precioFinal;
                    if (prod.tipo === TipoProducto.RETORNABLE) {
                        if (rDate === todayStr) hoy[prod.nombre] = (hoy[prod.nombre] || 0) + m.entregados;
                        if (rDate === yesterdayStr) ayer[prod.nombre] = (ayer[prod.nombre] || 0) + m.entregados;
                    }
                }
            });
            comprado += totalRemito;

            const pagosDeRemito = misPagos.filter(p => 
                (r.pagoIds || []).includes(p.id) || 
                (p.origen?.tipo === 'Remito' && p.origen?.id === r.id)
            );
            pagosDeRemito.forEach(p => allLinkedPagoIds.add(p.id));

            historialAgrupado.push({
                id: r.id,
                fecha: r.fecha,
                concepto: `Compra de Stock (#${r.puntoVenta}-${r.numero})`,
                monto: -totalRemito,
                detalle: `${r.movimientos.length} productos`,
                type: 'compra',
                originalMovs: r.movimientos,
                subItems: pagosDeRemito.map(p => ({
                    id: p.id,
                    fecha: p.fecha,
                    monto: p.monto,
                    detalle: `Pago (${p.metodo})`,
                    type: 'pago'
                }))
            });
        });

        // 4. Procesar Gastos asignados
        const misGastos = gastos.filter(g => g.vendedorId === user.id);
        misGastos.forEach(g => {
            const montoGasto = g.pagos.reduce((sum, p) => sum + p.monto, 0);
            totalG += montoGasto;
            historialAgrupado.push({
                id: g.id,
                fecha: g.fecha,
                concepto: `Gasto Asignado: ${g.concepto}`,
                monto: -montoGasto,
                detalle: g.nroRecibo ? `Recibo: ${g.nroRecibo}` : '-',
                type: 'gasto'
            });
        });

        // 5. Procesar Pagos NO vinculados (General)
        let totalP = 0;
        misPagos.forEach(p => {
            totalP += p.monto;
            if (!allLinkedPagoIds.has(p.id)) {
                historialAgrupado.push({
                    id: p.id,
                    fecha: p.fecha,
                    concepto: `Pago a Cuenta (${p.metodo})`,
                    monto: p.monto,
                    detalle: p.concepto || '-',
                    type: 'pago'
                });
            }
        });

        const deuda = (comprado + totalG) - totalP;
        historialAgrupado.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { 
            totalComprado: comprado, 
            totalPagado: totalP, 
            totalGastos: totalG, 
            saldoPendiente: deuda, 
            historial: historialAgrupado, 
            retiradosHoy: hoy, 
            retiradosAyer: ayer 
        };
    }, [misVentas, misRemitos, pagos, gastos, user.id, productosMap, user.preciosEspeciales, user.tipo]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-0 md:pr-12">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                    Cuenta Corriente: <span className="text-primary-600">{user.nombre}</span>
                </h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <AppButton onClick={onOpenPago} variant="success" className="shadow-lg flex-1 sm:flex-none">
                        $ Cargar Pago
                    </AppButton>
                    <AppButton onClick={onOpenStockPurchase} className="shadow-lg flex-1 sm:flex-none">
                        + Registrar Retiro
                    </AppButton>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className={`p-6 rounded-2xl border-2 shadow-xl flex flex-col items-center justify-center transition-all md:col-span-2 ${saldoPendiente > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Pendiente (Deuda)</p>
                    <p className={`text-3xl md:text-4xl font-black tracking-tighter ${saldoPendiente > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>${saldoPendiente.toLocaleString()}</p>
                </div>

                {/* CARD DE RETIROS HOY/AYER (EXTERNO) */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700 flex flex-col md:col-span-2">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest text-center">Envases Retirados (Hoy vs Ayer)</h3>
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                        {Object.keys(retiradosHoy).length > 0 || Object.keys(retiradosAyer).length > 0 ? (
                            Array.from(new Set([...Object.keys(retiradosHoy), ...Object.keys(retiradosAyer)])).map(prodName => (
                                <div key={prodName} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{prodName}</span>
                                    <div className="flex gap-4 text-sm">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-primary-600">{retiradosHoy[prodName] || 0}</span>
                                            <span className="text-[8px] uppercase text-gray-400">Hoy</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-gray-400">{retiradosAyer[prodName] || 0}</span>
                                            <span className="text-[8px] uppercase text-gray-400">Ayer</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-xs text-gray-400 py-4 uppercase font-bold">Sin retiros</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Historial de Movimientos</h3>
                </div>

                {historial.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {historial.map(item => (
                            <ExternalMovementRow 
                                key={item.id}
                                item={item}
                                productosMap={productosMap}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-12 text-center text-gray-400 italic font-bold uppercase text-[10px] tracking-widest">
                        Sin movimientos registrados
                    </div>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// DASHBOARD PRINCIPAL (CONTAINER)
// ----------------------------------------------------------------------

const DashboardView: React.FC<DashboardViewProps> = ({ 
    remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings, causasRecambio, planillas, movimientosPlanta,
    facturas = [],
    addRemito, addPagoManual, addGasto, addVentaVendedor, addCliente, addPagoToFactura, setCurrentView
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const handleSopladoAction = (type: 'produccion' | 'entrega') => {
    if (setCurrentView) {
      setCurrentView('plugin_soplado');
    }
  };
  
  // States for Modals
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState(false);
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [ojoMagicoAlert, setOjoMagicoAlert] = useState<string | null>(null);

  useEffect(() => {
      const handleOjoMagicoDone = (e: any) => {
          if (e.detail?.count) {
              setOjoMagicoAlert(`¡Procesamiento finalizado! Se registraron ${e.detail.count} facturas de proveedores automáticamente con la IA.`);
              setTimeout(() => setOjoMagicoAlert(null), 15000); // hide after 15s
          }
      };

      window.addEventListener('ojo_magico_done', handleOjoMagicoDone);
      return () => window.removeEventListener('ojo_magico_done', handleOjoMagicoDone);
  }, []);
  
  // Data for Modals
  const [newRemitoData, setNewRemitoData] = useState<any>(null);
  const [newPagoData, setNewPagoData] = useState<any>(null);
  const [stickyVendedorId, setStickyVendedorId] = useState<string>(user?.id || '');

  const productosMap = useMemo(() => new Map<string, Producto>(productos.map(p => [p.id, p])), [productos]);
  const usuariosMap = useMemo(() => new Map<string, Usuario>(usuarios.map(u => [u.id, u])), [usuarios]);
  
  const shortName = (name: string) => {
    const prod = productos.find(p => p.nombre === name);
    if (prod?.abreviatura) return prod.abreviatura;
    return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
  };
  
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
      setNewRemitoData({
          fecha: getLocalDateString(),
          vendedorId: user?.id,
          clienteId: null,
          puntoVenta: '0001',
          numero: '',
          movimientos: [{ productoId: '', entregados: 1, recibidos: 0 }],
          pagos: [] // Inicialmente sin pago, genera deuda
      });
      setIsRemitoModalOpen(true);
  }, [user]);

  // ATAJO DE TECLADO GLOBAL PARA NUEVO REMITO (Alt+N)
  useEffect(() => {
      const handleGlobalKeys = (e: KeyboardEvent) => {
          if (e.altKey && (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') && !isRemitoModalOpen && !isPagoModalOpen) {
              // Permitir a Repartidores (Internos y Externos) y Administradores
              if (user?.rol === Rol.REPARTIDOR || user?.rol === Rol.ADMINISTRADOR) {
                  e.preventDefault();
                  handleOpenRemito();
              }
          }
      };
      window.addEventListener('keydown', handleGlobalKeys);
      return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isRemitoModalOpen, isPagoModalOpen, handleOpenRemito, user]);

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


  // Handler wrapper para addCliente
  const handleAddClienteWrapper = async (c: any) => {
      if(!addCliente) return "";
      return await addCliente({ ...c, creadoPor: user?.id });
  }

  // --- LÓGICA COMPARTIDA PARA ADMIN DASHBOARD ---
  const returnableProductNames = useMemo(() => {
    return [...new Set(
        productos
        .filter(p => p.tipo === TipoProducto.RETORNABLE)
        .map(p => p.nombre)
    )].sort();
  }, [productos]);

  const nonReturnableProductNames = useMemo(() => {
    return [...new Set(
        productos
        .filter(p => p.tipo === TipoProducto.DESCARTABLE)
        .map(p => p.nombre)
    )].sort();
  }, [productos]);

  const productColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    productos.forEach((p) => {
        colors[p.nombre] = p.color || "#9ca3af";
    });
    return colors;
  }, [productos]);

  const [visibleProducts, setVisibleProducts] = useState<string[]>([]);

  useEffect(() => {
      try {
          const saved = localStorage.getItem('dashboard_visible_products');
          const savedList = saved ? JSON.parse(saved) : [];
          if (!Array.isArray(savedList) || savedList.length === 0) {
              setVisibleProducts(returnableProductNames);
              return;
          }
          setVisibleProducts(savedList.filter(name => typeof name === 'string' && returnableProductNames.includes(name)));
      } catch (e) {
          setVisibleProducts(returnableProductNames);
      }
  }, [returnableProductNames]);

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
      if (!dateStr) return new Date(0);
      // Handle YYYY-MM-DD or ISO strings by taking only the date part
      const cleanDate = dateStr.split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length !== 3) return new Date(0);
      const [y, m, d] = parts.map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(0);
      return new Date(y, m - 1, d, 0, 0, 0);
  };

  const calculateStatsForPeriod = (remitosToProcess: Remito[], ventasToProcess: VentaVendedor[]) => {
    const byProduct: { [key: string]: number } = {};
    remitosToProcess.forEach(remito => {
        // We count all remitos as deliveries, including adjustments if they have delivered items
        remito.movimientos?.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) {
                const val = Number(mov.entregados) || 0;
                byProduct[producto.nombre] = (byProduct[producto.nombre] || 0) + val;
            }
        });
    });
    ventasToProcess.forEach(venta => {
        venta.movimientos?.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) {
                const val = Number(mov.cantidad) || 0;
                byProduct[producto.nombre] = (byProduct[producto.nombre] || 0) + val;
            }
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
    nonReturnableMonthlyData,
    externalVendorsBarData,
    allExternalProducts,
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

    const todayStr = getLocalDateString(today);
    const yesterdayStr = getLocalDateString(yesterday);

    // Excluimos remitos de ajuste (Stock Inicial) para no romper las estadísticas de entregas reales
    const activeRemitos = remitos.filter(r => !r.esAjuste); 
    const dailyRemitos = activeRemitos.filter(r => r.fecha.split('T')[0] === todayStr);
    const yesterdayRemitos = activeRemitos.filter(r => r.fecha.split('T')[0] === yesterdayStr);
    const weeklyRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha) >= startOfWeek);
    const monthlyRemitos = activeRemitos.filter(r => parseLocalDate(r.fecha) >= startOfMonth);
    const lastMonthRemitos = activeRemitos.filter(r => { 
        const d = parseLocalDate(r.fecha); 
        return d >= startOfLastMonth && d <= endOfLastMonth; 
    });

    const dailyVentas = ventasVendedor.filter(v => v.fecha.split('T')[0] === todayStr);
    const yesterdayVentas = ventasVendedor.filter(v => v.fecha.split('T')[0] === yesterdayStr);
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
        
        returnableProductNames.forEach(pName => {
            monthObj[pName] = 0;
        });

        activeRemitos.forEach(r => {
            const d = parseLocalDate(r.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                r.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && returnableProductNames.includes(prod.nombre)) {
                        const cant = Number(m.entregados) || 0;
                        monthObj[prod.nombre] += cant;
                    }
                });
            }
        });
        ventasVendedor.forEach(v => {
            const d = parseLocalDate(v.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                v.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && returnableProductNames.includes(prod.nombre)) {
                        const cant = Number(m.cantidad) || 0;
                        monthObj[prod.nombre] += cant;
                    }
                });
            }
        });
        monthlyHistoryData.push(monthObj);
    }

    const dailyEvolutionData: any[] = [];
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysInLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const maxDays = Math.max(daysInMonth, daysInLastMonth);

    for (let d = 1; d <= maxDays; d++) {
        const dayLabel = d.toString();
        const dayObj: any = { name: dayLabel };
        
        returnableProductNames.forEach(pName => {
            dayObj[pName] = 0;
            dayObj[`${pName} Mes Ant`] = 0;
        });

        // Mes Actual
        if (d <= daysInMonth) {
            monthlyRemitos.forEach(r => {
                if (parseLocalDate(r.fecha).getDate() === d) {
                    r.movimientos.forEach(m => {
                        const prod = productosMap.get(m.productoId);
                        if (prod && returnableProductNames.includes(prod.nombre)) {
                            const cant = Number(m.entregados) || 0;
                            dayObj[prod.nombre] += cant;
                        }
                    });
                }
            });
            monthlyVentas.forEach(v => {
                if (parseLocalDate(v.fecha).getDate() === d) {
                    const vendor = usuariosMap.get(v.vendedorId);
                    const isExterno = vendor?.tipo === TipoVendedor.EXTERNO;
                    v.movimientos.forEach(m => {
                        const prod = productosMap.get(m.productoId);
                        if (prod && returnableProductNames.includes(prod.nombre)) {
                            const cant = Number(m.cantidad) || 0;
                            dayObj[prod.nombre] += cant;
                        }
                    });
                }
            });
        }

        // Mes Anterior
        if (d <= daysInLastMonth) {
            lastMonthRemitos.forEach(r => {
                if (parseLocalDate(r.fecha).getDate() === d) {
                    r.movimientos.forEach(m => {
                        const prod = productosMap.get(m.productoId);
                        if (prod && returnableProductNames.includes(prod.nombre)) {
                            const cant = Number(m.entregados) || 0;
                            dayObj[`${prod.nombre} Mes Ant`] += cant;
                        }
                    });
                }
            });
            lastMonthVentas.forEach(v => {
                if (parseLocalDate(v.fecha).getDate() === d) {
                    const vendor = usuariosMap.get(v.vendedorId);
                    const isExterno = vendor?.tipo === TipoVendedor.EXTERNO;
                    v.movimientos.forEach(m => {
                        const prod = productosMap.get(m.productoId);
                        if (prod && returnableProductNames.includes(prod.nombre)) {
                            const cant = Number(m.cantidad) || 0;
                            dayObj[`${prod.nombre} Mes Ant`] += cant;
                        }
                    });
                }
            });
        }
        
        if (d <= daysInMonth || d <= daysInLastMonth) {
            dailyEvolutionData.push(dayObj);
        }
    }

    // LÓGICA PARA PRODUCTOS DESCARTABLES (TOTALES MES ACTUAL VS ANTERIOR)
    const nonReturnableMonthlyData = nonReturnableProductNames.map(pName => {
        const prod = productos.find(p => p.nombre === pName);
        let totalActual = 0;
        let totalAnterior = 0;

        // Mes Actual
        monthlyRemitos.forEach(r => {
            r.movimientos.forEach(m => {
                if (m.productoId === prod?.id) totalActual += m.entregados;
            });
        });
        monthlyVentas.forEach(v => {
            v.movimientos.forEach(m => {
                if (m.productoId === prod?.id) totalActual += m.cantidad;
            });
        });

        // Mes Anterior
        lastMonthRemitos.forEach(r => {
            r.movimientos.forEach(m => {
                if (m.productoId === prod?.id) totalAnterior += m.entregados;
            });
        });
        lastMonthVentas.forEach(v => {
            v.movimientos.forEach(m => {
                if (m.productoId === prod?.id) totalAnterior += m.cantidad;
            });
        });

        return {
            name: shortName(pName),
            actual: totalActual,
            anterior: totalAnterior,
            color: prod?.color || '#3b82f6'
        };
    }).filter(d => d.actual > 0 || d.anterior > 0);

    // CÁLCULO DE VENTAS A VENDEDORES EXTERNOS (Agrupado por Vendedor y Producto)
    const externalSalesMap = new Map<string, Record<string, number>>();
    const allExternalProducts = new Set<string>();

    const processExternalSale = (vendedorId: string, clienteId: string | undefined, movimientos: any[]) => {
        // Remove guard check. Include all sales made by the external vendor.
        const vendor = usuariosMap.get(vendedorId);
        if (vendor?.tipo === TipoVendedor.EXTERNO) {
            if (!externalSalesMap.has(vendor.nombre)) externalSalesMap.set(vendor.nombre, {});
            const vData = externalSalesMap.get(vendor.nombre)!;
            
            movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const pName = prod.abreviatura || shortName(prod.nombre);
                    const cant = Number(m.cantidad || m.entregados) || 0;
                    if (cant > 0) {
                        vData[pName] = (vData[pName] || 0) + cant;
                        allExternalProducts.add(pName);
                    }
                }
            });
        }
    };

    monthlyVentas.forEach(v => processExternalSale(v.vendedorId, v.clienteId, v.movimientos));
    monthlyRemitos.forEach(r => processExternalSale(r.vendedorId, r.clienteId, r.movimientos));

    const externalVendorsBarData = Array.from(externalSalesMap.entries()).map(([name, data]) => ({
        name,
        ...data
    }));
    
    // Sort by total units descending
    externalVendorsBarData.sort((a, b) => {
        const totalA = Object.keys(a).filter(k => k !== 'name').reduce((sum, k) => sum + (a[k] as number), 0);
        const totalB = Object.keys(b).filter(k => k !== 'name').reduce((sum, k) => sum + (b[k] as number), 0);
        return totalB - totalA;
    });

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
        nonReturnableMonthlyData,
        externalVendorsBarData,
        allExternalProducts: Array.from(allExternalProducts),
        stockEnCalle,
        vendedoresComisiones: comisiones
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, usuariosMap, returnableProductNames, nonReturnableProductNames, usuarios, movimientosPlanta]);

  const [mapMarkers, setMapMarkers] = useState<{ lat: number, lng: number, title: string }[]>([]);
  const [todayName, setTodayName] = useState<string>('');
  const [routeLine, setRouteLine] = useState<{ lat: number, lng: number }[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);

  // --- DASHBOARD CUSTOMIZATION STATE ---
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  
  // Default layout definition with span (1 to 4)
  const defaultLayout = [
    { id: 'plugin_soplado', visible: true, span: 4 },
    { id: 'caja_efectivo', visible: true, span: 2 },
    { id: 'caja_bancos', visible: true, span: 2 },
    { id: 'entregas_consolidadas', visible: true, span: 4 },
    { id: 'evolucion_diaria', visible: true, span: 3 },
    { id: 'stock_planta', visible: true, span: 1 },
    { id: 'stock_calle', visible: true, span: 1 },
    { id: 'volumen_ventas', visible: true, span: 2 },
    { id: 'ventas_descartables', visible: true, span: 1 },
    { id: 'comisiones', visible: true, span: 1 },
    { id: 'vendedores_externos', visible: true, span: 1 },
    { id: 'ruta_reparto', visible: true, span: 4 }
  ];

  const [layout, setLayout] = useState(defaultLayout);

  const { updateUsuario, addLog } = useDataStore();

  // Load layout from user context on mount
  useEffect(() => {
    if (user.rol === Rol.ADMINISTRADOR) {
      if (user.dashboardLayout) {
        try {
          const parsed = typeof user.dashboardLayout === 'string' ? JSON.parse(user.dashboardLayout) : user.dashboardLayout;
          // Merge with default to ensure no missing widgets if we add new ones
          const defaultWithPlugins = [...defaultLayout];
          plugins.forEach(plugin => {
              if (plugin.dashboardWidget && !defaultWithPlugins.some(w => w.id === `plugin_${plugin.id}`)) {
                  defaultWithPlugins.push({ id: `plugin_${plugin.id}`, visible: true, span: 4 });
              }
          });

          const merged = defaultWithPlugins.map(def => {
            const found = parsed.find((p: any) => p.id === def.id);
            // Ensure span exists (for users who saved layout before we added span)
            return found ? { ...def, ...found, span: found.span || def.span } : def;
          });
          // Also append any saved widgets that might have been reordered
          const ordered = parsed.map((p: any) => merged.find(m => m.id === p.id)).filter(Boolean);
          const missing = merged.filter(m => !ordered.find((o: any) => o.id === m.id));
          setLayout([...ordered, ...missing]);
        } catch (e) {
          console.error("Error parsing dashboard layout", e);
        }
      } else {
        // First time, build with plugins
        const withPlugins = [...defaultLayout];
        plugins.forEach(plugin => {
            if (plugin.dashboardWidget && !withPlugins.some(w => w.id === `plugin_${plugin.id}`)) {
                withPlugins.push({ id: `plugin_${plugin.id}`, visible: true, span: 4 });
            }
        });
        setLayout(withPlugins);
      }
    }
  }, [user.id, user.rol, user.dashboardLayout]);

  const handleSaveLayout = async () => {
    try {
        if (!user || user.rol !== Rol.ADMINISTRADOR) return;
        setIsEditingLayout(false);
        await updateUsuario({ ...user, dashboardLayout: layout });
        showNotification("Layout guardado en la base de datos.", "success");
    } catch (error) {
        showNotification("Error guardando layout.", "error");
    }
  };

  const toggleWidgetVisibility = (id: string) => {
    setLayout(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const updateWidgetSpan = (id: string, newSpan: number) => {
    if (newSpan < 1 || newSpan > 4) return;
    setLayout(prev => prev.map(w => w.id === id ? { ...w, span: newSpan } : w));
  };

  const spanClasses: Record<number, string> = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
  };

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
    'hoy': <StatsCard title="Hoy" stats={dailyStats} productos={productos} />,
    'ayer': <StatsCard title="Ayer" stats={yesterdayStats} productos={productos} />,
    'semana': <StatsCard title="Esta Semana" stats={weeklyStats} productos={productos} />,
    'mes': <StatsCard title="Este Mes" stats={monthlyStats} productos={productos} />,
    'mes_anterior': <StatsCard title="Mes Anterior" stats={lastMonthStats} productos={productos} />
  };

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
                    gastos={gastos}
                    remitos={remitos}
                    productosMap={productosMap} 
                    onOpenStockPurchase={handleOpenStockPurchase} // AHORA: Retiro de Mercadería (vía Remito)
                    onOpenPago={handleOpenPago}
                />
            </div>
        )}

        {/* MODAL REMITO COMPARTIDO (Internos y Externos) */}
        {isRemitoModalOpen && (
            <Modal isOpen={isRemitoModalOpen} onClose={() => setIsRemitoModalOpen(false)}>
                <RemitoForm 
                    remito={newRemitoData} 
                    clientes={visibleClientes} 
                    vendedores={usuarios} 
                    productos={productos} 
                    currentUser={user} 
                    onSave={handleSaveRemito} 
                    onAddCliente={handleAddClienteWrapper} 
                    onClose={() => setIsRemitoModalOpen(false)} 
                    remitos={remitos} 
                    registrosPago={registrosPago} 
                    causasRecambio={causasRecambio}
                    facturas={facturas}
                    onAddPagoToFactura={addPagoToFactura}
                />
            </Modal>
        )}

        {/* MODAL PAGO CAJA (Para Externos) */}
        {isPagoModalOpen && (
            <Modal isOpen={isPagoModalOpen} onClose={() => setIsPagoModalOpen(false)} className="max-w-4xl">
                <CajaUnifiedForm 
                    initialType="VENTA"
                    productos={productos}
                    clientes={visibleClientes}
                    vendedores={usuarios}
                    currentUser={user!}
                    remitos={remitos}
                    registrosPago={registrosPago}
                    causasRecambio={[]}
                    onSaveRemito={handleSaveRemito}
                    onSaveGasto={addGasto}
                    onAddCliente={handleAddClienteWrapper}
                    onClose={() => setIsPagoModalOpen(false)}
                />
            </Modal>
        )}

      </>
  );

  // If the user's role uniquely maps to a plugin, maybe we render it. But for now Soplador is hardcoded because it's a root role.
  if (user.rol === Rol.SOPLADOR) {
      const sopladoPlugin = plugins.find(p => p.id === 'soplado');
      const isEnabled = sopladoPlugin?.isEnabled ? sopladoPlugin.isEnabled(empresaSettings) : true;
      const Widget = sopladoPlugin?.dashboardWidget;
      
    return (
      <div className="space-y-6 pt-12 md:pt-0 pb-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Panel de Especialista</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Bienvenido, {user.nombre}</p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl shadow-sm border-2 border-primary-100 dark:border-primary-900/30">
            <Calendar className="h-5 w-5 text-primary-600" />
            <span className="font-bold text-sm uppercase tracking-tighter">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</span>
          </div>
        </header>

        {isEnabled && Widget ? (
          <PluginErrorBoundary 
            pluginName={sopladoPlugin?.name || 'Módulo'} 
            onCatch={(error) => {
              if (addLog) {
                  addLog({
                      fecha: new Date().toISOString(),
                      usuario: 'Sistema',
                      accion: 'ERROR_PLUGIN',
                      detalle: `Falló widget Especialista: ${error.message}`
                  }).catch(() => {});
              }
            }}
          >
            <Widget onAction={handleSopladoAction} />
          </PluginErrorBoundary>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-tight">
                El módulo requerido está desactivado. Contacte al administrador.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (user.rol === Rol.REPARTIDOR) return vendorDashboard;

  // 3. DASHBOARD ADMINISTRADOR
  
  // Collect enabled dynamic plugin widgets
  const pluginWidgets: Record<string, React.ReactNode> = {};
  
  if (user.rol === Rol.ADMINISTRADOR) {
      plugins.forEach(plugin => {
          if (plugin.dashboardWidget) {
              const isEnabled = plugin.isEnabled ? plugin.isEnabled(empresaSettings) : true;
              if (isEnabled) {
                  const Widget = plugin.dashboardWidget;
                  pluginWidgets[`plugin_${plugin.id}`] = (
                      <PluginErrorBoundary 
                          pluginName={plugin.name}
                          onCatch={(error, info) => {
                              try {
                                  if (addLog) {
                                      addLog({
                                          fecha: new Date().toISOString(),
                                          usuario: 'Sistema',
                                          accion: 'ERROR_PLUGIN',
                                          detalle: `Falló widget ${plugin.name}: ${error.message}`
                                      }).catch(() => {});
                                  }
                                  console.error("Plugin failed in dashboard:", plugin.id, error);
                              } catch(e) {}
                          }}
                      >
                         <div className="h-full w-full">
                           <Widget />
                         </div>
                      </PluginErrorBoundary>
                  );
              }
          }
      });
  }

  // Define all possible widgets
  const isWidgetEnabled = (id: string) => {
      if (id.startsWith('plugin_')) {
          return pluginWidgets[id] !== undefined;
      }
      return true;
  };

  const widgets: Record<string, React.ReactNode> = {
    ...pluginWidgets,
    caja_efectivo: (
      <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-green-100 dark:border-green-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02] h-full">
          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Efectivo Total</p>
          <p className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoEfectivo.toLocaleString('es-AR')}</p>
      </div>
    ),
    caja_bancos: (
      <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02] h-full">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Caja Virtual / Bancos</p>
          <p className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoOtros.toLocaleString('es-AR')}</p>
      </div>
    ),
    entregas_consolidadas: (
      <div className="h-full w-full">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Entregas Consolidadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            {metricsOrder.map(key => <div key={key}>{metricsComponents[key]}</div>)}
        </div>
      </div>
    ),
    evolucion_diaria: (
      <div className="h-full w-full">
          <Card title="Evolución Diaria (Mes Actual vs Anterior)">
              <div className="px-4 pb-4">
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtro de Productos</p>
                        <div className="flex gap-4 text-[9px] font-bold uppercase tracking-tighter">
                            <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-current opacity-100"></div> Mes Actual</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-0.5 border-b border-dashed opacity-50"></div> Mes Anterior</div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {returnableProductNames.map(name => {
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
                                    {shortName(name).toUpperCase()}
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
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                          {returnableProductNames.filter(name => visibleProducts.includes(name)).flatMap(name => [
                              <Line key={`${name}-act`} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={3} dot={false} name={shortName(name)} />,
                              <Line key={`${name}-ant`} type="monotone" dataKey={`${name} Mes Ant`} stroke={productColors[name]} strokeWidth={2} strokeDasharray="5 5" dot={false} name={`${shortName(name)} (Ant)`} opacity={0.4} />
                          ])}
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </Card>
      </div>
    ),
    stock_planta: (
      <div className="h-full w-full">
          <Card title="Stock Permanente en Planta">
              <div className="overflow-y-auto max-h-[420px] pr-2">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-3">Productos y Envases en Fábrica</p>
                  {productos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).length > 0 ? (
                      <table className="w-full text-sm">
                          <thead className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              <tr>
                                  <th className="py-2 text-left">Producto</th>
                                  <th className="py-2 text-right">Llenos</th>
                                  <th className="py-2 text-right">Vacíos</th>
                              </tr>
                          </thead>
                          <tbody>
                              {productos
                                .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
                                .map(p => (
                                  <tr key={p.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                      <td className="py-3 text-gray-600 dark:text-gray-300 font-medium text-xs">{p.abreviatura || p.nombre}</td>
                                      <td className="py-3 text-right font-black text-blue-600 dark:text-blue-400 text-base">{p.stockPlanta || 0}</td>
                                      <td className="py-3 text-right font-black text-yellow-600 dark:text-yellow-400 text-base">{p.tipo === TipoProducto.RETORNABLE ? (p.stockEnvases || 0) : '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-40 opacity-40">
                          <p className="text-xs font-bold uppercase">Sin productos registrados</p>
                      </div>
                  )}
              </div>
          </Card>
      </div>
    ),
    stock_calle: (
      <div className="h-full w-full">
          <Card title="Stock en Poder de Clientes">
              <div className="overflow-y-auto max-h-[420px] pr-2">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-3">Activos pendientes de devolución</p>
                  {stockEnCalle.length > 0 ? (
                      <table className="w-full text-sm">
                          <tbody>
                              {stockEnCalle.map(([name, count]) => (
                                  <tr key={name} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                      <td className="py-3 text-gray-600 dark:text-gray-300 font-medium text-xs">{shortName(name)}</td>
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
    ),
    volumen_ventas: (
      <div className="h-full w-full">
          <Card title="Volumen de Ventas (Histórico 12 Meses)">
              <div className="h-80 px-2">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlySalesVolumeChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                          <Legend iconType="circle" formatter={(v) => v} />
                          
                          {returnableProductNames.filter(name => visibleProducts.includes(name)).map(name => {
                              return <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={3} dot={{ r: 4 }} name={shortName(name)} animationDuration={1000} />;
                          })}
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </Card>
      </div>
    ),
    ventas_descartables: (
      <div className="h-full w-full">
          <Card title="Ventas Productos Descartables">
              <div className="h-80 px-2">
                  {nonReturnableMonthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={nonReturnableMonthlyData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                              <Tooltip contentStyle={lightTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                              <Legend verticalAlign="top" height={36} />
                              <Area dataKey="actual" name="Mes Actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                              <Area dataKey="anterior" name="Mes Anterior" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.3} />
                          </AreaChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-400 text-xs uppercase font-black">Sin ventas descartables</div>
                  )}
              </div>
          </Card>
      </div>
    ),
    comisiones: (
      <div className="h-full w-full">
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
    ),
    vendedores_externos: (
      <div className="h-full w-full">
          <Card title="Vendedores Externos">
              <div className="h-80 w-full">
                  {externalVendorsBarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={externalVendorsBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} />
                              <Tooltip contentStyle={lightTooltipStyle} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                              {allExternalProducts.map((pName, index) => (
                                  <Bar key={pName} dataKey={pName} stackId="a" fill={PIE_COLORS[index % PIE_COLORS.length]} radius={index === allExternalProducts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                              ))}
                          </BarChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-40">
                          <p className="text-xs font-bold uppercase">Sin ventas externas</p>
                      </div>
                  )}
              </div>
          </Card>
      </div>
    ),
    ruta_reparto: (
      <div className="h-full w-full">
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
    )
  };

  return (
    <div className="space-y-8 pt-12 md:pt-0 pb-12">
      {ojoMagicoAlert && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">✨ ¡Éxito! </strong>
              <span className="block sm:inline">{ojoMagicoAlert}</span>
              <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setOjoMagicoAlert(null)}>
                  <svg className="fill-current h-6 w-6 text-green-500 cursor-pointer" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Cerrar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </span>
          </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Dashboard Operativo</h1>
        <button 
          onClick={() => {
              if (isEditingLayout) {
                  handleSaveLayout();
              } else {
                  setIsEditingLayout(true);
              }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            isEditingLayout 
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {isEditingLayout ? <><X className="w-4 h-4" /> Guardar Edición</> : <><Settings2 className="w-4 h-4" /> Personalizar</>}
        </button>
      </div>

      {/* Hidden Widgets Tray (Only visible when editing) */}
      <AnimatePresence>
        {isEditingLayout && layout.some(w => !w.visible && isWidgetEnabled(w.id)) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-4 border-2 border-dashed border-gray-300 dark:border-gray-700"
          >
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Widgets Ocultos</p>
            <div className="flex flex-wrap gap-2">
              {layout.filter(w => !w.visible && isWidgetEnabled(w.id)).map(w => (
                <button
                  key={w.id}
                  onClick={() => toggleWidgetVisibility(w.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {w.id.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReactSortable 
        list={layout.filter(item => (item.visible || isEditingLayout) && isWidgetEnabled(item.id))} 
        setList={(newList) => {
          const updated = layout.map(item => {
            const found = newList.find(n => n.id === item.id);
            return found ? { ...item, span: found.span } : item;
          });
          const sorted = [...updated].sort((a, b) => {
             const indexA = newList.findIndex(n => n.id === a.id);
             const indexB = newList.findIndex(n => n.id === b.id);
             if (indexA === -1 && indexB === -1) return 0;
             if (indexA === -1) return 1;
             if (indexB === -1) return -1;
             return indexA - indexB;
          });
          setLayout(sorted);
        }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
        animation={200}
        disabled={!isEditingLayout}
        ghostClass="opacity-50"
        handle=".drag-handle"
      >
        {layout.filter(item => (item.visible || isEditingLayout) && isWidgetEnabled(item.id)).map((item) => {
          
          return (
            <div 
              key={item.id} 
              className={`relative ${spanClasses[item.span || 1]} ${!item.visible ? 'opacity-50 grayscale' : ''}`}
            >
              {isEditingLayout && (
                <div className="absolute -top-3 -right-3 z-20 flex gap-1">
                  <div className="flex bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden mr-2">
                    <button 
                      onClick={() => updateWidgetSpan(item.id, (item.span || 1) - 1)}
                      disabled={(item.span || 1) <= 1}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      title="Reducir ancho"
                    >-</button>
                    <div className="px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 border-x border-gray-200 dark:border-gray-700 flex items-center justify-center min-w-[3ch]">
                      {item.span || 1}/4
                    </div>
                    <button 
                      onClick={() => updateWidgetSpan(item.id, (item.span || 1) + 1)}
                      disabled={(item.span || 1) >= 4}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      title="Aumentar ancho"
                    >+</button>
                  </div>

                  <button 
                    onClick={() => toggleWidgetVisibility(item.id)}
                    className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 transition-colors"
                    title={item.visible ? "Ocultar widget" : "Mostrar widget"}
                  >
                    {item.visible ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              )}
              
              {isEditingLayout && (
                <div className="drag-handle absolute inset-0 z-10 bg-primary-500/5 dark:bg-primary-500/10 border-2 border-dashed border-primary-500/50 rounded-3xl cursor-grab active:cursor-grabbing flex items-center justify-center">
                  <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm font-black text-xs text-primary-600 uppercase tracking-widest opacity-0 hover:opacity-100 transition-opacity">
                    Arrastrar para mover
                  </div>
                </div>
              )}
              
              <div className={`h-full w-full ${isEditingLayout ? 'pointer-events-none' : ''}`}>
                {widgets[item.id]}
              </div>
            </div>
          );
        })}
      </ReactSortable>
    </div>
  );
};

export default DashboardView;
