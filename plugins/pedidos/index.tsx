import React from 'react';
import { PackageSearchIcon } from 'lucide-react';
import { AppPlugin } from '../types';
import { Rol } from '../../types';
import PedidosPluginView from './PedidosPluginView';
import PedidosDashboardWidget from './PedidosDashboardWidget';
import PedidosSettings from './PedidosSettings';

const PedidosPluginConfig: AppPlugin = {
  id: 'pedidos',
  name: 'Gestión de Pedidos',
  label: 'Pedidos',
  icon: <PackageSearchIcon className="w-5 h-5" />,
  roles: [Rol.ADMIN, Rol.VENDEDOR],
  component: PedidosPluginView,
  dashboardWidget: PedidosDashboardWidget,
  settingsComponent: PedidosSettings,
  isEnabled: (settings) => settings?.pedidosConfig?.enabled || false
};

export default PedidosPluginConfig;
