
import React from 'react';
import { Rol } from '../types';

export interface AppPlugin {
  id: string;
  name: string;
  label: string;
  icon: React.ReactElement;
  roles: Rol[];
  component: React.ComponentType<any>;
  // Opcional: Para el futuro podemos agregar widgets al dashboard
  dashboardWidget?: React.ComponentType<any>;
  // Nuevo: Componente para inyectar configuración en SettingsView
  settingsComponent?: React.ComponentType<{
    settings: any;
    updateSettings: (newSettings: any) => void;
  }>;
  // Opcional: Determina si el plugin está globalmente habilitado
  isEnabled?: (settings: any) => boolean;
}
