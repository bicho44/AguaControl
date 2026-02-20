
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
  { view: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR] },
  // Remitos: Solo para Admins o Repartidores INTERNOS
  { view: 'remitos', label: 'Remitos', icon: <DocumentIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'planillas', label: 'Control Stock', icon: <ClipboardCheckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'rutas', label: 'Hoja de Ruta', icon: <MapIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'caja', label: 'Caja', icon: <CashIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'cuentacorriente', label: 'Cta. Corriente', icon: <BookOpenIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'facturas', label: 'Facturas', icon: <ReceiptIcon />, roles: [Rol.ADMINISTRADOR] },
];

// Grupo 2: Gestión / Catálogos
const managementNavItems: NavItem[] = [
  // Clientes: Solo para Admins o Repartidores INTERNOS (Externos gestionan su propia cartera en otro lado si quieren)
  { view: 'clientes', label: 'Clientes', icon: <UsersIcon />, roles: [Rol.ADMINISTRADOR, Rol.REPARTIDOR], excludeExternal: true },
  { view: 'contratos', label: 'Contratos', icon: <HandshakeIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'servicios', label: 'Servicios', icon: <ClipboardListIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'productos', label: 'Productos', icon: <CubeIcon />, roles: [Rol.ADMINISTRADOR] },
];

// Grupo 3: Sistema
const systemNavItems: NavItem[] = [
  { view: 'usuarios', label: 'Usuarios', icon: <TruckIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'importar', label: 'Imp./Exp. Datos', icon: <UploadIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'settings', label: 'Configuración', icon: <CogIcon />, roles: [Rol.ADMINISTRADOR] },
  { view: 'logs', label: 'Logs de Sistema', icon: <div className="text-xs font-mono font-bold bg-gray-200 dark:bg-gray-600 rounded px-1">LOG</div>, roles: [Rol.ADMINISTRADOR] },
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
  const group3 = filterItems(systemNavItems);

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
    <aside className={`fixed top-0 left-0 z-50 w-64 h-screen transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl md:shadow-none`}>
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

        <div className="flex-grow space-y-4">
            {renderNavList(group1)}
            
            {group2.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group2)}
                </>
            )}

            {group3.length > 0 && (
                <>
                    <hr className="border-gray-200 dark:border-gray-700" />
                    {renderNavList(group3)}
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
