
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
}
