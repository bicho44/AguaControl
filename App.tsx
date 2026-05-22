
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import RemitosView from './views/RemitosView';
import ClientesView from './views/ClientesView';
import UsuariosView from './views/UsuariosView';
import ProductosView from './views/ProductosView';
import ServiciosView from './views/ServiciosView';
import FacturacionView from './views/FacturacionView';
import FacturasListView from './views/FacturasListView';
import ImportarView from './views/ImportarView';
import CajaView from './views/CajaView';
import SettingsView from './views/SettingsView';
import ContratosView from './views/ContratosView';
import RutasView from './views/RutasView';
import GestionStockView from './views/GestionStockView';
import SystemLogsView from './views/SystemLogsView'; // Nueva vista
import LoginView from './views/LoginView';
import SetupView from './views/SetupView';
import MyProfileView from './views/MyProfileView';
import MyCustomerAccountView from './views/MyCustomerAccountView';
import plugins from './plugins';
import { useDataStore } from './hooks/useDataStore';
import { View, Rol, LogLevel } from './types';
import PluginErrorBoundary from './components/PluginErrorBoundary';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Notification from './components/Notification';
import { AuthProvider, useAuth } from './context/AuthContext';
import { app as firebaseApp } from './firebase/config';

// --- Configuración de la Versión ---
const APP_VERSION = '2.9.0 (Integración Soplado)';

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
  
  // --- Global Error Capture ---
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      dataStore.addLog({
        level: LogLevel.ERROR,
        message: event.message,
        details: event.error?.stack || 'No stack trace',
        userEmail: user?.email,
        userId: user?.id,
        route: currentView
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      dataStore.addLog({
        level: LogLevel.ERROR,
        message: 'Unhandled Promise Rejection',
        details: JSON.stringify(event.reason),
        userEmail: user?.email,
        userId: user?.id,
        route: currentView
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [user, currentView, dataStore]);
  // ----------------------------

  useEffect(() => {
    // Al iniciar sesión, siempre vamos al dashboard, independientemente del rol.
    if (user) {
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
    // Seguridad: Permitir 'dashboard' también a los repartidores y sopladores
    const allowedViewsForRepartidor: View[] = ['dashboard', 'remitos', 'clientes', 'my_profile'];
    const allowedViewsForSoplador: View[] = ['dashboard', 'my_profile'];
    const allowedViewsForCliente: View[] = ['dashboard', 'my_account', 'my_profile'];
    
    // Props comunes para Dashboard (ahora incluye funciones de acción)
    const dashboardProps = {
        remitos: dataStore.remitos,
        productos: dataStore.productos,
        registrosPago: dataStore.registrosPago,
        gastos: dataStore.gastos,
        usuarios: dataStore.usuarios,
        clientes: dataStore.clientes,
        ventasVendedor: dataStore.ventasVendedor,
        empresaSettings: dataStore.empresaSettings,
        causasRecambio: dataStore.causasRecambio,
        planillas: dataStore.planillas,
        movimientosPlanta: dataStore.movimientosStockPlanta,
        facturas: dataStore.facturas,
        // Soplado data
        preformas: dataStore.preformas,
        moldes: dataStore.moldes,
        produccionSoplado: dataStore.produccionSoplado,
        entregasSoplado: dataStore.entregasSoplado,
        // Acciones para botones rápidos
        addRemito: dataStore.addRemito,
        addPagoManual: dataStore.addPagoManual,
        addGasto: dataStore.addGasto,
        addVentaVendedor: dataStore.addVentaVendedor,
        addCliente: dataStore.addCliente,
        addPagoToFactura: dataStore.addPagoToFactura,
        setCurrentView: setCurrentView
    };

    if (user.rol === Rol.REPARTIDOR && !allowedViewsForRepartidor.includes(currentView)) {
      return <DashboardView {...dashboardProps} />;
    }

    if (user.rol === Rol.SOPLADOR && !allowedViewsForSoplador.includes(currentView) && !currentView.startsWith('plugin_')) {
      return <DashboardView {...dashboardProps} />;
    }

    if (user.rol === Rol.CLIENTE && !allowedViewsForCliente.includes(currentView)) {
      return <DashboardView {...dashboardProps} />;
    }

    const renderViewWithFailsafe = (viewName: string, component: React.ReactNode) => {
      return (
        <PluginErrorBoundary 
          pluginName={viewName}
          onCatch={(error, info) => {
            console.error(`ERROR IN VIEW [${viewName}]:`, error, info);
            dataStore.addLog({
              level: LogLevel.ERROR,
              message: `Error en Vista: ${viewName}`,
              details: `${error.message}\n${info.componentStack}`,
              userEmail: user?.email,
              userId: user?.id,
              route: currentView
            });
          }}
        >
          {component}
        </PluginErrorBoundary>
      );
    };

    // --- Soporte para Plugins ---
    if (currentView.startsWith('plugin_')) {
      const pluginId = currentView.replace('plugin_', '');
      const plugin = plugins.find(p => p.id === pluginId);
      if (plugin && plugin.roles.includes(user.rol)) {
        const PluginComponent = plugin.component;
        return renderViewWithFailsafe(plugin.name, <PluginComponent />);
      }
    }
    // ----------------------------

    switch (currentView) {
      case 'dashboard':
        return renderViewWithFailsafe('Dashboard', <DashboardView {...dashboardProps} />);
      case 'caja':
        return renderViewWithFailsafe('Caja', 
          <CajaView
            registrosPago={dataStore.registrosPago}
            gastos={dataStore.gastos}
            clientes={dataStore.clientes}
            vendedores={dataStore.usuarios}
            remitos={dataStore.remitos}
            facturas={dataStore.facturas}
            ventasVendedor={dataStore.ventasVendedor}
            productos={dataStore.productos}
            dataStore={dataStore}
            addPagoManual={dataStore.addPagoManual}
            addGasto={dataStore.addGasto}
            addVentaVendedor={dataStore.addVentaVendedor}
            addRemito={dataStore.addRemito}
            addCliente={dataStore.addCliente}
            updateRegistroPago={dataStore.updateRegistroPago}
            updateGasto={dataStore.updateGasto}
            deleteRegistroPago={dataStore.deleteRegistroPago}
            deleteGasto={dataStore.deleteGasto}
            updateRemito={dataStore.updateRemito}
            updateVentaVendedor={dataStore.updateVentaVendedor}
            currentUser={user}
          />
        );
      case 'cuentacorriente':
        return renderViewWithFailsafe('Cuenta Corriente',
          <FacturacionView
            clientes={dataStore.clientes}
            remitos={dataStore.remitos}
            facturas={dataStore.facturas}
            registrosPago={dataStore.registrosPago}
            productos={dataStore.productos}
            contratos={dataStore.contratos}
            servicios={dataStore.servicios}
            addFactura={dataStore.addFactura}
            addPagoToFactura={dataStore.addPagoToFactura}
          />
        );
      case 'facturas':
        return renderViewWithFailsafe('Facturas',
          <FacturasListView
            facturas={dataStore.facturas}
            clientes={dataStore.clientes}
            remitos={dataStore.remitos}
            productos={dataStore.productos}
            registrosPago={dataStore.registrosPago}
            addPagoToFactura={dataStore.addPagoToFactura}
            empresaSettings={dataStore.empresaSettings}
            markFacturaAsSent={dataStore.markFacturaAsSent}
          />
        );
      case 'remitos':
        return renderViewWithFailsafe('Remitos',
          <RemitosView 
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
            causasRecambio={dataStore.causasRecambio}
            empresaSettings={dataStore.empresaSettings}
            facturas={dataStore.facturas}
            addPagoToFactura={dataStore.addPagoToFactura}
          />
        );
      case 'clientes':
        return renderViewWithFailsafe('Clientes',
          <ClientesView 
            clientes={dataStore.clientes}
            remitos={dataStore.remitos}
            productos={dataStore.productos}
            contratos={dataStore.contratos}
            servicios={dataStore.servicios}
            registrosPago={dataStore.registrosPago}
            usuarios={dataStore.usuarios}
            addCliente={dataStore.addCliente}
            updateCliente={dataStore.updateCliente}
            deleteCliente={dataStore.deleteCliente}
            reactivarCliente={dataStore.reactivarCliente}
            deleteContrato={dataStore.deleteContrato}
            addContrato={dataStore.addContrato}
            updateContrato={dataStore.updateContrato}
          />
        );
      case 'usuarios':
        return renderViewWithFailsafe('Usuarios',
          <UsuariosView
            usuarios={dataStore.usuarios}
            registrosPago={dataStore.registrosPago}
            remitos={dataStore.remitos}
            clientes={dataStore.clientes}
            productos={dataStore.productos}
            addUsuario={dataStore.addUsuario}
            updateUsuario={dataStore.updateUsuario}
            ventasVendedor={dataStore.ventasVendedor}
            gastos={dataStore.gastos}
            addVentaVendedor={dataStore.addVentaVendedor}
            addPagoManual={dataStore.addPagoManual}
            addGasto={dataStore.addGasto}
            updateRegistroPago={dataStore.updateRegistroPago}
            updateVentaVendedor={dataStore.updateVentaVendedor}
            deleteRegistroPago={dataStore.deleteRegistroPago}
            deleteVentaVendedor={dataStore.deleteVentaVendedor}
            addRemito={dataStore.addRemito}
            updateRemito={dataStore.updateRemito}
            deleteRemito={dataStore.deleteRemito}
            addPagoToFactura={dataStore.addPagoToFactura}
            causasRecambio={dataStore.causasRecambio}
            facturas={dataStore.facturas}
          />
        );
      case 'productos':
        return renderViewWithFailsafe('Productos',
          <ProductosView
            productos={dataStore.productos}
            addProducto={dataStore.addProducto}
            updateProducto={dataStore.updateProducto}
            deleteProducto={dataStore.deleteProducto}
            reactivarProducto={dataStore.reactivarProducto}
          />
        );
      case 'servicios':
        return renderViewWithFailsafe('Servicios',
          <ServiciosView
            servicios={dataStore.servicios}
            productos={dataStore.productos}
            addServicio={dataStore.addServicio}
            updateServicio={dataStore.updateServicio}
            deleteServicio={dataStore.deleteServicio}
            reactivarServicio={dataStore.reactivarServicio}
          />
        );
      case 'contratos':
        return renderViewWithFailsafe('Contratos',
          <ContratosView
            contratos={dataStore.contratos}
            clientes={dataStore.clientes}
            productos={dataStore.productos}
            servicios={dataStore.servicios}
            addContrato={dataStore.addContrato}
            updateContrato={dataStore.updateContrato}
            deleteContrato={dataStore.deleteContrato}
          />
        );
      case 'planillas': 
      case 'stock_planta':
        return renderViewWithFailsafe('Gestión Stock',
          <GestionStockView
            planillas={dataStore.planillas}
            movimientosPlanta={dataStore.movimientosStockPlanta}
            cierresPlanta={dataStore.cierresPlanta}
            usuarios={dataStore.usuarios}
            productos={dataStore.productos}
            remitos={dataStore.remitos}
            ventasVendedor={dataStore.ventasVendedor}
            addPlanilla={dataStore.addPlanilla}
            updatePlanilla={dataStore.updatePlanilla}
            deletePlanilla={dataStore.deletePlanilla}
            addMovimientoPlanta={dataStore.addMovimientoStockPlanta}
            addCierrePlanta={dataStore.addCierrePlanta}
          />
        );
      case 'rutas':
        return renderViewWithFailsafe('Rutas',
          <RutasView
            clientes={dataStore.clientes}
            usuarios={dataStore.usuarios}
            updateRutasMasivo={dataStore.updateRutasMasivo}
            updateCliente={dataStore.updateCliente}
          />
        );
      case 'importar':
        return renderViewWithFailsafe('Importar',
          <ImportarView 
            clientes={dataStore.clientes} 
            remitos={dataStore.remitos}   
            productos={dataStore.productos}
            addMultipleClientes={dataStore.addMultipleClientes}
            deleteAllClientes={dataStore.deleteAllClientes}
          />
        );
      case 'settings':
          return renderViewWithFailsafe('Configuración',
            <SettingsView
              settings={dataStore.empresaSettings}
              updateSettings={dataStore.updateEmpresaSettings}
              causasRecambio={dataStore.causasRecambio}
              addCausaRecambio={dataStore.addCausaRecambio}
              deleteCausaRecambio={dataStore.deleteCausaRecambio}
            />
          );
      case 'logs':
          return renderViewWithFailsafe('Logs del Sistema', <SystemLogsView logs={dataStore.logs} />);
      case 'my_profile':
          return renderViewWithFailsafe('Mi Perfil', <MyProfileView />);
      case 'my_account':
          return renderViewWithFailsafe('Mi Cuenta', <MyCustomerAccountView />);
      default:
        return renderViewWithFailsafe('Dashboard', <DashboardView {...dashboardProps} />);
    }
  };

  return (
    <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-screen w-full overflow-hidden">
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

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        <header className="p-4 sm:p-6 lg:p-8 pb-0 flex justify-between items-center">
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
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
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
