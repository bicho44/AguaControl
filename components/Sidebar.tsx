
import React from 'react';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TruckIcon } from './icons/TruckIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CubeIcon } from './icons/CubeIcon';
import { CashIcon } from './icons/CashIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';

// Force sync
import { ReceiptIcon } from './icons/ReceiptIcon';
import { CogIcon } from './icons/CogIcon';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { ClipboardCheckIcon } from './icons/ClipboardCheckIcon';
import { MapIcon } from './icons/MapIcon';
import { View, Usuario, Rol, EmpresaSettings, TipoVendedor } from '../types';
import plugins, { isPluginEnabled } from '../plugins';

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
  { view: 'logs', label: 'Logs de Sistema', icon: <div className="text-xs font-mono font-bold bg-gray-200 dark:bg-gray-600 rounded px-1">LOG</div>, roles: [Rol.ADMINISTRADOR] },
];

// Grupo 5: Perfil de Usuario
const userNavItems: NavItem[] = [
    { view: 'my_account', label: 'Mi Cuenta', icon: <BookOpenIcon />, roles: [Rol.CLIENTE] },
    { view: 'my_profile', label: 'Mi Perfil', icon: <UsersIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR, Rol.SOPLADOR, Rol.CLIENTE] },
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
  const group5 = filterItems(userNavItems);
  
  // Plugins filtrados por rol y estado habilitado
  const pluginItems = plugins.filter(p => {
    if (!p.roles.includes(currentUser.rol)) return false;
    return isPluginEnabled(p, empresaSettings);
  });

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    onClose(); 
  };

  const renderNavList = (items: NavItem[]) => (
    <ul className="space-y-2 font-medium">
      {items.map(item => (
        <li key={item.view}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick(item.view);
            }}
            className={`flex items-center p-2 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group ${
              currentView === item.view ? 'bg-gray-200 dark:bg-gray-700' : ''
            }`}
          >
            <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">{item.icon}</span>
            <span className="ms-3">{item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <aside className={`fixed md:static top-0 left-0 z-50 w-64 h-full flex-shrink-0 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl md:shadow-none`}>
      <div className="h-full px-3 py-4 overflow-y-auto bg-white dark:bg-gray-800 flex flex-col border-r dark:border-gray-700">
        
        <button 
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-center ps-2.5 mb-5 h-12 flex-shrink-0">
            {empresaSettings.logo ? (
              <img src={empresaSettings.logo} alt={empresaSettings.nombre} className="h-12 w-auto max-w-full object-contain" />
            ) : (
              <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white text-center">
                {empresaSettings.nombreFantasia || empresaSettings.nombre}
              </span>
            )}
        </div>

        <div 
            onClick={() => setCurrentView('my_profile')}
            className={`flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl border cursor-pointer transition-all ${
                currentView === 'my_profile' 
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' 
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${
                currentView === 'my_profile' ? 'border-primary-400' : 'border-primary-200 dark:border-primary-800'
            }`}>
                {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.nombre} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                        {currentUser.nombre.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser.nombre}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-tight">{currentUser.rol}</p>
            </div>
        </div>

        <div className="flex-grow space-y-4">
            {renderNavList(group1)}
            
            {group2.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group2)}
                </>
            )}

            {pluginItems.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    <div className="px-3 py-2">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">Accesorios</h3>
                        <ul className="space-y-2 font-medium">
                            {pluginItems.map(plugin => (
                                <li key={plugin.id}>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavClick(`plugin_${plugin.id}`);
                                        }}
                                        className={`flex items-center p-2 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group ${
                                            currentView === `plugin_${plugin.id}` ? 'bg-gray-200 dark:bg-gray-700' : ''
                                        }`}
                                    >
                                        <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">{plugin.icon}</span>
                                        <span className="ms-3">{plugin.label}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            {group3.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group3)}
                </>
            )}
            
            {group4.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group4)}
                </>
            )}

            {group5.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group5)}
                </>
            )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500 font-mono">
                v{appVersion}
            </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
