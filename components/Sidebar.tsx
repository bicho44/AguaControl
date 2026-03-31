import React from 'react';
import { View, Rol, User } from '../types';
import plugins from '../plugins';
import ChartBarIcon from './icons/ChartBarIcon';
import ClipboardListIcon from './icons/ClipboardListIcon';
import UsersIcon from './icons/UsersIcon';
import CubeIcon from './icons/CubeIcon';
import CogIcon from './icons/CogIcon';
import CashIcon from './icons/CashIcon';
import MapIcon from './icons/MapIcon';
import HandshakeIcon from './icons/HandshakeIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import TruckIcon from './icons/TruckIcon';
import ClipboardCheckIcon from './icons/ClipboardCheckIcon';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  onClose: () => void;
  currentUser: User;
  empresaSettings: any;
  appVersion: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  isSidebarOpen, 
  onClose,
  currentUser,
  empresaSettings,
  appVersion
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR, Rol.REPARTIDOR, Rol.SOPLADOR] },
    { id: 'remitos', label: 'Remitos', icon: <ClipboardListIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR, Rol.REPARTIDOR] },
    { id: 'caja', label: 'Caja', icon: <CashIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR] },
    { id: 'clientes', label: 'Clientes', icon: <UsersIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR, Rol.REPARTIDOR] },
    { id: 'rutas', label: 'Rutas', icon: <MapIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR] },
    { id: 'productos', label: 'Productos', icon: <CubeIcon />, roles: [Rol.ADMIN] },
    { id: 'contratos', label: 'Abonos/Comodatos', icon: <HandshakeIcon />, roles: [Rol.ADMIN, Rol.VENDEDOR] },
    { id: 'planillas', label: 'Planillas', icon: <ClipboardCheckIcon />, roles: [Rol.ADMIN] },
    { id: 'usuarios', label: 'Usuarios', icon: <UsersIcon />, roles: [Rol.ADMIN] },
    { id: 'settings', label: 'Configuración', icon: <CogIcon />, roles: [Rol.ADMIN] },
    { id: 'logs', label: 'Logs Sistema', icon: <BookOpenIcon />, roles: [Rol.ADMIN] },
  ];

  const handleNavClick = (id: View) => {
    setCurrentView(id);
    onClose();
  };

  return (
    <nav>
      <ul>
        <li>
          <strong>{empresaSettings?.nombre || 'AguaControl'}</strong>
          <br />
          <small>{currentUser.nombre} ({currentUser.rol})</small>
        </li>
      </ul>
      <ul>
        {menuItems
          .filter(item => item.roles.includes(currentUser.rol))
          .map((item) => (
            <li key={item.id}>
              <a 
                href="#" 
                className={currentView === item.id ? '' : 'secondary'}
                onClick={(e) => { e.preventDefault(); handleNavClick(item.id as View); }}
              >
                <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
                {item.label}
              </a>
            </li>
          ))}
        
        {/* Plugins */}
        {plugins
          .filter(p => p.roles.includes(currentUser.rol))
          .map(plugin => (
            <li key={plugin.id}>
              <a 
                href="#" 
                className={currentView === `plugin_${plugin.id}` ? '' : 'secondary'}
                onClick={(e) => { e.preventDefault(); handleNavClick(`plugin_${plugin.id}` as View); }}
              >
                <span style={{ marginRight: '0.5rem' }}>{plugin.icon}</span>
                {plugin.name}
              </a>
            </li>
          ))}
      </ul>
      <footer>
        <small>v{appVersion}</small>
      </footer>
    </nav>
  );
};

export default Sidebar;