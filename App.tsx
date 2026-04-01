
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
import plugins from './plugins';
import { useDataStore } from './hooks/useDataStore';
import { View, Rol, LogLevel } from './types';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Notification from './components/Notification';
import { AuthProvider, useAuth } from './context/AuthContext';
import { app as firebaseApp } from './firebase/config';

// --- Configuración de la Versión ---
const APP_VERSION = '2.7.5 (UX Vendedores)';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.5rem', pointerEvents: 'none' }}>
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
      return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div aria-busy="true">Cargando...</div>
        </div>
      );
  }

  if (!user) {
      return <LoginView />;
  }

  const renderView = () => {
    // Seguridad: Permitir 'dashboard' también a los repartidores y sopladores
    const allowedViewsForRepartidor: View[] = ['dashboard', 'remitos', 'clientes'];
    const allowedViewsForSoplador: View[] = ['dashboard'];
    
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
        // Soplado data
        preformas: dataStore.preformas,
        moldes: dataStore.moldes,
        produccionSoplado: dataStore.produccionSoplado,
        entregasSoplado: dataStore.entregasSoplado,
        // Acciones para botones rápidos
        addRemito: dataStore.addRemito,
        addPagoManual: dataStore.addPagoManual,
        addVentaVendedor: dataStore.addVentaVendedor,
        addCliente: dataStore.addCliente,
        setCurrentView: setCurrentView
    };

    if (user.rol === Rol.REPARTIDOR && !allowedViewsForRepartidor.includes(currentView)) {
      return <DashboardView {...dashboardProps} />;
    }

    if (user.rol === Rol.SOPLADOR && !allowedViewsForSoplador.includes(currentView) && !currentView.startsWith('plugin_')) {
      return <DashboardView {...dashboardProps} />;
    }

    // --- Soporte para Plugins ---
    if (currentView.startsWith('plugin_')) {
      const pluginId = currentView.replace('plugin_', '');
      const plugin = plugins.find(p => p.id === pluginId);
      if (plugin && plugin.roles.includes(user.rol)) {
        const PluginComponent = plugin.component;
        return <PluginComponent />;
      }
    }
    // ----------------------------

    switch (currentView) {
      case 'dashboard':
        return <DashboardView {...dashboardProps} />;
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
        return <FacturacionView
                  clientes={dataStore.clientes}
                  remitos={dataStore.remitos}
                  facturas={dataStore.facturas}
                  registrosPago={dataStore.registrosPago}
                  productos={dataStore.productos}
                  contratos={dataStore.contratos}
                  servicios={dataStore.servicios}
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
                  causasRecambio={dataStore.causasRecambio}
                  empresaSettings={dataStore.empresaSettings}
                />;
      case 'clientes':
        return <ClientesView 
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
                  addPagoManual={dataStore.addPagoManual}
                  updateRegistroPago={dataStore.updateRegistroPago}
                  updateVentaVendedor={dataStore.updateVentaVendedor}
                  deleteRegistroPago={dataStore.deleteRegistroPago}
                  deleteVentaVendedor={dataStore.deleteVentaVendedor}
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
      case 'stock_planta':
        return <GestionStockView
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
               />;
      case 'rutas':
        return <RutasView
                  clientes={dataStore.clientes}
                  usuarios={dataStore.usuarios}
                  updateRutasMasivo={dataStore.updateRutasMasivo}
                  updateCliente={dataStore.updateCliente}
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
                    causasRecambio={dataStore.causasRecambio}
                    addCausaRecambio={dataStore.addCausaRecambio}
                    deleteCausaRecambio={dataStore.deleteCausaRecambio}
                  />;
      case 'logs':
          return <SystemLogsView logs={dataStore.logs} />;
      default:
        return <DashboardView {...dashboardProps} />;
    }
  };

  return (
    <div id="root">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isSidebarOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={user}
        empresaSettings={dataStore.empresaSettings}
        appVersion={APP_VERSION}
      />

      <main className="container">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pico-spacing)', padding: '1rem 0' }}>
            <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)} 
                className="outline"
                style={{ marginBottom: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}
            >
                <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            </button>
            <h4 style={{ margin: 0, flex: 1, textAlign: 'center', padding: '0 1rem' }}>
              {dataStore.empresaSettings.nombreFantasia || dataStore.empresaSettings.nombre}
            </h4>
            <button 
                onClick={logout} 
                className="contrast outline"
                style={{ marginBottom: 0, fontSize: '0.75rem', padding: '0.5rem 1rem' }}
            >
                Salir
            </button>
        </header>
        
        <div className="animate-fade-in">
          {renderView()}
        </div>
      </main>
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
