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
    onSave: (data: Omit<PlanillaDiaria, 'id'>) => void;
    onClose: () => void;
}> = ({ usuarios, productos, onSave, onClose }) => {
    const [repartidorId, setRepartidorId] = useState('');
    const [fecha, setFecha] = useState(getLocalDateString());
    const [cargaInicial, setCargaInicial] = useState<ItemStock[]>([]);

    const repartidores = useMemo(() => usuarios.filter(u => u.rol === Rol.REPARTIDOR && u.tipo === TipoVendedor.INTERNO), [usuarios]);
    const productosOptions = useMemo(() => 
        productos
            .filter(p => p.estado !== EstadoProducto.INACTIVO)
            .map(p => ({ value: p.id, label: p.nombre })), 
    [productos]);

    const handleAddItem = useCallback(() => {
        setCargaInicial(prev => [...prev, { productoId: '', cantidad: 0 }]);
    }, []);

    const handleItemChange = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...cargaInicial];
        newItems[index] = { ...newItems[index], [field]: value };
        setCargaInicial(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setCargaInicial(cargaInicial.filter((_, i) => i !== index));
    };

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const itemsValidos = cargaInicial.filter(item => item.productoId && item.cantidad > 0);
        if (!repartidorId || itemsValidos.length === 0) return;

        const nuevaPlanilla: Omit<PlanillaDiaria, 'id'> = {
            fecha,
            repartidorId,
            estado: EstadoPlanilla.ABIERTA,
            cargaInicial: itemsValidos,
        };
        onSave(nuevaPlanilla);
    }, [fecha, repartidorId, cargaInicial, onSave]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">Abrir Nuevo Reparto</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                    <input 
                        type="date" 
                        value={fecha} 
                        onChange={(e) => setFecha(e.target.value)} 
                        className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"
                        required 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repartidor</label>
                    <select 
                        value={repartidorId} 
                        onChange={(e) => setRepartidorId(e.target.value)} 
                        className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"
                        required
                    >
                        <option value="">Seleccione repartidor...</option>
                        {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 dark:text-gray-300">Carga Inicial (Llenos)</h3>
                    <AppButton type="button" size="sm" variant="secondary" onClick={handleAddItem}>+ Agregar Producto</AppButton>
                </div>
                
                {cargaInicial.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border dark:border-gray-700">
                        <div className="flex-grow">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Producto</label>
                            <SearchableSelect 
                                options={productosOptions}
                                value={item.productoId} 
                                onChange={(v) => handleItemChange(index, 'productoId', v)}
                                placeholder="Seleccionar..."
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cant.</label>
                            <input 
                                type="number" 
                                value={item.cantidad || ''} 
                                onChange={(e) => handleItemChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600"
                                required
                                min="1"
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md mb-[2px]"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton type="submit">Abrir Reparto</AppButton>
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
    const [itemsCarga, setItemsCarga] = useState<ItemStock[]>([]);
    const [itemsDescarga, setItemsDescarga] = useState<ItemStock[]>([]);

    const productosOptions = useMemo(() => 
        productos
            .filter(p => p.estado !== EstadoProducto.INACTIVO)
            .map(p => ({ value: p.id, label: p.nombre })), 
    [productos]);

    const handleAddCarga = () => setItemsCarga(prev => [...prev, { productoId: '', cantidad: 0 }]);
    const handleAddDescarga = () => setItemsDescarga(prev => [...prev, { productoId: '', cantidad: 0 }]);

    const handleSave = () => {
        const cargaValida = itemsCarga.filter(i => i.productoId && i.cantidad > 0);
        const descargaValida = itemsDescarga.filter(i => i.productoId && i.cantidad > 0);
        if (cargaValida.length === 0 && descargaValida.length === 0) return;
        onSave(cargaValida, descargaValida);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white pr-8">Registrar Recarga / Descarga</h2>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-blue-600 dark:text-blue-400 uppercase text-xs tracking-widest">Carga (Sale de Planta Lleno)</h3>
                    <AppButton size="sm" variant="secondary" onClick={handleAddCarga}>+ Agregar</AppButton>
                </div>
                {itemsCarga.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <SearchableSelect 
                                options={productosOptions}
                                value={item.productoId} 
                                onChange={(v) => {
                                    const newItems = [...itemsCarga];
                                    newItems[index].productoId = v;
                                    setItemsCarga(newItems);
                                }}
                                placeholder="Seleccionar producto..."
                            />
                        </div>
                        <input type="number" value={item.cantidad || ''} onChange={(e) => {
                            const newItems = [...itemsCarga];
                            newItems[index].cantidad = parseInt(e.target.value) || 0;
                            setItemsCarga(newItems);
                        }} className="w-24 p-2 bg-gray-100 dark:bg-gray-700 rounded-md border dark:border-gray-600" placeholder="Cant." />
                    </div>
                ))}
            </div>

            <hr className="dark:border-gray-700" />

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-yellow-600 dark:text-yellow-400 uppercase text-xs tracking-widest">Descarga (Entra a Planta Vacío)</h3>
                    <AppButton size="sm" variant="secondary" onClick={handleAddDescarga}>+ Agregar</AppButton>
                </div>
                {itemsDescarga.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <SearchableSelect 
                                options={productosOptions}
                                value={item.productoId} 
                                onChange={(v) => {
                                    const newItems = [...itemsDescarga];
                                    newItems[index].productoId = v;
                                    setItemsDescarga(newItems);
                                }}
                                placeholder="Seleccionar producto..."
                            />
                        </div>
                        <input type="number" value={item.cantidad || ''} onChange={(e) => {
                            const newItems = [...itemsDescarga];
                            newItems[index].cantidad = parseInt(e.target.value) || 0;
                            setItemsDescarga(newItems);
                        }} className="w-24 p-2 bg-gray-100 dark:bg-gray-700 rounded-md border dark:border-gray-600" placeholder="Cant." />
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton onClick={handleSave}>Guardar Recarga</AppButton>
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
    const [activeTab, setActiveTab] = useState<'planillas' | 'balance'>('planillas');
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
        <div className="space-y-6 pt-12 md:pt-0">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter italic">Control de Planta</h1>
                <div className="flex gap-2">
                    {activeTab === 'planillas' && (
                        <AppButton onClick={() => setIsNewPlanillaOpen(true)}>+ Abrir Reparto</AppButton>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit border dark:border-gray-700 shadow-sm">
                <button 
                    onClick={() => setActiveTab('planillas')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'planillas' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <ClipboardCheckIcon className="h-4 w-4" /> REPARTOS
                </button>
                <button 
                    onClick={() => setActiveTab('balance')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'balance' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <ChartBarIcon className="h-4 w-4" /> BALANCE DIARIO
                </button>
            </div>

            {/* CONTENIDO TABS */}
            {activeTab === 'planillas' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {planillas
                            .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime())
                            .slice(0, 12)
                            .map(p => {
                                const totalUnidades = p.cargaInicial.reduce((s, i) => s + i.cantidad, 0);
                                const totalRecargas = p.recargas?.length || 0;
                                return (
                                <Card key={p.id} className={`border-l-4 ${p.estado === EstadoPlanilla.ABIERTA ? 'border-l-blue-500' : 'border-l-green-500'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                                            <h3 className="font-bold text-gray-800 dark:text-white truncate max-w-[150px]">{usuariosMap.get(p.repartidorId)?.nombre}</h3>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase shrink-0 ${p.estado === EstadoPlanilla.ABIERTA ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {p.estado}
                                        </span>
                                    </div>
                                    <div className="space-y-1 mb-4 min-h-[60px]">
                                        {p.cargaInicial.slice(0, 3).map(item => (
                                            <div key={item.productoId} className="flex justify-between text-[11px]">
                                                <span className="text-gray-500 truncate mr-2">{productosMap.get(item.productoId)?.nombre}</span>
                                                <span className="font-bold shrink-0">{item.cantidad}</span>
                                            </div>
                                        ))}
                                        {p.cargaInicial.length > 3 && (
                                            <p className="text-[10px] text-gray-400 italic">+{p.cargaInicial.length - 3} productos más...</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
                                        <AppButton size="sm" variant="secondary" fullWidth onClick={() => setSelectedPlanilla(p)}>Detalle</AppButton>
                                        {p.estado === EstadoPlanilla.ABIERTA && (
                                            <AppButton size="sm" variant="success" fullWidth onClick={() => handleClosePlanilla(p)}>Cerrar</AppButton>
                                        )}
                                    </div>
                                </Card>
                                );
                            })}
                    </div>
                </div>
            )}

            {activeTab === 'balance' && (
                <div className="space-y-6">
                    <Card>
                        <div className="flex flex-wrap gap-4 mb-6 items-end justify-between border-b dark:border-gray-700 pb-4">
                            <div className="flex gap-4 items-end">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fecha de Balance</label>
                                    <input 
                                        type="date" 
                                        value={selectedDate} 
                                        onChange={e => setSelectedDate(e.target.value)} 
                                        className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500 font-bold"
                                    />
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-xs text-gray-500 italic">El balance compara el stock teórico (calculado por el sistema) contra el conteo físico real en planta.</p>
                                </div>
                            </div>
                            <AppButton 
                                variant="success" 
                                onClick={handleSaveBalance}
                                isLoading={isSavingCierre}
                            >
                                Guardar Cierre de Planta
                            </AppButton>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-right">Stock Inicial</th>
                                        <th className="px-4 py-3 text-right w-32 bg-blue-50/50 dark:bg-blue-900/10">+ Producción</th>
                                        <th className="px-4 py-3 text-right">- Salidas (Total)</th>
                                        <th className="px-4 py-3 text-right">= Teórico</th>
                                        <th className="px-4 py-3 text-right w-32 bg-yellow-50/50 dark:bg-yellow-900/10">Físico (Real)</th>
                                        <th className="px-4 py-3 text-right">Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {balanceData.map(d => {
                                        const fisico = physicalStock[d.producto.id] ?? d.teorico;
                                        const diferencia = fisico - d.teorico;
                                        const totalSalidas = d.salidasInternas + d.salidasExternas;
                                        
                                        if (d.inicial === 0 && d.produccionHistorica === 0 && d.produccionNueva === 0 && totalSalidas === 0 && fisico === 0) {
                                            return null;
                                        }

                                        return (
                                            <tr key={d.producto.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-bold">{d.producto.nombre}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-500">{d.inicial}</td>
                                                <td className="px-4 py-3 text-right bg-blue-50/30 dark:bg-blue-900/5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {d.produccionHistorica > 0 && <span className="text-[10px] text-gray-400">({d.produccionHistorica}) +</span>}
                                                        <input 
                                                            type="number" 
                                                            placeholder="0"
                                                            value={productionInput[d.producto.id] || ''}
                                                            onChange={e => setProductionInput(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                            className="w-16 p-1 text-right bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 font-bold rounded border border-blue-200 dark:border-blue-800 focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-red-600">-{totalSalidas}</span>
                                                        <span className="text-[9px] text-gray-400 uppercase">({d.salidasInternas} Int / {d.salidasExternas} Ext)</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-gray-800 dark:text-white text-lg">{d.teorico}</td>
                                                <td className="px-4 py-3 text-right bg-yellow-50/30 dark:bg-yellow-900/5">
                                                    <input 
                                                        type="number" 
                                                        value={fisico}
                                                        onChange={e => setPhysicalStock(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                        className="w-20 p-2 text-right font-black bg-white dark:bg-gray-600 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-0"
                                                    />
                                                </td>
                                                <td className={`px-4 py-3 text-right font-black text-lg ${diferencia === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {diferencia > 0 ? `+${diferencia}` : diferencia}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* MODALS */}
            <Modal isOpen={isNewPlanillaOpen} onClose={() => setIsNewPlanillaOpen(false)}>
                <PlanillaForm 
                    usuarios={usuarios} 
                    productos={productos} 
                    onSave={(data) => {
                        addPlanilla(data);
                        setIsNewPlanillaOpen(false);
                        showNotification('Reparto abierto', 'success');
                    }} 
                    onClose={() => setIsNewPlanillaOpen(false)} 
                />
            </Modal>

            <Modal isOpen={!!selectedPlanilla} onClose={() => setSelectedPlanilla(null)} className="max-w-4xl">
                {selectedPlanilla && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b dark:border-gray-700 pb-4 pr-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalle de Reparto</h2>
                                <p className="text-gray-500 font-medium">
                                    {usuariosMap.get(selectedPlanilla.repartidorId)?.nombre} • {new Date(selectedPlanilla.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedPlanilla.estado === EstadoPlanilla.ABIERTA && (
                                    <>
                                        <AppButton size="sm" variant="secondary" onClick={() => setIsRecargaOpen(true)}>+ Registrar Recarga</AppButton>
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

                        {/* Comparación con Remitos */}
                        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                                <ChartBarIcon className="h-5 w-5" /> Comparación con Entregas (Remitos)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-[10px] font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest">
                                        <tr>
                                            <th className="text-left pb-2">Producto</th>
                                            <th className="text-right pb-2">Entregado (Reparto)</th>
                                            <th className="text-right pb-2">Entregado (Remitos)</th>
                                            <th className="text-right pb-2">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => {
                                            // Entregado Reparto = Inicial + Recargas - Devolucion
                                            let entregadoReparto = selectedPlanilla.cargaInicial.find(i => i.productoId === p.id)?.cantidad || 0;
                                            selectedPlanilla.recargas?.forEach(r => {
                                                entregadoReparto += r.items.find(i => i.productoId === p.id)?.cantidad || 0;
                                            });
                                            if (selectedPlanilla.estado === EstadoPlanilla.CERRADA) {
                                                entregadoReparto -= selectedPlanilla.devolucion?.find(d => d.productoId === p.id)?.cantidadLlenos || 0;
                                            }

                                            // Entregado Remitos
                                            const remitosDelDia = remitos.filter(r => r.fecha === selectedPlanilla.fecha && r.vendedorId === selectedPlanilla.repartidorId);
                                            const entregadoRemitos = remitosDelDia.reduce((sum, r) => {
                                                return sum + (r.movimientos.find(m => m.productoId === p.id)?.entregados || 0);
                                            }, 0);

                                            if (entregadoReparto === 0 && entregadoRemitos === 0) return null;

                                            const diff = entregadoRemitos - entregadoReparto;

                                            return (
                                                <tr key={p.id} className="border-t border-blue-100 dark:border-blue-800/50">
                                                    <td className="py-2 font-medium">{p.nombre}</td>
                                                    <td className="py-2 text-right font-mono">{selectedPlanilla.estado === EstadoPlanilla.ABIERTA ? 'Pendiente Cierre' : entregadoReparto}</td>
                                                    <td className="py-2 text-right font-mono">{entregadoRemitos}</td>
                                                    <td className={`py-2 text-right font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {selectedPlanilla.estado === EstadoPlanilla.ABIERTA ? '-' : (diff > 0 ? `+${diff}` : diff)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Movimientos del Reparto */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Producto</th>
                                        <th className="px-4 py-2 text-right">Carga Inicial</th>
                                        <th className="px-4 py-2 text-right">Recargas</th>
                                        <th className="px-4 py-2 text-right">Devolución (Llenos)</th>
                                        <th className="px-4 py-2 text-right">Devolución (Vacíos)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => {
                                        const inicial = selectedPlanilla.cargaInicial.find(i => i.productoId === p.id)?.cantidad || 0;
                                        const recargas = selectedPlanilla.recargas?.reduce((sum, r) => sum + (r.items.find(i => i.productoId === p.id)?.cantidad || 0), 0) || 0;
                                        const devLlenos = selectedPlanilla.devolucion?.find(d => d.productoId === p.id)?.cantidadLlenos || 0;
                                        const devVacios = selectedPlanilla.devolucion?.find(d => d.productoId === p.id)?.cantidadVacios || 0;

                                        if (inicial === 0 && recargas === 0 && devLlenos === 0 && devVacios === 0) return null;

                                        return (
                                            <tr key={p.id} className="border-b dark:border-gray-700">
                                                <td className="px-4 py-3 font-bold">{p.nombre}</td>
                                                <td className="px-4 py-3 text-right">{inicial > 0 ? inicial : '-'}</td>
                                                <td className="px-4 py-3 text-right text-blue-600">{recargas > 0 ? `+${recargas}` : '-'}</td>
                                                <td className="px-4 py-3 text-right text-orange-600">{selectedPlanilla.estado === EstadoPlanilla.CERRADA ? devLlenos : '...'}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{selectedPlanilla.estado === EstadoPlanilla.CERRADA ? devVacios : '...'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
