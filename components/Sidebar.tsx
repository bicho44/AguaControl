import React from 'react';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TruckIcon } from './icons/TruckIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CubeIcon } from './icons/CubeIcon';
import { CashIcon } from './icons/CashIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { ReceiptIcon } from './icons/ReceiptIcon';
import { CogIcon } from './icons/CogIcon';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { ClipboardCheckIcon } from './icons/ClipboardCheckIcon';
import { MapIcon } from './icons/MapIcon';
import { View, Usuario, Rol, EmpresaSettings, TipoVendedor } from '../types';
import plugins from '../plugins';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  onClose: () => void;
  currentUser: Usuario;
  empresaSettings: EmpresaSettings;
  appVersion: string;
}

interface NavItem {
  view: View;
  label: string;
  icon: React.ReactElement;
  roles: Rol[];
  excludeExternal?: boolean;
}

const mainNavItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR, Rol.SOPLADOR] },
  { view: 'caja', label: 'Caja', icon: <CashIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'remitos', label: 'Remitos', icon: <DocumentIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'planillas', label: 'Stock y Cargas', icon: <ClipboardCheckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'rutas', label: 'Hoja de Ruta', icon: <MapIcon />, roles: [Rol.ADMINISTRADOR] },
];

const managementNavItems: NavItem[] = [
  { view: 'clientes', label: 'Clientes', icon: <UsersIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'cuentacorriente', label: 'Cta. Corriente', icon: <BookOpenIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'facturas', label: 'Facturas', icon: <ReceiptIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'contratos', label: 'Contratos', icon: <HandshakeIcon />, roles: [Rol.ADMINISTRADOR] },
];

const catalogNavItems: NavItem[] = [
  { view: 'servicios', label: 'Servicios', icon: <ClipboardListIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'productos', label: 'Productos', icon: <CubeIcon />, roles: [Rol.ADMINISTRADOR] },
];

const systemNavItems: NavItem[] = [
  { view: 'usuarios', label: 'Usuarios', icon: <TruckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'importar', label: 'Imp./Exp. Datos', icon: <UploadIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'settings', label: 'Configuración', icon: <CogIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'logs', label: 'Logs de Sistema', icon: <span style={{fontSize: '10px', fontWeight: 'bold'}}>LOG</span>, roles: [Rol.ADMINISTRADOR] },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onClose, currentUser, empresaSettings, appVersion }) => {
  const filterItems = (items: NavItem[]) => items.filter(item => {
    if (!item.roles.includes(currentUser.rol)) return false;
    if (item.excludeExternal && currentUser.tipo === TipoVendedor.EXTERNO) return false;
    return true;
  });

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (window.innerWidth < 992) onClose();
  };

  const renderNavList = (items: NavItem[]) => (
    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
      {filterItems(items).map(item => (
        <li key={item.view} style={{ marginBottom: '0.25rem' }}>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); handleNavClick(item.view); }} 
            className={currentView === item.view ? "" : "secondary outline"} 
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--pico-border-radius)',
                textDecoration: 'none',
                backgroundColor: currentView === item.view ? 'var(--pico-primary-background)' : 'transparent',
                color: currentView === item.view ? 'var(--pico-primary-inverse)' : 'var(--pico-secondary)'
            }}
          >
            {item.icon} <span style={{fontSize: '0.9rem', fontWeight: currentView === item.view ? 'bold' : 'normal'}}>{item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <nav>
      <header style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {empresaSettings.logo ? <img src={empresaSettings.logo} alt="Logo" style={{ maxHeight: '50px' }} /> : <strong>{empresaSettings.nombreFantasia || empresaSettings.nombre}</strong>}
      </header>
      {renderNavList(mainNavItems)}
      <details open><summary className="secondary" style={{fontSize: '0.8rem'}}>GESTIÓN</summary>{renderNavList(managementNavItems)}</details>
      <details><summary className="secondary" style={{fontSize: '0.8rem'}}>CATÁLOGOS</summary>{renderNavList(catalogNavItems)}</details>
      <details><summary className="secondary" style={{fontSize: '0.8rem'}}>SISTEMA</summary>{renderNavList(systemNavItems)}</details>
      {plugins.filter(p => p.roles.includes(currentUser.rol)).length > 0 && (
        <details>
          <summary className="secondary" style={{fontSize: '0.8rem'}}>ACCESORIOS</summary>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {plugins.filter(p => p.roles.includes(currentUser.rol)).map(plugin => (
              <li key={plugin.id}>
                <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick(`plugin_${plugin.id}` as View); }} className={currentView === `plugin_${plugin.id}` ? "" : "secondary"} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {plugin.icon} <span style={{fontSize: '0.9rem'}}>{plugin.name || (plugin as any).label}</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <footer style={{ marginTop: '2rem', borderTop: '1px solid var(--pico-muted-border-color)', paddingTop: '1rem' }}>
        <small style={{ display: 'block', textAlign: 'center', color: 'var(--pico-muted-color)' }}>v{appVersion}</small>
      </footer>
    </nav>
  );
};

export default Sidebar;