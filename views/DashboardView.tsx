
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import MovimientoCajaForm from '../components/MovimientoCajaForm';
import SopladoDashboardWidget from '../plugins/soplado/SopladoDashboardWidget';
import { Preforma, Molde, ProduccionSoplado, EntregaSoplado } from '../plugins/soplado/types';

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
  preformas?: Preforma[];
  moldes?: Molde[];
  produccionSoplado?: ProduccionSoplado[];
  entregasSoplado?: EntregaSoplado[];
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
  productos: Producto[];
}> = ({ title, stats, productos }) => {
  const shortName = (name: string) => {
    const prod = productos.find(p => p.nombre === name);
    if (prod?.abreviatura) return prod.abreviatura;
    return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
  };

  return (
    <Card title={title}>
      <div style={{ minHeight: '120px' }}>
        {Object.keys(stats.byProduct).length > 0 ? (
          Object.entries(stats.byProduct)
          .sort(([, valueA], [, valueB]) => (valueB as number) - (valueA as number))
          .map(([name, value]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>{shortName(name)}</span>
              <strong style={{ color: 'var(--pico-primary)', fontSize: '1.1rem' }}>{value}</strong>
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.4 }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Sin movimientos</p>
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
        <div className="animate-fade-in">
            <div className="grid">
                <hgroup>
                    <h2 style={{ margin: 0 }}>
                        Rendimiento: <span style={{ color: 'var(--pico-primary)' }}>{user.nombre}</span>
                    </h2>
                    <p>Panel de control de repartidor</p>
                </hgroup>
                <div style={{ textAlign: 'right' }}>
                    <AppButton onClick={() => onOpenRemito()}>
                        + Nuevo Remito Rápido
                    </AppButton>
                </div>
            </div>

            {/* CLIENTES A VISITAR HOY */}
            {visitasDelDia.length > 0 && (
                <Card title={`Ruta del Día (${currentDay})`}>
                    <div className="responsive-grid">
                        {visitasDelDia.map(cliente => (
                            <article 
                                key={cliente.id} 
                                onClick={() => !cliente.visitado && onOpenRemito(cliente.id)}
                                style={{ 
                                    padding: '1rem', 
                                    cursor: cliente.visitado ? 'default' : 'pointer',
                                    opacity: cliente.visitado ? 0.6 : 1,
                                    marginBottom: '1rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ textDecoration: cliente.visitado ? 'line-through' : 'none' }}>
                                            {cliente.nombre}
                                        </strong>
                                        <br />
                                        <small>{cliente.sucursales[0]?.direccion}</small>
                                    </div>
                                    {cliente.visitado ? (
                                        <ins>✓</ins>
                                    ) : (
                                        <mark style={{ fontSize: '0.7rem' }}>VISITAR</mark>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </Card>
            )}

            {/* CONTROL DE CARGA COMPACTO */}
            {cargaStatus && (
                <Card title="Control de Carga (Hoy)">
                    <div className="responsive-grid">
                        {Object.entries(cargaStatus.cargaTotal).map(([prodId, cargaVal]) => {
                            const prod = productosMap.get(prodId);
                            const carga = cargaVal as number;
                            const entregado = cargaStatus.entregadoHoy[prodId] || 0;
                            const disponible = carga - entregado;
                            
                            return (
                                <article key={prodId} style={{ padding: '0.5rem', marginBottom: '0.5rem' }}>
                                    <small><strong>{prod?.nombre}</strong></small>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                        <span>{entregado} / {carga}</span>
                                        <mark style={{ backgroundColor: disponible <= 5 ? 'var(--pico-error-color)' : 'var(--pico-primary)' }}>
                                            Disp: {disponible}
                                        </mark>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </Card>
            )}
            
            <div className="grid">
                {/* CARD DE ENTREGAS HOY/AYER */}
                <article>
                    <header style={{ textAlign: 'center' }}>
                        <small><strong>Ritmo de Entrega (Envases)</strong></small>
                    </header>
                    <div className="grid" style={{ textAlign: 'center' }}>
                        <div>
                            <h2 style={{ color: 'var(--pico-primary)', margin: 0 }}>{entregasHoy}</h2>
                            <small>Hoy</small>
                        </div>
                        <div>
                            <h2 style={{ opacity: 0.5, margin: 0 }}>{entregasAyer}</h2>
                            <small>Ayer</small>
                        </div>
                    </div>
                </article>

                <article style={{ textAlign: 'center' }}>
                    <header>
                        <small><strong>Total Mensual</strong></small>
                    </header>
                    <h2 style={{ color: 'var(--pico-primary)', margin: 0 }}>{entregasTotal}</h2>
                    <small>Envases retornables</small>
                </article>
            </div>

            <Card title="Progreso Diario de Entregas">
                <div style={{ height: '260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--pico-primary)" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="var(--pico-primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={lightTooltipStyle} />
                            <Area type="monotone" dataKey="entregas" stroke="var(--pico-primary)" fillOpacity={1} fill="url(#colorEntregas)" strokeWidth={3} />
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
    const misVentas = useMemo(() => ventas.filter(v => v.vendedorId === user.id && !v.clienteId), [ventas, user.id]);

    const shortName = (name: string) => {
        const prod = Array.from(productosMap.values()).find((p: any) => p.nombre === name) as Producto | undefined;
        if (prod?.abreviatura) return prod.abreviatura;
        return name.replace('Bidón ', '').replace(' Retornable', '').replace(' Descartable', '');
    };
    
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
        const misPagos = pagos.filter(p => p.vendedorId === user.id && !p.clienteId);
        
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
        <div className="animate-fade-in">
            <div className="grid">
                <hgroup>
                    <h2 style={{ margin: 0 }}>
                        Cuenta Corriente: <span style={{ color: 'var(--pico-primary)' }}>{user.nombre}</span>
                    </h2>
                    <p>Panel de control de vendedor externo</p>
                </hgroup>
                <div style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <AppButton onClick={onOpenPago} variant="success">
                        $ Cargar Pago
                    </AppButton>
                    <AppButton onClick={onOpenStockPurchase}>
                        + Registrar Retiro
                    </AppButton>
                </div>
            </div>
            
            <div className="grid">
                <article style={{ 
                    textAlign: 'center', 
                    border: '2px solid',
                    borderColor: saldoPendiente > 0 ? 'var(--pico-error-color)' : 'var(--pico-primary)',
                    backgroundColor: saldoPendiente > 0 ? 'rgba(255,0,0,0.05)' : 'rgba(0,255,0,0.05)'
                }}>
                    <small><strong>Saldo Pendiente (Deuda)</strong></small>
                    <h2 style={{ 
                        margin: 0,
                        color: saldoPendiente > 0 ? 'var(--pico-error-color)' : 'var(--pico-primary)'
                    }}>
                        ${saldoPendiente.toLocaleString()}
                    </h2>
                </article>

                {/* CARD DE RETIROS HOY/AYER (EXTERNO) */}
                <article>
                    <header style={{ textAlign: 'center' }}>
                        <small><strong>Envases Retirados</strong></small>
                    </header>
                    <div className="grid" style={{ textAlign: 'center' }}>
                        <div>
                            <h2 style={{ color: 'var(--pico-primary)', margin: 0 }}>{retiradosHoy}</h2>
                            <small>Hoy</small>
                        </div>
                        <div>
                            <h2 style={{ opacity: 0.5, margin: 0 }}>{retiradosAyer}</h2>
                            <small>Ayer</small>
                        </div>
                    </div>
                </article>
            </div>

            <Card title="Historial de Movimientos">
                <div className="overflow-auto">
                    <table className="striped">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Concepto</th>
                                <th>Detalle</th>
                                <th style={{ textAlign: 'right' }}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historial.map((h, i) => (
                                <tr key={i}>
                                    <td><small>{new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</small></td>
                                    <td><strong>{h.concepto}</strong></td>
                                    <td><small>{h.detalle}</small></td>
                                    <td style={{ textAlign: 'right', color: h.monto < 0 ? 'var(--pico-error-color)' : 'var(--pico-primary)' }}>
                                        <strong>{h.monto < 0 ? '-' : '+'}${Math.abs(h.monto).toLocaleString()}</strong>
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

  if (!user) return <article style={{ padding: '2rem', textAlign: 'center' }}>Cargando perfil...</article>;

  // Render para Vendedores (usando los nuevos modales)
  const vendorDashboard = (
      <>
        {user.rol === Rol.REPARTIDOR && user.tipo === TipoVendedor.INTERNO && (
            <div style={{ paddingTop: '2rem' }}>
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
            <div style={{ paddingTop: '2rem' }}>
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
            <Modal isOpen={isPagoModalOpen} onClose={() => setIsPagoModalOpen(false)}>
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
            <Modal isOpen={isStockPurchaseModalOpen} onClose={() => setIsStockPurchaseModalOpen(false)}>
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

  if (user.rol === Rol.SOPLADOR) {
    return (
      <main className="container animate-fade-in">
        <header className="grid">
          <hgroup>
            <h1 style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>Panel de Soplado</h1>
            <p>Bienvenido, {user.nombre}</p>
          </hgroup>
          <div style={{ textAlign: 'right' }}>
            <article style={{ display: 'inline-block', padding: '0.5rem 1rem', margin: 0 }}>
              <small><strong>{format(new Date(), "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}</strong></small>
            </article>
          </div>
        </header>

        {empresaSettings?.sopladoConfig?.enabled ? (
          <SopladoDashboardWidget 
            preformas={preformas || []}
            moldes={moldes || []}
            produccion={produccionSoplado || []}
            entregas={entregasSoplado || []}
            settings={empresaSettings.sopladoConfig}
            onAction={handleSopladoAction}
          />
        ) : (
          <article style={{ backgroundColor: 'var(--pico-ins-color)', color: 'var(--pico-contrast)' }}>
            <p><strong>⚠️ El plugin de soplado está desactivado.</strong> Contacte al administrador para habilitarlo.</p>
          </article>
        )}
      </main>
    );
  }

  if (user.rol === Rol.REPARTIDOR) return vendorDashboard;

  // 3. DASHBOARD ADMINISTRADOR
  return (
    <main className="container animate-fade-in">
      <h1 style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>Dashboard Operativo</h1>
      
      {/* Widget de Soplado (Solo si está habilitado) */}
      {empresaSettings?.sopladoConfig?.enabled && (
        <div style={{ marginBottom: '2rem' }}>
          <SopladoDashboardWidget 
            preformas={preformas || []}
            moldes={moldes || []}
            produccion={produccionSoplado || []}
            entregas={entregasSoplado || []}
            settings={empresaSettings.sopladoConfig}
            onAction={handleSopladoAction}
          />
        </div>
      )}

      <div className="grid">
          <article style={{ textAlign: 'center', border: '2px solid var(--pico-primary)', backgroundColor: 'rgba(0,255,0,0.05)' }}>
              <small><strong>Efectivo Total</strong></small>
              <h2 style={{ margin: 0 }}>${saldoEfectivo.toLocaleString('es-AR')}</h2>
          </article>
          <article style={{ textAlign: 'center', border: '2px solid var(--pico-secondary)', backgroundColor: 'rgba(0,0,255,0.05)' }}>
              <small><strong>Caja Virtual / Bancos</strong></small>
              <h2 style={{ margin: 0 }}>${saldoOtros.toLocaleString('es-AR')}</h2>
          </article>
      </div>

      <section>
        <small style={{ textTransform: 'uppercase', fontWeight: 'bold', opacity: 0.5 }}>Entregas Consolidadas</small>
        <div className="responsive-grid">
            {metricsOrder.map(key => <div key={key}>{metricsComponents[key]}</div>)}
        </div>
      </section>

      <div className="grid">
          <div style={{ gridColumn: 'span 2' }}>
              <Card title="Evolución Diaria (Mes Actual vs Anterior)">
                  <div style={{ padding: '0 1rem 1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <small style={{ textTransform: 'uppercase', fontWeight: 'bold', opacity: 0.5 }}>Filtro de Productos</small>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <small>● Mes Actual</small>
                                <small style={{ opacity: 0.5 }}>○ Mes Anterior</small>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {returnableProductNames.map(name => {
                                const isVisible = visibleProducts.includes(name);
                                return (
                                    <AppButton
                                        key={name}
                                        onClick={() => toggleProductVisibility(name)}
                                        style={{ 
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.7rem',
                                            backgroundColor: isVisible ? productColors[name] : 'var(--pico-secondary-background)',
                                            borderColor: isVisible ? productColors[name] : 'var(--pico-border-color)',
                                            color: isVisible ? 'white' : 'var(--pico-muted-color)',
                                            opacity: isVisible ? 1 : 0.5
                                        }}
                                    >
                                        {shortName(name).toUpperCase()}
                                    </AppButton>
                                );
                            })}
                        </div>
                    </div>
                  <div style={{ height: '320px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={currentMonthDailySalesData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} labelFormatter={(l) => `Día ${l}`} />
                              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                              
                              <Line type="monotone" dataKey="Total Mes Actual" stroke="#3b82f6" strokeWidth={4} dot={false} name="📦 TOTAL ACTUAL" />
                              <Line type="monotone" dataKey="Internos Mes Actual" stroke="#10b981" strokeWidth={2} dot={false} name="👤 INTERNOS ACTUAL" />
                              <Line type="monotone" dataKey="Externos Mes Actual" stroke="#f59e0b" strokeWidth={2} dot={false} name="🤝 EXTERNOS ACTUAL" />
                              
                              <Line type="monotone" dataKey="Total Mes Anterior" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} name="📦 TOTAL ANTERIOR" opacity={0.5} />

                              {returnableProductNames.map(name => visibleProducts.includes(name) ? (
                                  <React.Fragment key={name}>
                                      <Line type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={2} dot={false} name={shortName(name)} />
                                  </React.Fragment>
                              ) : null)}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
          </div>

          <div>
              <Card title="Stock Permanente en Planta">
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {productos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).length > 0 ? (
                          <table className="striped">
                              <thead>
                                  <tr>
                                      <th>Producto</th>
                                      <th style={{ textAlign: 'right' }}>Llenos</th>
                                      <th style={{ textAlign: 'right' }}>Vacíos</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {productos
                                    .filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE)
                                    .map(p => (
                                      <tr key={p.id}>
                                          <td><small>{p.abreviatura || p.nombre}</small></td>
                                          <td style={{ textAlign: 'right', color: 'var(--pico-primary)', fontWeight: 'bold' }}>{p.stockPlanta || 0}</td>
                                          <td style={{ textAlign: 'right', color: 'var(--pico-secondary)', fontWeight: 'bold' }}>{p.tipo === TipoProducto.RETORNABLE ? (p.stockEnvases || 0) : '-'}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin productos registrados</p>
                      )}
                  </div>
              </Card>
          </div>

          <div>
              <Card title="Stock en Poder de Clientes">
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {stockEnCalle.length > 0 ? (
                          <table className="striped">
                              <tbody>
                                  {stockEnCalle.map(([name, count]) => (
                                      <tr key={name}>
                                          <td><small>{shortName(name)}</small></td>
                                          <td style={{ textAlign: 'right', color: 'var(--pico-primary)', fontWeight: 'bold' }}>{count.toLocaleString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin stock pendiente</p>
                      )}
                  </div>
              </Card>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
              <Card title="Volumen de Ventas (Histórico 12 Meses)">
                  <div style={{ height: '320px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlySalesVolumeChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                              <Legend iconType="circle" />
                              
                              <Line type="monotone" dataKey="Total General" stroke="#111827" strokeWidth={4} dot={{ r: 5 }} name="📈 TOTAL VENTAS" />
                              <Line type="monotone" dataKey="Internos" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="👤 INTERNOS" />
                              <Line type="monotone" dataKey="Externos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="🤝 EXTERNOS" />

                              {returnableProductNames.map(name => {
                                  if (!visibleProducts.includes(name)) return null;
                                  return <Line key={name} type="monotone" dataKey={name} stroke={productColors[name]} strokeWidth={2} dot={{ r: 4 }} name={shortName(name)} />;
                              })}
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
          </div>

          <div>
              <Card title="Ventas Productos Descartables">
                  <div style={{ height: '320px' }}>
                      {nonReturnableMonthlyData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={nonReturnableMonthlyData} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128, 128, 128, 0.1)" />
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} />
                                  <Tooltip contentStyle={lightTooltipStyle} />
                                  <Legend verticalAlign="top" />
                                  <Area dataKey="actual" name="Mes Actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                  <Area dataKey="anterior" name="Mes Anterior" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.3} />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : (
                          <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin ventas descartables</p>
                      )}
                  </div>
              </Card>
          </div>

          <div>
              <Card title="Comisiones Vendedores">
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {vendedoresComisiones.length > 0 ? (
                          <table className="striped">
                              <tbody>
                                  {vendedoresComisiones.map(v => (
                                      <tr key={v.nombre}>
                                          <td><small>{v.nombre}</small></td>
                                          <td style={{ textAlign: 'right', color: 'var(--pico-primary)', fontWeight: 'bold' }}>${v.monto.toLocaleString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin comisiones este mes</p>
                      )}
                  </div>
              </Card>
          </div>

          <div>
              <Card title="Vendedores Externos">
                  <div style={{ height: '320px' }}>
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
                                      label={({ value }) => `${value}`}
                                  >
                                      {externalVendorsPieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#111827' }} />
                                  <Legend verticalAlign="bottom" />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin ventas externas</p>
                      )}
                  </div>
              </Card>
          </div>
      </div>

      <section>
          <Card title={`Ruta de Reparto: ${todayName}`}>
            <div style={{ padding: '1rem' }}>
                {mapMarkers.length > 0 ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <small style={{ fontWeight: 'bold', opacity: 0.5 }}>{mapMarkers.length} Puntos Georeferenciados.</small>
                            <AppButton onClick={optimizeRoute} style={{ fontSize: '0.7rem', padding: '0.25rem 1rem' }}>
                                {isOptimized ? 'Ruta Optimizada ✓' : 'Optimizar Recorrido'}
                            </AppButton>
                        </div>
                        <LeafletMap markers={mapMarkers} height="450px" route={routeLine} />
                    </>
                ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--pico-border-color)', borderRadius: '1rem', opacity: 0.5 }}>Sin repartos hoy</div>}
            </div>
          </Card>
      </section>
    </main>
  );
};

export default DashboardView;
