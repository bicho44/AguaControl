import React from 'react';
import AppButton from '../../components/ui/AppButton';

const PedidosSettings: React.FC<{ settings: any; dataStore: any; updateSettings: (s: any) => void }> = ({ settings, dataStore, updateSettings }) => {
    const enabled = settings?.pedidosConfig?.enabled || false;
    const { usuarios = [], updateUsuario } = dataStore || {};

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
                    <p className="text-sm text-gray-500">Activa el módulo general de toma de pedidos. Luego habilita el acceso individual por usuario a continuación.</p>
                </div>
            </label>

            {enabled && usuarios.length > 0 && (
                <div className="border dark:border-gray-700 rounded-xl overflow-hidden mt-4">
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 border-b dark:border-gray-700">
                        <h4 className="font-bold text-sm uppercase text-gray-700 dark:text-gray-300">Permisos de Usuarios</h4>
                        <p className="text-xs text-gray-500">Activa los usuarios que podrán ver y gestionar los pedidos.</p>
                    </div>
                    <ul className="divide-y dark:divide-gray-700 max-h-64 overflow-y-auto">
                        {usuarios.map((u: any) => (
                            <li key={u.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center transition-colors">
                                <div>
                                    <p className="font-bold text-sm dark:text-white">{u.nombre}</p>
                                    <p className="text-xs text-gray-500 uppercase">{u.rol}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={u.accesoPedidos || false}
                                        onChange={() => {
                                            if(updateUsuario) {
                                                updateUsuario(u.id, { accesoPedidos: !u.accesoPedidos });
                                            }
                                        }}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PedidosSettings;
