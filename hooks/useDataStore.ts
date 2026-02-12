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
  setDoc
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
  PagoDetalle,
  MetodoPago,
  EstadoCliente,
  EstadoProducto,
  EstadoServicio
} from '../types';

const cleanUndefineds = (obj: any): any => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined && obj[key] !== null) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

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
    const [empresaSettings, setEmpresaSettings] = useState<EmpresaSettings>({ 
        nombre: 'Distribuidora Aguas Puras',
        nombreFantasia: 'Aguas Puras'
    });

    useEffect(() => {
        if (!db) return;

        const unsub = [
            onSnapshot(collection(db, 'remitos'), (s) => setRemitos(s.docs.map(d => ({ id: d.id, ...d.data() } as Remito)))),
            onSnapshot(collection(db, 'clientes'), (s) => setClientes(s.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)))),
            onSnapshot(collection(db, 'usuarios'), (s) => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario)))),
            onSnapshot(collection(db, 'productos'), (s) => setProductos(s.docs.map(d => ({ id: d.id, ...d.data() } as Producto)))),
            onSnapshot(collection(db, 'registrosPago'), (s) => setRegistrosPago(s.docs.map(d => ({ id: d.id, ...d.data() } as RegistroPago)))),
            onSnapshot(collection(db, 'gastos'), (s) => setGastos(s.docs.map(d => ({ id: d.id, ...d.data() } as Gasto)))),
            onSnapshot(collection(db, 'ventasVendedor'), (s) => setVentasVendedor(s.docs.map(d => ({ id: d.id, ...d.data() } as VentaVendedor)))),
            onSnapshot(collection(db, 'facturas'), (s) => setFacturas(s.docs.map(d => ({ id: d.id, ...d.data() } as Factura)))),
            onSnapshot(collection(db, 'contratos'), (s) => setContratos(s.docs.map(d => ({ id: d.id, ...d.data() } as Contrato)))),
            onSnapshot(collection(db, 'servicios'), (s) => setServicios(s.docs.map(d => ({ id: d.id, ...d.data() } as Servicio)))),
            onSnapshot(collection(db, 'planillas'), (s) => setPlanillas(s.docs.map(d => ({ id: d.id, ...d.data() } as PlanillaDiaria)))),
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

    const updateRemito = useCallback(async (r: any) => {
        const { id, pagos, ...data } = r;
        await updateDoc(doc(db, 'remitos', id), cleanUndefineds(data));
    }, []);

    const deleteRemito = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'remitos', id));
    }, []);

    // Función auxiliar para procesar stock inicial y contratos (reutilizable)
    const processInitialData = async (clienteId: string, stockInicial?: any[], contratosIniciales?: any[], adminId?: string) => {
        // 1. Procesar Stock Inicial (Crear Remitos de Ajuste)
        if (stockInicial && stockInicial.length > 0) {
            const today = new Date().toISOString().split('T')[0];
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

    const addPagoManual = useCallback(async (p: any) => {
        const { pagos, ...base } = p;
        for (const pago of pagos) {
            await addDoc(collection(db, 'registrosPago'), {
                ...base,
                monto: pago.monto,
                metodo: pago.metodo,
                origen: { tipo: 'pago_manual', id: `PM-${Date.now()}` }
            });
        }
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
                    vendedorId: data.vendedorId
                });
                pagoIds.push(pDoc.id);
            }
            await updateDoc(doc(db, 'ventasVendedor', docRef.id), { pagoIds });
        }
    }, []);

    const updateRegistroPago = useCallback(async (p: any) => {
        const { id, ...data } = p;
        await updateDoc(doc(db, 'registrosPago', id), cleanUndefineds(data));
    }, []);

    const updateGasto = useCallback(async (g: any) => {
        const { id, ...data } = g;
        await updateDoc(doc(db, 'gastos', id), cleanUndefineds(data));
    }, []);

    const deleteRegistroPago = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'registrosPago', id));
    }, []);

    const deleteGasto = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'gastos', id));
    }, []);

    const updateVentaVendedor = useCallback(async (v: any) => {
        const { id, ...data } = v;
        await updateDoc(doc(db, 'ventasVendedor', id), cleanUndefineds(data));
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
            estado: EstadoFactura.PENDIENTE,
            numero: `F-${Date.now()}` 
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
        await updateDoc(doc(db, 'servicios', id), cleanUndefineds(data));
    }, []);

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
        await addDoc(collection(db, 'planillas'), cleanUndefineds(p));
    }, []);

    const updatePlanilla = useCallback(async (p: any) => {
        const { id, ...data } = p;
        await updateDoc(doc(db, 'planillas', id), cleanUndefineds(data));
    }, []);

    const updateEmpresaSettings = useCallback(async (s: any) => {
        await setDoc(doc(db, 'settings', 'empresa'), cleanUndefineds(s));
    }, []);

    return {
        remitos, clientes, usuarios, productos, registrosPago, gastos, ventasVendedor, facturas, contratos, servicios, planillas, empresaSettings,
        addRemito, updateRemito, deleteRemito, addCliente, updateCliente, deleteCliente, reactivarCliente,
        addPagoManual, addGasto, addVentaVendedor, updateRegistroPago, updateGasto, deleteRegistroPago, deleteGasto, updateVentaVendedor,
        addUsuario, updateUsuario, addFactura, addPagoToFactura, markFacturaAsSent,
        addProducto, updateProducto, deleteProducto, reactivarProducto,
        addServicio, updateServicio, deleteServicio, reactivarServicio,
        addContrato, updateContrato, deleteContrato, addMultipleClientes, deleteAllClientes,
        addPlanilla, updatePlanilla, updateEmpresaSettings
    };
};