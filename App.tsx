import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import RemitosView from './views/RemitosView';
import ClientesView from './views/ClientesView';
import UsuariosView from './views/VendedoresView';
import ProductosView from './views/ProductosView';
import ServiciosView from './views/ServiciosView';
import CuentaCorrienteView from './views/FacturasView';
import FacturasListView from './views/FacturasListView';
import ImportarView from './views/ImportarView';
import CajaView from './views/CajaView';
import SettingsView from './views/SettingsView';
import ContratosView from './views/ContratosView';
import PlanillasView from './views/PlanillasView';
import { useDataStore } from './hooks/useDataStore';
// FIX: Corrected import from types.ts
import { View, Usuario, Rol } from './types';
import { mockUsuarios } from './data/mockData';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Notification from './components/Notification';

// --- Configuración de la Versión ---
const APP_VERSION = '2.5';

// --- Simulación de Sesión de Usuario ---
const SIMULATED_USER_INDEX = 1; 
// -----------------------------------------

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const dataStore = useDataStore();
  
  const [currentUser, setCurrentUser] = useState<Usuario>(mockUsuarios[SIMULATED_USER_INDEX]);

  React.useEffect(() => {
    if (currentUser.rol === Rol.REPARTIDOR) {
      setCurrentView('remitos');
    } else {
      setCurrentView('dashboard');
    }
  }, [currentUser]);

  const renderView = () => {
    if (currentUser.rol === Rol.REPARTIDOR && !['remitos', 'clientes'].includes(currentView)) {
      return <RemitosView 
                remitos={dataStore.remitos} 
                clientes={dataStore.clientes} 
                vendedores={dataStore.usuarios}
                productos={dataStore.productos}
                registrosPago={dataStore.registrosPago}
                addRemito={dataStore.addRemito}
                updateRemito={dataStore.updateRemito}
                deleteRemito={dataStore.deleteRemito}
                currentUser={currentUser}
              />;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView 
                  remitos={dataStore.remitos} 
                  productos={dataStore.productos} 
                  registrosPago={dataStore.registrosPago}
                  gastos={dataStore.gastos}
                  usuarios={dataStore.usuarios}
                  clientes={dataStore.clientes}
                  ventasVendedor={dataStore.ventasVendedor}
                  empresaSettings={dataStore.empresaSettings}
                />;
      case 'caja':
        return <CajaView 
                  registrosPago={dataStore.registrosPago}
                  gastos={dataStore.gastos}
                  clientes={dataStore.clientes}
                  vendedores={dataStore.usuarios}
                  remitos={dataStore.remitos}
                  facturas={dataStore.facturas}
                  ventasVendedor={dataStore.ventasVendedor}
                  addPagoManual={dataStore.addPagoManual}
                  addGasto={dataStore.addGasto}
                  updateRegistroPago={dataStore.updateRegistroPago}
                  updateGasto={dataStore.updateGasto}
                  deleteRegistroPago={dataStore.deleteRegistroPago}
                  deleteGasto={dataStore.deleteGasto}
                  updateRemito={dataStore.updateRemito}
                  updateVentaVendedor={dataStore.updateVentaVendedor}
                />;
      case 'cuentacorriente':
        return <CuentaCorrienteView
                  clientes={dataStore.clientes}
                  remitos={dataStore.remitos}
                  facturas={dataStore.facturas}
                  registrosPago={dataStore.registrosPago}
                  productos={dataStore.productos}
                  addFactura={dataStore.addFactura}
                  addPagoToFactura={dataStore.addPagoToFactura}
                />;
      case 'facturas':
        return <FacturasListView
                  facturas={dataStore.facturas}
                  clientes={dataStore.clientes}
                  remitos={dataStore.remitos}
                  productos={dataStore.productos}
                  registrosPago={dataStore.registrosPago}
                  addPagoToFactura={dataStore.addPagoToFactura}
                  empresaSettings={dataStore.empresaSettings}
                  markFacturaAsSent={dataStore.markFacturaAsSent}
                />;
      case 'remitos':
        return <RemitosView 
                  remitos={dataStore.remitos} 
                  clientes={dataStore.clientes} 
                  vendedores={dataStore.usuarios}
                  productos={dataStore.productos}
                  registrosPago={dataStore.registrosPago}
                  addRemito={dataStore.addRemito}
                  updateRemito={dataStore.updateRemito}
                  deleteRemito={dataStore.deleteRemito}
                  currentUser={currentUser}
                />;
      case 'clientes':
        return <ClientesView 
                  clientes={dataStore.clientes}
                  remitos={dataStore.remitos}
                  productos={dataStore.productos}
                  contratos={dataStore.contratos}
                  servicios={dataStore.servicios}
                  addCliente={dataStore.addCliente}
                  updateCliente={dataStore.updateCliente}
                  deleteCliente={dataStore.deleteCliente}
                  reactivarCliente={dataStore.reactivarCliente}
                />;
      case 'usuarios':
        return <UsuariosView
                  usuarios={dataStore.usuarios}
                  registrosPago={dataStore.registrosPago}
                  remitos={dataStore.remitos}
                  clientes={dataStore.clientes}
                  productos={dataStore.productos}
                  addUsuario={dataStore.addUsuario}
                  updateUsuario={dataStore.updateUsuario}
                  ventasVendedor={dataStore.ventasVendedor}
                  addVentaVendedor={dataStore.addVentaVendedor}
                />;
      case 'productos':
        return <ProductosView
                  productos={dataStore.productos}
                  addProducto={dataStore.addProducto}
                  updateProducto={dataStore.updateProducto}
                  deleteProducto={dataStore.deleteProducto}
                  reactivarProducto={dataStore.reactivarProducto}
                />;
      case 'servicios':
        return <ServiciosView
                  servicios={dataStore.servicios}
                  productos={dataStore.productos}
                  addServicio={dataStore.addServicio}
                  updateServicio={dataStore.updateServicio}
                  deleteServicio={dataStore.deleteServicio}
                  reactivarServicio={dataStore.reactivarServicio}
                />;
      case 'contratos':
        return <ContratosView
                  contratos={dataStore.contratos}
                  clientes={dataStore.clientes}
                  productos={dataStore.productos}
                  servicios={dataStore.servicios}
                  addContrato={dataStore.addContrato}
                  updateContrato={dataStore.updateContrato}
                  deleteContrato={dataStore.deleteContrato}
                />;
      case 'planillas': 
        return <PlanillasView
                  planillas={dataStore.planillas}
                  usuarios={dataStore.usuarios}
                  productos={dataStore.productos}
                  remitos={dataStore.remitos}
                  addPlanilla={dataStore.addPlanilla}
                  updatePlanilla={dataStore.updatePlanilla}
               />;
      case 'importar':
        return <ImportarView 
                  clientes={dataStore.clientes} 
                  remitos={dataStore.remitos}   
                  addMultipleClientes={dataStore.addMultipleClientes}
                  addMultipleRemitos={dataStore.addMultipleRemitos}
                />;
      case 'settings':
          return <SettingsView
                    settings={dataStore.empresaSettings}
                    updateSettings={dataStore.updateEmpresaSettings}
                  />;
      default:
        return <DashboardView 
                  remitos={dataStore.remitos} 
                  productos={dataStore.productos}
                  registrosPago={dataStore.registrosPago}
                  gastos={dataStore.gastos}
                  usuarios={dataStore.usuarios}
                  clientes={dataStore.clientes}
                  ventasVendedor={dataStore.ventasVendedor}
                  empresaSettings={dataStore.empresaSettings}
                />;
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isSidebarOpen={isSidebarOpen}
        currentUser={currentUser}
        empresaSettings={dataStore.empresaSettings}
        appVersion={APP_VERSION}
      />
      <div className="md:ml-64 p-4 sm:p-6 lg:p-8">
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)} 
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-200 dark:bg-gray-700 rounded-md"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
        <main>{renderView()}</main>
      </div>
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
      <NotificationContainer />
    </NotificationProvider>
  );
}

export default App;