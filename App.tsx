
import React, { useState, useEffect } from 'react';
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
import RutasView from './views/RutasView';
import LoginView from './views/LoginView';
import SetupView from './views/SetupView';
import { useDataStore } from './hooks/useDataStore';
import { View, Rol } from './types';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Notification from './components/Notification';
import { AuthProvider, useAuth } from './context/AuthContext';
import { app as firebaseApp } from './firebase/config';

// --- Configuración de la Versión ---
const APP_VERSION = '2.6.0 (Rutas Matrix)';

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
  const { user, loading: authLoading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const dataStore = useDataStore();
  
  useEffect(() => {
    if (user && user.rol === Rol.REPARTIDOR) {
      setCurrentView('remitos');
    } else if (user) {
      setCurrentView('dashboard');
    }
  }, [user]);

  if (authLoading) {
      return <div className="flex h-screen items-center justify-center dark:bg-gray-900"><div className="text-primary-600 dark:text-white">Cargando...</div></div>;
  }

  if (!user) {
      return <LoginView />;
  }

  const renderView = () => {
    // Seguridad y redirección para Repartidor
    if (user.rol === Rol.REPARTIDOR && !['remitos', 'clientes'].includes(currentView)) {
      return <RemitosView 
                remitos={dataStore.remitos} 
                clientes={dataStore.clientes} 
                vendedores={dataStore.usuarios}
                productos={dataStore.productos}
                registrosPago={dataStore.registrosPago}
                addRemito={dataStore.addRemito}
                updateRemito={dataStore.updateRemito}
                deleteRemito={dataStore.deleteRemito}
                addCliente={dataStore.addCliente}
                currentUser={user}
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
                  productos={dataStore.productos}
                  addPagoManual={dataStore.addPagoManual}
                  addGasto={dataStore.addGasto}
                  addVentaVendedor={dataStore.addVentaVendedor}
                  addCliente={dataStore.addCliente}
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
                  addCliente={dataStore.addCliente}
                  currentUser={user}
                />;
      case 'clientes':
        return <ClientesView 
                  clientes={dataStore.clientes}
                  remitos={dataStore.remitos}
                  productos={dataStore.productos}
                  contratos={dataStore.contratos}
                  servicios={dataStore.servicios}
                  registrosPago={dataStore.registrosPago}
                  addCliente={dataStore.addCliente}
                  updateCliente={dataStore.updateCliente}
                  deleteCliente={dataStore.deleteCliente}
                  reactivarCliente={dataStore.reactivarCliente}
                  deleteContrato={dataStore.deleteContrato}
                  addContrato={dataStore.addContrato}
                  updateContrato={dataStore.updateContrato}
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
      case 'rutas':
        return <RutasView
                  clientes={dataStore.clientes}
                  usuarios={dataStore.usuarios}
                  updateRutasMasivo={dataStore.updateRutasMasivo}
               />;
      case 'importar':
        return <ImportarView 
                  clientes={dataStore.clientes} 
                  remitos={dataStore.remitos}   
                  productos={dataStore.productos}
                  addMultipleClientes={dataStore.addMultipleClientes}
                  deleteAllClientes={dataStore.deleteAllClientes}
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
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen relative overflow-x-hidden">
      {/* Backdrop para cerrar el menú en móviles */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isSidebarOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={user}
        empresaSettings={dataStore.empresaSettings}
        appVersion={APP_VERSION}
      />

      <div className="md:ml-64 p-4 sm:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-4">
            <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)} 
                className="md:hidden p-2 bg-white dark:bg-gray-800 shadow-sm rounded-md border dark:border-gray-700"
            >
                <svg className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            </button>
            <button 
                onClick={logout} 
                className="ml-auto px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
            >
                Cerrar Sesión
            </button>
        </div>
        <main>{renderView()}</main>
      </div>
    </div>
  );
}

function App() {
  // Comprobamos si Firebase está inicializado
  const [isConfigured, setIsConfigured] = useState(!!firebaseApp);

  const handleConfigured = () => {
      window.location.reload();
  };

  if (!isConfigured) {
      return <SetupView onConfigured={handleConfigured} />;
  }

  return (
    <AuthProvider>
        <NotificationProvider>
            <AppContent />
            <NotificationContainer />
        </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
