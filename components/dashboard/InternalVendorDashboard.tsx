
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Usuario, Remito, Producto, PlanillaDiaria, Cliente, DiaSemana, TipoProducto } from '../../types';
import { getLocalDateString } from '../../utils/dateUtils';

const lightTooltipStyle = {
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.75rem',
    color: '#111827',
    fontSize: '12px',
    fontWeight: 'bold',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    zIndex: 100
};

interface InternalVendorDashboardProps {
    user: Usuario;
    remitos: Remito[];
    productosMap: Map<string, Producto>;
    planillas: PlanillaDiaria[];
    clientes: Cliente[];
    onOpenRemito: (clienteId?: string) => void;
}

const InternalVendorDashboard: React.FC<InternalVendorDashboardProps> = ({ 
    user, remitos, productosMap, planillas, clientes, onOpenRemito 
}) => {
    const misRemitos = useMemo(() => remitos.filter(r => r.vendedorId === user.id && !r.esAjuste), [remitos, user.id]);
    const todayStr = useMemo(() => getLocalDateString(), []);
    const currentDay = useMemo(() => {
        const days = [DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO];
        return days[new Date().getDay()];
    }, []);

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

    const visitasDelDia = useMemo(() => {
        return clientes.filter(c => {
            return c.sucursales.some(s => {
                const assignedDriver = s.repartidoresPorDia?.[currentDay];
                if (assignedDriver) return assignedDriver === user.id;
                return s.diasReparto?.includes(currentDay as DiaSemana);
            });
        }).map(c => {
            const visitado = misRemitos.some(r => r.clienteId === c.id && r.fecha === todayStr);
            return { ...c, visitado };
        });
    }, [user.id, clientes, currentDay, misRemitos, todayStr]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: 'var(--pico-spacing)' }}>
                <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    Rendimiento: <span style={{ color: 'var(--pico-primary)' }}>{user.nombre}</span>
                </h2>
                <button onClick={() => onOpenRemito()} style={{ width: '100%' }}>
                    + Nuevo Remito Rápido
                </button>
            </div>

            {visitasDelDia.length > 0 && (
                <article>
                    <header><h6 style={{ margin: 0 }}>Ruta del Día ({currentDay})</h6></header>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {visitasDelDia.map(cliente => (
                            <button 
                                key={cliente.id} 
                                onClick={() => !cliente.visitado && onOpenRemito(cliente.id)}
                                className={cliente.visitado ? 'secondary outline' : 'outline'}
                                style={{ 
                                  textAlign: 'left', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between', 
                                  padding: '0.5rem 0.75rem',
                                  marginBottom: '0.5rem',
                                  opacity: cliente.visitado ? 0.6 : 1
                                }}
                            >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <strong style={{ fontSize: '0.75rem', display: 'block', textDecoration: cliente.visitado ? 'line-through' : 'none' }}>
                                        {cliente.nombre}
                                    </strong>
                                    <small style={{ fontSize: '0.625rem', opacity: 0.7 }}>{cliente.sucursales[0]?.direccion}</small>
                                </div>
                                {cliente.visitado ? (
                                    <svg style={{ width: '16px', height: '16px', color: 'var(--pico-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <span style={{ fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase' }}>Visitar</span>
                                )}
                            </button>
                        ))}
                    </div>
                </article>
            )}

            {cargaStatus && (
                <article>
                    <header><h6 style={{ margin: 0 }}>Control de Carga (Hoy)</h6></header>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {Object.entries(cargaStatus.cargaTotal).map(([prodId, cargaVal]) => {
                            const prod = productosMap.get(prodId);
                            const carga = cargaVal as number;
                            const entregado = cargaStatus.entregadoHoy[prodId] || 0;
                            const disponible = carga - entregado;
                            
                            return (
                                <div key={prodId} style={{ padding: '0.5rem', border: '1px solid var(--pico-muted-border-color)', borderRadius: 'var(--pico-border-radius)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <span style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', display: 'block' }}>{prod?.nombre}</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                            <strong style={{ fontSize: '1rem' }}>{entregado}</strong>
                                            <small style={{ fontSize: '0.625rem', color: 'var(--pico-muted-color)' }}>/ {carga}</small>
                                        </div>
                                    </div>
                                    <div style={{ 
                                      padding: '0.25rem 0.5rem', 
                                      borderRadius: '0.5rem', 
                                      backgroundColor: disponible <= 5 ? 'rgba(255,0,0,0.1)' : 'rgba(0,0,255,0.1)',
                                      color: disponible <= 5 ? 'red' : 'blue',
                                      textAlign: 'center'
                                    }}>
                                        <span style={{ fontSize: '0.5rem', fontWeight: 900, display: 'block' }}>Disp.</span>
                                        <strong style={{ fontSize: '0.75rem' }}>{disponible}</strong>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </article>
            )}
            
            <div className="grid">
                <article style={{ padding: 0 }}>
                    <header style={{ padding: '1rem' }}><h6 style={{ margin: 0 }}>Ritmo de Entrega (Envases)</h6></header>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, color: 'var(--pico-primary)' }}>{entregasHoy}</h2>
                            <small style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Hoy</small>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--pico-muted-border-color)' }}>
                            <h2 style={{ margin: 0, color: 'var(--pico-muted-color)' }}>{entregasAyer}</h2>
                            <small style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Ayer</small>
                        </div>
                    </div>
                </article>

                <article style={{ textAlign: 'center' }}>
                    <header><h6 style={{ margin: 0 }}>Total Mensual</h6></header>
                    <h1 style={{ margin: '0.5rem 0', color: 'var(--pico-primary)' }}>{entregasTotal}</h1>
                    <small>Productos Retornables</small>
                </article>
            </div>

            <article>
                <header><h6 style={{ margin: 0 }}>Progreso Diario de Entregas</h6></header>
                <div style={{ height: '260px' }}>
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
            </article>
        </div>
    );
};

export default InternalVendorDashboard;
