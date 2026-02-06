
import { useState, useCallback, useEffect } from 'react';
import { Remito, Cliente, Usuario, Factura, Producto, VentaVendedor, RegistroPago, PagoDetalle, Gasto, EmpresaSettings, Contrato, Servicio, PlanillaDiaria, Rol, EstadoCliente, EstadoProducto, EstadoServicio } from '../types';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, limit, where, QueryConstraint, writeBatch } from 'firebase/firestore';
import { mockEmpresaSettings } from '../data/mockData';

const cleanUndefineds = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => cleanUndefineds(v));
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, cleanUndefineds(v)])
    );
};

function useFirestoreCollection<T>(
    collectionName: string, 
    options: { 
        orderByField?: string, 
        limitTo?: number,
        whereConstraints?: { field: string, op: any, value: any }[]
    } = {}
): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const colRef = collection(db, collectionName);
    const constraints: QueryConstraint[] = [];

    if (options.whereConstraints) {
        options.whereConstraints.forEach(c => {
            constraints.push(where(c.field, c.op, c.value));
        });
    }

    if (options.orderByField) {
        constraints.push(orderBy(options.orderByField, 'desc'));
    }

    if (options.limitTo) {
        constraints.push(limit(options.limitTo));
    }

    const q = query(colRef, ...constraints);
    
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
  }, [collectionName, options.orderByField, options.limitTo, JSON.stringify(options.whereConstraints)]);

  return data;
}

export const useDataStore = () => {
  const clientes = useFirestoreCollection<Cliente>('clientes', { orderByField: 'nombre' });
  const remitos = useFirestoreCollection<Remito>('remitos', { orderByField: 'fecha', limitTo: 500 });
  const usuarios = useFirestoreCollection<Usuario>('usuarios');
  const registrosPago = useFirestoreCollection<RegistroPago>('registrosPago', { orderByField: 'fecha', limitTo: 200 });
  const facturas = useFirestoreCollection<Factura>('facturas', { orderByField: 'fecha', limitTo: 100 });
  const productos = useFirestoreCollection<Producto>('productos');
  const ventasVendedor = useFirestoreCollection<VentaVendedor>('ventasVendedor', { limitTo: 100 });
  const gastos = useFirestoreCollection<Gasto>('gastos', { limitTo: 100 });
  const contratos = useFirestoreCollection<Contrato>('contratos');
  const servicios = useFirestoreCollection<Servicio>('servicios');
  const planillas = useFirestoreCollection<PlanillaDiaria>('planillas', { orderByField: 'fecha', limitTo: 30 });
  
  const [empresaSettings, setEmpresaSettings] = useState<EmpresaSettings>(mockEmpresaSettings);
  
  useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'empresa'), (doc) => {
          if (doc.exists()) {
              setEmpresaSettings(doc.data() as EmpresaSettings);
          }
      });
      return () => unsub();
  }, []);

  const addRemito = useCallback(async (remitoData: Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] }) => {
    const cliente = clientes.find(c => c.id === remitoData.clienteId);
    const { pagos, ...rawRemitoData } = remitoData;
    
    const newRemitoData = {
        ...rawRemitoData,
        sucursalId: rawRemitoData.sucursalId || null,
        pagoIds: [],
        facturaId: null
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
    const { id, pagos, ...dataToSave } = updatedRemitoData;
    const remitoRef = doc(db, 'remitos', id);
    await updateDoc(remitoRef, cleanUndefineds(dataToSave));
  }, []);

  const deleteRemito = useCallback(async (remitoId: string) => {
    await deleteDoc(doc(db, 'remitos', remitoId));
  }, []);
  
  const addMultipleRemitos = useCallback(async (newRemitos: Remito[]) => {
      const batchPromises = newRemitos.map(r => addDoc(collection(db, 'remitos'), cleanUndefineds(r)));
      await Promise.all(batchPromises);
  }, []);

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
            sucursalId: stock.sucursalId || null,
            vendedorId: adminUser?.id || usuarios[0]?.id,
            puntoVenta: '0000',
            numero: `AJU-${Date.now()}-${Math.floor(Math.random()*1000)}`,
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

    return clienteRef.id;
  }, [usuarios]);

  const updateCliente = useCallback(async (updatedCliente: Cliente & { 
    stockInicial?: { productoId: string; cantidad: number; sucursalId?: string }[];
    contratosIniciales?: Omit<Contrato, 'id' | 'clienteId'>[];
  }) => {
    const { id, stockInicial, contratosIniciales, ...data } = updatedCliente;
    await updateDoc(doc(db, 'clientes', id), cleanUndefineds(data));

    if (stockInicial && stockInicial.length > 0) {
        const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);
        const today = new Date().toISOString().split('T')[0];

        const remitosDeAjuste = stockInicial.map(stock => ({
            fecha: today,
            clienteId: id,
            sucursalId: stock.sucursalId || null,
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
        contratosIniciales.forEach(c => addDoc(collection(db, 'contratos'), cleanUndefineds({ ...c, clienteId: id })));
    }
  }, [usuarios]);

  const deleteCliente = useCallback(async (clienteId: string) => {
    await updateDoc(doc(db, 'clientes', clienteId), { estado: EstadoCliente.INACTIVO });
  }, []);
  
  const reactivarCliente = useCallback(async (clienteId: string) => {
    await updateDoc(doc(db, 'clientes', clienteId), { estado: EstadoCliente.ACTIVO });
  }, []);

  const addMultipleClientes = useCallback(async (newClientes: (Cliente & { stockInicial?: any[] })[]) => {
      // Usamos writeBatch para mayor eficiencia en importaciones masivas
      const batch = writeBatch(db);
      const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const fechaAjuste = yesterday.toISOString().split('T')[0];

      newClientes.forEach(clienteData => {
          const { stockInicial, ...cliente } = clienteData;
          const clienteRef = doc(collection(db, 'clientes'));
          batch.set(clienteRef, cleanUndefineds({ ...cliente, estado: EstadoCliente.ACTIVO }));

          if (stockInicial && stockInicial.length > 0) {
              stockInicial.forEach((stock: any) => {
                  const remitoRef = doc(collection(db, 'remitos'));
                  const remitoAjuste = {
                      fecha: fechaAjuste,
                      clienteId: clienteRef.id,
                      sucursalId: stock.sucursalId || null,
                      vendedorId: adminUser?.id || usuarios[0]?.id,
                      puntoVenta: '0000',
                      numero: `AJU-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                      movimientos: [{
                          productoId: stock.productoId,
                          entregados: stock.cantidad,
                          recibidos: 0
                      }]
                  };
                  batch.set(remitoRef, cleanUndefineds(remitoAjuste));
              });
          }
      });
      await batch.commit();
  }, [usuarios]);

  const addUsuario = useCallback(async (usuario: Omit<Usuario, 'id'>) => {
    await addDoc(collection(db, 'usuarios'), cleanUndefineds(usuario));
  }, []);

  const updateUsuario = useCallback(async (updatedUsuario: Usuario) => {
    const { id, ...data } = updatedUsuario;
    await updateDoc(doc(db, 'usuarios', id), cleanUndefineds(data));
  }, []);
  
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
    const { id, ...data } = updatedPago;
    await updateDoc(doc(db, 'registrosPago', id), cleanUndefineds(data));
  }, []);

  const deleteRegistroPago = useCallback(async (pagoId: string) => {
    await deleteDoc(doc(db, 'registrosPago', pagoId));
  }, []);

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
                clienteId: ventaData.clienteId || null,
            });
            return pagoRef.id;
        });
        const ids = await Promise.all(batchPagos);
        await updateDoc(ventaRef, { pagoIds: ids });
    }
  }, []);
  
  const updateVentaVendedor = useCallback(async (updatedVentaData: VentaVendedor & { pagos?: PagoDetalle[] }) => {
     const { id, pagos, ...data } = updatedVentaData;
     await updateDoc(doc(db, 'ventasVendedor', id), cleanUndefineds(data));
  }, []);

  const addGasto = useCallback(async (gasto: Omit<Gasto, 'id'>) => {
    await addDoc(collection(db, 'gastos'), cleanUndefineds(gasto));
  }, []);

  const updateGasto = useCallback(async (updatedGasto: Gasto) => {
    const { id, ...data } = updatedGasto;
    await updateDoc(doc(db, 'gastos', id), cleanUndefineds(data));
  }, []);

  const deleteGasto = useCallback(async (gastoId: string) => {
    await deleteDoc(doc(db, 'gastos', gastoId));
  }, []);

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

  const addProducto = useCallback(async (producto: Omit<Producto, 'id' | 'estado'>) => {
    await addDoc(collection(db, 'productos'), cleanUndefineds({ ...producto, estado: EstadoProducto.ACTIVO }));
  }, []);

  const updateProducto = useCallback(async (updatedProducto: Producto) => {
    const { id, ...data } = updatedProducto;
    await updateDoc(doc(db, 'productos', id), cleanUndefineds(data));
  }, []);

  const deleteProducto = useCallback(async (productoId: string) => {
    await updateDoc(doc(db, 'productos', productoId), { estado: EstadoProducto.INACTIVO });
  }, []);
  
  const reactivarProducto = useCallback(async (productoId: string) => {
    await updateDoc(doc(db, 'productos', productoId), { estado: EstadoProducto.ACTIVO });
  }, []);
  
  const updateEmpresaSettings = useCallback(async (settings: EmpresaSettings) => {
    await setDoc(doc(db, 'settings', 'empresa'), cleanUndefineds(settings));
  }, []);

  const addContrato = useCallback(async (contrato: Omit<Contrato, 'id'>) => {
    await addDoc(collection(db, 'contratos'), cleanUndefineds(contrato));
  }, []);

  const updateContrato = useCallback(async (updatedContrato: Contrato) => {
    const { id, ...data } = updatedContrato;
    await updateDoc(doc(db, 'contratos', id), cleanUndefineds(data));
  }, []);

  const deleteContrato = useCallback(async (contratoId: string) => {
    await deleteDoc(doc(db, 'contratos', contratoId));
  }, []);

  const addServicio = useCallback(async (servicio: Omit<Servicio, 'id' | 'estado'>) => {
    await addDoc(collection(db, 'servicios'), cleanUndefineds({ ...servicio, estado: EstadoServicio.ACTIVO }));
  }, []);

  const updateServicio = useCallback(async (updatedServicio: Servicio) => {
    const { id, ...data } = updatedServicio;
    await updateDoc(doc(db, 'servicios', id), cleanUndefineds(data));
  }, []);

  const deleteServicio = useCallback(async (servicioId: string) => {
    await updateDoc(doc(db, 'servicios', servicioId), { estado: EstadoServicio.INACTIVO });
  }, []);
  
  const reactivarServicio = useCallback(async (servicioId: string) => {
    await updateDoc(doc(db, 'servicios', servicioId), { estado: EstadoServicio.ACTIVO });
  }, []);

  const addPlanilla = useCallback(async (planilla: Omit<PlanillaDiaria, 'id'>) => {
      await addDoc(collection(db, 'planillas'), cleanUndefineds(planilla));
  }, []);

  const updatePlanilla = useCallback(async (updatedPlanilla: PlanillaDiaria) => {
      const { id, ...data } = updatedPlanilla;
      await updateDoc(doc(db, 'planillas', id), cleanUndefineds(data));
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
