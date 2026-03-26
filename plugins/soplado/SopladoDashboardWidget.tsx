
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
        <div className="space-y-4">
            {/* Quick Actions for Soplador */}
            {isSoplador && (
                <div className="grid grid-cols-2 gap-3">
                    <AppButton 
                        onClick={() => onAction('produccion')}
                        className="h-24 flex flex-col gap-2 rounded-2xl shadow-lg shadow-primary-500/20"
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Cargar Soplado</span>
                    </AppButton>
                    <AppButton 
                        variant="secondary"
                        onClick={() => onAction('entrega')}
                        className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-primary-100 dark:border-gray-700"
                    >
                        <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-primary-600">Registrar Entrega</span>
                    </AppButton>
                </div>
            )}

            {/* Stock Alerts */}
            {lowStockPreformas.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="font-bold text-sm uppercase tracking-wider">Alerta de Stock Crítico</span>
                    </div>
                    <div className="space-y-1">
                        {lowStockPreformas.map(p => (
                            <p key={p.id} className="text-xs text-red-700 dark:text-red-300">
                                <span className="font-bold">{p.color} ({p.peso}g)</span>: Quedan solo {p.stockActual} unidades.
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Production Chart */}
            <Card title="Evolución de Soplado (7 días)">
                <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                            <Tooltip 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                                cursor={{fill: '#f3f4f6'}}
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
