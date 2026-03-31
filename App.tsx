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
import SystemLogsView from './views/SystemLogsView';
import LoginView from './views/LoginView';
import SetupView from './views/SetupView';
import plugins from './plugins';
import { useDataStore } from './hooks/useDataStore';
import { View, Rol, LogLevel } from './types';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Notification from './components/Notification';
import { AuthProvider, useAuth } from './context/AuthContext';
import { app as firebaseApp } from './firebase/config';

const APP_VERSION = '3.0.0 (Pico.css)';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
      {notifications.map(notification => (
        <Notification key={notification.id} message={notification.message} type={notification.type} onClose={() => removeNotification(notification.id)} />
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
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, [user, currentView, dataStore]);

  useEffect(() => {
    if (user) setCurrentView('dashboard');
  }, [user]);

  if (authLoading) return <div aria-busy="true">Cargando...</div>;
  if (!user) return <LoginView />;

  const renderView = () => {
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
        preformas: dataStore.preformas,
        moldes: dataStore.moldes,
        produccionSoplado: dataStore.produccionSoplado,
        entregasSoplado: dataStore.entregasSoplado,
        addRemito: dataStore.addRemito,
        addPagoManual: dataStore.addPagoManual,
        addVentaVendedor: dataStore.addVentaVendedor,
        addCliente: dataStore.addCliente,
        setCurrentView: setCurrentView
    };

    if (currentView.startsWith('plugin_')) {
      const pluginId = currentView.replace('plugin_', '');
      const plugin = plugins.find(p => p.id === pluginId);
      if (plugin && plugin.roles.includes(user.rol)) {
        const PluginComponent = plugin.component;
        return <PluginComponent />;
      }
    }

    switch (currentView) {
      case 'dashboard': return <DashboardView {...dashboardProps} />;
      case 'caja': return <CajaView registrosPago={dataStore.registrosPago} gastos={dataStore.gastos} clientes={dataStore.clientes} vendedores={dataStore.usuarios} remitos={dataStore.remitos} facturas={dataStore.facturas} ventasVendedor={dataStore.ventasVendedor} productos={dataStore.productos} addPagoManual={dataStore.addPagoManual} addGasto={dataStore.addGasto} addVentaVendedor={dataStore.addVentaVendedor} addCliente={dataStore.addCliente} updateRegistroPago={dataStore.updateRegistroPago} updateGasto={dataStore.updateGasto} deleteRegistroPago={dataStore.deleteRegistroPago} deleteGasto={dataStore.deleteGasto} updateRemito={dataStore.updateRemito} updateVentaVendedor={dataStore.updateVentaVendedor} />;
      case 'cuentacorriente': return <FacturacionView clientes={dataStore.clientes} remitos={dataStore.remitos} facturas={dataStore.facturas} registrosPago={dataStore.registrosPago} productos={dataStore.productos} contratos={dataStore.contratos} servicios={dataStore.servicios} addFactura={dataStore.addFactura} addPagoToFactura={dataStore.addPagoToFactura} />;
      case 'facturas': return <FacturasListView facturas={dataStore.facturas} clientes={dataStore.clientes} remitos={dataStore.remitos} productos={dataStore.productos} registrosPago={dataStore.registrosPago} addPagoToFactura={dataStore.addPagoToFactura} empresaSettings={dataStore.empresaSettings} markFacturaAsSent={dataStore.markFacturaAsSent} />;
      case 'remitos': return <RemitosView remitos={dataStore.remitos} clientes={dataStore.clientes} vendedores={dataStore.usuarios} productos={dataStore.productos} registrosPago={dataStore.registrosPago} addRemito={dataStore.addRemito} updateRemito={dataStore.updateRemito} deleteRemito={dataStore.deleteRemito} addCliente={dataStore.addCliente} currentUser={user} causasRecambio={dataStore.causasRecambio} empresaSettings={dataStore.empresaSettings} />;
      case 'clientes': return <ClientesView clientes={dataStore.clientes} remitos={dataStore.remitos} productos={dataStore.productos} contratos={dataStore.contratos} servicios={dataStore.servicios} registrosPago={dataStore.registrosPago} usuarios={dataStore.usuarios} addCliente={dataStore.addCliente} updateCliente={dataStore.updateCliente} deleteCliente={dataStore.deleteCliente} reactivarCliente={dataStore.reactivarCliente} deleteContrato={dataStore.deleteContrato} addContrato={dataStore.addContrato} updateContrato={dataStore.updateContrato} />;
      case 'usuarios': return <UsuariosView usuarios={dataStore.usuarios} registrosPago={dataStore.registrosPago} remitos={dataStore.remitos} clientes={dataStore.clientes} productos={dataStore.productos} addUsuario={dataStore.addUsuario} updateUsuario={dataStore.updateUsuario} ventasVendedor={dataStore.ventasVendedor} addVentaVendedor={dataStore.addVentaVendedor} addPagoManual={dataStore.addPagoManual} updateRegistroPago={dataStore.updateRegistroPago} updateVentaVendedor={dataStore.updateVentaVendedor} deleteRegistroPago={dataStore.deleteRegistroPago} deleteVentaVendedor={dataStore.deleteVentaVendedor} />;
      case 'productos': return <ProductosView productos={dataStore.productos} addProducto={dataStore.addProducto} updateProducto={dataStore.updateProducto} deleteProducto={dataStore.deleteProducto} reactivarProducto={dataStore.reactivarProducto} />;
      case 'servicios': return <ServiciosView servicios={dataStore.servicios} productos={dataStore.productos} addServicio={dataStore.addServicio} updateServicio={dataStore.updateServicio} deleteServicio={dataStore.deleteServicio} reactivarServicio={dataStore.reactivarServicio} />;
      case 'contratos': return <ContratosView contratos={dataStore.contratos} clientes={dataStore.clientes} productos={dataStore.productos} servicios={dataStore.servicios} addContrato={dataStore.addContrato} updateContrato={dataStore.updateContrato} deleteContrato={dataStore.deleteContrato} />;
      case 'planillas': 
      case 'stock_planta': return <GestionStockView planillas={dataStore.planillas} movimientosPlanta={dataStore.movimientosStockPlanta} cierresPlanta={dataStore.cierresPlanta} usuarios={dataStore.usuarios} productos={dataStore.productos} remitos={dataStore.remitos} ventasVendedor={dataStore.ventasVendedor} addPlanilla={dataStore.addPlanilla} updatePlanilla={dataStore.updatePlanilla} deletePlanilla={dataStore.deletePlanilla} addMovimientoPlanta={dataStore.addMovimientoStockPlanta} addCierrePlanta={dataStore.addCierrePlanta} />;
      case 'rutas': return <RutasView clientes={dataStore.clientes} usuarios={dataStore.usuarios} updateRutasMasivo={dataStore.updateRutasMasivo} updateCliente={dataStore.updateCliente} />;
      case 'importar': return <ImportarView clientes={dataStore.clientes} remitos={dataStore.remitos} productos={dataStore.productos} addMultipleClientes={dataStore.addMultipleClientes} deleteAllClientes={dataStore.deleteAllClientes} />;
      case 'settings': return <SettingsView settings={dataStore.empresaSettings} updateSettings={dataStore.updateEmpresaSettings} causasRecambio={dataStore.causasRecambio} addCausaRecambio={dataStore.addCausaRecambio} deleteCausaRecambio={dataStore.deleteCausaRecambio} />;
      case 'logs': return <SystemLogsView logs={dataStore.logs} />;
      default: return <DashboardView {...dashboardProps} />;
    }
  };

  return (
    <>
      <aside role="sidebar" className={isSidebarOpen ? 'open' : ''}>
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} isSidebarOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentUser={user} empresaSettings={dataStore.empresaSettings} appVersion={APP_VERSION} />
      </aside>
      <main role="main-content">
        <nav>
          <ul>
            <li style={{ display: window.innerWidth < 992 ? 'block' : 'none' }}><button className="outline" onClick={() => setSidebarOpen(!isSidebarOpen)}>☰</button></li>
            <li><strong>{currentView.toUpperCase()}</strong></li>
          </ul>
          <ul>
            <li><small>{user.nombre}</small></li>
            <li><button className="secondary outline" onClick={logout}>Salir</button></li>
          </ul>
        </nav>
        <section>{renderView()}</section>
      </main>
    </>
  );
}

function App() {
  const [isConfigured, setIsConfigured] = useState(!!firebaseApp);
  if (!isConfigured) return <SetupView onConfigured={() => window.location.reload()} />;
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