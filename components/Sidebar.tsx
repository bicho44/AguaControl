
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
  excludeExternal?: boolean; // Nueva propiedad para excluir a externos
}

// Grupo 1: Operativa Diaria
const mainNavItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR, Rol.SOPLADOR] },
  { view: 'caja', label: 'Caja', icon: <CashIcon />, roles: [Rol.ADMINISTRADOR] },
// Remitos: Solo para Admins o Repartidores INTERNOS
  { view: 'remitos', label: 'Remitos', icon: <DocumentIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'planillas', label: 'Stock y Cargas', icon: <ClipboardCheckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'rutas', label: 'Hoja de Ruta', icon: <MapIcon />, roles: [Rol.ADMINISTRADOR] },
 ];

// Grupo 2: Gestión
const managementNavItems: NavItem[] = [
  // Clientes: Solo para Admins o Repartidores INTERNOS (Externos gestionan su propia cartera en otro lado si quieren)
  { view: 'clientes', label: 'Clientes', icon: <UsersIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'cuentacorriente', label: 'Cta. Corriente', icon: <BookOpenIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'facturas', label: 'Facturas', icon: <ReceiptIcon />, roles: [Rol.ADMINISTRADOR] },
 { view: 'contratos', label: 'Contratos', icon: <HandshakeIcon />, roles: [Rol.ADMINISTRADOR] },
 ];

// Grupo 3: Catálogos
const catalogNavItems: NavItem[] = [
{ view: 'servicios', label: 'Servicios', icon: <ClipboardListIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'productos', label: 'Productos', icon: <CubeIcon />, roles: [Rol.ADMINISTRADOR] },
];

// Grupo 4: Sistema
const systemNavItems: NavItem[] = [
  { view: 'usuarios', label: 'Usuarios', icon: <TruckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'importar', label: 'Imp./Exp. Datos', icon: <UploadIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'settings', label: 'Configuración', icon: <CogIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'logs', label: 'Logs de Sistema', icon: <div style={{ fontSize: '0.625rem', fontFamily: 'var(--pico-font-family-mono)', fontWeight: 'bold', backgroundColor: 'var(--pico-muted-background-color)', borderRadius: '4px', padding: '0 4px' }}>LOG</div>, roles: [Rol.ADMINISTRADOR] },
];


const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isSidebarOpen, onClose, currentUser, empresaSettings, appVersion }) => {
  
  const filterItems = (items: NavItem[]) => items.filter(item => {
      // 1. Check Rol
      const roleMatch = item.roles.includes(currentUser.rol);
      if (!roleMatch) return false;

      // 2. Check Exclusión de Externos
      if (item.excludeExternal && currentUser.tipo === TipoVendedor.EXTERNO) {
          return false;
      }

      return true;
  });

  const group1 = filterItems(mainNavItems);
  const group2 = filterItems(managementNavItems);
  const group3 = filterItems(catalogNavItems);
  const group4 = filterItems(systemNavItems);
  
  // Plugins filtrados por rol
  const pluginItems = plugins.filter(p => p.roles.includes(currentUser.rol));

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    onClose(); 
  };

  const renderNavList = (items: NavItem[]) => (
    <ul>
      {items.map(item => (
        <li key={item.view}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick(item.view);
            }}
            className={currentView === item.view ? 'active' : ''}
          >
            {item.icon}
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <aside className={isSidebarOpen ? 'open' : ''}>
      <nav>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--pico-spacing)' }}>
            {empresaSettings.logo ? (
              <img src={empresaSettings.logo} alt={empresaSettings.nombre} style={{ height: '3rem', width: 'auto' }} />
            ) : (
              <h4 style={{ margin: 0, textAlign: 'center' }}>
                {empresaSettings.nombreFantasia || empresaSettings.nombre}
              </h4>
            )}
            <button 
              onClick={onClose}
              className="outline md:hidden"
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', width: 'auto', marginBottom: 0 }}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </header>

        <div style={{ flexGrow: 1 }}>
            {renderNavList(group1)}
            
            {group2.length > 0 && (
                <>
                    <hr style={{ margin: '1rem 0' }} />
                    {renderNavList(group2)}
                </>
            )}

            {group3.length > 0 && (
                <>
                    <hr style={{ margin: '1rem 0' }} />
                    {renderNavList(group3)}
                </>
            )}
            
            {group4.length > 0 && (
                <>
                    <hr style={{ margin: '1rem 0' }} />
                    {renderNavList(group4)}
                </>
            )}

            {pluginItems.length > 0 && (
                <>
                    <hr style={{ margin: '1rem 0' }} />
                    <details open>
                        <summary style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Accesorios</summary>
                        <ul>
                            {pluginItems.map(plugin => (
                                <li key={plugin.id}>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavClick(`plugin_${plugin.id}`);
                                        }}
                                        className={currentView === `plugin_${plugin.id}` ? 'active' : ''}
                                    >
                                        {plugin.icon}
                                        {plugin.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </details>
                </>
            )}
        </div>

        <footer style={{ marginTop: 'auto', paddingTop: '1rem', textAlign: 'center', borderTop: '1px solid var(--pico-muted-border-color)' }}>
            <small style={{ color: 'var(--pico-muted-color)', fontFamily: 'var(--pico-font-family-mono)' }}>
                v{appVersion}
            </small>
        </footer>
      </nav>
    </aside>
  );
};

export default Sidebar;
