
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

export default plugins;
