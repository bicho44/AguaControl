import React from 'react';

export const ProveedoresSettings: React.FC<{ settings: any, updateSettings: (settings: any) => void }> = ({ settings, updateSettings }) => {
    const isEnabled = settings?.proveedoresConfig?.enabled || false;

    const handleToggle = () => {
        updateSettings({
            ...settings,
            proveedoresConfig: {
                ...(settings?.proveedoresConfig || {}),
                enabled: !isEnabled
            }
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Módulo de Proveedores</h4>
                    <p className="text-sm text-gray-500">Gestión de facturas y pagos (aparta la gestión de gastos fijos)</p>
                </div>
                <button
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${isEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                </button>
            </div>
            {isEnabled && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    El módulo se encuentra activado. Puedes acceder desde el menú lateral para gestionar proveedores, facturas de compra y pagos.
                </div>
            )}
        </div>
    );
};
