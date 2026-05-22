
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  getDocs,
  writeBatch,
  setDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Cliente, 
  Remito, 
  Producto, 
  Usuario, 
  RegistroPago, 
  Gasto, 
  VentaVendedor, 
  Factura, 
  EmpresaSettings, 
  Contrato, 
  Servicio, 
  PlanillaDiaria,
  Rol,
  EstadoFactura,
  EstadoPlanilla,
  PagoDetalle,
  MetodoPago,
  EstadoCliente,
  EstadoProducto,
  EstadoServicio,
  Sucursal,
  DiaSemana,
  LogEntry,
  LogLevel,
  CausaRecambio,
  Recambio,
  MovimientoStockPlanta,
  CierrePlanta,
  Proveedor,
  FacturaProveedor,
  PagoProveedor,
  EstadoFacturaProveedor
} from '../types';
import { 
  Preforma, 
  Molde, 
  ProduccionSoplado, 
  EntregaSoplado,
  InsumoSoplado
} from '../plugins/soplado/types';
import { 
    calculateInsumoStockUpdates, 
    calculateInsumoStockReversions,
    calculateProduccionSubmits,
    calculateProduccionReversions,
    calculateEntregaMoldeUpdates,
    calculateEntregaMoldeReversions,
    calculateEntregaPlantaUpdates,
    calculateEntregaPlantaReversions
} from '../plugins/soplado/sopladoUtils';

const cleanUndefineds = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefineds(item)).filter(item => item !== undefined);
    }
    if (typeof obj === 'object') {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined && obj[key] !== null) {
                newObj[key] = cleanUndefineds(obj[key]);
            }
        });
        return newObj;
    }
    return obj;
};

import { getLocalDateString } from '../utils/dateUtils';

export const useDataStore = () => {
    const [remitos, setRemitos] = useState<Remito[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [registrosPago, setRegistrosPago] = useState<RegistroPago[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [ventasVendedor, setVentasVendedor] = useState<VentaVendedor[]>([]);
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [planillas, setPlanillas] = useState<PlanillaDiaria[]>([]);
    const [movimientosStockPlanta, setMovimientosStockPlanta] = useState<MovimientoStockPlanta[]>([]);
    const [cierresPlanta, setCierresPlanta] = useState<CierrePlanta[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [causasRecambio, setCausasRecambio] = useState<CausaRecambio[]>([]);
    const [preformas, setPreformas] = useState<Preforma[]>([]);
    const [moldes, setMoldes] = useState<Molde[]>([]);
    const [produccionSoplado, setProduccionSoplado] = useState<ProduccionSoplado[]>([]);
    const [entregasSoplado, setEntregasSoplado] = useState<EntregaSoplado[]>([]);
    const [insumosSoplado, setInsumosSoplado] = useState<InsumoSoplado[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [facturasProveedor, setFacturasProveedor] = useState<FacturaProveedor[]>([]);
    const [pagosProveedor, setPagosProveedor] = useState<PagoProveedor[]>([]);
    const [empresaSettings, setEmpresaSettings] = useState<EmpresaSettings>({ 
        nombre: 'Distribuidora Aguas Puras',
        nombreFantasia: 'Aguas Puras'
    });

    // --- LOGGER ---
    const addLog = useCallback(async (logData: Omit<LogEntry, 'id' | 'timestamp'>) => {
        try {
            await addDoc(collection(db, 'system_logs'), {
                ...logData,
                timestamp: Date.now(),
                version: '2.7.6'
            });
        } catch (e) {
            console.error("Error crítico al guardar log:", e);
        }
    }, []);

    useEffect(() => {
        if (!db) return;

        // Query especial para logs: Solo últimos 100 y ordenados
        const logsQuery = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(100));

        const unsub = [
            onSnapshot(collection(db, 'remitos'), (s) => setRemitos(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, movimientos: data.movimientos || [] } as Remito; }))),
            onSnapshot(collection(db, 'clientes'), (s) => setClientes(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, sucursales: data.sucursales || [] } as Cliente; }))),
            onSnapshot(collection(db, 'usuarios'), (s) => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario)))),
            onSnapshot(collection(db, 'productos'), (s) => setProductos(s.docs.map(d => ({ id: d.id, ...d.data() } as Producto)))),
            onSnapshot(collection(db, 'registrosPago'), (s) => setRegistrosPago(s.docs.map(d => ({ id: d.id, ...d.data() } as RegistroPago)))),
            onSnapshot(collection(db, 'gastos'), (s) => setGastos(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, pagos: data.pagos || [] } as Gasto; }))),
            onSnapshot(collection(db, 'ventasVendedor'), (s) => setVentasVendedor(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, movimientos: data.movimientos || [] } as VentaVendedor; }))),
            onSnapshot(collection(db, 'facturas'), (s) => setFacturas(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, remitosIds: data.remitosIds || [], pagoIds: data.pagoIds || [] } as Factura; }))),
            onSnapshot(collection(db, 'contratos'), (s) => setContratos(s.docs.map(d => ({ id: d.id, ...d.data() } as Contrato)))),
            onSnapshot(collection(db, 'servicios'), (s) => setServicios(s.docs.map(d => ({ id: d.id, ...d.data() } as Servicio)))),
            onSnapshot(collection(db, 'planillas'), (s) => setPlanillas(s.docs.map(d => { const data = d.data(); return { id: d.id, ...data, cargaInicial: data.cargaInicial || [], recargas: data.recargas || [], devolucion: data.devolucion || [] } as PlanillaDiaria; }))),
            onSnapshot(collection(db, 'movimientosStockPlanta'), (s) => setMovimientosStockPlanta(s.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoStockPlanta)))),
            onSnapshot(collection(db, 'cierres_planta'), (s) => setCierresPlanta(s.docs.map(d => ({ id: d.id, ...d.data() } as CierrePlanta)))),
            onSnapshot(collection(db, 'causasRecambio'), (s) => setCausasRecambio(s.docs.map(d => ({ id: d.id, ...d.data() } as CausaRecambio)))),
            onSnapshot(logsQuery, (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry)))),
            onSnapshot(collection(db, 'preformas'), (s) => setPreformas(s.docs.map(d => ({ id: d.id, ...d.data() } as Preforma)))),
            onSnapshot(collection(db, 'moldes'), (s) => setMoldes(s.docs.map(d => ({ id: d.id, ...d.data() } as Molde)))),
            onSnapshot(collection(db, 'produccion_soplado'), (s) => setProduccionSoplado(s.docs.map(d => ({ id: d.id, ...d.data() } as ProduccionSoplado)))),
            onSnapshot(collection(db, 'entregas_soplado'), (s) => setEntregasSoplado(s.docs.map(d => ({ id: d.id, ...d.data() } as EntregaSoplado)))),
            onSnapshot(collection(db, 'insumos_soplado'), (s) => setInsumosSoplado(s.docs.map(d => ({ id: d.id, ...d.data() } as InsumoSoplado)))),
            onSnapshot(collection(db, 'proveedores'), (s) => setProveedores(s.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)))),
            onSnapshot(collection(db, 'facturas_proveedor'), (s) => setFacturasProveedor(s.docs.map(d => ({ id: d.id, ...d.data() } as FacturaProveedor)))),
            onSnapshot(collection(db, 'pagos_proveedor'), (s) => setPagosProveedor(s.docs.map(d => ({ id: d.id, ...d.data() } as PagoProveedor)))),
            onSnapshot(doc(db, 'settings', 'empresa'), (s) => {
                if (s.exists()) {
                    setEmpresaSettings(s.data() as EmpresaSettings);
                }
            }),
        ];
        return () => {
            unsub.forEach(fn => fn());
            setRemitos([]); setClientes([]); setUsuarios([]); setProductos([]); setRegistrosPago([]);
        };
    }, []);

    const addRemito = useCallback(async (r: any) => {
        const { pagos, ...remitoData } = r;
        const docRef = await addDoc(collection(db, 'remitos'), cleanUndefineds(remitoData));
        if (pagos && pagos.length > 0) {
            const pagoIds: string[] = [];
            for (const p of pagos) {
                const pDoc = await addDoc(collection(db, 'registrosPago'), {
                    fecha: remitoData.fecha,
                    monto: p.monto,
                    metodo: p.metodo,
                    origen: { tipo: 'remito', id: docRef.id },
                    clienteId: remitoData.clienteId,
                    vendedorId: remitoData.vendedorId
                });
                pagoIds.push(pDoc.id);
            }
            await updateDoc(doc(db, 'remitos', docRef.id), { pagoIds });
        }
    }, []);

    const deleteRemito = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'remitos', id));
    }, []);

    const addPagoManual = useCallback(async (p: any) => {
        const { pagos, ...base } = p;
        const groupId = `PM-${Date.now()}`;
        for (const pago of pagos) {
            await addDoc(collection(db, 'registrosPago'), {
                ...base,
                monto: pago.monto,
                metodo: pago.metodo,
                origen: { tipo: 'pago_manual', id: groupId }
            });
        }
    }, []);

    const updateRegistroPago = useCallback(async (p: any) => {
        const { id, pagos, ...data } = p;
        
        // Si no hay array de pagos, es una actualización simple de un solo documento
        if (!pagos) {
            await updateDoc(doc(db, 'registrosPago', id), cleanUndefineds(data));
            return;
        }

        // Si hay array de pagos, estamos editando un grupo (Ingreso Manual, Remito, Venta, etc.)
        const batch = writeBatch(db);
        
        // 1. Buscar todos los pagos con el mismo origen para eliminarlos y recrearlos
        // Esto asegura que si se agregaron o quitaron métodos de pago, el estado sea correcto.
        const q = query(collection(db, 'registrosPago'), where('origen.id', '==', data.origen.id));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        
        // 2. Crear los nuevos pagos
        const newPagoIds: string[] = [];
        for (const pago of pagos) {
            const newDocRef = doc(collection(db, 'registrosPago'));
            batch.set(newDocRef, cleanUndefineds({
                ...data,
                monto: pago.monto,
                metodo: pago.metodo
            }));
            newPagoIds.push(newDocRef.id);
        }
        
        await batch.commit();

        // 3. Sincronizar pagoIds en el origen si aplica
        if (data.origen.tipo === 'remito') {
            await updateDoc(doc(db, 'remitos', data.origen.id), { pagoIds: newPagoIds });
        } else if (data.origen.tipo === 'venta_vendedor') {
            await updateDoc(doc(db, 'ventasVendedor', data.origen.id), { pagoIds: newPagoIds });
        }
    }, []);

    const deleteRegistroPago = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'registrosPago', id));
    }, []);

    const updateRemito = useCallback(async (r: any) => {
        const { id, pagos, ...data } = r;
        await updateDoc(doc(db, 'remitos', id), cleanUndefineds(data));

        // Si hay pagos, actualizarlos también para que coincidan en fecha/vendedor/cliente
        if (pagos) {
            await updateRegistroPago({
                fecha: data.fecha,
                vendedorId: data.vendedorId,
                clienteId: data.clienteId || null,
                origen: { tipo: 'remito', id: id },
                pagos
            });
        }
    }, [updateRegistroPago]);

    // Función auxiliar para procesar stock inicial y contratos (reutilizable)
    const processInitialData = async (clienteId: string, stockInicial?: any[], contratosIniciales?: any[], adminId?: string) => {
        // 1. Procesar Stock Inicial (Crear Remitos de Ajuste)
        if (stockInicial && stockInicial.length > 0) {
            const today = getLocalDateString();
            // Agrupar por sucursal para no crear mil remitos
            const stockPorSucursal: Record<string, any[]> = {};
            
            stockInicial.forEach(item => {
                const sucId = item.sucursalId || 'main';
                if (!stockPorSucursal[sucId]) stockPorSucursal[sucId] = [];
                stockPorSucursal[sucId].push(item);
            });

            for (const [sucursalId, items] of Object.entries(stockPorSucursal)) {
                const movimientos = items.map((stock: any) => ({
                    productoId: stock.productoId,
                    entregados: stock.cantidad > 0 ? stock.cantidad : 0,
                    recibidos: stock.cantidad < 0 ? Math.abs(stock.cantidad) : 0
                })).filter((m: any) => m.entregados > 0 || m.recibidos > 0);

                if (movimientos.length > 0) {
                    const remitoAjuste = {
                        fecha: today,
                        clienteId: clienteId,
                        sucursalId: sucursalId === 'main' ? null : sucursalId,
                        vendedorId: adminId || '',
                        puntoVenta: '0000',
                        numero: `INI-${Date.now().toString().slice(-6)}`,
                        esAjuste: true,
                        movimientos
                    };
                    await addDoc(collection(db, 'remitos'), cleanUndefineds(remitoAjuste));
                }
            }
        }

        // 2. Procesar Contratos Iniciales
        if (contratosIniciales && contratosIniciales.length > 0) {
            for (const c of contratosIniciales) {
                await addDoc(collection(db, 'contratos'), cleanUndefineds({ ...c, clienteId: clienteId }));
            }
        }
    };

    const addCliente = useCallback(async (c: any) => {
        const { stockInicial, contratosIniciales, ...data } = c;
        
        // 1. Guardar Cliente
        const docRef = await addDoc(collection(db, 'clientes'), { ...cleanUndefineds(data), estado: EstadoCliente.ACTIVO });
        
        // 2. Procesar Datos Iniciales (AHORA SÍ SE GUARDAN)
        const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);
        await processInitialData(docRef.id, stockInicial, contratosIniciales, adminUser?.id || (usuarios.length > 0 ? usuarios[0].id : ''));

        return docRef.id;
    }, [usuarios]);

    const updateCliente = useCallback(async (updatedCliente: Cliente & { 
        stockInicial?: { productoId: string; cantidad: number; sucursalId?: string }[];
        contratosIniciales?: Omit<Contrato, 'id' | 'clienteId'>[];
    }) => {
        const { id, stockInicial, contratosIniciales, ...data } = updatedCliente;
        
        await updateDoc(doc(db, 'clientes', id), cleanUndefineds(data));
        
        // También procesamos en update por si es una auditoría posterior
        const adminUser = usuarios.find(u => u.rol === Rol.ADMINISTRADOR);
        await processInitialData(id, stockInicial, contratosIniciales, adminUser?.id || (usuarios.length > 0 ? usuarios[0].id : ''));

    }, [usuarios]);

    const deleteCliente = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'clientes', id), { estado: EstadoCliente.INACTIVO });
    }, []);

    const reactivarCliente = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'clientes', id), { estado: EstadoCliente.ACTIVO });
    }, []);


    const addGasto = useCallback(async (g: any) => {
        await addDoc(collection(db, 'gastos'), cleanUndefineds(g));
    }, []);

    const addVentaVendedor = useCallback(async (v: any) => {
        const { pagos, ...data } = v;
        const docRef = await addDoc(collection(db, 'ventasVendedor'), cleanUndefineds(data));
        if (pagos) {
            const pagoIds = [];
            for (const p of pagos) {
                const pDoc = await addDoc(collection(db, 'registrosPago'), {
                    fecha: data.fecha,
                    monto: p.monto,
                    metodo: p.metodo,
                    origen: { tipo: 'venta_vendedor', id: docRef.id },
                    vendedorId: data.vendedorId,
                    clienteId: data.clienteId || null
                });
                pagoIds.push(pDoc.id);
            }
            await updateDoc(doc(db, 'ventasVendedor', docRef.id), { pagoIds });
        }
    }, []);


    const updateGasto = useCallback(async (g: any) => {
        const { id, ...data } = g;
        await updateDoc(doc(db, 'gastos', id), cleanUndefineds(data));
    }, []);


    const deleteGasto = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'gastos', id));
    }, []);

    const updateVentaVendedor = useCallback(async (v: any) => {
        const { id, pagos, ...data } = v;
        await updateDoc(doc(db, 'ventasVendedor', id), cleanUndefineds(data));
        
        // Si hay pagos, actualizarlos también para que coincidan en fecha/vendedor/cliente
        if (pagos) {
            await updateRegistroPago({
                fecha: data.fecha,
                vendedorId: data.vendedorId,
                clienteId: data.clienteId || null,
                origen: { tipo: 'venta_vendedor', id: id },
                pagos
            });
        }
    }, [updateRegistroPago]);

    // NUEVO: Función para eliminar ventas de vendedores (corrección de stock)
    const deleteVentaVendedor = useCallback(async (id: string) => {
        // Eliminar la venta
        await deleteDoc(doc(db, 'ventasVendedor', id));
        // Eliminar los pagos asociados en registrosPago
        const q = query(collection(db, 'registrosPago'), where('origen.tipo', '==', 'venta_vendedor'), where('origen.id', '==', id));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
    }, []);

    const addUsuario = useCallback(async (u: any) => {
        await addDoc(collection(db, 'usuarios'), cleanUndefineds(u));
    }, []);

    const updateUsuario = useCallback(async (u: any) => {
        const { id, ...data } = u;
        await updateDoc(doc(db, 'usuarios', id), cleanUndefineds(data));
    }, []);

    const addFactura = useCallback(async (f: any) => {
        const docRef = await addDoc(collection(db, 'facturas'), { 
            ...cleanUndefineds(f), 
            estado: EstadoFactura.PENDIENTE
        });
        for (const rid of f.remitosIds) { await updateDoc(doc(db, 'remitos', rid), { facturaId: docRef.id }); }
    }, []);

    const addPagoToFactura = useCallback(async (facturaId: string, fecha: string, pagos: PagoDetalle[]) => {
        const f = facturas.find(fact => fact.id === facturaId);
        if (!f) return;
        const currentPagos = registrosPago.filter(p => p.origen.tipo === 'factura' && p.origen.id === facturaId);
        const pagoIds = [...(f.pagoIds || [])];
        for (const p of pagos) {
            const pDoc = await addDoc(collection(db, 'registrosPago'), {
                fecha, monto: p.monto, metodo: p.metodo, origen: { tipo: 'factura', id: facturaId }, clienteId: f.clienteId
            });
            pagoIds.push(pDoc.id);
        }
        const totalPagado = [...currentPagos.map(p => p.monto), ...pagos.map(p => p.monto)].reduce((s, p) => s + p, 0);
        const nuevoEstado = totalPagado >= f.monto ? EstadoFactura.PAGADO : EstadoFactura.PAGADO_PARCIAL;
        await updateDoc(doc(db, 'facturas', facturaId), { pagoIds, estado: nuevoEstado });
    }, [facturas, registrosPago]);

    const markFacturaAsSent = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'facturas', id), { enviada: true });
    }, []);

    const addProducto = useCallback(async (p: any) => {
        await addDoc(collection(db, 'productos'), { ...cleanUndefineds(p), estado: EstadoProducto.ACTIVO });
    }, []);

    const updateProducto = useCallback(async (p: any) => {
        const { id, ...data } = p;
        await updateDoc(doc(db, 'productos', id), cleanUndefineds(data));
    }, []);

    const deleteProducto = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'productos', id), { estado: EstadoProducto.INACTIVO });
    }, []);

    const reactivarProducto = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'productos', id), { estado: EstadoProducto.ACTIVO });
    }, []);

    const addServicio = useCallback(async (s: any) => {
        await addDoc(collection(db, 'servicios'), { ...cleanUndefineds(s), estado: EstadoServicio.ACTIVO });
    }, []);

    const updateServicio = useCallback(async (s: any) => {
        const { id, ...data } = s;
        const oldServicio = servicios.find(serv => serv.id === id);
        
        await updateDoc(doc(db, 'servicios', id), cleanUndefineds(data));

        // Propagar cambios en valores (monto y consumo) a los contratos que no tengan valores personalizados
        if (oldServicio) {
            const batch = writeBatch(db);
            const affectedContratos = contratos.filter(c => c.servicioId === id);
            
            let hasChanges = false;
            affectedContratos.forEach(c => {
                const updates: any = {};

                // Propagar montoMensual si el contrato tenía el valor estándar anterior
                if (data.montoMensual !== undefined && data.montoMensual !== oldServicio.montoMensual) {
                    if (c.montoMensual === oldServicio.montoMensual) {
                        updates.montoMensual = data.montoMensual;
                    }
                }

                // Propagar consumoIncluido si el contrato tenía el valor estándar anterior
                if (data.consumoIncluido !== undefined && data.consumoIncluido !== oldServicio.consumoIncluido) {
                    if (c.consumoIncluido === oldServicio.consumoIncluido) {
                        updates.consumoIncluido = data.consumoIncluido;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc(db, 'contratos', c.id), updates);
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                await batch.commit();
            }
        }
    }, [servicios, contratos]);

    const deleteServicio = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'servicios', id), { estado: EstadoServicio.INACTIVO });
    }, []);

    const reactivarServicio = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'servicios', id), { estado: EstadoServicio.ACTIVO });
    }, []);

    const addContrato = useCallback(async (c: any) => {
        await addDoc(collection(db, 'contratos'), cleanUndefineds(c));
    }, []);

    const updateContrato = useCallback(async (c: any) => {
        const { id, ...data } = c;
        await updateDoc(doc(db, 'contratos', id), cleanUndefineds(data));
    }, []);

    const deleteContrato = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'contratos', id));
    }, []);

    const addMultipleClientes = useCallback(async (cls: Cliente[]) => {
        const batch = writeBatch(db);
        cls.forEach(c => {
            const newDoc = doc(collection(db, 'clientes'));
            batch.set(newDoc, cleanUndefineds(c));
        });
        await batch.commit();
    }, []);

    const deleteAllClientes = useCallback(async () => {
        const snapshot = await getDocs(collection(db, 'clientes'));
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }, []);

    const addPlanilla = useCallback(async (p: any) => {
        const docRef = await addDoc(collection(db, 'planillas'), cleanUndefineds(p));
        
        // Al abrir planilla, descontar carga inicial del stock de planta
        const batch = writeBatch(db);
        p.cargaInicial.forEach((item: any) => {
            const prod = productos.find(pr => pr.id === item.productoId);
            if (prod) {
                const newStock = (prod.stockPlanta || 0) - item.cantidad;
                batch.update(doc(db, 'productos', prod.id), { stockPlanta: newStock });
            }
        });
        await batch.commit();

        addLog({
            level: LogLevel.INFO,
            message: `Planilla abierta para ${usuarios.find(u => u.id === p.repartidorId)?.nombre}`,
            details: `Carga inicial: ${JSON.stringify(p.cargaInicial)}`,
            route: 'planillas'
        });
    }, [productos, usuarios, addLog]);

    const updatePlanilla = useCallback(async (p: any) => {
        const { id, ...data } = p;
        const oldPlanilla = planillas.find(pl => pl.id === id);
        if (!oldPlanilla) return;
        
        await updateDoc(doc(db, 'planillas', id), cleanUndefineds(data));

        const batch = writeBatch(db);
        let hasChanges = false;

        // 1. Lógica de CIERRE
        if (data.estado === EstadoPlanilla.CERRADA && oldPlanilla.estado === EstadoPlanilla.ABIERTA) {
            // Al cerrar planilla, sumar lo que vuelve al stock de planta (Llenos y Vacíos)
            data.devolucion?.forEach((item: any) => {
                const prod = productos.find(pr => pr.id === item.productoId);
                if (prod) {
                    const newStockLlenos = (prod.stockPlanta || 0) + (item.cantidadLlenos || 0);
                    const newStockVacios = (prod.stockEnvases || 0) + (item.cantidadVacios || 0);
                    batch.update(doc(db, 'productos', prod.id), { 
                        stockPlanta: newStockLlenos,
                        stockEnvases: newStockVacios
                    });
                    hasChanges = true;
                }
            });
            addLog({
                level: LogLevel.INFO,
                message: `Planilla cerrada: ${usuarios.find(u => u.id === oldPlanilla.repartidorId)?.nombre}`,
                details: `Devolución: ${JSON.stringify(data.devolucion)}`,
                route: 'planillas'
            });
        } 

        // 1.5 Lógica de REAPERTURA
        if (data.estado === EstadoPlanilla.ABIERTA && oldPlanilla.estado === EstadoPlanilla.CERRADA) {
            // Al reabrir, restar lo que se había sumado al stock de planta (revertir cierre)
            oldPlanilla.devolucion?.forEach((item: any) => {
                const prod = productos.find(pr => pr.id === item.productoId);
                if (prod) {
                    const newStockLlenos = (prod.stockPlanta || 0) - (item.cantidadLlenos || 0);
                    const newStockVacios = (prod.stockEnvases || 0) - (item.cantidadVacios || 0);
                    batch.update(doc(db, 'productos', prod.id), { 
                        stockPlanta: newStockLlenos,
                        stockEnvases: newStockVacios
                    });
                    hasChanges = true;
                }
            });
            addLog({
                level: LogLevel.WARNING,
                message: `Planilla reabierta: ${usuarios.find(u => u.id === oldPlanilla.repartidorId)?.nombre}`,
                details: `Se revirtió la devolución de stock`,
                route: 'planillas'
            });
        }
        
        // 2. Lógica de RECARGAS (Detección de nuevas recargas)
        const oldRecargasCount = oldPlanilla.recargas?.length || 0;
        const newRecargasCount = data.recargas?.length || 0;

        if (newRecargasCount > oldRecargasCount) {
            // Se agregaron recargas
            const addedRecargas = data.recargas.slice(oldRecargasCount);
            addedRecargas.forEach((rec: any) => {
                // Descontar productos llenos que salen de planta
                rec.items.forEach((item: any) => {
                    const prod = productos.find(pr => pr.id === item.productoId);
                    if (prod) {
                        const newStock = (prod.stockPlanta || 0) - item.cantidad;
                        batch.update(doc(db, 'productos', prod.id), { stockPlanta: newStock });
                        hasChanges = true;
                    }
                });

                // Sumar envases vacíos que entran a planta desde el camión
                rec.vaciosDescargados?.forEach((item: any) => {
                    const prod = productos.find(pr => pr.id === item.productoId);
                    if (prod) {
                        const newStock = (prod.stockEnvases || 0) + item.cantidad;
                        batch.update(doc(db, 'productos', prod.id), { stockEnvases: newStock });
                        hasChanges = true;
                    }
                });
            });
        } else if (newRecargasCount < oldRecargasCount) {
            // Se eliminaron recargas (Revertir stock)
            const removedRecargas = oldPlanilla.recargas!.slice(newRecargasCount);
            removedRecargas.forEach((rec: any) => {
                // Revertir: Sumar productos llenos que NO salieron
                rec.items.forEach((item: any) => {
                    const prod = productos.find(pr => pr.id === item.productoId);
                    if (prod) {
                        const newStock = (prod.stockPlanta || 0) + item.cantidad;
                        batch.update(doc(db, 'productos', prod.id), { stockPlanta: newStock });
                        hasChanges = true;
                    }
                });

                // Revertir: Restar envases vacíos que NO entraron
                rec.vaciosDescargados?.forEach((item: any) => {
                    const prod = productos.find(pr => pr.id === item.productoId);
                    if (prod) {
                        const newStock = (prod.stockEnvases || 0) - item.cantidad;
                        batch.update(doc(db, 'productos', prod.id), { stockEnvases: newStock });
                        hasChanges = true;
                    }
                });
            });
        }

        if (hasChanges) {
            await batch.commit();
        }
    }, [planillas, productos, usuarios, addLog]);

    const deletePlanilla = useCallback(async (id: string) => {
        const planilla = planillas.find(p => p.id === id);
        if (!planilla) return;

        const batch = writeBatch(db);
        
        // REVERTIR CARGA INICIAL (Sumar a planta)
        planilla.cargaInicial.forEach(item => {
            const prod = productos.find(p => p.id === item.productoId);
            if (prod) {
                const newStock = (prod.stockPlanta || 0) + item.cantidad;
                batch.update(doc(db, 'productos', prod.id), { stockPlanta: newStock });
            }
        });

        // REVERTIR RECARGAS
        planilla.recargas?.forEach(rec => {
            rec.items.forEach(item => {
                const prod = productos.find(p => p.id === item.productoId);
                if (prod) {
                    const newStock = (prod.stockPlanta || 0) + item.cantidad;
                    batch.update(doc(db, 'productos', prod.id), { stockPlanta: newStock });
                }
            });
            rec.vaciosDescargados?.forEach(item => {
                const prod = productos.find(p => p.id === item.productoId);
                if (prod) {
                    const newStock = (prod.stockEnvases || 0) - item.cantidad;
                    batch.update(doc(db, 'productos', prod.id), { stockEnvases: newStock });
                }
            });
        });

        // REVERTIR DEVOLUCION SI ESTABA CERRADA
        if (planilla.estado === EstadoPlanilla.CERRADA) {
            planilla.devolucion?.forEach(item => {
                const prod = productos.find(p => p.id === item.productoId);
                if (prod) {
                    const newStockLlenos = (prod.stockPlanta || 0) - (item.cantidadLlenos || 0);
                    const newStockVacios = (prod.stockEnvases || 0) - (item.cantidadVacios || 0);
                    batch.update(doc(db, 'productos', prod.id), { 
                        stockPlanta: newStockLlenos,
                        stockEnvases: newStockVacios
                    });
                }
            });
        }

        batch.delete(doc(db, 'planillas', id));
        await batch.commit();

        addLog({
            level: LogLevel.WARNING,
            message: `Planilla eliminada: ${usuarios.find(u => u.id === planilla.repartidorId)?.nombre}`,
            details: `Se revirtieron todos los movimientos de stock asociados.`,
            route: 'planillas'
        });
    }, [planillas, productos, usuarios, addLog]);

    const addMovimientoStockPlanta = useCallback(async (mov: Omit<MovimientoStockPlanta, 'id'>) => {
        const docRef = await addDoc(collection(db, 'movimientosStockPlanta'), cleanUndefineds(mov));
        
        // Actualizar stock del producto (si no es un cierre físico, ya que el cierre no suma/resta, sino que establece el nuevo punto de partida)
        if (mov.tipo !== 'cierre_fisico') {
            const prod = productos.find(p => p.id === mov.productoId);
            if (prod) {
                const field = mov.esEnvase ? 'stockEnvases' : 'stockPlanta';
                const currentStock = (prod[field] as number) || 0;
                let newStock = currentStock;
                
                if (mov.tipo === 'entrada') newStock += mov.cantidad;
                else if (mov.tipo === 'salida') newStock -= mov.cantidad;
                else if (mov.tipo === 'ajuste') newStock = mov.cantidad;

                await updateDoc(doc(db, 'productos', prod.id), { [field]: newStock });
            }
        }
        return docRef.id;
    }, [productos]);

    const addCierrePlanta = useCallback(async (cierre: Omit<CierrePlanta, 'id'>) => {
        const docRef = await addDoc(collection(db, 'cierres_planta'), cleanUndefineds(cierre));
        
        // Al cerrar, actualizamos el stock de los productos con el valor físico real
        const batch = writeBatch(db);
        for (const saldo of cierre.saldos) {
            const prodRef = doc(db, 'productos', saldo.productoId);
            batch.update(prodRef, { stockPlanta: saldo.cantidadFisica });
            
            // También registramos un movimiento de tipo 'cierre_fisico' para el historial
            const movRef = doc(collection(db, 'movimientosStockPlanta'));
            batch.set(movRef, cleanUndefineds({
                fecha: cierre.fecha,
                productoId: saldo.productoId,
                cantidad: saldo.cantidadFisica,
                tipo: 'cierre_fisico',
                concepto: 'Cierre Diario de Planta',
                esEnvase: false
            }));
        }
        await batch.commit();
        return docRef.id;
    }, []);

    const updateEmpresaSettings = useCallback(async (s: any) => {
        await setDoc(doc(db, 'settings', 'empresa'), cleanUndefineds(s));
    }, []);

    const addCausaRecambio = useCallback(async (causa: Omit<CausaRecambio, 'id'>) => {
        await addDoc(collection(db, 'causasRecambio'), causa);
    }, []);

    const deleteCausaRecambio = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'causasRecambio', id));
    }, []);

    // --- SOPLADO PLUGIN FUNCTIONS ---

    const addPreforma = useCallback(async (p: Omit<Preforma, 'id'>) => {
        await addDoc(collection(db, 'preformas'), cleanUndefineds(p));
    }, []);

    const updatePreforma = useCallback(async (p: Preforma) => {
        const { id, ...data } = p;
        await updateDoc(doc(db, 'preformas', id), cleanUndefineds(data));
    }, []);

    const deletePreforma = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'preformas', id));
    }, []);

    const addMolde = useCallback(async (m: Omit<Molde, 'id'>) => {
        await addDoc(collection(db, 'moldes'), cleanUndefineds(m));
    }, []);

    const updateMolde = useCallback(async (m: Molde) => {
        const { id, ...data } = m;
        await updateDoc(doc(db, 'moldes', id), cleanUndefineds(data));
    }, []);

    const deleteMolde = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'moldes', id));
    }, []);

    const addInsumoSoplado = useCallback(async (insumo: Omit<InsumoSoplado, 'id'>) => {
        await addDoc(collection(db, 'insumos_soplado'), cleanUndefineds(insumo));
    }, []);

    const updateInsumoSoplado = useCallback(async (insumo: InsumoSoplado) => {
        const { id, ...data } = insumo;
        await updateDoc(doc(db, 'insumos_soplado', id), cleanUndefineds(data));
    }, []);

    const deleteInsumoSoplado = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'insumos_soplado', id));
    }, []);

    const addProduccionSoplado = useCallback(async (prod: Omit<ProduccionSoplado, 'id'>) => {
        const batch = writeBatch(db);
        
        // 1. Registrar producción
        const prodRef = doc(collection(db, 'produccion_soplado'));
        batch.set(prodRef, cleanUndefineds(prod));

        // 2. Descontar preforma y sumar stock al molde
        const prodUpdates = calculateProduccionSubmits(prod, moldes);
        if (prodUpdates) {
            batch.update(doc(db, 'moldes', prodUpdates.moldeId), { stockActual: prodUpdates.newStock });
            
            const preforma = preformas.find(p => p.id === prodUpdates.preformaId);
            if (preforma) {
                const totalConsumido = Number(prod.cantidadProducida) + Number(prod.merma);
                const newStockPreforma = Number(preforma.stockActual) - totalConsumido;
                batch.update(doc(db, 'preformas', preforma.id), { stockActual: newStockPreforma });
            }
        }

        await batch.commit();
    }, [moldes, preformas]);

    const deleteProduccionSoplado = useCallback(async (id: string) => {
        const prod = produccionSoplado.find(p => p.id === id);
        if (!prod) return;

        const batch = writeBatch(db);
        
        // 1. Revertir stock de preforma y molde
        const revertUpdates = calculateProduccionReversions(prod, moldes);
        if (revertUpdates) {
            batch.update(doc(db, 'moldes', revertUpdates.moldeId), { stockActual: revertUpdates.newStock });
            
            const preforma = preformas.find(p => p.id === revertUpdates.preformaId);
            if (preforma) {
                const totalConsumido = Number(prod.cantidadProducida) + Number(prod.merma);
                const newStockPreforma = Number(preforma.stockActual) + totalConsumido;
                batch.update(doc(db, 'preformas', preforma.id), { stockActual: newStockPreforma });
            }
        }

        // 2. Eliminar producción
        batch.delete(doc(db, 'produccion_soplado', id));

        await batch.commit();
    }, [produccionSoplado, moldes, preformas]);

    const updateProduccionSoplado = useCallback(async (prod: ProduccionSoplado) => {
        const oldProd = produccionSoplado.find(p => p.id === prod.id);
        if (!oldProd) return;

        const batch = writeBatch(db);

        // Revertir vieja producción en memoria y aplicar la nueva
        const oldRevertUpdates = calculateProduccionReversions(oldProd, moldes);
        const virtualMoldes = moldes.map(m => m.id === oldRevertUpdates?.moldeId ? { ...m, stockActual: oldRevertUpdates.newStock } : m);
        const newUpdates = calculateProduccionSubmits(prod, virtualMoldes);

        if (newUpdates) {
            batch.update(doc(db, 'moldes', newUpdates.moldeId), { stockActual: newUpdates.newStock });
            
            const preforma = preformas.find(p => p.id === newUpdates.preformaId);
            if (preforma) {
                const oldConsumido = Number(oldProd.cantidadProducida) + Number(oldProd.merma);
                const newConsumido = Number(prod.cantidadProducida) + Number(prod.merma);
                const diff = newConsumido - oldConsumido;
                const newStockPreforma = Number(preforma.stockActual) - diff;
                batch.update(doc(db, 'preformas', preforma.id), { stockActual: newStockPreforma });
            }
        }

        batch.update(doc(db, 'produccion_soplado', prod.id), cleanUndefineds(prod));
        await batch.commit();
    }, [produccionSoplado, moldes, preformas]);

    const addEntregaSoplado = useCallback(async (entrega: Omit<EntregaSoplado, 'id'>) => {
        const batch = writeBatch(db);
        
        // 1. Registrar entrega
        const entregaRef = doc(collection(db, 'entregas_soplado'));
        batch.set(entregaRef, cleanUndefineds(entrega));

        // 2. Integración con Planta (si está habilitada) y Descuento de stock en Soplado
        // Soplado: descontamos el stock del molde porque los bidones salen del sector
        const moldeUpdates = calculateEntregaMoldeUpdates(entrega, moldes);
        if (moldeUpdates) {
            batch.update(doc(db, 'moldes', moldeUpdates.moldeId), { stockActual: moldeUpdates.newStock });
        }

        if (entrega.destino === 'PLANTA') {
            const plantaUpdates = calculateEntregaPlantaUpdates(entrega, productos);
            if (plantaUpdates) {
                batch.update(doc(db, 'productos', plantaUpdates.productoId), { stockEnvases: plantaUpdates.newStockEnvases });
            }
        }

        // 3. Descontar stock de insumos asociados
        const updates = calculateInsumoStockUpdates(entrega, insumosSoplado);
        updates.forEach(update => {
            batch.update(doc(db, 'insumos_soplado', update.id), { stockActual: update.newStock });
        });

        await batch.commit();
    }, [moldes, productos, insumosSoplado]);

    const deleteEntregaSoplado = useCallback(async (id: string) => {
        const entrega = entregasSoplado.find(e => e.id === id);
        if (!entrega) return;

        const batch = writeBatch(db);
        
        // 1. Revertir integración con Planta y Stock de Soplado
        // Soplado: devolvemos los bidones al sector
        const revertMoldeUpdates = calculateEntregaMoldeReversions(entrega, moldes);
        if (revertMoldeUpdates) {
            batch.update(doc(db, 'moldes', revertMoldeUpdates.moldeId), { stockActual: revertMoldeUpdates.newStock });
        }

        if (entrega.destino === 'PLANTA') {
            const revertPlantaUpdates = calculateEntregaPlantaReversions(entrega, productos);
            if (revertPlantaUpdates) {
                batch.update(doc(db, 'productos', revertPlantaUpdates.productoId), { stockEnvases: revertPlantaUpdates.newStockEnvases });
            }
        }

        // 2. Revertir stock de insumos asociados
        const updates = calculateInsumoStockReversions(entrega, insumosSoplado);
        updates.forEach(update => {
            batch.update(doc(db, 'insumos_soplado', update.id), { stockActual: update.newStock });
        });

        // 3. Eliminar entrega
        batch.delete(doc(db, 'entregas_soplado', id));

        await batch.commit();
    }, [entregasSoplado, moldes, productos, insumosSoplado]);

    const updateEntregaSoplado = useCallback(async (entrega: EntregaSoplado) => {
        const oldEntrega = entregasSoplado.find(e => e.id === entrega.id);
        if (!oldEntrega) return;

        const batch = writeBatch(db);

        // Old Reversals
        const insumoReversas = calculateInsumoStockReversions(oldEntrega, insumosSoplado);
        const moldeReversas = calculateEntregaMoldeReversions(oldEntrega, moldes);
        const plantaReversas = oldEntrega.destino === 'PLANTA' ? calculateEntregaPlantaReversions(oldEntrega, productos) : null;

        let insumoStocks = new Map(insumosSoplado.map(i => [i.id, Number(i.stockActual) || 0]));
        let moldeStocks = new Map(moldes.map(m => [m.id, Number(m.stockActual) || 0]));
        let prodEnvasesStocks = new Map(productos.map(p => [p.id, Number(p.stockEnvases) || 0]));

        insumoReversas.forEach(r => insumoStocks.set(r.id, r.newStock));
        if (moldeReversas) moldeStocks.set(moldeReversas.moldeId, moldeReversas.newStock);
        if (plantaReversas) prodEnvasesStocks.set(plantaReversas.productoId, plantaReversas.newStockEnvases);
        
        const virtualInsumos = insumosSoplado.map(i => ({...i, stockActual: insumoStocks.get(i.id) || 0}));
        const virtualMoldes = moldes.map(m => ({...m, stockActual: moldeStocks.get(m.id) || 0}));
        const virtualProductos = productos.map(p => ({...p, stockEnvases: prodEnvasesStocks.get(p.id) || 0}));

        const newInsumoUpdates = calculateInsumoStockUpdates(entrega, virtualInsumos);
        newInsumoUpdates.forEach(r => insumoStocks.set(r.id, r.newStock));
        
        const newMoldeUpdates = calculateEntregaMoldeUpdates(entrega, virtualMoldes);
        if (newMoldeUpdates) moldeStocks.set(newMoldeUpdates.moldeId, newMoldeUpdates.newStock);
        
        const newPlantaUpdates = entrega.destino === 'PLANTA' ? calculateEntregaPlantaUpdates(entrega, virtualProductos) : null;
        if (newPlantaUpdates) prodEnvasesStocks.set(newPlantaUpdates.productoId, newPlantaUpdates.newStockEnvases);

        // Apply changes
        insumosSoplado.forEach(i => {
           if (insumoStocks.get(i.id) !== Number(i.stockActual)) batch.update(doc(db, 'insumos_soplado', i.id), { stockActual: insumoStocks.get(i.id) });
        });
        moldes.forEach(m => {
           if (moldeStocks.get(m.id) !== Number(m.stockActual)) batch.update(doc(db, 'moldes', m.id), { stockActual: moldeStocks.get(m.id) });
        });
        productos.forEach(p => {
           if (prodEnvasesStocks.get(p.id) !== Number(p.stockEnvases)) batch.update(doc(db, 'productos', p.id), { stockEnvases: prodEnvasesStocks.get(p.id) });
        });

        batch.update(doc(db, 'entregas_soplado', entrega.id), cleanUndefineds(entrega));
        await batch.commit();
    }, [entregasSoplado, insumosSoplado, moldes, productos]);

    const updateRutasMasivo = useCallback(async (updates: { clienteId: string, sucursalId: string, dia: DiaSemana, repartidorId: string | null }[]) => {
        if (!updates.length) return;

        const clienteUpdates = new Map<string, { cliente: Cliente, sucursalesMap: Map<string, Sucursal> }>();

        for (const update of updates) {
            if (!clienteUpdates.has(update.clienteId)) {
                const cliente = clientes.find(c => c.id === update.clienteId);
                if (cliente) {
                    const sMap = new Map<string, Sucursal>(cliente.sucursales.map(s => [s.id, { ...s }]));
                    clienteUpdates.set(update.clienteId, { cliente, sucursalesMap: sMap });
                }
            }
        }

        const batch = writeBatch(db);

        updates.forEach(({ clienteId, sucursalId, dia, repartidorId }) => {
            const data = clienteUpdates.get(clienteId);
            if (!data) return;

            const sucursal = data.sucursalesMap.get(sucursalId);
            if (!sucursal) return;

            const currentDays = new Set(sucursal.diasReparto || []);
            if (repartidorId) {
                currentDays.add(dia);
            } else {
                currentDays.delete(dia);
            }
            sucursal.diasReparto = Array.from(currentDays);

            const repartidoresMap = { ...(sucursal.repartidoresPorDia || {}) };
            if (repartidorId) {
                repartidoresMap[dia] = repartidorId;
            } else {
                delete repartidoresMap[dia];
            }
            sucursal.repartidoresPorDia = repartidoresMap;
        });

        clienteUpdates.forEach(({ cliente, sucursalesMap }) => {
            const nuevasSucursales = Array.from(sucursalesMap.values());
            const ref = doc(db, 'clientes', cliente.id);
            batch.update(ref, { sucursales: nuevasSucursales });
        });

        await batch.commit();
    }, [clientes]);

    return {
        remitos, clientes, usuarios, productos, registrosPago, gastos, ventasVendedor, facturas, contratos, servicios, planillas, movimientosStockPlanta, empresaSettings, logs, causasRecambio,
        preformas, moldes, produccionSoplado, entregasSoplado, insumosSoplado,
        proveedores, facturasProveedor, pagosProveedor,
        addRemito, updateRemito, deleteRemito, addCliente, updateCliente, deleteCliente, reactivarCliente,
        addPagoManual, addGasto, addVentaVendedor, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateVentaVendedor, deleteVentaVendedor,
        addUsuario, updateUsuario, addFactura, addPagoToFactura, markFacturaAsSent,
        addProducto, updateProducto, deleteProducto, reactivarProducto,
        addServicio, updateServicio, deleteServicio, reactivarServicio,
        addContrato, updateContrato, deleteContrato, addMultipleClientes, deleteAllClientes,
        addPlanilla, updatePlanilla, deletePlanilla, addMovimientoStockPlanta, addCierrePlanta, updateEmpresaSettings, updateRutasMasivo,
        addCausaRecambio, deleteCausaRecambio,
        addPreforma, updatePreforma, deletePreforma,
        addMolde, updateMolde, deleteMolde,
        addInsumoSoplado, updateInsumoSoplado, deleteInsumoSoplado,
        addProduccionSoplado, updateProduccionSoplado, deleteProduccionSoplado,
        addEntregaSoplado, updateEntregaSoplado, deleteEntregaSoplado,
        cierresPlanta,
        addLog
    };
};
