
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
  empresaSettings?: EmpresaSettings; // Add settings prop
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
            <span className="text-gray-600 dark:text-gray-300 truncate pr-2">{name}</span>
            <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{value}</span>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-center h-[120px]">
          <p className="text-center text-sm text-gray-400">Sin entregas.</p>
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
    <div className="px-4 pb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Toque para mostrar/ocultar productos:</p>
        <div className="flex flex-wrap gap-2">
            {products.map(name => {
                const isVisible = visibleProducts.includes(name);
                return (
                    <button
                        key={name}
                        onClick={() => onToggle(name)}
                        className={`px-3 py-1 text-xs rounded-full border transition-all duration-200 flex items-center gap-2 ${
                            isVisible 
                            ? 'text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600 line-through'
                        }`}
                        style={{ 
                            backgroundColor: isVisible ? colors[name] : undefined,
                            borderColor: isVisible ? colors[name] : undefined
                        }}
                    >
                        {name}
                    </button>
                );
            })}
        </div>
    </div>
);


const DashboardView: React.FC<DashboardViewProps> = ({ remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings }) => {
  const productosMap = useMemo(() => new Map<string, Producto>(productos.map(p => [p.id, p])), [productos]);
  
  // 1. Extract product names
  const consumableProductNames = useMemo(() => {
    return [...new Set(
        productos
        .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
        .map(p => p.nombre)
    )].sort();
  }, [productos]);

  // 2. Map product names to their defined colors
  const productColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    consumableProductNames.forEach((name) => {
        const product = productos.find(p => p.nombre === name);
        colors[name] = product?.color || "#9ca3af"; // Default gray if missing
    });
    return colors;
  }, [consumableProductNames, productos]);

  // 3. Visibility State with Persistence
  const [visibleProducts, setVisibleProducts] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('dashboard_visible_products');
          return saved ? JSON.parse(saved) : consumableProductNames;
      } catch (e) {
          return consumableProductNames;
      }
  });

  // Sync initial load if local storage was empty but products exist
  useEffect(() => {
      const saved = localStorage.getItem('dashboard_visible_products');
      if (!saved && consumableProductNames.length > 0) {
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
        remito.movimientos.forEach(mov => {
            const producto = productosMap.get(mov.productoId);
            if (producto) {
                acc[producto.nombre] = (acc[producto.nombre] || 0) + mov.entregados;
            }
        });
        return acc;
    }, {} as { [key: string]: number });
    return { byProduct };
  };

  const parseDate = (dateString: string) => new Date(dateString + 'T00:00:00');

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfToday = new Date(today);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startOfYesterday = new Date(yesterday);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const dailyRemitos = remitos.filter(r => parseDate(r.fecha) >= startOfToday);
    const yesterdayRemitos = remitos.filter(r => { const d = parseDate(r.fecha); return d >= startOfYesterday && d <= endOfYesterday; });
    const weeklyRemitos = remitos.filter(r => parseDate(r.fecha) >= startOfWeek);
    const monthlyRemitos = remitos.filter(r => parseDate(r.fecha) >= startOfMonth);
    const lastMonthRemitos = remitos.filter(r => { const d = parseDate(r.fecha); return d >= startOfLastMonth && d <= endOfLastMonth; });

    // Saldos de Caja
    let saldoEfectivo = 0;
    let saldoOtros = 0;
    registrosPago.forEach(pago => {
        if (pago.metodo === MetodoPago.EFECTIVO) {
            saldoEfectivo += pago.monto;
        } else {
            saldoOtros += pago.monto;
        }
    });
    gastos.forEach(gasto => {
        gasto.pagos.forEach(pago => {
            if (pago.metodo === MetodoPago.EFECTIVO) {
                saldoEfectivo -= pago.monto;
            } else {
                saldoOtros -= pago.monto;
            }
        });
    });

    // --- Sales Volume Chart Data ---
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const salesByProductData: Record<string, { name: string; values: Record<string, number> }> = {};
    // --- New Data Structure for Internal vs External ---
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

    // Process Internal Sales (Remitos)
    remitos.filter(r => parseDate(r.fecha) >= twelveMonthsAgo).forEach(r => {
        const date = parseDate(r.fecha);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        r.movimientos.forEach(m => {
            const producto = productosMap.get(m.productoId);
            if (producto && consumableProductNames.includes(producto.nombre)) {
                 if (salesByProductData[monthKey]) {
                    salesByProductData[monthKey].values[producto.nombre] += m.entregados;
                 }
                 if (salesByTypeDataStructure[monthKey]) {
                    salesByTypeDataStructure[monthKey].values[`Int. - ${producto.nombre}`] += m.entregados;
                 }
            }
        });
    });

    // Process External Sales (VentasVendedor)
    const monthlyVentas = ventasVendedor.filter(v => parseDate(v.fecha) >= startOfMonth);

    ventasVendedor.filter(v => parseDate(v.fecha) >= twelveMonthsAgo).forEach(v => {
        const date = parseDate(v.fecha);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        v.movimientos.forEach(m => {
            const producto = productosMap.get(m.productoId);
             if (producto && consumableProductNames.includes(producto.nombre)) {
                 if (salesByProductData[monthKey]) {
                    salesByProductData[monthKey].values[producto.nombre] += m.cantidad;
                 }
                 if (salesByTypeDataStructure[monthKey]) {
                    salesByTypeDataStructure[monthKey].values[`Ext. - ${producto.nombre}`] += m.cantidad;
                 }
             }
        });
    });

    const monthlySalesVolumeChartData = Object.values(salesByProductData).map(data => ({ name: data.name, ...data.values }));
    const monthlySalesByTypeData = Object.values(salesByTypeDataStructure).map(data => ({ name: data.name, ...data.values }));
    
    // --- Daily Sales Data (Current Month) ---
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
        const date = parseDate(r.fecha);
        const dayKey = date.getDate().toString();
        r.movimientos.forEach(m => {
            const producto = productosMap.get(m.productoId);
            if (producto && consumableProductNames.includes(producto.nombre)) {
                if (currentMonthDailyData[dayKey]) {
                    currentMonthDailyData[dayKey].values[`Int. - ${producto.nombre}`] += m.entregados;
                }
            }
        });
    });

    monthlyVentas.forEach(v => {
        const date = parseDate(v.fecha);
        const dayKey = date.getDate().toString();
        v.movimientos.forEach(m => {
            const producto = productosMap.get(m.productoId);
            if (producto && consumableProductNames.includes(producto.nombre)) {
                 if (currentMonthDailyData[dayKey]) {
                    currentMonthDailyData[dayKey].values[`Ext. - ${producto.nombre}`] += m.cantidad;
                 }
            }
        });
    });

    const currentMonthDailySalesData = Object.values(currentMonthDailyData).map(data => ({ name: data.name, ...data.values }));
    // -------------------------

    return {
        dailyStats: calculateStatsForPeriod(dailyRemitos),
        yesterdayStats: calculateStatsForPeriod(yesterdayRemitos),
        weeklyStats: calculateStatsForPeriod(weeklyRemitos),
        monthlyStats: calculateStatsForPeriod(monthlyRemitos),
        lastMonthStats: calculateStatsForPeriod(lastMonthRemitos),
        saldoEfectivo,
        saldoOtros,
        monthlySalesVolumeChartData,
        monthlySalesByTypeData,
        currentMonthDailySalesData
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, consumableProductNames]);


  // --- Map Data Logic ---
  const [mapMarkers, setMapMarkers] = useState<{ lat: number, lng: number, title: string }[]>([]);
  const [todayName, setTodayName] = useState<string>('');
  const [routeLine, setRouteLine] = useState<{ lat: number, lng: number }[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date();
    const days = [DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];
    const name = days[today.getDay()];
    setTodayName(name);

    const markers: { lat: number, lng: number, title: string }[] = [];
    
    // Add Factory if exists
    if (empresaSettings?.lat && empresaSettings?.lng) {
        markers.push({
            lat: empresaSettings.lat,
            lng: empresaSettings.lng,
            title: "Depósito / Fábrica (Inicio)"
        });
    }

    clientes.forEach(cliente => {
        cliente.sucursales.forEach(sucursal => {
            const hasDeliveryToday = sucursal.diasReparto?.includes(name);
            if (hasDeliveryToday && sucursal.lat && sucursal.lng) {
                markers.push({
                    lat: sucursal.lat,
                    lng: sucursal.lng,
                    title: `${cliente.nombre} - ${sucursal.nombre}`
                });
            }
        });
    });
    setMapMarkers(markers);
    setRouteLine([]); // Reset route when data refreshes
    setIsOptimized(false);
    setTotalDistance(null);
  }, [clientes, empresaSettings]);

  // Helper distance function (Haversine for better accuracy, though Euclid is fine for short distances)
  const getDistance = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
      const R = 6371e3; // metres
      const φ1 = p1.lat * Math.PI/180; // φ, λ in radians
      const φ2 = p2.lat * Math.PI/180;
      const Δφ = (p2.lat-p1.lat) * Math.PI/180;
      const Δλ = (p2.lng-p1.lng) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c; // in metres
  }

  // Algoritmo de optimización: Vecino Más Cercano (Nearest Neighbor) con Depósito y Vuelta
  const optimizeRoute = () => {
    if (mapMarkers.length < 2) return;

    let depot = null;
    let unvisited = [];

    // Check if first marker is depot (based on logic in useEffect)
    if (empresaSettings?.lat && empresaSettings?.lng && mapMarkers[0].lat === empresaSettings.lat && mapMarkers[0].lng === empresaSettings.lng) {
        depot = mapMarkers[0];
        unvisited = mapMarkers.slice(1);
    } else {
        // If no depot set, use first client as start point
        depot = mapMarkers[0];
        unvisited = mapMarkers.slice(1);
    }

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
            const target = unvisited[i];
            const dist = getDistance(current, target);

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
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

    // Return to Depot (Circular Route)
    if (depot) {
        optimizedPath.push({ lat: depot.lat, lng: depot.lng });
        calcDistance += getDistance(current, depot);
    }

    setMapMarkers(orderedMarkers);
    setRouteLine(optimizedPath);
    setIsOptimized(true);
    setTotalDistance(calcDistance / 1000); // km
  };


  // --- Drag and Drop Logic ---
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
    e.dataTransfer.effectAllowed = 'move';
    // Add opacity to the element being dragged
    const target = e.target as HTMLElement;
    target.style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    draggingItem.current = null;
    draggingItemType.current = null;
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
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
         <Card title={`Mapa de Reparto - Hoy (${todayName})`}>
            <div className="p-2">
                {mapMarkers.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                            <p className="text-sm text-gray-500">
                                {mapMarkers.length} puntos programados.
                                {(!empresaSettings?.lat) && <span className="text-red-500 ml-2">(Configure la ubicación del Depósito para mejorar la ruta)</span>}
                            </p>
                            <button 
                                onClick={optimizeRoute} 
                                disabled={isOptimized}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                    isOptimized 
                                    ? 'bg-green-100 text-green-700 cursor-default' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {isOptimized ? 'Recorrido Optimizado ✓' : 'Optimizar Recorrido'}
                            </button>
                        </div>
                        {isOptimized && totalDistance !== null && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                Distancia estimada (circular, línea recta): <strong>{totalDistance.toFixed(1)} km</strong>.
                                <br/><span className="italic text-gray-400">Orden sugerido por proximidad. El chofer debe respetar manos y sentido de calles.</span>
                            </p>
                        )}
                        <LeafletMap 
                            markers={mapMarkers}
                            height="400px"
                            route={routeLine}
                        />
                    </>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-500">
                        <p>No hay clientes con reparto programado para hoy o no tienen ubicación definida.</p>
                    </div>
                )}
            </div>
         </Card>
      ),
      'sales_volume': (
        <Card title="Evolución de Volumen de Ventas por Producto (Últimos 12 Meses)">
            <ProductFilter 
                products={consumableProductNames} 
                visibleProducts={visibleProducts} 
                colors={productColors} 
                onToggle={toggleProductVisibility} 
            />
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySalesVolumeChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.3)" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => (value as number).toLocaleString('es-AR')} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(31, 41, 55, 0.8)',
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                borderRadius: '0.5rem',
                            }}
                            formatter={(value: number) => `${value.toLocaleString('es-AR')} u.`}
                        />
                        <Legend />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return (
                                <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={2} name={name} />
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      ),
      'internal_vs_external': (
        <Card title="Evolución Internos vs Externos por Producto (Anual)">
            <ProductFilter 
                products={consumableProductNames} 
                visibleProducts={visibleProducts} 
                colors={productColors} 
                onToggle={toggleProductVisibility} 
            />
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySalesByTypeData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.3)" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => (value as number).toLocaleString('es-AR')} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                borderRadius: '0.5rem',
                            }}
                            formatter={(value: number) => `${value.toLocaleString('es-AR')} u.`}
                        />
                        <Legend />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return (
                                <React.Fragment key={name}>
                                    {/* Línea para Internos (Sólida) */}
                                    <Line 
                                        type="monotone" 
                                        dataKey={`Int. - ${name}`} 
                                        stroke={productColors[name]} 
                                        strokeWidth={3} 
                                        dot={{ r: 3 }}
                                        name={`Int. - ${name}`} 
                                    />
                                    {/* Línea para Externos (Punteada) */}
                                    <Line 
                                        type="monotone" 
                                        dataKey={`Ext. - ${name}`} 
                                        stroke={productColors[name]} 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5" 
                                        dot={{ r: 3, fill: 'white' }}
                                        name={`Ext. - ${name}`} 
                                    />
                                </React.Fragment>
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      ),
      'daily_evolution': (
        <Card title="Evolución Diaria Internos vs Externos (Mes Actual)">
            <ProductFilter 
                products={consumableProductNames} 
                visibleProducts={visibleProducts} 
                colors={productColors} 
                onToggle={toggleProductVisibility} 
            />
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentMonthDailySalesData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.3)" />
                        <XAxis dataKey="name" label={{ value: 'Día del mes', position: 'insideBottomRight', offset: -5, fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => (value as number).toLocaleString('es-AR')} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                borderRadius: '0.5rem',
                            }}
                            formatter={(value: number) => `${value.toLocaleString('es-AR')} u.`}
                            labelFormatter={(label) => `Día ${label}`}
                        />
                        <Legend />
                        {consumableProductNames.map(name => {
                            if (!visibleProducts.includes(name)) return null;
                            return (
                                <React.Fragment key={name}>
                                    {/* Línea para Internos (Sólida) */}
                                    <Line 
                                        type="monotone" 
                                        dataKey={`Int. - ${name}`} 
                                        stroke={productColors[name]} 
                                        strokeWidth={3} 
                                        dot={{ r: 2 }}
                                        name={`Int. - ${name}`} 
                                    />
                                    {/* Línea para Externos (Punteada) */}
                                    <Line 
                                        type="monotone" 
                                        dataKey={`Ext. - ${name}`} 
                                        stroke={productColors[name]} 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5" 
                                        dot={{ r: 2, fill: 'white' }}
                                        name={`Ext. - ${name}`} 
                                    />
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
    <div className="space-y-8 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
      
      <div>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Saldos de Caja</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
                <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Saldo en Efectivo</p>
                    <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                        ${saldoEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </Card>
            <Card>
                 <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Otros Medios</p>
                    <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                         ${saldoOtros.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </Card>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Unidades Entregadas</h2>
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
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Estadísticas</h2>
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
