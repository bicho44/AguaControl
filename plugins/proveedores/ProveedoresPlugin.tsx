import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDataStore } from '../../hooks/useDataStore';
import { useNotification } from '../../context/NotificationContext';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import SearchableSelect from '../../components/SearchableSelect';
import Modal from '../../components/Modal';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
    Proveedor, 
    FacturaProveedor, 
    PagoProveedor, 
    EstadoFacturaProveedor,
    MetodoPago
} from '../../types';
import ProveedoresList from './ProveedoresList';
import FacturasList from './FacturasList';
import PagosList from './PagosList';

export const ProveedoresPlugin: React.FC = () => {
    const { 
        proveedores, 
        facturasProveedor, 
        pagosProveedor,
        empresaSettings,
        addLog
    } = useDataStore();
    const { user } = useAuth();
    const { showNotification } = useNotification();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'proveedores' | 'facturas' | 'pagos'>('dashboard');

    if (!empresaSettings.proveedoresConfig?.enabled) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h2 className="text-xl font-bold dark:text-white">Módulo Desactivado</h2>
                <p className="text-gray-500 mt-2">El módulo de Proveedores se encuentra desactivado.</p>
                <p className="text-gray-500 text-sm mt-1">Actívalo desde Configuración Sistema.</p>
            </div>
        );
    }

    const renderDashboard = () => {
        // Cálculo de métricas
        const facturasPendientes = facturasProveedor.filter(f => f.estado === EstadoFacturaProveedor.PENDIENTE || f.estado === EstadoFacturaProveedor.PAGADO_PARCIAL);
        const totalDeuda = facturasPendientes.reduce((sum, f) => sum + (f.saldoPagar || 0), 0);
        
        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Dashboard Proveedores</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-4">
                        <p className="text-sm font-bold text-purple-600 dark:text-purple-400">Total Deuda a Proveedores</p>
                        <p className="text-3xl font-black text-gray-800 dark:text-white mt-2">${totalDeuda.toFixed(2)}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold dark:text-white">Próximos Vencimientos (Facturas Impagas)</h3>
                    <div className="space-y-3">
                        {facturasPendientes.map(f => {
                            const prov = proveedores.find(p => p.id === f.proveedorId);
                            return (
                                <Card key={f.id} className="p-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{prov?.nombre || 'Desconocido'}</p>
                                            <p className="text-xs text-gray-500">Factura: {f.numero} - Vencimiento: {f.fechaVencimiento}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-red-500">${(f.saldoPagar || 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                        {facturasPendientes.length === 0 && (
                            <p className="text-sm text-gray-500">No hay vencimientos pendientes.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 pb-24">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/30">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Proveedores & Compras</h1>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">v1.0.0</span>
                    </div>
                    <p className="text-sm text-gray-500">Gestión de facturas y cuentas corrientes</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 gap-1">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                >
                    Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('proveedores')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'proveedores' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                >
                    Proveedores
                </button>
                <button 
                    onClick={() => setActiveTab('facturas')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'facturas' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                >
                    Facturas
                </button>
                <button 
                    onClick={() => setActiveTab('pagos')}
                    className={`py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'pagos' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                >
                    Pagos
                </button>
            </div>

            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'proveedores' && <ProveedoresList />}
            {activeTab === 'facturas' && <FacturasList />}
            {activeTab === 'pagos' && <PagosList />}
        </div>
    );
};

export default ProveedoresPlugin;
