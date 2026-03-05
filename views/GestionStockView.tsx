import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
    PlanillaDiaria, 
    Usuario, 
    Producto, 
    EstadoPlanilla, 
    Rol, 
    ItemStock, 
    TipoVendedor, 
    Remito, 
    ItemDevolucion, 
    TipoProducto,
    MovimientoStockPlanta,
    VentaVendedor,
    CierrePlanta,
    EstadoProducto
} from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChartBarIcon } from '../components/icons/ChartBarIcon';
import { ClipboardCheckIcon } from '../components/icons/ClipboardCheckIcon';
import { TruckIcon } from '../components/icons/TruckIcon';
import AppButton from '../components/ui/AppButton';
import { getLocalDateString } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';

interface GestionStockViewProps {
  planillas: PlanillaDiaria[];
  movimientosPlanta: MovimientoStockPlanta[];
  cierresPlanta: CierrePlanta[];
  usuarios: Usuario[];
  productos: Producto[];
  remitos: Remito[];
  ventasVendedor: VentaVendedor[];
  addPlanilla: (planilla: Omit<PlanillaDiaria, 'id'>) => void;
  updatePlanilla: (planilla: PlanillaDiaria) => void;
  deletePlanilla: (id: string) => void;
  addMovimientoPlanta: (mov: Omit<MovimientoStockPlanta, 'id'>) => Promise<string>;
  addCierrePlanta: (cierre: Omit<CierrePlanta, 'id'>) => Promise<string>;
}

// --- SUB-COMPONENTES ---

// Formulario para crear nueva planilla (Carga Inicial)
const PlanillaForm: React.FC<{
    usuarios: Usuario[];
    productos: Producto[];
    planillas: PlanillaDiaria[];
    onSave: (data: Omit<PlanillaDiaria, 'id'>) => void;
    onClose: () => void;
}> = ({ usuarios, productos, planillas, onSave, onClose }) => {
    const [repartidorId, setRepartidorId] = useState('');
    const [fecha, setFecha] = useState(getLocalDateString());
    const [cantidades, setCantidades] = useState<Record<string, number>>({});

    const repartidores = useMemo(() => usuarios.filter(u => u.rol === Rol.REPARTIDOR && u.tipo === TipoVendedor.INTERNO), [usuarios]);
    const productosActivos = useMemo(() => productos.filter(p => p.estado !== EstadoProducto.INACTIVO && p.tipo !== TipoProducto.EQUIPO), [productos]);

    const handleLoadLast = useCallback(() => {
        if (!repartidorId) return;
        const lastPlanilla = [...planillas]
            .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime())
            .find(p => p.repartidorId === repartidorId);
        
        if (lastPlanilla) {
            const newCantidades: Record<string, number> = {};
            lastPlanilla.cargaInicial.forEach(item => {
                newCantidades[item.productoId] = item.cantidad;
            });
            setCantidades(newCantidades);
        }
    }, [repartidorId, planillas]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const itemsValidos: ItemStock[] = Object.entries(cantidades)
            .filter(([_, cant]) => (cant as number) > 0)
            .map(([id, cant]) => ({ productoId: id, cantidad: cant as number }));

        if (!repartidorId || itemsValidos.length === 0) return;

        onSave({
            fecha,
            repartidorId,
            estado: EstadoPlanilla.ABIERTA,
            cargaInicial: itemsValidos,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-start pr-10">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Abrir Reparto</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Carga Inicial de Camión</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border dark:border-gray-700">
                <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Repartidor</label>
                    <select 
                        value={repartidorId} 
                        onChange={(e) => setRepartidorId(e.target.value)} 
                        className="w-full p-2.5 bg-white dark:bg-gray-700 rounded-xl border-2 border-gray-100 dark:border-gray-600 font-bold"
                        required
                    >
                        <option value="">Seleccione...</option>
                        {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fecha</label>
                    <input 
                        type="date" 
                        value={fecha} 
                        onChange={(e) => setFecha(e.target.value)} 
                        className="w-full p-2.5 bg-white dark:bg-gray-700 rounded-xl border-2 border-gray-100 dark:border-gray-600 font-bold"
                        required 
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos en Planta</h3>
                    {repartidorId && (
                        <button 
                            type="button" 
                            onClick={handleLoadLast}
                            className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full transition-colors"
                        >
                            ⚡ Cargar Último Reparto
                        </button>
                    )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {productosActivos.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 hover:border-primary-500 transition-colors shadow-sm">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{p.nombre}</span>
                            <input 
                                type="number" 
                                value={cantidades[p.id] || ''} 
                                onChange={(e) => setCantidades(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                                className="w-20 p-1.5 text-right bg-gray-50 dark:bg-gray-700 rounded-lg border-none font-black text-primary-600 focus:ring-2 focus:ring-primary-500"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton type="submit" className="px-8">Abrir Reparto</AppButton>
            </div>
        </form>
    );
};

// Modal de Recarga
const RecargaModal: React.FC<{
    productos: Producto[];
    onSave: (itemsCarga: ItemStock[], itemsDescarga: ItemStock[]) => void;
    onClose: () => void;
}> = ({ productos, onSave, onClose }) => {
    const [cantidadesCarga, setCantidadesCarga] = useState<Record<string, number>>({});
    const [cantidadesDescarga, setCantidadesDescarga] = useState<Record<string, number>>({});

    const productosActivos = useMemo(() => productos.filter(p => p.estado !== EstadoProducto.INACTIVO && p.tipo !== TipoProducto.EQUIPO), [productos]);

    const handleSave = () => {
        const cargaValida: ItemStock[] = Object.entries(cantidadesCarga)
            .filter(([_, cant]) => (cant as number) > 0)
            .map(([id, cant]) => ({ productoId: id, cantidad: cant as number }));

        const descargaValida: ItemStock[] = Object.entries(cantidadesDescarga)
            .filter(([_, cant]) => (cant as number) > 0)
            .map(([id, cant]) => ({ productoId: id, cantidad: cant as number }));

        if (cargaValida.length === 0 && descargaValida.length === 0) return;
        onSave(cargaValida, descargaValida);
    };

    return (
        <div className="space-y-6">
            <div className="pr-10">
                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Registrar Recarga</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Movimiento intermedio de stock</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CARGA (LLENOS) */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                        Sale de Planta (Llenos)
                    </h3>
                    <div className="space-y-2">
                        {productosActivos.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 bg-blue-50/30 dark:bg-blue-900/5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{p.nombre}</span>
                                <input 
                                    type="number" 
                                    value={cantidadesCarga[p.id] || ''} 
                                    onChange={(e) => setCantidadesCarga(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                                    className="w-16 p-1 text-right bg-white dark:bg-gray-800 rounded border-none font-black text-blue-600 focus:ring-1 focus:ring-blue-500 text-sm"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* DESCARGA (VACÍOS) */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
                        Entra a Planta (Vacíos)
                    </h3>
                    <div className="space-y-2">
                        {productosActivos.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 bg-orange-50/30 dark:bg-orange-900/5 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{p.nombre}</span>
                                <input 
                                    type="number" 
                                    value={cantidadesDescarga[p.id] || ''} 
                                    onChange={(e) => setCantidadesDescarga(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                                    className="w-16 p-1 text-right bg-white dark:bg-gray-800 rounded border-none font-black text-orange-600 focus:ring-1 focus:ring-orange-500 text-sm"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton onClick={handleSave} className="px-8">Guardar Recarga</AppButton>
            </div>
        </div>
    );
};

// Modal de Cierre de Planilla
const CierrePlanillaModal: React.FC<{
    planilla: PlanillaDiaria;
    productos: Producto[];
    onConfirm: (devolucion: ItemDevolucion[]) => void;
    onClose: () => void;
}> = ({ planilla, productos, onConfirm, onClose }) => {
    const [devolucion, setDevolucion] = useState<ItemDevolucion[]>([]);

    useEffect(() => {
        // Inicializar con los productos que salieron en la carga inicial y recargas
        const productosSalidos = new Set<string>();
        planilla.cargaInicial.forEach(i => productosSalidos.add(i.productoId));
        planilla.recargas?.forEach(r => r.items.forEach(i => productosSalidos.add(i.productoId)));

        const initialDev: ItemDevolucion[] = Array.from(productosSalidos).map(id => ({
            productoId: id,
            cantidadLlenos: 0,
            cantidadVacios: 0
        }));
        setDevolucion(initialDev);
    }, [planilla]);

    const handleItemChange = (index: number, field: keyof ItemDevolucion, value: number) => {
        const newDev = [...devolucion];
        newDev[index] = { ...newDev[index], [field]: value };
        setDevolucion(newDev);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white pr-8">Cierre de Reparto</h2>
                <p className="text-xs text-gray-500">Registre lo que el repartidor trae de vuelta a la planta.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-2 text-left">Producto</th>
                            <th className="px-4 py-2 text-right">Salió (Total)</th>
                            <th className="px-4 py-2 text-right">Volvió (Lleno)</th>
                            <th className="px-4 py-2 text-right">Entregado</th>
                            <th className="px-4 py-2 text-right">Vacíos (Recup.)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devolucion.map((item, idx) => {
                            const pId = item.productoId;
                            let salio = planilla.cargaInicial.find(i => i.productoId === pId)?.cantidad || 0;
                            planilla.recargas?.forEach(r => {
                                salio += r.items.find(i => i.productoId === pId)?.cantidad || 0;
                            });
                            const entregado = salio - item.cantidadLlenos;

                            return (
                                <tr key={item.productoId} className="border-b dark:border-gray-700">
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-gray-800 dark:text-white">{productos.find(p => p.id === item.productoId)?.nombre}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-500">{salio}</td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="number" 
                                            value={item.cantidadLlenos || ''} 
                                            onChange={e => handleItemChange(idx, 'cantidadLlenos', parseInt(e.target.value) || 0)}
                                            className="w-full p-2 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-right font-bold text-orange-600"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-blue-600 text-lg">
                                        {entregado}
                                    </td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="number" 
                                            value={item.cantidadVacios || ''} 
                                            onChange={e => handleItemChange(idx, 'cantidadVacios', parseInt(e.target.value) || 0)}
                                            className="w-full p-2 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-right font-bold text-green-600"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton variant="success" onClick={() => onConfirm(devolucion)}>Confirmar Cierre</AppButton>
            </div>
        </div>
    );
};

// Componente Principal
const GestionStockView: React.FC<GestionStockViewProps> = ({ 
    planillas, 
    movimientosPlanta, 
    cierresPlanta,
    usuarios, 
    productos, 
    remitos,
    ventasVendedor,
    addPlanilla,
    updatePlanilla,
    deletePlanilla,
    addMovimientoPlanta,
    addCierrePlanta
}) => {
    const { showNotification } = useNotification();
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    
    // Modals state
    const [isNewPlanillaOpen, setIsNewPlanillaOpen] = useState(false);
    const [selectedPlanilla, setSelectedPlanilla] = useState<PlanillaDiaria | null>(null);
    const [isClosingPlanilla, setIsClosingPlanilla] = useState<PlanillaDiaria | null>(null);
    const [isRecargaOpen, setIsRecargaOpen] = useState(false);
    
    // Balance state
    const [physicalStock, setPhysicalStock] = useState<Record<string, number>>({});
    const [productionInput, setProductionInput] = useState<Record<string, number>>({});
    const [isSavingCierre, setIsSavingCierre] = useState(false);

    const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
    const usuariosMap = useMemo(() => new Map(usuarios.map(u => [u.id, u])), [usuarios]);

    // Planillas filtradas por fecha
    const planillasDelDia = useMemo(() => 
        planillas.filter(p => p.fecha === selectedDate)
    , [planillas, selectedDate]);

    const repartosActivos = useMemo(() => 
        planillasDelDia.filter(p => p.estado === EstadoPlanilla.ABIERTA)
    , [planillasDelDia]);

    const repartosCerrados = useMemo(() => 
        planillasDelDia.filter(p => p.estado === EstadoPlanilla.CERRADA)
    , [planillasDelDia]);

    // --- LOGICA DE PLANILLAS ---
    const handleClosePlanilla = (planilla: PlanillaDiaria) => {
        setIsClosingPlanilla(planilla);
    };

    const confirmClosePlanilla = (devolucion: ItemDevolucion[]) => {
        if (!isClosingPlanilla) return;
        updatePlanilla({
            ...isClosingPlanilla,
            estado: EstadoPlanilla.CERRADA,
            devolucion,
            observaciones: ''
        });
        setIsClosingPlanilla(null);
        showNotification('Reparto cerrado correctamente', 'success');
    };

    // --- LÓGICA DE BALANCE DIARIO ---
    const balanceData = useMemo(() => {
        const date = selectedDate;
        const prevDateObj = new Date(date + 'T00:00:00');
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDate = getLocalDateString(prevDateObj);

        const lastCierre = cierresPlanta.find(c => c.fecha === prevDate);
        const planillasDia = planillas.filter(p => p.fecha === date);
        const ventasDia = ventasVendedor.filter(v => v.fecha === date && !v.clienteId);
        const movsDia = movimientosPlanta.filter(m => m.fecha === date);

        return productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => {
            // 1. Stock Inicial
            const stockInicial = lastCierre?.saldos.find(s => s.productoId === p.id)?.cantidadFisica ?? (p.stockPlanta || 0);
            
            // 2. Producción Histórica (si ya se guardó antes)
            const produccionHistorica = movsDia
                .filter(m => m.productoId === p.id && m.tipo === 'entrada' && m.concepto.toLowerCase().includes('producción'))
                .reduce((sum, m) => sum + m.cantidad, 0);

            // 3. Salidas Internas (Planillas)
            let salidasInternas = 0;
            planillasDia.forEach(pl => {
                salidasInternas += pl.cargaInicial.find(i => i.productoId === p.id)?.cantidad || 0;
                pl.recargas?.forEach(rec => {
                    salidasInternas += rec.items.find(i => i.productoId === p.id)?.cantidad || 0;
                });
                if (pl.estado === EstadoPlanilla.CERRADA) {
                    salidasInternas -= pl.devolucion?.find(d => d.productoId === p.id)?.cantidadLlenos || 0;
                }
            });

            // 4. Salidas Externas (Ventas a revendedores)
            const salidasExternas = ventasDia.reduce((sum, v) => {
                return sum + (v.movimientos.find(m => m.productoId === p.id)?.cantidad || 0);
            }, 0);

            // Teórico = Inicial + Producción Histórica + Producción Nueva (input) - Salidas
            const prodNueva = productionInput[p.id] || 0;
            const teorico = stockInicial + produccionHistorica + prodNueva - salidasInternas - salidasExternas;

            return {
                producto: p,
                inicial: stockInicial,
                produccionHistorica,
                produccionNueva: prodNueva,
                salidasInternas,
                salidasExternas,
                teorico
            };
        });
    }, [selectedDate, cierresPlanta, planillas, ventasVendedor, movimientosPlanta, productos, productionInput]);

    const handleSaveBalance = async () => {
        if (isSavingCierre) return;
        setIsSavingCierre(true);
        try {
            // 1. Guardar movimientos de producción nuevos
            for (const d of balanceData) {
                if (d.produccionNueva > 0) {
                    await addMovimientoPlanta({
                        fecha: selectedDate,
                        productoId: d.producto.id,
                        cantidad: d.produccionNueva,
                        tipo: 'entrada',
                        concepto: 'Producción Diaria',
                        esEnvase: false
                    });
                }
            }

            // 2. Guardar Cierre
            const saldos = balanceData.map(d => ({
                productoId: d.producto.id,
                cantidadFisica: physicalStock[d.producto.id] ?? d.teorico,
                cantidadTeorica: d.teorico,
                produccionDia: d.produccionHistorica + d.produccionNueva
            }));

            await addCierrePlanta({
                fecha: selectedDate,
                saldos,
                cerradoPor: 'Admin' // TODO: Get from auth
            });

            // Limpiar inputs de producción porque ya pasaron a ser históricos
            setProductionInput({});
            showNotification('Balance diario guardado correctamente', 'success');
        } catch (e) {
            showNotification('Error al guardar el balance', 'error');
        } finally {
            setIsSavingCierre(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="space-y-8 pt-12 md:pt-0 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b dark:border-gray-700 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic leading-none">Control de Planta</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="p-0 bg-transparent border-none text-sm font-black text-primary-600 focus:ring-0 cursor-pointer uppercase tracking-widest"
                        />
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">• Sesión Diaria</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <AppButton onClick={() => setIsNewPlanillaOpen(true)} className="shadow-2xl shadow-primary-500/40 px-8 py-3 text-sm font-black uppercase tracking-widest">
                        + Abrir Nuevo Reparto
                    </AppButton>
                    <div className="hidden md:flex items-center gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span>1. Apertura</span>
                        <span className="text-gray-300">→</span>
                        <span>2. Recargas</span>
                        <span className="text-gray-300">→</span>
                        <span>3. Cierre Reparto</span>
                        <span className="text-gray-300">→</span>
                        <span>4. Auditoría Planta</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: REPARTOS EN CURSO */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </div>
                    <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Repartos en Curso</h2>
                </div>
                
                {repartosActivos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {repartosActivos.map(p => {
                            const totalUnidades = (p.cargaInicial || []).reduce((s, i) => s + (i.cantidad || 0), 0);
                            return (
                                <div key={p.id}>
                                    <Card className="border-l-8 border-l-blue-500 hover:shadow-2xl transition-all group overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <TruckIcon className="h-24 w-24 -rotate-12" />
                                        </div>
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <h3 className="font-black text-xl text-gray-800 dark:text-white truncate max-w-[180px] group-hover:text-primary-600 transition-colors tracking-tighter">
                                                    {usuariosMap.get(p.repartidorId)?.nombre || 'S/N'}
                                                </h3>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Carga: <span className="text-blue-600">{totalUnidades}</span> unidades</p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase bg-blue-100 text-blue-700 mb-2 tracking-widest">En Viaje</span>
                                                <span className="text-[10px] font-mono font-bold text-gray-400">{p.recargas?.length || 0} Recargas</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700 relative z-10">
                                            <AppButton size="sm" variant="secondary" fullWidth onClick={() => setSelectedPlanilla(p)} className="font-black uppercase tracking-widest text-[10px]">Gestionar</AppButton>
                                            <AppButton size="sm" variant="success" fullWidth onClick={() => handleClosePlanilla(p)} className="font-black uppercase tracking-widest text-[10px]">Cerrar</AppButton>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-16 border-4 border-dashed border-gray-100 dark:border-gray-800 rounded-[3rem] flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
                        <ClipboardCheckIcon className="h-16 w-16 mb-4 opacity-10" />
                        <p className="text-xs font-black uppercase tracking-[0.4em]">No hay repartos activos</p>
                    </div>
                )}
            </section>

            {/* SECCIÓN 2: BALANCE DE PLANTA (AUDITORÍA) */}
            <section className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <ChartBarIcon className="h-5 w-5 text-primary-600" />
                        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Balance de Planta / Auditoría</h2>
                    </div>
                    <AppButton 
                        variant="success" 
                        size="sm"
                        onClick={handleSaveBalance}
                        isLoading={isSavingCierre}
                        className="shadow-xl shadow-green-500/20 px-6 font-black uppercase tracking-widest text-[10px]"
                    >
                        Guardar Cierre de Planta
                    </AppButton>
                </div>

                <Card className="overflow-hidden border-none shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-5">Producto</th>
                                    <th className="px-6 py-5 text-right">Inicial</th>
                                    <th className="px-6 py-5 text-right bg-blue-50/30 dark:bg-blue-900/5">+ Producción</th>
                                    <th className="px-6 py-5 text-right">- Salidas</th>
                                    <th className="px-6 py-5 text-right">= Teórico</th>
                                    <th className="px-6 py-5 text-right bg-yellow-50/30 dark:bg-yellow-900/5">Físico</th>
                                    <th className="px-6 py-5 text-right">Dif.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {balanceData.map(d => {
                                    const fisico = physicalStock[d.producto.id] ?? d.teorico;
                                    const diferencia = fisico - d.teorico;
                                    const totalSalidas = d.salidasInternas + d.salidasExternas;
                                    
                                    if (d.inicial === 0 && d.produccionHistorica === 0 && d.produccionNueva === 0 && totalSalidas === 0 && fisico === 0) {
                                        return null;
                                    }

                                    return (
                                        <tr key={d.producto.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="font-black text-gray-800 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tighter">{d.producto.nombre}</p>
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-gray-400 font-bold">{d.inicial}</td>
                                            <td className="px-6 py-5 text-right bg-blue-50/10 dark:bg-blue-900/5">
                                                <div className="flex items-center justify-end gap-2">
                                                    {d.produccionHistorica > 0 && <span className="text-[10px] text-gray-400 font-black">({d.produccionHistorica}) +</span>}
                                                    <input 
                                                        type="number" 
                                                        placeholder="0"
                                                        value={productionInput[d.producto.id] || ''}
                                                        onChange={e => setProductionInput(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                        className="w-20 p-2 text-right bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 font-black rounded-xl border-2 border-blue-50 dark:border-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-red-500 text-base">-{totalSalidas}</span>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">({d.salidasInternas} Int / {d.salidasExternas} Ext)</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-gray-800 dark:text-white text-xl tracking-tighter">{d.teorico}</td>
                                            <td className="px-6 py-5 text-right bg-yellow-50/10 dark:bg-yellow-900/5">
                                                <input 
                                                    type="number" 
                                                    value={fisico}
                                                    onChange={e => setPhysicalStock(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                    className="w-24 p-2.5 text-right font-black bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 focus:border-primary-500 focus:ring-0 outline-none shadow-md transition-all"
                                                />
                                            </td>
                                            <td className={`px-6 py-5 text-right font-black text-xl ${diferencia === 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {diferencia > 0 ? `+${diferencia}` : diferencia}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>

            {/* SECCIÓN 3: REPARTOS CERRADOS */}
            {repartosCerrados.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Repartos Finalizados</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-60 hover:opacity-100 transition-opacity">
                        {repartosCerrados.map(p => (
                            <div key={p.id}>
                                <Card className="border-l-4 border-l-green-500 bg-gray-50/50 dark:bg-gray-800/50 p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-black text-sm text-gray-700 dark:text-gray-300 truncate uppercase tracking-tighter">{usuariosMap.get(p.repartidorId)?.nombre || 'S/N'}</h3>
                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-green-100 text-green-700 tracking-widest">OK</span>
                                    </div>
                                    <AppButton size="sm" variant="secondary" fullWidth onClick={() => setSelectedPlanilla(p)} className="text-[9px] font-black uppercase tracking-widest py-1">Ver Resumen</AppButton>
                                </Card>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            {/* MODALS */}
            <Modal isOpen={isNewPlanillaOpen} onClose={() => setIsNewPlanillaOpen(false)}>
                <PlanillaForm 
                    usuarios={usuarios} 
                    productos={productos} 
                    planillas={planillas}
                    onSave={(data) => {
                        addPlanilla(data);
                        setIsNewPlanillaOpen(false);
                        showNotification('Reparto abierto', 'success');
                    }} 
                    onClose={() => setIsNewPlanillaOpen(false)} 
                />
            </Modal>

            <Modal isOpen={!!selectedPlanilla} onClose={() => setSelectedPlanilla(null)} className="max-w-5xl">
                {selectedPlanilla && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b dark:border-gray-700 pb-4 pr-12">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${selectedPlanilla.estado === EstadoPlanilla.ABIERTA ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {selectedPlanilla.estado}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(selectedPlanilla.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">
                                    Reparto: {usuariosMap.get(selectedPlanilla.repartidorId)?.nombre}
                                </h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedPlanilla.estado === EstadoPlanilla.ABIERTA && (
                                    <>
                                        <AppButton size="sm" variant="secondary" onClick={() => setIsRecargaOpen(true)}>+ Recarga</AppButton>
                                        <AppButton size="sm" variant="success" onClick={() => handleClosePlanilla(selectedPlanilla)}>Cerrar Reparto</AppButton>
                                    </>
                                )}
                                <AppButton size="sm" variant="danger" onClick={() => {
                                    if(window.confirm('¿Eliminar este reparto?')) {
                                        deletePlanilla(selectedPlanilla.id);
                                        setSelectedPlanilla(null);
                                    }
                                }}>Eliminar</AppButton>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Auditoría de Ventas */}
                            <Card className="bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800">
                                <h3 className="font-black text-xs text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ClipboardCheckIcon className="h-4 w-4" /> Auditoría de Ventas (Remitos)
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-[9px] font-black text-primary-400 uppercase tracking-widest border-b border-primary-100 dark:border-primary-800">
                                            <tr>
                                                <th className="text-left py-2">Producto</th>
                                                <th className="text-right py-2">Entregado</th>
                                                <th className="text-right py-2">Remitos</th>
                                                <th className="text-right py-2">Dif.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => {
                                                let entregadoReparto = selectedPlanilla.cargaInicial.find(i => i.productoId === p.id)?.cantidad || 0;
                                                selectedPlanilla.recargas?.forEach(r => {
                                                    entregadoReparto += r.items.find(i => i.productoId === p.id)?.cantidad || 0;
                                                });
                                                if (selectedPlanilla.estado === EstadoPlanilla.CERRADA) {
                                                    entregadoReparto -= selectedPlanilla.devolucion?.find(d => d.productoId === p.id)?.cantidadLlenos || 0;
                                                }

                                                const remitosDelDia = remitos.filter(r => r.fecha === selectedPlanilla.fecha && r.vendedorId === selectedPlanilla.repartidorId);
                                                const entregadoRemitos = remitosDelDia.reduce((sum, r) => {
                                                    return sum + (r.movimientos.find(m => m.productoId === p.id)?.entregados || 0);
                                                }, 0);

                                                if (entregadoReparto === 0 && entregadoRemitos === 0) return null;
                                                const diff = entregadoRemitos - entregadoReparto;

                                                return (
                                                    <tr key={p.id} className="border-b border-primary-50 dark:border-primary-900/30 last:border-0">
                                                        <td className="py-2.5 font-bold text-xs">{p.nombre}</td>
                                                        <td className="py-2.5 text-right font-mono text-gray-500">{selectedPlanilla.estado === EstadoPlanilla.ABIERTA ? '...' : entregadoReparto}</td>
                                                        <td className="py-2.5 text-right font-mono font-bold">{entregadoRemitos}</td>
                                                        <td className={`py-2.5 text-right font-black ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {selectedPlanilla.estado === EstadoPlanilla.ABIERTA ? '-' : (diff > 0 ? `+${diff}` : diff)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Detalle de Movimientos */}
                            <div className="space-y-4">
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border dark:border-gray-700">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Carga Inicial</h3>
                                    <div className="space-y-1">
                                        {selectedPlanilla.cargaInicial.map(item => (
                                            <div key={item.productoId} className="flex justify-between text-xs">
                                                <span className="text-gray-600 dark:text-gray-400">{productosMap.get(item.productoId)?.nombre}</span>
                                                <span className="font-black">{item.cantidad}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedPlanilla.recargas && selectedPlanilla.recargas.length > 0 && (
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">Recargas ({selectedPlanilla.recargas.length})</h3>
                                        <div className="space-y-3">
                                            {selectedPlanilla.recargas.map((rec, idx) => (
                                                <div key={idx} className="border-b border-blue-100 dark:border-blue-800 last:border-0 pb-2 last:pb-0">
                                                    {rec.items.map(item => (
                                                        <div key={item.productoId} className="flex justify-between text-xs">
                                                            <span className="text-blue-700 dark:text-blue-400">{productosMap.get(item.productoId)?.nombre}</span>
                                                            <span className="font-black">+{item.cantidad}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedPlanilla.estado === EstadoPlanilla.CERRADA && selectedPlanilla.devolucion && (
                                    <div className="bg-green-50/50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30">
                                        <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">Devolución (Retorno)</h3>
                                        <div className="space-y-1">
                                            {selectedPlanilla.devolucion.map(item => (
                                                <div key={item.productoId} className="flex justify-between text-xs">
                                                    <span className="text-green-700 dark:text-green-400">{productosMap.get(item.productoId)?.nombre}</span>
                                                    <div className="flex gap-3">
                                                        <span className="font-black text-orange-600">L: {item.cantidadLlenos}</span>
                                                        <span className="font-black text-green-600">V: {item.cantidadVacios}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isRecargaOpen} onClose={() => setIsRecargaOpen(false)}>
                <RecargaModal 
                    productos={productos} 
                    onSave={(carga, descarga) => {
                        if (selectedPlanilla) {
                            const updatedPlanilla = { ...selectedPlanilla };
                            if (!updatedPlanilla.recargas) updatedPlanilla.recargas = [];
                            updatedPlanilla.recargas.push({
                                hora: new Date().toLocaleTimeString(),
                                items: carga,
                                vaciosDescargados: descarga
                            });
                            updatePlanilla(updatedPlanilla);
                            setIsRecargaOpen(false);
                            showNotification('Recarga registrada', 'success');
                        }
                    }} 
                    onClose={() => setIsRecargaOpen(false)} 
                />
            </Modal>

            <Modal isOpen={!!isClosingPlanilla} onClose={() => setIsClosingPlanilla(null)}>
                {isClosingPlanilla && (
                    <CierrePlanillaModal 
                        planilla={isClosingPlanilla} 
                        productos={productos} 
                        onConfirm={confirmClosePlanilla} 
                        onClose={() => setIsClosingPlanilla(null)} 
                    />
                )}
            </Modal>
        </div>
    );
};

export default GestionStockView;
