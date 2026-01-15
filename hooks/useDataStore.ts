


import { useState, useCallback, useEffect } from 'react';
import { Remito, Cliente, Usuario, Factura, Producto, VentaVendedor, RegistroPago, PagoDetalle, Gasto, EstadoFactura, EmpresaSettings, Contrato, Servicio, Rol, EstadoCliente, EstadoServicio, EstadoProducto, PlanillaDiaria, EstadoPlanilla } from '../types';
import { mockRemitos, mockClientes, mockUsuarios, mockFacturas, mockProductos, mockVentasVendedor, mockRegistrosPago, mockGastos, mockEmpresaSettings, mockContratos, mockServicios, mockPlanillas } from '../data/mockData';

// Helper generic function for localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

export const useDataStore = () => {
  const [remitos, setRemitos] = useLocalStorage<Remito[]>('remitos', mockRemitos);
  const [clientes, setClientes] = useLocalStorage<Cliente[]>('clientes', mockClientes);
  const [usuarios, setUsuarios] = useLocalStorage<Usuario[]>('usuarios', mockUsuarios);
  const [registrosPago, setRegistrosPago] = useLocalStorage<RegistroPago[]>('registrosPago', mockRegistrosPago);
  const [facturas, setFacturas] = useLocalStorage<Factura[]>('facturas', mockFacturas);
  const [productos, setProductos] = useLocalStorage<Producto[]>('productos', mockProductos);
  const [ventasVendedor, setVentasVendedor] = useLocalStorage<VentaVendedor[]>('ventasVendedor', mockVentasVendedor);
  const [gastos, setGastos] = useLocalStorage<Gasto[]>('gastos', mockGastos);
  const [empresaSettings, setEmpresaSettings] = useLocalStorage<EmpresaSettings>('empresaSettings', mockEmpresaSettings);
  const [contratos, setContratos] = useLocalStorage<Contrato[]>('contratos', mockContratos);
  const [servicios, setServicios] = useLocalStorage<Servicio[]>('servicios', mockServicios);
  const [planillas, setPlanillas] = useLocalStorage<PlanillaDiaria[]>('planillas', mockPlanillas);


  const generateId = (prefix: string) => `${prefix}_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;

  // Helper para calcular total de remito
  const getRemitoTotal = useCallback((remito: Remito): number => {
    const cliente = clientes.find(c => c.id === remito.clienteId);
    if (!cliente) return 0;
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return remito.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        const producto = productos.find(p => p.id === mov.productoId);
        if (!producto) return total;
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return total + (mov.entregados * precio);
    }, 0);
  }, [clientes, productos]);


  // Remitos
  const addRemito = useCallback((remitoData: Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] }) => {
    const cliente = clientes.find(c => c.id === remitoData.clienteId);
    
    const remitoBase = {
      ...remitoData,
      id: generateId('r'),
      pagoIds: [] as string[],
    };

    if (cliente?.tieneCuentaCorriente) {
        const { pagos, ...newRemito } = remitoData;
        setRemitos(prev => [...prev, { ...remitoBase, ...newRemito }]);
        return;
    }
      
    const newPagoIds: string[] = [];

    if (remitoData.pagos && remitoData.pagos.length > 0) {
      const newPagos: RegistroPago[] = remitoData.pagos.map(pago => {
        const newPagoId = generateId('rp');
        newPagoIds.push(newPagoId);
        return {
          ...pago,
          id: newPagoId,
          fecha: remitoData.fecha,
          origen: { tipo: 'remito', id: remitoBase.id },
          clienteId: remitoData.clienteId,
          vendedorId: remitoData.vendedorId,
        };
      });
      setRegistrosPago(prev => [...prev, ...newPagos]);
    }
    
    const { pagos, ...newRemito } = remitoData;
    setRemitos(prev => [...prev, { ...remitoBase, ...newRemito, pagoIds: newPagoIds }]);
  }, [clientes, setRemitos, setRegistrosPago]);

  const updateRemito = useCallback((updatedRemitoData: Remito & { pagos?: PagoDetalle[] }) => {
    const cliente = clientes.find(c => c.id === updatedRemitoData.clienteId);

    if (cliente?.tieneCuentaCorriente) {
      const { pagos, ...updatedRemito } = updatedRemitoData;
      setRemitos(prev => prev.map(r => r.id === updatedRemito.id ? { ...updatedRemito, pagoIds: [] } : r));
      const originalRemito = remitos.find(r => r.id === updatedRemitoData.id);
      if (originalRemito && originalRemito.pagoIds) {
        setRegistrosPago(prev => prev.filter(p => !originalRemito.pagoIds!.includes(p.id)));
      }
      return;
    }
      
    const originalRemito = remitos.find(r => r.id === updatedRemitoData.id);
    if (originalRemito && originalRemito.pagoIds) {
      setRegistrosPago(prev => prev.filter(p => !originalRemito.pagoIds!.includes(p.id)));
    }
    
    const newPagoIds: string[] = [];
    if (updatedRemitoData.pagos && updatedRemitoData.pagos.length > 0) {
        const newPagos: RegistroPago[] = updatedRemitoData.pagos.map(pago => {
        const newPagoId = generateId('rp');
        newPagoIds.push(newPagoId);
        return {
          ...pago,
          id: newPagoId,
          fecha: updatedRemitoData.fecha,
          origen: { tipo: 'remito', id: updatedRemitoData.id },
          clienteId: updatedRemitoData.clienteId,
          vendedorId: updatedRemitoData.vendedorId,
        };
      });
      setRegistrosPago(prev => [...prev, ...newPagos]);
    }

    const { pagos, ...updatedRemito } = updatedRemitoData;
    setRemitos(prev => prev.map(r => r.id === updatedRemito.id ? { ...updatedRemito, pagoIds: newPagoIds } : r));
  }, [remitos, clientes, setRemitos, setRegistrosPago]);

  const deleteRemito = useCallback((remitoId: string) => {
    const remitoToDelete = remitos.find(r => r.id === remitoId);
    if (!remitoToDelete) return;

    if ((remitoToDelete.pagoIds && remitoToDelete.pagoIds.length > 0) || remitoToDelete.facturaId) {
      throw new Error("No se puede borrar un remito que ha sido pagado o facturado.");
    }
    setRemitos(prev => prev.filter(r => r.id !== remitoId));
  }, [remitos, setRemitos]);
  
  const addMultipleRemitos = useCallback((newRemitos: Remito[]) => {
    setRemitos(prev => [...prev, ...newRemitos]);
  }, [setRemitos]);

  // Clientes
  const addCliente = useCallback((clienteData: Omit<Cliente, 'id' | 'estado'> & { 
    stockInicial?: { productoId: string; cantidad: number; sucursalId?: string }[];
    contratosIniciales?: Omit<Contrato, 'id' | 'clienteId'>[];
  }) => {
    const { stockInicial, contratosIniciales, ...cliente } = clienteData;
    const newClienteId = generateId('c');

    setClientes(prev => [...prev, { ...cliente, tieneCuentaCorriente: cliente.tieneCuentaCorriente || false, id: newClienteId, estado: EstadoCliente.ACTIVO }]);

    if (stockInicial && stockInicial.length > 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);

        const remitosDeAjuste = stockInicial.map((stock, index) => ({
            id: generateId('r-ajuste'),
            fecha: yesterday.toISOString().split('T')[0],
            clienteId: newClienteId,
            sucursalId: stock.sucursalId || undefined,
            vendedorId: adminUser?.id || usuarios[0]?.id,
            puntoVenta: '0000',
            numero: `AJU-${index + 1}`,
            movimientos: [{
                productoId: stock.productoId,
                entregados: stock.cantidad,
                recibidos: 0
            }]
        }));
        setRemitos(prev => [...prev, ...remitosDeAjuste]);
    }

    if (contratosIniciales && contratosIniciales.length > 0) {
        const nuevosContratos = contratosIniciales.map(contrato => ({
            ...contrato,
            id: generateId('ct'),
            clienteId: newClienteId,
        }));
        setContratos(prev => [...prev, ...nuevosContratos]);
    }

  }, [usuarios, setClientes, setRemitos, setContratos]);

  const updateCliente = useCallback((updatedCliente: Cliente) => {
    setClientes(prev => prev.map(c => c.id === updatedCliente.id ? { ...updatedCliente, tieneCuentaCorriente: updatedCliente.tieneCuentaCorriente || false } : c));
  }, [setClientes]);

  const deleteCliente = useCallback((clienteId: string) => {
    setClientes(prev => prev.map(c => 
      c.id === clienteId ? { ...c, estado: EstadoCliente.INACTIVO } : c
    ));
  }, [setClientes]);
  
  const reactivarCliente = useCallback((clienteId: string) => {
    setClientes(prev => prev.map(c => 
      c.id === clienteId ? { ...c, estado: EstadoCliente.ACTIVO } : c
    ));
  }, [setClientes]);

  const addMultipleClientes = useCallback((newClientes: Cliente[]) => {
      setClientes(currentClientes => {
          const clientesMap = new Map<string, Cliente>(currentClientes.map(c => [c.id, c]));
          newClientes.forEach(c => {
              if (clientesMap.has(c.id)) {
                  const existing = clientesMap.get(c.id)!;
                  const sucursalesMap = new Map(existing.sucursales.map(s => [s.nombre, s]));
                  c.sucursales.forEach(s => {
                      if (!sucursalesMap.has(s.nombre)) {
                          existing.sucursales.push(s);
                      }
                  });
                  clientesMap.set(c.id, existing);
              } else {
                  clientesMap.set(c.id, c);
              }
          });
          return Array.from(clientesMap.values());
      });
  }, [setClientes]);

  // Usuarios
  const addUsuario = useCallback((usuario: Omit<Usuario, 'id'>) => {
    setUsuarios(prev => [...prev, { ...usuario, id: generateId('u') }]);
  }, [setUsuarios]);

  const updateUsuario = useCallback((updatedUsuario: Usuario) => {
    setUsuarios(prev => prev.map(u => u.id === updatedUsuario.id ? updatedUsuario : u));
  }, [setUsuarios]);
  
  // Pagos
  const addPagoManual = useCallback((pagoData: {
    fecha: string;
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
    pagos: PagoDetalle[];
  }) => {
    const { fecha, clienteId, vendedorId, concepto, pagos } = pagoData;
    const cliente = clientes.find(c => c.id === clienteId);

    if (!cliente || cliente.tieneCuentaCorriente) {
      const newPagos: RegistroPago[] = pagos.map(pago => {
        const newPagoId = generateId('rpm');
        return {
          id: newPagoId,
          fecha,
          clienteId,
          vendedorId,
          concepto,
          monto: pago.monto,
          metodo: pago.metodo,
          origen: { tipo: 'pago_manual', id: newPagoId }
        };
      });
      setRegistrosPago(prev => [...prev, ...newPagos]);
      return;
    }

    const newPagosBatch: RegistroPago[] = [];
    const updatedRemitosMap = new Map<string, Remito>(remitos.map(r => [r.id, JSON.parse(JSON.stringify(r))]));
    
    const remitosConDeuda = remitos
        .filter(r => r.clienteId === clienteId)
        .map(remito => {
            const totalRemito = getRemitoTotal(remito);
            const totalPagado = (remito.pagoIds || [])
                .map(pId => registrosPago.find(p => p.id === pId))
                .filter((p): p is RegistroPago => !!p)
                .reduce((sum, p) => sum + p.monto, 0);
            return { remito, deuda: totalRemito - totalPagado };
        })
        .filter(item => item.deuda > 0.001)
        .sort((a, b) => new Date(a.remito.fecha).getTime() - new Date(b.remito.fecha).getTime());
        
    let remitosConDeudaActualizada = remitosConDeuda.map(r => ({ ...r }));

    for (const pago of pagos) {
        let montoRestanteDeEstePago = pago.monto;

        for (const item of remitosConDeudaActualizada) {
            if (montoRestanteDeEstePago <= 0.001) break;

            if (item.deuda > 0.001) {
                const montoAAplicar = Math.min(item.deuda, montoRestanteDeEstePago);
                
                const newPagoId = generateId('rp');
                const newPago: RegistroPago = {
                    id: newPagoId,
                    fecha,
                    monto: montoAAplicar,
                    metodo: pago.metodo,
                    origen: { tipo: 'remito', id: item.remito.id },
                    clienteId,
                    vendedorId,
                    concepto: `Pago a remito ${item.remito.numero}`
                };
                newPagosBatch.push(newPago);
                
                const remitoAActualizar = updatedRemitosMap.get(item.remito.id)!;
                if (!remitoAActualizar.pagoIds) remitoAActualizar.pagoIds = [];
                remitoAActualizar.pagoIds.push(newPagoId);
                
                montoRestanteDeEstePago -= montoAAplicar;
                item.deuda -= montoAAplicar;
            }
        }

        if (montoRestanteDeEstePago > 0.001) {
            const newPagoId = generateId('rpm');
            const newPago: RegistroPago = {
                id: newPagoId,
                fecha,
                monto: montoRestanteDeEstePago,
                metodo: pago.metodo,
                origen: { tipo: 'pago_manual', id: newPagoId },
                clienteId,
                vendedorId,
                concepto: concepto || `Adelanto de ${cliente.nombre}`
            };
            newPagosBatch.push(newPago);
        }
    }
    
    setRegistrosPago(prev => [...prev, ...newPagosBatch]);
    setRemitos(Array.from(updatedRemitosMap.values()));

  }, [clientes, remitos, registrosPago, getRemitoTotal, setRegistrosPago, setRemitos]);
  
  const updateRegistroPago = useCallback((updatedPago: RegistroPago) => {
    setRegistrosPago(prev => prev.map(p => p.id === updatedPago.id ? updatedPago : p));
  }, [setRegistrosPago]);

  const deleteRegistroPago = useCallback((pagoId: string) => {
    const pagoToDelete = registrosPago.find(p => p.id === pagoId);
    if (!pagoToDelete) return;

    if (pagoToDelete.origen.tipo === 'remito') {
      setRemitos(prev => prev.map(r => 
        r.id === pagoToDelete.origen.id 
        ? { ...r, pagoIds: r.pagoIds?.filter(id => id !== pagoId) } 
        : r
      ));
    } else if (pagoToDelete.origen.tipo === 'venta_vendedor') {
      setVentasVendedor(prev => prev.map(v => 
        v.id === pagoToDelete.origen.id
        ? { ...v, pagoIds: v.pagoIds?.filter(id => id !== pagoId) }
        : v
      ));
    } else if (pagoToDelete.origen.tipo === 'factura') {
      setFacturas(prev => prev.map(f =>
          f.id === pagoToDelete.origen.id
          ? { ...f, pagoIds: f.pagoIds?.filter(id => id !== pagoId) }
          : f
      ));
    }
    setRegistrosPago(prev => prev.filter(p => p.id !== pagoId));
  }, [registrosPago, setRemitos, setVentasVendedor, setFacturas, setRegistrosPago]);

  // Venta Vendedor
  const addVentaVendedor = useCallback((ventaData: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => {
    const newVentaId = generateId('vv');
    const newPagoIds: string[] = [];

    if (ventaData.pagos && ventaData.pagos.length > 0) {
      const newPagos: RegistroPago[] = ventaData.pagos.map(pago => {
        const newPagoId = generateId('rp');
        newPagoIds.push(newPagoId);
        return {
          ...pago,
          id: newPagoId,
          fecha: ventaData.fecha,
          origen: { tipo: 'venta_vendedor', id: newVentaId },
          vendedorId: ventaData.vendedorId,
        };
      });
      setRegistrosPago(prev => [...prev, ...newPagos]);
    }
    
    const { pagos, ...newVenta } = ventaData;
    setVentasVendedor(prev => [...prev, { ...newVenta, id: newVentaId, pagoIds: newPagoIds }]);
  }, [setRegistrosPago, setVentasVendedor]);
  
  const updateVentaVendedor = useCallback((updatedVentaData: VentaVendedor & { pagos?: PagoDetalle[] }) => {
    const originalVenta = ventasVendedor.find(v => v.id === updatedVentaData.id);
    if (originalVenta && originalVenta.pagoIds) {
      setRegistrosPago(prev => prev.filter(p => !originalVenta.pagoIds!.includes(p.id)));
    }
    
    const newPagoIds: string[] = [];
    if (updatedVentaData.pagos && updatedVentaData.pagos.length > 0) {
        const newPagos: RegistroPago[] = updatedVentaData.pagos.map(pago => {
        const newPagoId = generateId('rp');
        newPagoIds.push(newPagoId);
        return {
          ...pago,
          id: newPagoId,
          fecha: updatedVentaData.fecha,
          origen: { tipo: 'venta_vendedor', id: updatedVentaData.id },
          vendedorId: updatedVentaData.vendedorId,
        };
      });
      setRegistrosPago(prev => [...prev, ...newPagos]);
    }

    const { pagos, ...updatedVenta } = updatedVentaData;
    setVentasVendedor(prev => prev.map(v => v.id === updatedVenta.id ? { ...updatedVenta, pagoIds: newPagoIds } : v));
  }, [ventasVendedor, setRegistrosPago, setVentasVendedor]);


  // Gastos
  const addGasto = useCallback((gasto: Omit<Gasto, 'id'>) => {
    setGastos(prev => [...prev, { ...gasto, id: generateId('g') }]);
  }, [setGastos]);

  const updateGasto = useCallback((updatedGasto: Gasto) => {
    setGastos(prev => prev.map(g => g.id === updatedGasto.id ? updatedGasto : g));
  }, [setGastos]);

  const deleteGasto = useCallback((gastoId: string) => {
    setGastos(prev => prev.filter(g => g.id !== gastoId));
  }, [setGastos]);

  // Facturas
  const addFactura = useCallback((facturaData: Omit<Factura, 'id' | 'pagoIds' | 'estado' | 'numero'>) => {
    const newFacturaId = generateId('f');
    setFacturas(prevFacturas => {
        const lastFacturaNumber = prevFacturas.length > 0
            ? Math.max(...prevFacturas.map(f => parseInt(f.numero.split('-')[2], 10)))
            : 0;
        const newFacturaNumber = `F-001-${(lastFacturaNumber + 1).toString().padStart(4, '0')}`;

        const newFactura: Factura = {
            ...facturaData,
            id: newFacturaId,
            numero: newFacturaNumber,
            estado: EstadoFactura.PENDIENTE,
            pagoIds: [],
            enviada: false, // Default false
        };
        return [...prevFacturas, newFactura];
    });

    setRemitos(prev => prev.map(r => 
        facturaData.remitosIds.includes(r.id)
        ? { ...r, facturaId: newFacturaId }
        : r
    ));
  }, [setFacturas, setRemitos]);
    
  const addPagoToFactura = useCallback((facturaId: string, fecha: string, pagos: PagoDetalle[]) => {
    const factura = facturas.find(f => f.id === facturaId);
    if (!factura) return;

    const newPagoIds: string[] = [];
    const newPagos: RegistroPago[] = pagos.map(pago => {
      const newPagoId = generateId('rp');
      newPagoIds.push(newPagoId);
      return {
        ...pago,
        id: newPagoId,
        fecha: fecha,
        origen: { tipo: 'factura', id: facturaId },
        clienteId: factura.clienteId,
      };
    });
    
    setRegistrosPago(prev => [...prev, ...newPagos]);
    
    setFacturas(prevFacturas => {
      return prevFacturas.map(f => {
        if (f.id === facturaId) {
          const updatedPagoIds = [...(f.pagoIds || []), ...newPagoIds];
          return { ...f, pagoIds: updatedPagoIds };
        }
        return f;
      });
    });
  }, [facturas, setRegistrosPago, setFacturas]);

  const markFacturaAsSent = useCallback((facturaId: string) => {
      setFacturas(prev => prev.map(f => 
          f.id === facturaId ? { ...f, enviada: true } : f
      ));
  }, [setFacturas]);


  // Productos
  const addProducto = useCallback((producto: Omit<Producto, 'id' | 'estado'>) => {
    setProductos(prev => [...prev, { ...producto, id: generateId('p'), estado: EstadoProducto.ACTIVO }]);
  }, [setProductos]);

  const updateProducto = useCallback((updatedProducto: Producto) => {
    setProductos(prev => prev.map(p => p.id === updatedProducto.id ? updatedProducto : p));
  }, [setProductos]);

  const deleteProducto = useCallback((productoId: string) => {
    setProductos(prev => prev.map(p => 
      p.id === productoId ? { ...p, estado: EstadoProducto.INACTIVO } : p
    ));
  }, [setProductos]);
  
  const reactivarProducto = useCallback((productoId: string) => {
    setProductos(prev => prev.map(p => 
      p.id === productoId ? { ...p, estado: EstadoProducto.ACTIVO } : p
    ));
  }, [setProductos]);
  
  // Empresa Settings
  const updateEmpresaSettings = useCallback((settings: EmpresaSettings) => {
    setEmpresaSettings(settings);
  }, [setEmpresaSettings]);

  // Contratos
  const addContrato = useCallback((contrato: Omit<Contrato, 'id'>) => {
    setContratos(prev => [...prev, { ...contrato, id: generateId('ct') }]);
  }, [setContratos]);

  const updateContrato = useCallback((updatedContrato: Contrato) => {
    setContratos(prev => prev.map(c => c.id === updatedContrato.id ? updatedContrato : c));
  }, [setContratos]);

  const deleteContrato = useCallback((contratoId: string) => {
    setContratos(prev => prev.filter(c => c.id !== contratoId));
  }, [setContratos]);

  // Servicios
  const addServicio = useCallback((servicio: Omit<Servicio, 'id' | 'estado'>) => {
    setServicios(prev => [...prev, { ...servicio, id: generateId('serv'), estado: EstadoServicio.ACTIVO }]);
  }, [setServicios]);

  const updateServicio = useCallback((updatedServicio: Servicio) => {
    setServicios(prev => prev.map(s => s.id === updatedServicio.id ? updatedServicio : s));
  }, [setServicios]);

  const deleteServicio = useCallback((servicioId: string) => {
    setServicios(prev => prev.map(s => 
      s.id === servicioId ? { ...s, estado: EstadoServicio.INACTIVO } : s
    ));
  }, [setServicios]);
  
  const reactivarServicio = useCallback((servicioId: string) => {
    setServicios(prev => prev.map(s => 
      s.id === servicioId ? { ...s, estado: EstadoServicio.ACTIVO } : s
    ));
  }, [setServicios]);

  // Planillas (Stock Control)
  const addPlanilla = useCallback((planilla: Omit<PlanillaDiaria, 'id'>) => {
      setPlanillas(prev => [...prev, { ...planilla, id: generateId('pd') }]);
  }, [setPlanillas]);

  const updatePlanilla = useCallback((updatedPlanilla: PlanillaDiaria) => {
      setPlanillas(prev => prev.map(p => p.id === updatedPlanilla.id ? updatedPlanilla : p));
  }, [setPlanillas]);


  return {
    remitos,
    clientes,
    usuarios,
    registrosPago,
    facturas,
    productos,
    ventasVendedor,
    gastos,
    empresaSettings,
    contratos,
    servicios,
    planillas,
    addRemito,
    updateRemito,
    deleteRemito,
    addMultipleRemitos,
    addCliente,
    updateCliente,
    deleteCliente,
    reactivarCliente,
    addMultipleClientes,
    addUsuario,
    updateUsuario,
    addPagoManual,
    updateRegistroPago,
    deleteRegistroPago,
    addVentaVendedor,
    updateVentaVendedor,
    addGasto,
    updateGasto,
    deleteGasto,
    addFactura,
    addPagoToFactura,
    markFacturaAsSent,
    addProducto,
    updateProducto,
    deleteProducto,
    reactivarProducto,
    updateEmpresaSettings,
    addContrato,
    updateContrato,
    deleteContrato,
    addServicio,
    updateServicio,
    deleteServicio,
    reactivarServicio,
    addPlanilla,
    updatePlanilla,
  };
};
