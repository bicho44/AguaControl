
import { AppPlugin } from './types';

// Cargamos dinámicamente todos los plugins que tengan un archivo index.tsx en su subdirectorio
// @ts-ignore
const modules = import.meta.glob('./*/index.tsx', { eager: true });

export const plugins: AppPlugin[] = Object.values(modules)
  .map((module: any) => module.default)
  .filter((plugin): plugin is AppPlugin => {
    const isValid = plugin && typeof plugin.id === 'string' && typeof plugin.name === 'string';
    if (!isValid && plugin) {
      console.warn('Plugin inválido detectado y omitido:', plugin);
    }
    return isValid;
  });

/**
 * Helper unificado para determinar si un plugin está habilitado/activo en la configuración de la empresa.
 * Soporta configuración unificada bajo settings.pluginsConfig[pluginId].enabled
 * y mantiene retrocompatibilidad con las configuraciones previas (ej: sopladoConfig o proveedoresConfig).
 */
export const isPluginEnabled = (plugin: AppPlugin, settings: any): boolean => {
  if (!settings) return true; // Por defecto asumimos activo para no bloquear flujos iniciales

  // 1. Verificación en la configuración unificada general de plugins de la empresa
  if (settings.pluginsConfig?.[plugin.id] !== undefined) {
    return settings.pluginsConfig[plugin.id].enabled === true;
  }

  // 2. Fallback de retrocompatibilidad directa específica por ID (ej. proveedoresConfig / sopladoConfig)
  const legacySelector = `${plugin.id}Config`;
  if (settings[legacySelector] && typeof settings[legacySelector].enabled === 'boolean') {
    return settings[legacySelector].enabled;
  }

  // 3. Fallback a método interno del propio plugin si lo define
  if (plugin.isEnabled) {
    return plugin.isEnabled(settings);
  }

  // 4. Por defecto, si el plugin existe y no ha sido desactivado explícitamente, se encuentra activo.
  return true;
};

export default plugins;
