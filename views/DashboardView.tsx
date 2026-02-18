import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import Card from '../components/Card';
import Modal from '../components/Modal';
import AppButton from '../components/ui/AppButton';
import SearchableSelect from '../components/SearchableSelect';
import { Remito, Producto, TipoProducto, RegistroPago, Gasto, MetodoPago, Usuario, Cliente, VentaVendedor, DiaSemana, EmpresaSettings, TipoVendedor, Rol } from '../types';
import LeafletMap from '../components/LeafletMap';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  remitos: Remito[];
  productos: Producto[];
  registrosPago: RegistroPago[];
  gastos: Gasto[];
  usuarios: Usuario[];
  clientes: Cliente[];
  ventasVendedor: VentaVendedor[];
  empresaSettings?: EmpresaSettings;
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
const InternalVendorDashboard: React.FC<{ user: Usuario, remitos: Remito[], productosMap: Map<string, Producto> }> = ({ user, remitos, productosMap }) => {
    // Filtrar remitos del vendedor
    const misRemitos = useMemo(() => remitos.filter(r => r.vendedorId === user.id && !r.esAjuste), [remitos, user.id]);
    
    // Cálculo de Comisiones (Mes Actual)
    const { entregasTotal, comisionEstimada, chartData } = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Fix: Use getTime() for numeric comparison to avoid TS errors
        const remitosMes = misRemitos.filter(r => new Date(r.fecha).getTime() >= startOfMonth.getTime());
        
        let totalEntregado = 0;
        let totalComision = 0;
        const dataPorDia: Record<string, number> = {};

        // Mapa rápido de comisiones por producto
        const comisionesMap = new Map<string, number>();
        user.comisiones?.forEach(c => comisionesMap.set(c.productoId, c.monto));

        remitosMes.forEach(r => {
            const day = new Date(r.fecha + 'T00:00:00').getDate();
            if (!dataPorDia[day]) dataPorDia[day] = 0;

            r.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                // Si hay comisión específica, usarla. Si no, 0.
                const comisionRate = comisionesMap.get(m.productoId) || 0;
                
                if (prod && prod.tipo === TipoProducto.RETORNABLE) {
                    totalEntregado += m.entregados;
                    dataPorDia[day] += m.entregados;
                    totalComision += m.entregados * comisionRate;
                }
            });
        });
        
        // Formatear para gráfico
        const chart = Object.keys(dataPorDia).map(day => ({ name: `Día ${day}`, entregas: dataPorDia[day] }));

        return { entregasTotal: totalEntregado, comisionEstimada: totalComision, chartData: chart };
    }, [misRemitos, productosMap, user.comisiones]);

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                Rendimiento: <span className="text-primary-600">{user.nombre}</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Envases Entregados</p>
                        <p className="text-5xl font-black text-blue-600">{entregasTotal}</p>
                        <p className="text-xs text-gray-400 mt-2">Productos Retornables</p>
                    </div>
                </Card>
                <Card>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Comisión Estimada</p>
                        <p className="text-5xl font-black text-green-600">${comisionEstimada.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-2">Calculada según configuración</p>
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
const ExternalVendorDashboard: React.FC<{ user: Usuario, ventas: VentaVendedor[], pagos: RegistroPago[], productosMap: Map<string, Producto> }> = ({ user, ventas, pagos, productosMap }) => {
    const misVentas = useMemo(() => ventas.filter(v => v.vendedorId === user.id), [ventas, user.id]);
    
    const { totalComprado, totalPagado, saldoPendiente, historial } = useMemo(() => {
        let comprado = 0;
        const historialCombinado: any[] = [];

        // 1. Sumar Compras (VentaVendedor)
        misVentas.forEach(v => {
            let totalVenta = 0;
            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    // Lógica de precio: Usar precio especial del vendedor si existe, sino precio reventa, sino precio lista
                    const precioEsp = user.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;
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
        // Buscamos pagos donde: origen.tipo === 'venta_vendedor' Y vendedorId === user.id
        // O pagos manuales asignados a este vendedor.
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

        return { totalComprado: comprado, totalPagado: pagado, saldoPendiente: deuda, historial: historialCombinado };
    }, [misVentas, pagos, user.id, productosMap, user.preciosEspeciales]);

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">
                Cuenta Corriente: <span className="text-primary-600">{user.nombre}</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Comprado</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">${totalComprado.toLocaleString()}</p>
                    </div>
                </Card>
                <Card>
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Pagado</p>
                        <p className="text-2xl font-bold text-green-600">${totalPagado.toLocaleString()}</p>
                    </div>
                </Card>
                <div className={`p-6 rounded-2xl border-2 shadow-xl flex flex-col items-center justify-center transition-all ${saldoPendiente > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Pendiente (Deuda)</p>
                    <p className={`text-4xl font-black tracking-tighter ${saldoPendiente > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>${saldoPendiente.toLocaleString()}</p>
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
                                    <td className="px-4 py-3 font-mono text-xs">{new Date(h.fecha + 'T00:00:00').toLocaleDateString()}</td>
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

const DashboardView: React.FC<DashboardViewProps> = ({ remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings }) => {
  const { user } = useAuth(); // Obtenemos el usuario autenticado
  const [showDebtDetails, setShowDebtDetails] = useState(false);
  const [viewAsId, setViewAsId] = useState<string>(''); // Nuevo estado para "Ver como"

  const productosMap = useMemo(() => new Map<string, Producto>(productos.map(p => [p.id, p])), [productos]);
  const usuariosMap = useMemo(() => new Map<string, Usuario>(usuarios.map(u => [u.id, u])), [usuarios]);
  
  // --- LÓGICA COMPARTIDA PARA ADMIN DASHBOARD ---
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
    monthlySalesByTypeData,
    currentMonthDailySalesData,
    externalVendorsPieData,
    totalDeudaExterna,
    debtByVendor // Nueva estructura desglosada
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

    // CÁLCULO DEUDA EXTERNA GLOBAL & DESGLOSADA
    let deudaTotal = 0;
    const vendorDebts: Record<string, { id: string, name: string, bought: number, paid: number }> = {};

    ventasVendedor.forEach(v => {
        const vendor = usuariosMap.get(v.vendedorId);
        if (vendor?.tipo === TipoVendedor.EXTERNO) {
            if (!vendorDebts[v.vendedorId]) vendorDebts[v.vendedorId] = { id: v.vendedorId, name: vendor.nombre, bought: 0, paid: 0 };
            
            let totalVenta = 0;
            v.movimientos.forEach(m => {
                const prod = productosMap.get(m.productoId);
                if (prod) {
                    const precioEsp = vendor.preciosEspeciales?.find(p => p.productoId === m.productoId)?.precio;
                    const precioFinal = m.precioUnitario || precioEsp || prod.precioReventa || prod.precio;
                    totalVenta += m.cantidad * precioFinal;
                }
            });
            deudaTotal += totalVenta;
            vendorDebts[v.vendedorId].bought += totalVenta;
        }
    });
    // Restar pagos de vendedores externos
    registrosPago.forEach(p => {
        if (p.vendedorId) {
            const vendor = usuariosMap.get(p.vendedorId);
            if (vendor?.tipo === TipoVendedor.EXTERNO) {
                if (!vendorDebts[p.vendedorId]) vendorDebts[p.vendedorId] = { id: p.vendedorId, name: vendor.nombre, bought: 0, paid: 0 };
                deudaTotal -= p.monto;
                vendorDebts[p.vendedorId].paid += p.monto;
            }
        }
    });


    const monthlyHistoryData: any[] = [];
    const monthlyTypeData: any[] = [];
    
    for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthLabel = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthObj: any = { name: monthLabel, sortKey: monthKey };
        const typeObj: any = { name: monthLabel, sortKey: monthKey };
        consumableProductNames.forEach(pName => {
            monthObj[pName] = 0;
            typeObj[`Carga - ${pName}`] = 0;
            typeObj[`Caja - ${pName}`] = 0;
        });
        activeRemitos.forEach(r => {
            const d = parseLocalDate(r.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                r.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) {
                        monthObj[prod.nombre] += m.entregados;
                        typeObj[`Carga - ${prod.nombre}`] += m.entregados;
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
                        typeObj[`Caja - ${prod.nombre}`] += m.cantidad;
                    }
                });
            }
        });
        monthlyHistoryData.push(monthObj);
        monthlyTypeData.push(typeObj);
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

    return {
        dailyStats: calculateStatsForPeriod(dailyRemitos, dailyVentas),
        yesterdayStats: calculateStatsForPeriod(yesterdayRemitos, yesterdayVentas),
        weeklyStats: calculateStatsForPeriod(weeklyRemitos, weeklyVentas),
        monthlyStats: calculateStatsForPeriod(monthlyRemitos, monthlyVentas),
        lastMonthStats: calculateStatsForPeriod(lastMonthRemitos, lastMonthVentas),
        saldoEfectivo: sEfectivo,
        saldoOtros: sOtros,
        monthlySalesVolumeChartData: monthlyHistoryData,
        monthlySalesByTypeData: monthlyTypeData,
        currentMonthDailySalesData: dailyEvolutionData,
        externalVendorsPieData,
        totalDeudaExterna: deudaTotal,
        debtByVendor: Object.values(vendorDebts)
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, usuariosMap, consumableProductNames]);

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

  // LOGICA "IMPERSONATE" O DASHBOARD NORMAL
  let currentUserToRender = user;
  
  if (user.rol === Rol.ADMINISTRADOR && viewAsId) {
      const selectedUser = usuariosMap.get(viewAsId);
      if (selectedUser) currentUserToRender = selectedUser;
  }

  // 1. DASHBOARD REPARTIDOR INTERNO (O ADMIN VIENDO COMO INTERNO)
  if (currentUserToRender.rol === Rol.REPARTIDOR && currentUserToRender.tipo === TipoVendedor.INTERNO) {
      return (
        <div className="space-y-4 pt-12 md:pt-0">
            {user.rol === Rol.ADMINISTRADOR && (
                <div className="flex justify-end">
                    <button onClick={() => setViewAsId('')} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg hover:bg-gray-700 transition-all">
                        ← Volver a Vista Admin
                    </button>
                </div>
            )}
            <InternalVendorDashboard user={currentUserToRender} remitos={remitos} productosMap={productosMap} />
        </div>
      );
  }

  // 2. DASHBOARD REVENDEDOR EXTERNO (O ADMIN VIENDO COMO EXTERNO)
  if (currentUserToRender.rol === Rol.REPARTIDOR && currentUserToRender.tipo === TipoVendedor.EXTERNO) {
      return (
        <div className="space-y-4 pt-12 md:pt-0">
            {user.rol === Rol.ADMINISTRADOR && (
                <div className="flex justify-end">
                    <button onClick={() => setViewAsId('')} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg hover:bg-gray-700 transition-all">
                        ← Volver a Vista Admin
                    </button>
                </div>
            )}
            <ExternalVendorDashboard user={currentUserToRender} ventas={ventasVendedor} pagos={registrosPago} productosMap={productosMap} />
        </div>
      );
  }

  // 3. DASHBOARD ADMINISTRADOR (Original + Mejoras)
  return (
    <div className="space-y-8 pt-12 md:pt-0 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Dashboard Operativo</h1>
          
          <div className="w-full md:w-64">
              <SearchableSelect 
                  options={usuarios.filter(u => u.rol === Rol.REPARTIDOR).map(u => ({ value: u.id, label: `Ver como: ${u.nombre}` }))}
                  value={viewAsId}
                  onChange={setViewAsId}
                  placeholder="Administrador (Vista General)"
                  disableSort
              />
          </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-green-100 dark:border-green-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Efectivo Total</p>
              <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoEfectivo.toLocaleString('es-AR')}</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Caja Virtual / Bancos</p>
              <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${saldoOtros.toLocaleString('es-AR')}</p>
          </div>
          <div 
            onClick={() => setShowDebtDetails(true)}
            className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-orange-100 dark:border-orange-900/30 shadow-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02] cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10"
          >
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1">Cta. Cte. Revendedores <span className="text-[8px] bg-orange-200 text-orange-800 px-1 rounded">VER</span></p>
              <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${totalDeudaExterna.toLocaleString('es-AR')}</p>
          </div>
      </div>

      {showDebtDetails && (
          <Modal isOpen={showDebtDetails} onClose={() => setShowDebtDetails(false)} className="max-w-4xl">
              <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Estado de Cuenta de Revendedores</h2>
                      <AppButton variant="secondary" size="sm" onClick={() => setShowDebtDetails(false)}>Cerrar</AppButton>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                              <tr>
                                  <th className="px-4 py-3">Revendedor</th>
                                  <th className="px-4 py-3 text-right">Total Comprado</th>
                                  <th className="px-4 py-3 text-right">Total Pagado</th>
                                  <th className="px-4 py-3 text-right">Saldo (Deuda)</th>
                                  <th className="px-4 py-3 text-right">Acción</th>
                              </tr>
                          </thead>
                          <tbody>
                              {debtByVendor.map((d, i) => {
                                  const saldo = d.bought - d.paid;
                                  return (
                                      <tr key={i} className="border-b dark:border-gray-700">
                                          <td className="px-4 py-3 font-medium">{d.name}</td>
                                          <td className="px-4 py-3 text-right">${d.bought.toLocaleString()}</td>
                                          <td className="px-4 py-3 text-right text-green-600">${d.paid.toLocaleString()}</td>
                                          <td className={`px-4 py-3 text-right font-black ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                              ${saldo.toLocaleString()}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                              <button 
                                                onClick={() => { setShowDebtDetails(false); setViewAsId(d.id); }}
                                                className="text-xs text-blue-600 hover:underline font-bold"
                                              >
                                                  Ver Detalle
                                              </button>
                                          </td>
                                      </tr>
                                  );
                              })}
                              {debtByVendor.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">Sin deudas registradas.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>
          </Modal>
      )}

      <div>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Entregas Consolidadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {metricsOrder.map(key => <div key={key}>{metricsComponents[key]}</div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
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