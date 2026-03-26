
import React from 'react';
import AppButton from '../../components/ui/AppButton';
import Card from '../../components/Card';

interface SopladoSettingsProps {
  settings: any;
  updateSettings: (newSettings: any) => void;
}

const SopladoSettings: React.FC<SopladoSettingsProps> = ({ settings, updateSettings }) => {
  const config = settings.sopladoConfig || { enabled: false, integrationEnabled: false };

  const handleChange = (field: string, value: any) => {
    updateSettings({
      ...settings,
      sopladoConfig: {
        ...config,
        [field]: value
      }
    });
  };

  return (
    <Card title="Configuración de Soplado">
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
          <input 
            type="checkbox" 
            id="sopladoEnabled"
            checked={config.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
          />
          <div className="flex-1">
            <label htmlFor="sopladoEnabled" className="font-bold text-gray-800 dark:text-gray-200 cursor-pointer">Habilitar Plugin de Soplado</label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Activa el módulo de producción de bidones descartables.</p>
          </div>
        </div>

        {config.enabled && (
          <div className="space-y-4 animate-fade-in pl-8">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
              <input 
                type="checkbox" 
                id="integrationEnabled"
                checked={config.integrationEnabled}
                onChange={(e) => handleChange('integrationEnabled', e.target.checked)}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <div className="flex-1">
                <label htmlFor="integrationEnabled" className="font-bold text-gray-800 dark:text-gray-200 cursor-pointer">Integración con Stock de Planta</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Las entregas a "Planta" sumarán automáticamente al stock de productos descartables.</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-tighter">Alertas de Stock</h4>
              <p className="text-xs text-gray-500">
                Las alertas de stock bajo se muestran visualmente en el Dashboard cuando una preforma cae por debajo del punto de reposición definido en el inventario.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SopladoSettings;
