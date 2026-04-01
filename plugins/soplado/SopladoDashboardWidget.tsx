
import React from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Rol } from '../../types';

import { Preforma, Molde, ProduccionSoplado, EntregaSoplado, SopladoDashboardSettings } from './types';

interface SopladoDashboardWidgetProps {
    preformas: Preforma[];
    moldes: Molde[];
    produccion: ProduccionSoplado[];
    entregas: EntregaSoplado[];
    settings: SopladoDashboardSettings;
    onAction?: (type: 'produccion' | 'entrega') => void;
}

const SopladoDashboardWidget: React.FC<SopladoDashboardWidgetProps> = ({ 
    preformas, 
    moldes, 
    produccion, 
    entregas, 
    settings,
    onAction 
}) => {
    const { user } = useAuth();

    const isSoplador = user?.rol === Rol.SOPLADOR;

    if (!settings?.enabled) return null;

    // --- DATA PREPARATION ---
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(date => {
        const prod = produccion.filter(p => p.fecha === date).reduce((sum, p) => sum + p.cantidadProducida, 0);
        const ent = entregas.filter(e => e.fecha === date).reduce((sum, e) => sum + e.cantidad, 0);
        return {
            name: date.split('-').slice(1).join('/'),
            Producción: prod,
            Entregas: ent
        };
    });

    const lowStockPreformas = preformas.filter(p => p.stockActual <= p.puntoReposicion);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Quick Actions for Soplador */}
            {isSoplador && (
                <div className="grid">
                    <AppButton 
                        onClick={() => onAction('produccion')}
                        style={{ height: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: 'var(--pico-border-radius)' }}
                    >
                        <svg style={{ width: '32px', height: '32px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Cargar Soplado</span>
                    </AppButton>
                    <AppButton 
                        variant="secondary"
                        onClick={() => onAction('entrega')}
                        style={{ height: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: 'var(--pico-border-radius)' }}
                    >
                        <svg style={{ width: '32px', height: '32px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span>Registrar Entrega</span>
                    </AppButton>
                </div>
            )}

            {/* Stock Alerts */}
            {lowStockPreformas.length > 0 && (
                <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.2)', padding: '1rem', borderRadius: 'var(--pico-border-radius)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d32f2f', marginBottom: '0.5rem' }}>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span style={{ fontWeight: 'bold', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alerta de Stock Crítico</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {lowStockPreformas.map(p => (
                            <p key={p.id} style={{ fontSize: '0.75rem', color: '#b71c1c', margin: 0 }}>
                                <span style={{ fontWeight: 'bold' }}>{p.color} ({p.peso}g)</span>: Quedan solo {p.stockActual} unidades.
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Production Chart */}
            <Card title="Evolución de Soplado (7 días)">
                <div style={{ height: '260px', marginTop: '1rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--pico-muted-color)'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--pico-muted-color)'}} />
                            <Tooltip 
                                contentStyle={{borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-muted-border-color)', backgroundColor: 'var(--pico-card-background-color)'}}
                                cursor={{fill: 'rgba(0,0,0,0.05)'}}
                            />
                            <Legend iconType="circle" wrapperStyle={{fontSize: 12, paddingTop: 10}} />
                            <Bar dataKey="Producción" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Entregas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
};

export default SopladoDashboardWidget;
