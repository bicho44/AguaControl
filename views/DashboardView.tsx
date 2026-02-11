
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Card from '../components/Card';
import { Remito, Producto, TipoProducto, RegistroPago, Gasto, MetodoPago, Usuario, Cliente, VentaVendedor, DiaSemana, EmpresaSettings } from '../types';
import LeafletMap from '../components/LeafletMap';

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

interface ProductFilterProps {
    products: string[];
    visibleProducts: string[];
    colors: { [key: string]: string };
    onToggle: (name: string) => void;
}

const ProductFilter: React.FC<ProductFilterProps> = ({ products, visibleProducts, colors, onToggle }) => (
    <div className="px-4 pb-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Filtro de Productos en Gráficos</p>
        <div className="flex flex-wrap gap-2">
            {products.map(name => {
                const isVisible = visibleProducts.includes(name);
                return (
                    <button
                        key={name}
                        onClick={() => onToggle(name)}
                        className={`px-3 py-1.5 text-[11px] font-black rounded-xl border transition-all duration-200 flex items-center gap-2 ${
                            isVisible 
                            ? 'text-white shadow-md scale-105' 
                            : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700/50 dark:text-gray-500 dark:border-gray-700 opacity-60 grayscale'
                        }`}
                        style={{ 
                            backgroundColor: isVisible ? colors[name] : undefined,
                            borderColor: isVisible ? colors[name] : undefined
                        }}
                    >
                        <div className="w-2 h-2 rounded-full bg-white/40"></div>
                        {name.toUpperCase()}
                    </button>
                );
            })}
        </div>
    </div>
);


const DashboardView: React.FC<DashboardViewProps> = ({ remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings }) => {
  const productosMap = useMemo(() => new Map<string, Producto>(productos.map(p => [p.id, p])), [productos]);
  
  // Extraer nombres de productos consumibles
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

  // Efecto para sincronizar visibilidad con nuevos productos de la DB
  useEffect(() => {
      try {
          const saved = localStorage.getItem('dashboard_visible_products');
          const savedList = saved ? JSON.parse(saved) : [];
          
          // Si no hay nada guardado, mostramos todos
          if (savedList.length === 0) {
              setVisibleProducts(consumableProductNames);
              return;
          }

          // Merge: Mantener los que estaban, y agregar los nuevos de la DB que no estaban en la lista guardada
          const merged = [...new Set([...savedList, ...consumableProductNames])];
          // Pero filtrar solo los que realmente existen ahora en la DB
          const currentValid = merged.filter(name => consumableProductNames.includes(name));
          setVisibleProducts(currentValid);
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

  const calculateStatsForPeriod = (remitosToProcess: Remito[]) => {
    const byProduct = remitosToProcess.reduce((acc, remito) => {
        if (!remito.movimientos) return acc;
        remito.movimientos.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) {
                acc[producto.nombre] = (acc[producto.nombre] || 0) + (mov.entregados || 0);
            }
        });
        return acc;
    }, {} as { [key: string]: number });
    return { byProduct };
  };

  // Función robusta para parsear fechas de Firestore (YYYY-MM-DD)
  const parseDate = (dateString: string) => {
      if (!dateString) return new Date(0);
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0);
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
    currentMonthDailySalesData
  } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startOfWeek = new Date(today);
    // Ajustar al lunes de esta semana
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

    const dailyRemitos = remitos.filter(r => parseDate(r.fecha).getTime() === today.getTime());
    const yesterdayRemitos = remitos.filter(r => parseDate(r.fecha).getTime() === yesterday.getTime());
    const weeklyRemitos = remitos.filter(r => parseDate(r.fecha) >= startOfWeek);
    const monthlyRemitos = remitos.filter(r => parseDate(r.fecha) >= startOfMonth);
    const lastMonthRemitos = remitos.filter(r => { 
        const d = parseDate(r.fecha); 
        return d >= startOfLastMonth && d <= endOfLastMonth; 
    });

    // Saldos de Caja (Reales de registrosPago de Firebase)
    let sEfectivo = 0;
    let sOtros = 0;
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

    // Gráfico de Volumen de Ventas (12 meses)
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const salesByProductData: Record<string, { name: string; values: Record<string, number> }> = {};
    const salesByTypeDataStructure: Record<string, { name: string; values: Record<string, number> }> = {};

    for (let i = 0; i < 12; i++) {
        const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
        
        const monthValues: Record<string, number> = {};
        const monthValuesByType: Record<string, number> = {};
        
        consumableProductNames.forEach(pName => {
            monthValues[pName] = 0;
            monthValuesByType[`Int. - ${pName}`] = 0;
            monthValuesByType[`Ext. - ${pName}`] = 0;
        });
        salesByProductData[monthKey] = { name: monthName, values: monthValues };
        salesByTypeDataStructure[monthKey] = { name: monthName, values: monthValuesByType };
    }

    // Ventas Internas (Remitos)
    remitos.forEach(r => {
        const d = parseDate(r.fecha);
        if (d >= twelveMonthsAgo) {
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (salesByProductData[monthKey]) {
                r.movimientos?.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) {
                        salesByProductData[monthKey].values[prod.nombre] += (m.entregados || 0);
                        salesByTypeDataStructure[monthKey].values[`Int. - ${prod.nombre}`] += (m.entregados || 0);
                    }
                });
            }
        }
    });

    // Ventas Externas (VentasVendedor)
    ventasVendedor.forEach(v => {
        const d = parseDate(v.fecha);
        if (d >= twelveMonthsAgo) {
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (salesByProductData[monthKey]) {
                v.movimientos?.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && consumableProductNames.includes(prod.nombre)) {
                        salesByProductData[monthKey].values[prod.nombre] += (m.cantidad || 0);
                        salesByTypeDataStructure[monthKey].values[`Ext. - ${prod.nombre}`] += (m.cantidad || 0);
                    }
                });
            }
        }
    });

    const monthlySalesVolumeChartData = Object.values(salesByProductData).map(data => ({ name: data.name, ...data.values }));
    const monthlySalesByTypeData = Object.values(salesByTypeDataStructure).map(data => ({ name: data.name, ...data.values }));
    
    // Evolución Diaria (Mes Actual)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentMonthDailyData: Record<string, { name: string; values: Record<string, number> }> = {};

    for (let i = 1; i <= daysInMonth; i++) {
        const dayKey = i.toString();
        const dayValues: Record<string, number> = {};
        consumableProductNames.forEach(pName => {
            dayValues[`Int. - ${pName}`] = 0;
            dayValues[`Ext. - ${pName}`] = 0;
        });
        currentMonthDailyData[dayKey] = { name: i.toString(), values: dayValues };
    }

    monthlyRemitos.forEach(r => {
        const d = parseDate(r.fecha);
        const dayKey = d.getDate().toString();
        r.movimientos?.forEach(m => {
            const prod = productosMap.get(m.productoId);
            if (prod && consumableProductNames.includes(prod.nombre)) {
                if (currentMonthDailyData[dayKey]) {
                    currentMonthDailyData[dayKey].values[`Int. - ${prod.nombre}`] += (m.entregados || 0);
                }
            }
        });
    });

    ventasVendedor.filter(v => parseDate(v.fecha) >= startOfMonth).forEach(v => {
        const d = parseDate(v.fecha);
        const dayKey = d.getDate().toString();
        v.movimientos?.forEach(m => {
            const prod = productosMap.get(m.productoId);
            if (prod && consumableProductNames.includes(prod.nombre)) {
                 if (currentMonthDailyData[dayKey]) {
                    currentMonthDailyData[dayKey].values[`Ext. - ${prod.nombre}`] += (m.cantidad || 0);
                 }
            }
        });
    });

    const currentMonthDailySalesData = Object.values(currentMonthDailyData).map(data => ({ name: data.name, ...data.values }));

    return {
        dailyStats: calculateStatsForPeriod(dailyRemitos),
        yesterdayStats: calculateStatsForPeriod(yesterdayRemitos),
        weeklyStats: calculateStatsForPeriod(weeklyRemitos),
        monthlyStats: calculateStatsForPeriod(monthlyRemitos),
        lastMonthStats: calculateStatsForPeriod(lastMonthRemitos),
        saldoEfectivo: sEfectivo,
        saldoOtros: sOtros,
        monthlySalesVolumeChartData,
        monthlySalesByTypeData,
        currentMonthDailySalesData
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, consumableProductNames]);


  // Mapa
  const [mapMarkers, setMapMarkers] = useState<{ lat: number, lng: number, title: string }[]>([]);
  const [todayName, setTodayName] = useState<string>('');
  const [routeLine, setRouteLine] = useState<{ lat: number, lng: number }[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);

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
    setRouteLine([]);
    setIsOptimized(false);
    setTotalDistance(null);
  }, [clientes, empresaSettings]);

  const getDistance = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
      const R = 6371e3;
      const φ1 = p1.lat * Math.PI/180;
      const φ2 = p2.lat * Math.PI/180;
      const Δφ = (p2.lat-p1.lat) * Math.PI/180;
      const Δλ = (p2.lng-p1.lng) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  const optimizeRoute = () => {
    if (mapMarkers.length < 2) return;
    let depot = mapMarkers[0];
    let unvisited = mapMarkers.slice(1);
    const optimizedPath = [];
    const orderedMarkers = [];
    let calcDistance = 0;
    let current = depot;
    optimizedPath.push({ lat: current.lat, lng: current.lng });
    orderedMarkers.push(current);

    while (unvisited.length > 0) {
        let nearestIndex = -1;
        let minDistance = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
            const dist = getDistance(current, unvisited[i]);
            if (dist < minDistance) { minDistance = dist; nearestIndex = i; }
        }
        if (nearestIndex !== -1) {
            const nearest = unvisited[nearestIndex];
            optimizedPath.push({ lat: nearest.lat, lng: nearest.lng });
            orderedMarkers.push(nearest);
            calcDistance += minDistance;
            current = nearest;
            unvisited.splice(nearestIndex, 1);
        }
    }
    optimizedPath.push({ lat: depot.lat, lng: depot.lng });
    calcDistance += getDistance(current, depot);
    setMapMarkers(orderedMarkers);
    setRouteLine(optimizedPath);
    setIsOptimized(true);
    setTotalDistance(calcDistance / 1000);
  };

  // Drag and Drop Orden
  const [metricsOrder, setMetricsOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_metrics_order');
    return saved ? JSON.parse(saved) : ['hoy', 'ayer', 'semana', 'mes', 'mes_anterior'];
  });

  const [chartsOrder, setChartsOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_charts_order');
    return saved ? JSON.parse(saved) : ['mapa_reparto', 'sales_volume', 'internal_vs_external', 'daily_evolution'];
  });

  const draggingItem = useRef<string | null>(null);
  const draggingItemType = useRef<'metric' | 'chart' | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string, type: 'metric' | 'chart') => {
    draggingItem.current = id;
    draggingItemType.current = type;
    (e.target as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    draggingItem.current = null;
    draggingItemType.current = null;
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string, type: 'metric' | 'chart') => {
    if (draggingItem.current === targetId || draggingItemType.current !== type) return;
    if (type === 'metric') {
        setMetricsOrder(prev => {
            const newOrder = [...prev];
            const draggedIdx = newOrder.indexOf(draggingItem.current!);
            const targetIdx = newOrder.indexOf(targetId);
            newOrder.splice(draggedIdx, 1);
            newOrder.splice(targetIdx, 0, draggingItem.current!);
            localStorage.setItem('dashboard_metrics_order', JSON.stringify(newOrder));
            return newOrder;
        });
    } else {
        setChartsOrder(prev => {
            const newOrder = [...prev];
            const draggedIdx = newOrder.indexOf(draggingItem.current!);
            const targetIdx = newOrder.indexOf(targetId);
            newOrder.splice(draggedIdx, 1);
            newOrder.splice(targetIdx, 0, draggingItem.current!);
            localStorage.setItem('dashboard_charts_order', JSON.stringify(newOrder));
            return newOrder;
        });
    }
  };

  const metricsComponents: Record<string, React.ReactNode> = {
    'hoy': <StatsCard title="Hoy" stats={dailyStats} />,
    'ayer': <StatsCard title="Ayer" stats={yesterdayStats} />,
    'semana': <StatsCard title="Esta Semana" stats={weeklyStats} />,
    'mes': <StatsCard title="Este Mes" stats={monthlyStats} />,
    'mes_anterior': <StatsCard title="Mes Anterior" stats={lastMonthStats} />
  };

  const chartsComponents: Record<string, React.ReactNode> = {
      'mapa_reparto': (
         <Card title={`Ruta Programada: ${todayName}`}>
            <div className="p-2">
                {mapMarkers.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                {mapMarkers.length} Puntos Georeferenciados.
                            </p>
                            <button 
                                onClick={optimizeRoute} 
                                disabled={isOptimized}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full transition-all ${
                                    isOptimized 
                                    ? 'bg-green-100 text-green-700 cursor-default' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                }`}
                            >
                                {isOptimized ? 'Ruta Optimizada ✓' : 'Optimizar Recorrido'}
                            </button>
                        </div>
                        {isOptimized && totalDistance !== null && (
                            <p className="text-xs text-gray-500 mb-3 font-medium">
                                Recorrido estimado: <span className="font-black text-gray-800 dark:text-white">{totalDistance.toFixed(1)} km</span>.
                            </p>
                        )}
                        <LeafletMap markers={mapMarkers} height="400px" route={routeLine} />
                    </>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                         <svg className="w-8 h-8 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m-6 10v-5m6 5v-5m0 0l-6-3" /></svg>
                        <p className="text-[10px] font-black uppercase tracking-tighter">Sin repartos programados para hoy</p>
                    </div>
                )}
            </div>
         </Card>
      ),
      'sales_volume': (
        <Card title="Volumen de Ventas (Histórico 12 Meses)">
            <ProductFilter products={consumableProductNames} visibleProducts={visibleProducts} colors={productColors} onToggle={toggleProductVisibility} />
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySalesVolumeChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                        <Legend iconType="circle" />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={3} dot={{ r: 4 }} name={name} animationDuration={1000} />;
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      ),
      'internal_vs_external': (
        <Card title="Carga Propia vs Reventa (Comparativa Anual)">
            <ProductFilter products={consumableProductNames} visibleProducts={visibleProducts} colors={productColors} onToggle={toggleProductVisibility} />
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySalesByTypeData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                        <Legend iconType="circle" />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return (
                                <React.Fragment key={name}>
                                    <Line type="monotone" dataKey={`Int. - ${name}`} stroke={productColors[name]} strokeWidth={4} dot={{ r: 3 }} name={`Carga - ${name}`} />
                                    <Line type="monotone" dataKey={`Ext. - ${name}`} stroke={productColors[name]} strokeWidth={2} strokeDasharray="6 6" dot={{ r: 3, fill: 'white' }} name={`Reventa - ${name}`} />
                                </React.Fragment>
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      ),
      'daily_evolution': (
        <Card title="Evolución Diaria del Mes">
            <ProductFilter products={consumableProductNames} visibleProducts={visibleProducts} colors={productColors} onToggle={toggleProductVisibility} />
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentMonthDailySalesData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '1rem', color: '#fff' }} labelFormatter={(l) => `Día ${l}`} />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return (
                                <React.Fragment key={name}>
                                    <Line type="monotone" dataKey={`Int. - ${name}`} stroke={productColors[name]} strokeWidth={3} dot={false} name={`Carga - ${name}`} />
                                    <Line type="monotone" dataKey={`Ext. - ${name}`} stroke={productColors[name]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={`Reventa - ${name}`} />
                                </React.Fragment>
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      )
  }

  return (
    <div className="space-y-8 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Dashboard</h1>
      
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-green-100 dark:border-green-900/30 shadow-xl shadow-green-500/5 flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
                <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-1">Efectivo en Caja</p>
                <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">
                    ${saldoEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-100 dark:border-blue-900/30 shadow-xl shadow-blue-500/5 flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Otros Medios / Virtual</p>
                <p className="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">
                     ${saldoOtros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
            </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Resumen de Unidades Entregadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {metricsOrder.map(key => (
                <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key, 'metric')}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, key, 'metric')}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move transition-transform duration-200 active:scale-95"
                >
                    {metricsComponents[key]}
                </div>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Analítica y Logística</h2>
        <div className="space-y-6">
            {chartsOrder.map(key => (
                <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key, 'chart')}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, key, 'chart')}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move transition-all duration-300"
                >
                    {chartsComponents[key]}
                </div>
            ))}
        </div>
      </div>
        
    </div>
  );
};

export default DashboardView;
