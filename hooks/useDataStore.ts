
import { useState, useCallback, useEffect } from 'react';
import { Remito, Cliente, Usuario, Factura, Producto, VentaVendedor, RegistroPago, PagoDetalle, Gasto, EmpresaSettings, Contrato, Servicio, PlanillaDiaria, Rol, EstadoCliente, EstadoProducto, EstadoServicio } from '../types';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { mockEmpresaSettings } from '../data/mockData'; // Fallback para settings iniciales

// Helper para limpiar undefineds (Firestore no los acepta)
const cleanUndefineds = <T extends Record<string, any>>(obj: T): T => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        }
    });
    return newObj;
};

// Hook para sincronizar colecciones de Firestore
function useFirestoreCollection<T>(collectionName: string, orderByField?: string): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const colRef = collection(db, collectionName);
    const q = orderByField ? query(colRef, orderBy(orderByField, 'desc')) : query(colRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data(), id: doc.id } as unknown as T);
      });
      setData(items);
    }, (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
    });

    return () => unsubscribe();
  }, [collectionName, orderByField]);

  return data;
}

export const useDataStore = () => {
  // --- LEER DATOS (REAL-TIME) ---
  const remitos = useFirestoreCollection<Remito>('remitos', 'fecha');
  const clientes = useFirestoreCollection<Cliente>('clientes', 'nombre');
  const usuarios = useFirestoreCollection<Usuario>('usuarios');
  const registrosPago = useFirestoreCollection<RegistroPago>('registrosPago', 'fecha');
  const facturas = useFirestoreCollection<Factura>('facturas', 'fecha');
  const productos = useFirestoreCollection<Producto>('productos');
  const ventasVendedor = useFirestoreCollection<VentaVendedor>('ventasVendedor', 'fecha');
  const gastos = useFirestoreCollection<Gasto>('gastos', 'fecha');
  const contratos = useFirestoreCollection<Contrato>('contratos');
  const servicios = useFirestoreCollection<Servicio>('servicios');
  const planillas = useFirestoreCollection<PlanillaDiaria>('planillas', 'fecha');
  
  // Settings es un documento único
  const [empresaSettings, setEmpresaSettings] = useState<EmpresaSettings>(mockEmpresaSettings);
  
  useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'empresa'), (doc) => {
          if (doc.exists()) {
              setEmpresaSettings(doc.data() as EmpresaSettings);
          }
      });
      return () => unsub();
  }, []);


  // --- ESCRITURA DATOS (FIRESTORE) ---

  const generateId = (prefix: string) => `${prefix}_${new Date().getTime()}`;

  // Helper para calcular total de remito
  const getRemitoTotal = useCallback((remito: Remito, currentClientes: Cliente[], currentProductos: Producto[]): number => {
    const cliente = currentClientes.find(c => c.id === remito.clienteId);
    if (!cliente) return 0;
    const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    
    return remito.movimientos.reduce((total, mov) => {
        if (!mov.productoId) return total;
        const producto = currentProductos.find(p => p.id === mov.productoId);
        if (!producto) return total;
        const precio = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
        return total + (mov.entregados * precio);
    }, 0);
  }, []);


  // Remitos
  const addRemito = useCallback(async (remitoData: Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] }) => {
    const cliente = clientes.find(c => c.id === remitoData.clienteId);
    
    // Limpieza de datos (Separar pagos y limpiar undefineds del remito)
    const { pagos, ...rawRemitoData } = remitoData;
    
    const newRemitoData = {
        ...rawRemitoData,
        sucursalId: rawRemitoData.sucursalId || null, // Convertir undefined/vacío a null
        pagoIds: [],
        facturaId: null // Firestore no acepta undefined, usar null
    };

    const remitoRef = await addDoc(collection(db, 'remitos'), cleanUndefineds(newRemitoData));
    
    if (!cliente?.tieneCuentaCorriente && pagos && pagos.length > 0) {
        const batchPagos = pagos.map(async (pago) => {
            const pagoRef = await addDoc(collection(db, 'registrosPago'), {
                ...pago,
                fecha: remitoData.fecha,
                origen: { tipo: 'remito', id: remitoRef.id },
                clienteId: remitoData.clienteId,
                vendedorId: remitoData.vendedorId,
            });
            return pagoRef.id;
        });
        const ids = await Promise.all(batchPagos);
        await updateDoc(remitoRef, { pagoIds: ids });
    }

  }, [clientes]);

  const updateRemito = useCallback(async (updatedRemitoData: Remito & { pagos?: PagoDetalle[] }) => {
    const remitoRef = doc(db, 'remitos', updatedRemitoData.id);
    const { pagos, ...dataToSave } = updatedRemitoData;
    
    // Limpiar undefineds antes de guardar
    await updateDoc(remitoRef, cleanUndefineds(dataToSave));
  }, []);

  const deleteRemito = useCallback(async (remitoId: string) => {
    await deleteDoc(doc(db, 'remitos', remitoId));
  }, []);
  
  const addMultipleRemitos = useCallback(async (newRemitos: Remito[]) => {
      // Importación masiva
      const batchPromises = newRemitos.map(r => addDoc(collection(db, 'remitos'), cleanUndefineds(r)));
      await Promise.all(batchPromises);
  }, []);

  // Clientes
  const addCliente = useCallback(async (clienteData: Omit<Cliente, 'id' | 'estado'> & { 
    stockInicial?: { productoId: string; cantidad: number; sucursalId?: string }[];
    contratosIniciales?: Omit<Contrato, 'id' | 'clienteId'>[];
  }) => {
    const { stockInicial, contratosIniciales, ...cliente } = clienteData;
    const clienteRef = await addDoc(collection(db, 'clientes'), cleanUndefineds({ ...cliente, estado: EstadoCliente.ACTIVO }));

    if (stockInicial && stockInicial.length > 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);

        const remitosDeAjuste = stockInicial.map(stock => ({
            fecha: yesterday.toISOString().split('T')[0],
            clienteId: clienteRef.id,
            sucursalId: stock.sucursalId || null, // Convertir undefined a null
            vendedorId: adminUser?.id || usuarios[0]?.id,
            puntoVenta: '0000',
            numero: `AJU-${Date.now()}`,
            movimientos: [{
                productoId: stock.productoId,
                entregados: stock.cantidad,
                recibidos: 0
            }]
        }));
        remitosDeAjuste.forEach(r => addDoc(collection(db, 'remitos'), cleanUndefineds(r)));
    }

    if (contratosIniciales && contratosIniciales.length > 0) {
        contratosIniciales.forEach(c => addDoc(collection(db, 'contratos'), cleanUndefineds({ ...c, clienteId: clienteRef.id })));
    }

  }, [usuarios]);

  const updateCliente = useCallback(async (updatedCliente: Cliente) => {
    await updateDoc(doc(db, 'clientes', updatedCliente.id), cleanUndefineds(updatedCliente));
  }, []);

  const deleteCliente = useCallback(async (clienteId: string) => {
    await updateDoc(doc(db, 'clientes', clienteId), { estado: EstadoCliente.INACTIVO });
  }, []);
  
  const reactivarCliente = useCallback(async (clienteId: string) => {
    await updateDoc(doc(db, 'clientes', clienteId), { estado: EstadoCliente.ACTIVO });
  }, []);

  const addMultipleClientes = useCallback(async (newClientes: Cliente[]) => {
      const batchPromises = newClientes.map(c => addDoc(collection(db, 'clientes'), cleanUndefineds(c)));
      await Promise.all(batchPromises);
  }, []);

  // Usuarios
  const addUsuario = useCallback(async (usuario: Omit<Usuario, 'id'>) => {
    await addDoc(collection(db, 'usuarios'), cleanUndefineds(usuario));
  }, []);

  const updateUsuario = useCallback(async (updatedUsuario: Usuario) => {
    await updateDoc(doc(db, 'usuarios', updatedUsuario.id), cleanUndefineds(updatedUsuario));
  }, []);
  
  // Pagos Manuales
  const addPagoManual = useCallback(async (pagoData: {
    fecha: string;
    clienteId?: string;
    vendedorId?: string;
    concepto?: string;
    pagos: PagoDetalle[];
  }) => {
    const { fecha, clienteId, vendedorId, concepto, pagos } = pagoData;
    
    pagos.forEach(async (pago) => {
        await addDoc(collection(db, 'registrosPago'), cleanUndefineds({
            fecha,
            clienteId: clienteId || null,
            vendedorId: vendedorId || null,
            concepto: concepto || 'Pago Manual',
            monto: pago.monto,
            metodo: pago.metodo,
            origen: { tipo: 'pago_manual', id: 'manual' }
        }));
    });

  }, []);
  
  const updateRegistroPago = useCallback(async (updatedPago: RegistroPago) => {
    await updateDoc(doc(db, 'registrosPago', updatedPago.id), cleanUndefineds(updatedPago));
  }, []);

  const deleteRegistroPago = useCallback(async (pagoId: string) => {
    await deleteDoc(doc(db, 'registrosPago', pagoId));
  }, []);

  // Venta Vendedor
  const addVentaVendedor = useCallback(async (ventaData: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => {
    const { pagos, ...newVenta } = ventaData;
    const ventaRef = await addDoc(collection(db, 'ventasVendedor'), cleanUndefineds({ ...newVenta, pagoIds: [] }));
    
    if (pagos && pagos.length > 0) {
        const batchPagos = pagos.map(async (pago) => {
            const pagoRef = await addDoc(collection(db, 'registrosPago'), {
                ...pago,
                fecha: ventaData.fecha,
                origen: { tipo: 'venta_vendedor', id: ventaRef.id },
                vendedorId: ventaData.vendedorId,
            });
            return pagoRef.id;
        });
        const ids = await Promise.all(batchPagos);
        await updateDoc(ventaRef, { pagoIds: ids });
    }
  }, []);
  
  const updateVentaVendedor = useCallback(async (updatedVentaData: VentaVendedor & { pagos?: PagoDetalle[] }) => {
     const { pagos, ...data } = updatedVentaData;
     await updateDoc(doc(db, 'ventasVendedor', data.id), cleanUndefineds(data));
  }, []);


  // Gastos
  const addGasto = useCallback(async (gasto: Omit<Gasto, 'id'>) => {
    await addDoc(collection(db, 'gastos'), cleanUndefineds(gasto));
  }, []);

  const updateGasto = useCallback(async (updatedGasto: Gasto) => {
    await updateDoc(doc(db, 'gastos', updatedGasto.id), cleanUndefineds(updatedGasto));
  }, []);

  const deleteGasto = useCallback(async (gastoId: string) => {
    await deleteDoc(doc(db, 'gastos', gastoId));
  }, []);

  // Facturas
  const addFactura = useCallback(async (facturaData: Omit<Factura, 'id' | 'pagoIds' | 'estado' | 'numero'>) => {
    const lastFacturaNumber = facturas.length > 0
        ? Math.max(...facturas.map(f => parseInt(f.numero.split('-')[2], 10)))
        : 0;
    const newFacturaNumber = `F-001-${(lastFacturaNumber + 1).toString().padStart(4, '0')}`;

    const facturaRef = await addDoc(collection(db, 'facturas'), cleanUndefineds({
        ...facturaData,
        numero: newFacturaNumber,
        estado: 'Pendiente',
        pagoIds: [],
        enviada: false,
    }));

    facturaData.remitosIds.forEach(remitoId => {
        updateDoc(doc(db, 'remitos', remitoId), { facturaId: facturaRef.id });
    });

  }, [facturas]);
    
  const addPagoToFactura = useCallback(async (facturaId: string, fecha: string, pagos: PagoDetalle[]) => {
    const factura = facturas.find(f => f.id === facturaId);
    if (!factura) return;

    const batchPagos = pagos.map(async (pago) => {
        const pagoRef = await addDoc(collection(db, 'registrosPago'), {
            ...pago,
            fecha,
            origen: { tipo: 'factura', id: facturaId },
            clienteId: factura.clienteId,
        });
        return pagoRef.id;
    });
    
    const newIds = await Promise.all(batchPagos);
    const updatedPagoIds = [...(factura.pagoIds || []), ...newIds];
    
    await updateDoc(doc(db, 'facturas', facturaId), { pagoIds: updatedPagoIds });

  }, [facturas]);

  const markFacturaAsSent = useCallback(async (facturaId: string) => {
      await updateDoc(doc(db, 'facturas', facturaId), { enviada: true });
  }, []);


  // Productos
  const addProducto = useCallback(async (producto: Omit<Producto, 'id' | 'estado'>) => {
    await addDoc(collection(db, 'productos'), cleanUndefineds({ ...producto, estado: EstadoProducto.ACTIVO }));
  }, []);

  const updateProducto = useCallback(async (updatedProducto: Producto) => {
    await updateDoc(doc(db, 'productos', updatedProducto.id), cleanUndefineds(updatedProducto));
  }, []);

  const deleteProducto = useCallback(async (productoId: string) => {
    await updateDoc(doc(db, 'productos', productoId), { estado: EstadoProducto.INACTIVO });
  }, []);
  
  const reactivarProducto = useCallback(async (productoId: string) => {
    await updateDoc(doc(db, 'productos', productoId), { estado: EstadoProducto.ACTIVO });
  }, []);
  
  // Empresa Settings
  const updateEmpresaSettings = useCallback(async (settings: EmpresaSettings) => {
    await setDoc(doc(db, 'settings', 'empresa'), cleanUndefineds(settings));
  }, []);

  // Contratos
  const addContrato = useCallback(async (contrato: Omit<Contrato, 'id'>) => {
    await addDoc(collection(db, 'contratos'), cleanUndefineds(contrato));
  }, []);

  const updateContrato = useCallback(async (updatedContrato: Contrato) => {
    await updateDoc(doc(db, 'contratos', updatedContrato.id), cleanUndefineds(updatedContrato));
  }, []);

  const deleteContrato = useCallback(async (contratoId: string) => {
    await deleteDoc(doc(db, 'contratos', contratoId));
  }, []);

  // Servicios
  const addServicio = useCallback(async (servicio: Omit<Servicio, 'id' | 'estado'>) => {
    await addDoc(collection(db, 'servicios'), cleanUndefineds({ ...servicio, estado: EstadoServicio.ACTIVO }));
  }, []);

  const updateServicio = useCallback(async (updatedServicio: Servicio) => {
    await updateDoc(doc(db, 'servicios', updatedServicio.id), cleanUndefineds(updatedServicio));
  }, []);

  const deleteServicio = useCallback(async (servicioId: string) => {
    await updateDoc(doc(db, 'servicios', servicioId), { estado: EstadoServicio.INACTIVO });
  }, []);
  
  const reactivarServicio = useCallback(async (servicioId: string) => {
    await updateDoc(doc(db, 'servicios', servicioId), { estado: EstadoServicio.ACTIVO });
  }, []);

  // Planillas
  const addPlanilla = useCallback(async (planilla: Omit<PlanillaDiaria, 'id'>) => {
      await addDoc(collection(db, 'planillas'), cleanUndefineds(planilla));
  }, []);

  const updatePlanilla = useCallback(async (updatedPlanilla: PlanillaDiaria) => {
      await updateDoc(doc(db, 'planillas', updatedPlanilla.id), cleanUndefineds(updatedPlanilla));
  }, []);


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
