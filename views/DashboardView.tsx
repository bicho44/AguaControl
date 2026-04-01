
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '../components/Modal';
import { AppButton, AppCard } from '../components/ui';
import { Remito, Producto, TipoProducto, RegistroPago, Gasto, MetodoPago, Usuario, Cliente, VentaVendedor, DiaSemana, EmpresaSettings, TipoVendedor, Rol, PlanillaDiaria, MovimientoStockPlanta, CausaRecambio } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getLocalDateString } from '../utils/dateUtils';
// Importamos formularios
import RemitoForm from '../components/RemitoForm';
import MovimientoCajaForm from '../components/MovimientoCajaForm';
// Importamos componentes de dashboard
import StatsCard from '../components/dashboard/StatsCard';
import InternalVendorDashboard from '../components/dashboard/InternalVendorDashboard';
import ExternalVendorDashboard from '../components/dashboard/ExternalVendorDashboard';
import SopladorDashboard from '../components/dashboard/SopladorDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';

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
  // Soplado props
  preformas?: any[];
  moldes?: any[];
  produccionSoplado?: any[];
  entregasSoplado?: any[];
  // New props for actions
  addRemito?: (remito: any) => Promise<void>;
  addPagoManual?: (pago: any) => Promise<void>;
  addVentaVendedor?: (venta: any) => Promise<void>;
  addCliente?: (cliente: any) => Promise<string>;
  setCurrentView?: (view: string) => void;
}

// ----------------------------------------------------------------------
// SUB-COMPONENTES PARA ESTILOS Y REUTILIZACION
// ----------------------------------------------------------------------

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
// Extraído a /components/dashboard/InternalVendorDashboard.tsx

// ----------------------------------------------------------------------
// DASHBOARD PARA VENDEDOR EXTERNO (REVENDEDOR)
// ----------------------------------------------------------------------
// Extraído a /components/dashboard/ExternalVendorDashboard.tsx

// ----------------------------------------------------------------------
// DASHBOARD PRINCIPAL (CONTAINER)
// ----------------------------------------------------------------------

const DashboardView: React.FC<DashboardViewProps> = ({ 
    remitos, productos, registrosPago, gastos, usuarios, clientes, ventasVendedor, empresaSettings, causasRecambio, planillas, movimientosPlanta,
    preformas, moldes, produccionSoplado, entregasSoplado,
    addRemito, addPagoManual, addVentaVendedor, addCliente, setCurrentView
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
  // Nuevo state para la compra de stock del vendedor externo
  const [isStockPurchaseModalOpen, setIsStockPurchaseModalOpen] = useState(false);
  
  // Data for Modals
  const [newRemitoData, setNewRemitoData] = useState<any>(null);
  const [newPagoData, setNewPagoData] = useState<any>(null);
  const [newStockPurchaseData, setNewStockPurchaseData] = useState<any>(null);
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
        
        monthObj["Total General"] = 0;
        monthObj["Internos"] = 0;
        monthObj["Externos"] = 0;

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
                        monthObj["Total General"] += cant;
                        monthObj["Internos"] += cant;
                        monthObj[prod.nombre] += cant;
                    }
                });
            }
        });
        ventasVendedor.forEach(v => {
            const d = parseLocalDate(v.fecha);
            if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
                const vendor = usuariosMap.get(v.vendedorId);
                const isExterno = vendor?.tipo === TipoVendedor.EXTERNO;
                v.movimientos.forEach(m => {
                    const prod = productosMap.get(m.productoId);
                    if (prod && returnableProductNames.includes(prod.nombre)) {
                        const cant = Number(m.cantidad) || 0;
                        monthObj["Total General"] += cant;
                        if (isExterno) monthObj["Externos"] += cant;
                        else monthObj["Internos"] += cant;
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
        
        dayObj["Total Mes Actual"] = 0;
        dayObj["Internos Mes Actual"] = 0;
        dayObj["Externos Mes Actual"] = 0;
        dayObj["Total Mes Anterior"] = 0;
        dayObj["Internos Mes Anterior"] = 0;
        dayObj["Externos Mes Anterior"] = 0;

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
                            dayObj["Total Mes Actual"] += cant;
                            dayObj["Internos Mes Actual"] += cant;
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
                            dayObj["Total Mes Actual"] += cant;
                            if (isExterno) dayObj["Externos Mes Actual"] += cant;
                            else dayObj["Internos Mes Actual"] += cant;
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
                            dayObj["Total Mes Anterior"] += cant;
                            dayObj["Internos Mes Anterior"] += cant;
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
                            dayObj["Total Mes Anterior"] += cant;
                            if (isExterno) dayObj["Externos Mes Anterior"] += cant;
                            else dayObj["Internos Mes Anterior"] += cant;
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
        nonReturnableMonthlyData,
        externalVendorsPieData,
        stockEnCalle,
        vendedoresComisiones: comisiones
    }
  }, [remitos, productos, registrosPago, gastos, ventasVendedor, productosMap, usuariosMap, returnableProductNames, nonReturnableProductNames, usuarios, movimientosPlanta]);

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

  if (!user) return <div style={{ padding: 'var(--pico-spacing)' }}>Cargando perfil...</div>;

  // Render para Vendedores (usando los nuevos modales)
  const vendorDashboard = (
      <>
        {user.rol === Rol.REPARTIDOR && user.tipo === TipoVendedor.INTERNO && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '3rem' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '3rem' }}>
                <ExternalVendorDashboard 
                    user={user} 
                    ventas={ventasVendedor} 
                    pagos={registrosPago} 
                    productosMap={productosMap} 
                    onOpenStockPurchase={handleOpenStockPurchase}
                    onOpenPago={handleOpenPago}
                />
            </div>
        )}

        {/* MODAL REMITO COMPARTIDO (Solo Internos) */}
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
                />
            </Modal>
        )}

        {/* MODAL PAGO CAJA (Para Externos) */}
        {isPagoModalOpen && (
            <Modal isOpen={isPagoModalOpen} onClose={() => setIsPagoModalOpen(false)} style={{ maxWidth: '800px' }}>
                <MovimientoCajaForm 
                    type="ingreso"
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
            <Modal isOpen={isStockPurchaseModalOpen} onClose={() => setIsStockPurchaseModalOpen(false)} style={{ maxWidth: '800px' }}>
                <MovimientoCajaForm 
                    type="ingreso"
                    movimiento={newStockPurchaseData} 
                    isEdit={false} 
                    onSave={handleSaveStockPurchase} 
                    onAddCliente={handleAddClienteWrapper} 
                    onClose={() => setIsStockPurchaseModalOpen(false)} 
                    clientes={[]} 
                    vendedores={usuarios} 
                    productos={productos} 
                    ventasVendedor={ventasVendedor} 
                    initialVentaMode={true}
                    hideClientSelector={true}
                />
            </Modal>
        )}
      </>
  );

  if (user.rol === Rol.SOPLADOR) {
    return (
      <SopladorDashboard 
        user={user}
        empresaSettings={empresaSettings}
        preformas={preformas}
        moldes={moldes}
        produccionSoplado={produccionSoplado}
        entregasSoplado={entregasSoplado}
        handleSopladoAction={handleSopladoAction}
      />
    );
  }

  if (user.rol === Rol.REPARTIDOR) return vendorDashboard;

  // 3. DASHBOARD ADMINISTRADOR
  return (
    <AdminDashboard 
      empresaSettings={empresaSettings}
      preformas={preformas}
      moldes={moldes}
      produccionSoplado={produccionSoplado}
      entregasSoplado={entregasSoplado}
      handleSopladoAction={handleSopladoAction}
      saldoEfectivo={saldoEfectivo}
      saldoOtros={saldoOtros}
      metricsOrder={metricsOrder}
      metricsComponents={metricsComponents}
      returnableProductNames={returnableProductNames}
      visibleProducts={visibleProducts}
      toggleProductVisibility={toggleProductVisibility}
      productColors={productColors}
      shortName={shortName}
      currentMonthDailySalesData={currentMonthDailySalesData}
      productos={productos}
      stockEnCalle={stockEnCalle}
      monthlySalesVolumeChartData={monthlySalesVolumeChartData}
      nonReturnableMonthlyData={nonReturnableMonthlyData}
      externalVendorsPieData={externalVendorsPieData}
      vendedoresComisiones={vendedoresComisiones}
      todayName={todayName}
      mapMarkers={mapMarkers}
      routeLine={routeLine}
      optimizeRoute={optimizeRoute}
      isOptimized={isOptimized}
    />
  );
};

export default DashboardView;
