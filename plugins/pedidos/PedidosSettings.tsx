import React from 'react';
import AppButton from '../../components/ui/AppButton';

const PedidosSettings: React.FC<{ settings: any; updateSettings: (s: any) => void }> = ({ settings, updateSettings }) => {
    const enabled = settings?.pedidosConfig?.enabled || false;

    return (
        <div className="space-y-4">
            <label className="flex items-start gap-3 p-4 border dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input 
                    type="checkbox" 
                    className="mt-1 w-5 h-5 text-primary-600 rounded"
                    checked={enabled}
                    onChange={(e) => updateSettings({ 
                        pedidosConfig: { 
                            ...settings.pedidosConfig, 
                            enabled: e.target.checked 
                        } 
                    })}
                />
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Habilitar Gestión de Pedidos</h3>
                    <p className="text-sm text-gray-500">Activa el módulo completo de toma de pedidos anticipados. Recuerda que además debes darle acceso individual a cada usuario desde la gestión de Usuarios.</p>
                </div>
            </label>
        </div>
    );
};

export default PedidosSettings;
