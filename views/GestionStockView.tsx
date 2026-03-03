
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
    MovimientoStockPlanta
} from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { TrashIcon } from '../components/icons/TrashIcon';
import { CubeIcon } from '../components/icons/CubeIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import { ChartBarIcon } from '../components/icons/ChartBarIcon';
import { ClipboardCheckIcon } from '../components/icons/ClipboardCheckIcon';
import AppButton from '../components/ui/AppButton';
import { getLocalDateString } from '../utils/dateUtils';

interface GestionStockViewProps {
  planillas: PlanillaDiaria[];
  movimientosPlanta: MovimientoStockPlanta[];
  usuarios: Usuario[];
  productos: Producto[];
  remitos: Remito[];
  addPlanilla: (planilla: Omit<PlanillaDiaria, 'id'>) => void;
  updatePlanilla: (planilla: PlanillaDiaria) => void;
  deletePlanilla: (id: string) => void;
  addMovimientoPlanta: (mov: Omit<MovimientoStockPlanta, 'id'>) => Promise<string>;
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
    const productosOptions = useMemo(() => productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

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
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">Abrir Nueva Planilla de Carga</h2>
            
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
                            <SearchableSelect 
                                label="Producto"
                                options={productosOptions}
                                value={item.productoId}
                                onChange={(val) => handleItemChange(index, 'productoId', val)}
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cant.</label>
                            <input 
                                type="number" 
                                value={item.cantidad} 
                                onChange={(e) => handleItemChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600"
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton type="submit">Abrir Planilla</AppButton>
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

    const productosOptions = useMemo(() => productos.filter(p => p.tipo !== TipoProducto.EQUIPO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

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
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Registrar Recarga / Descarga</h2>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-blue-600 dark:text-blue-400 uppercase text-xs tracking-widest">Carga (Sale de Planta Lleno)</h3>
                    <AppButton size="sm" variant="secondary" onClick={handleAddCarga}>+ Agregar</AppButton>
                </div>
                {itemsCarga.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <SearchableSelect options={productosOptions} value={item.productoId} onChange={(val) => {
                                const newItems = [...itemsCarga];
                                newItems[index].productoId = val;
                                setItemsCarga(newItems);
                            }} />
                        </div>
                        <input type="number" value={item.cantidad} onChange={(e) => {
                            const newItems = [...itemsCarga];
                            newItems[index].cantidad = parseInt(e.target.value) || 0;
                            setItemsCarga(newItems);
                        }} className="w-20 p-2 bg-gray-100 dark:bg-gray-700 rounded-md" />
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
                            <SearchableSelect options={productosOptions} value={item.productoId} onChange={(val) => {
                                const newItems = [...itemsDescarga];
                                newItems[index].productoId = val;
                                setItemsDescarga(newItems);
                            }} />
                        </div>
                        <input type="number" value={item.cantidad} onChange={(e) => {
                            const newItems = [...itemsDescarga];
                            newItems[index].cantidad = parseInt(e.target.value) || 0;
                            setItemsDescarga(newItems);
                        }} className="w-20 p-2 bg-gray-100 dark:bg-gray-700 rounded-md" />
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
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
    onConfirm: (devolucion: ItemDevolucion[], observaciones: string) => void;
    onClose: () => void;
}> = ({ planilla, productos, onConfirm, onClose }) => {
    const [devolucion, setDevolucion] = useState<ItemDevolucion[]>([]);
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        // Inicializar con los productos que salieron en la carga inicial
        const initialDev: ItemDevolucion[] = planilla.cargaInicial.map(item => ({
            productoId: item.productoId,
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
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cierre de Planilla</h2>
                <p className="text-xs text-gray-500">Registre lo que el repartidor trae de vuelta a la planta.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-2 text-left">Producto</th>
                            <th className="px-4 py-2 text-right">Llenos (Sobrante)</th>
                            <th className="px-4 py-2 text-right">Vacíos (Recuperados)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devolucion.map((item, idx) => (
                            <tr key={item.productoId} className="border-b dark:border-gray-700">
                                <td className="px-4 py-3 font-bold">{productos.find(p => p.id === item.productoId)?.nombre}</td>
                                <td className="px-4 py-3">
                                    <input 
                                        type="number" 
                                        value={item.cantidadLlenos} 
                                        onChange={e => handleItemChange(idx, 'cantidadLlenos', parseInt(e.target.value) || 0)}
                                        className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded text-right"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <input 
                                        type="number" 
                                        value={item.cantidadVacios} 
                                        onChange={e => handleItemChange(idx, 'cantidadVacios', parseInt(e.target.value) || 0)}
                                        className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded text-right"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Observaciones</label>
                <textarea 
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                    placeholder="Ej: Diferencia de stock por rotura, etc..."
                />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                <AppButton variant="success" onClick={() => onConfirm(devolucion, observaciones)}>Confirmar Cierre y Ajustar Stock</AppButton>
            </div>
        </div>
    );
};

// Componente Principal
const GestionStockView: React.FC<GestionStockViewProps> = ({ 
    planillas, 
    movimientosPlanta, 
    usuarios, 
    productos, 
    remitos,
    addPlanilla,
    updatePlanilla,
    deletePlanilla,
    addMovimientoPlanta
}) => {
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState<'planta' | 'planillas' | 'flujo'>('planillas');
    const [isNewPlanillaOpen, setIsNewPlanillaOpen] = useState(false);
    const [selectedPlanilla, setSelectedPlanilla] = useState<PlanillaDiaria | null>(null);
    const [isClosingPlanilla, setIsClosingPlanilla] = useState<PlanillaDiaria | null>(null);
    const [isRecargaOpen, setIsRecargaOpen] = useState(false);
    const [isMovPlantaOpen, setIsMovPlantaOpen] = useState(false);
    const [newMovPlanta, setNewMovPlanta] = useState<Partial<MovimientoStockPlanta>>({
        fecha: getLocalDateString(),
        tipo: 'entrada',
        concepto: 'Producción',
        cantidad: 0,
        esEnvase: false
    });

    const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
    const usuariosMap = useMemo(() => new Map(usuarios.map(u => [u.id, u])), [usuarios]);

    // --- LOGICA DE PLANILLAS ---
    const handleClosePlanilla = (planilla: PlanillaDiaria) => {
        setIsClosingPlanilla(planilla);
    };

    const confirmClosePlanilla = (devolucion: ItemDevolucion[], observaciones: string) => {
        if (!isClosingPlanilla) return;
        updatePlanilla({
            ...isClosingPlanilla,
            estado: EstadoPlanilla.CERRADA,
            devolucion,
            observaciones
        });
        setIsClosingPlanilla(null);
        showNotification('Planilla cerrada y stock ajustado', 'success');
    };

    // --- LOGICA DE MOVIMIENTOS PLANTA ---
    const handleSaveMovPlanta = async () => {
        if (!newMovPlanta.productoId || !newMovPlanta.cantidad || newMovPlanta.cantidad <= 0) {
            showNotification('Complete todos los campos', 'error');
            return;
        }
        await addMovimientoPlanta(newMovPlanta as Omit<MovimientoStockPlanta, 'id'>);
        showNotification('Movimiento registrado', 'success');
        setIsMovPlantaOpen(false);
    };

    // --- CALCULOS DE FLUJO ---
    const flujoDelDia = useMemo(() => {
        const today = getLocalDateString();
        const planillasHoy = planillas.filter(p => p.fecha === today);
        const movsHoy = movimientosPlanta.filter(m => m.fecha === today);

        const resumen: Record<string, { salio: number, entro: number, ventas: number, devoluciones: number }> = {};

        productos.forEach(p => {
            if (p.tipo === TipoProducto.EQUIPO) return;
            resumen[p.id] = { salio: 0, entro: 0, ventas: 0, devoluciones: 0 };
        });

        // 1. Salidas de Planta (Cargas Iniciales + Recargas)
        planillasHoy.forEach(p => {
            p.cargaInicial.forEach(item => {
                if (resumen[item.productoId]) resumen[item.productoId].salio += item.cantidad;
            });
            p.recargas?.forEach(rec => {
                rec.items.forEach(item => {
                    if (resumen[item.productoId]) resumen[item.productoId].salio += item.cantidad;
                });
                rec.vaciosDescargados?.forEach(item => {
                    if (resumen[item.productoId]) resumen[item.productoId].entro += item.cantidad; // Envases que entran
                });
            });
            if (p.estado === EstadoPlanilla.CERRADA) {
                p.devolucion?.forEach(item => {
                    if (resumen[item.productoId]) {
                        resumen[item.productoId].entro += item.cantidadLlenos;
                        resumen[item.productoId].devoluciones += item.cantidadLlenos;
                    }
                });
            }
        });

        // 2. Movimientos Manuales
        movsHoy.forEach(m => {
            if (!resumen[m.productoId]) return;
            if (m.tipo === 'entrada') resumen[m.productoId].entro += m.cantidad;
            else if (m.tipo === 'salida') resumen[m.productoId].salio += m.cantidad;
        });

        return resumen;
    }, [planillas, movimientosPlanta, productos]);

    return (
        <div className="space-y-6 pt-12 md:pt-0">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter italic">Gestión de Stock y Cargas</h1>
                <div className="flex gap-2">
                    {activeTab === 'planillas' && (
                        <AppButton onClick={() => setIsNewPlanillaOpen(true)}>+ Abrir Planilla</AppButton>
                    )}
                    {activeTab === 'planta' && (
                        <AppButton onClick={() => setIsMovPlantaOpen(true)}>+ Movimiento Manual</AppButton>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit border dark:border-gray-700 shadow-sm">
                <button 
                    onClick={() => setActiveTab('planillas')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'planillas' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <ClipboardCheckIcon className="h-4 w-4" /> CONTROL DE CARGAS
                </button>
                <button 
                    onClick={() => setActiveTab('planta')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'planta' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <CubeIcon className="h-4 w-4" /> STOCK PLANTA
                </button>
                <button 
                    onClick={() => setActiveTab('flujo')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'flujo' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <ChartBarIcon className="h-4 w-4" /> FLUJO DIARIO
                </button>
            </div>

            {/* CONTENIDO TABS */}
            {activeTab === 'planillas' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {planillas
                            .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime())
                            .slice(0, 12)
                            .map(p => (
                            <Card key={p.id} className={`border-l-4 ${p.estado === EstadoPlanilla.ABIERTA ? 'border-l-blue-500' : 'border-l-green-500'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                                        <h3 className="font-bold text-gray-800 dark:text-white">{usuariosMap.get(p.repartidorId)?.nombre}</h3>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${p.estado === EstadoPlanilla.ABIERTA ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {p.estado}
                                    </span>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Carga Inicial:</span>
                                        <span className="font-bold">{p.cargaInicial.reduce((s, i) => s + i.cantidad, 0)} items</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Recargas:</span>
                                        <span className="font-bold">{p.recargas?.length || 0} veces</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <AppButton size="sm" variant="secondary" fullWidth onClick={() => setSelectedPlanilla(p)}>Ver Detalle</AppButton>
                                    {p.estado === EstadoPlanilla.ABIERTA && (
                                        <AppButton size="sm" variant="success" fullWidth onClick={() => handleClosePlanilla(p)}>Cerrar</AppButton>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'planta' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {productos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).map(p => (
                            <Card key={p.id} title={p.nombre} compact>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <p className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Llenos</p>
                                        <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{p.stockPlanta || 0}</p>
                                    </div>
                                    {p.tipo === TipoProducto.RETORNABLE && (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-100 dark:border-yellow-800">
                                            <p className="text-[9px] font-black uppercase text-yellow-600 dark:text-yellow-400">Vacíos</p>
                                            <p className="text-2xl font-black text-yellow-700 dark:text-yellow-300">{p.stockEnvases || 0}</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Card title="Historial de Movimientos de Planta">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Concepto</th>
                                        <th className="px-4 py-3 text-right">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientosPlanta
                                        .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime())
                                        .slice(0, 20)
                                        .map(m => (
                                        <tr key={m.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50">
                                            <td className="px-4 py-3 font-mono text-xs">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                            <td className="px-4 py-3 font-bold">
                                                {productosMap.get(m.productoId)?.nombre}
                                                {m.esEnvase && <span className="ml-2 text-[8px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded uppercase font-black">Envase</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                    m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 
                                                    m.tipo === 'salida' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {m.tipo}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{m.concepto}</td>
                                            <td className={`px-4 py-3 text-right font-black ${m.tipo === 'entrada' ? 'text-green-600' : m.tipo === 'salida' ? 'text-red-600' : 'text-gray-600'}`}>
                                                {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '-' : ''}{m.cantidad}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'flujo' && (
                <div className="space-y-6">
                    <Card title={`Balance de Movimientos del Día (${new Date().toLocaleDateString('es-AR')})`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-right">Salida (Calle)</th>
                                        <th className="px-4 py-3 text-right">Entrada (Devolución)</th>
                                        <th className="px-4 py-3 text-right">Venta Teórica</th>
                                        <th className="px-4 py-3 text-right">Balance Planta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(flujoDelDia).map(([prodId, data]: [string, any]) => (
                                        <tr key={prodId} className="border-b dark:border-gray-700">
                                            <td className="px-4 py-3 font-bold">{productosMap.get(prodId)?.nombre}</td>
                                            <td className="px-4 py-3 text-right text-red-600 font-bold">-{data.salio}</td>
                                            <td className="px-4 py-3 text-right text-green-600 font-bold">+{data.entro}</td>
                                            <td className="px-4 py-3 text-right font-black text-primary-600">{data.salio - data.entro}</td>
                                            <td className={`px-4 py-3 text-right font-black ${data.entro - data.salio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.entro - data.salio}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            <strong>Nota:</strong> El balance de planta muestra la diferencia neta de stock físico al final del día. 
                            Un balance negativo indica que salió más producto del que volvió (Venta o Pérdida).
                        </p>
                    </div>
                </div>
            )}

            {/* MODALES */}
            {isNewPlanillaOpen && (
                <Modal isOpen={true} onClose={() => setIsNewPlanillaOpen(false)}>
                    <PlanillaForm 
                        usuarios={usuarios} 
                        productos={productos} 
                        onSave={(p) => { addPlanilla(p); setIsNewPlanillaOpen(false); }} 
                        onClose={() => setIsNewPlanillaOpen(false)} 
                    />
                </Modal>
            )}

            {isClosingPlanilla && (
                <Modal isOpen={true} onClose={() => setIsClosingPlanilla(null)} className="max-w-2xl">
                    <CierrePlanillaModal 
                        planilla={isClosingPlanilla}
                        productos={productos}
                        onConfirm={confirmClosePlanilla}
                        onClose={() => setIsClosingPlanilla(null)}
                    />
                </Modal>
            )}

            {selectedPlanilla && (
                <Modal isOpen={true} onClose={() => setSelectedPlanilla(null)} className="max-w-4xl">
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b dark:border-gray-700 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalle de Planilla</h2>
                                <p className="text-gray-500">{usuariosMap.get(selectedPlanilla.repartidorId)?.nombre} - {new Date(selectedPlanilla.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                            </div>
                            <div className="flex gap-2">
                                {selectedPlanilla.estado === EstadoPlanilla.ABIERTA && (
                                    <AppButton variant="success" onClick={() => setIsRecargaOpen(true)}>+ Registrar Recarga</AppButton>
                                )}
                                <AppButton variant="danger" onClick={() => { if(confirm('¿Eliminar planilla?')) { deletePlanilla(selectedPlanilla.id); setSelectedPlanilla(null); } }}>Eliminar</AppButton>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card title="Carga Inicial (Llenos)" compact>
                                <table className="w-full text-xs">
                                    <tbody>
                                        {selectedPlanilla.cargaInicial.map(item => (
                                            <tr key={item.productoId} className="border-b dark:border-gray-700 last:border-0">
                                                <td className="py-2">{productosMap.get(item.productoId)?.nombre}</td>
                                                <td className="py-2 text-right font-bold">{item.cantidad}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>

                            <Card title="Recargas / Descargas" compact>
                                {selectedPlanilla.recargas && selectedPlanilla.recargas.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedPlanilla.recargas.map((rec, idx) => (
                                            <div key={idx} className="text-[10px] bg-gray-50 dark:bg-gray-700/50 p-2 rounded border dark:border-gray-600">
                                                <p className="font-black mb-1">HORA: {rec.hora}</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-blue-600 font-bold uppercase">Sale (Llenos):</p>
                                                        {rec.items.map(i => <p key={i.productoId}>{productosMap.get(i.productoId)?.nombre}: {i.cantidad}</p>)}
                                                    </div>
                                                    <div>
                                                        <p className="text-yellow-600 font-bold uppercase">Entra (Vacíos):</p>
                                                        {rec.vaciosDescargados?.map(i => <p key={i.productoId}>{productosMap.get(i.productoId)?.nombre}: {i.cantidad}</p>)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-gray-400 italic">Sin recargas registradas</p>}
                            </Card>
                        </div>

                        {selectedPlanilla.estado === EstadoPlanilla.CERRADA && (
                            <Card title="Devolución al Cierre (Lo que volvió a Planta)" compact>
                                <table className="w-full text-xs">
                                    <thead className="text-[10px] uppercase font-black text-gray-400">
                                        <tr>
                                            <th className="text-left py-2">Producto</th>
                                            <th className="text-right py-2">Llenos</th>
                                            <th className="text-right py-2">Vacíos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedPlanilla.devolucion?.map(item => (
                                            <tr key={item.productoId} className="border-b dark:border-gray-700 last:border-0">
                                                <td className="py-2">{productosMap.get(item.productoId)?.nombre}</td>
                                                <td className="py-2 text-right font-bold text-blue-600">{item.cantidadLlenos}</td>
                                                <td className="py-2 text-right font-bold text-yellow-600">{item.cantidadVacios}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {selectedPlanilla.observaciones && (
                                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs italic">
                                        Obs: {selectedPlanilla.observaciones}
                                    </div>
                                )}
                            </Card>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                            <AppButton variant="secondary" onClick={() => setSelectedPlanilla(null)}>Cerrar Ventana</AppButton>
                        </div>
                    </div>
                </Modal>
            )}

            {isRecargaOpen && selectedPlanilla && (
                <Modal isOpen={true} onClose={() => setIsRecargaOpen(false)}>
                    <RecargaModal 
                        productos={productos} 
                        onSave={(carga, descarga) => {
                            const newRecarga = {
                                hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
                                items: carga,
                                vaciosDescargados: descarga
                            };
                            updatePlanilla({
                                ...selectedPlanilla,
                                recargas: [...(selectedPlanilla.recargas || []), newRecarga]
                            });
                            setIsRecargaOpen(false);
                            showNotification('Recarga registrada', 'success');
                        }}
                        onClose={() => setIsRecargaOpen(false)}
                    />
                </Modal>
            )}

            {isMovPlantaOpen && (
                <Modal isOpen={true} onClose={() => setIsMovPlantaOpen(false)} title="Movimiento Manual de Planta">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Fecha</label>
                                <input type="date" value={newMovPlanta.fecha} onChange={e => setNewMovPlanta({...newMovPlanta, fecha: e.target.value})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Tipo Stock</label>
                                <select value={newMovPlanta.esEnvase ? 'envase' : 'lleno'} onChange={e => setNewMovPlanta({...newMovPlanta, esEnvase: e.target.value === 'envase'})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    <option value="lleno">Producto Lleno</option>
                                    <option value="envase">Envase Vacío</option>
                                </select>
                            </div>
                        </div>
                        <SearchableSelect label="Producto" options={productos.map(p => ({ value: p.id, label: p.nombre }))} value={newMovPlanta.productoId || ''} onChange={v => setNewMovPlanta({...newMovPlanta, productoId: v})} />
                        <div className="grid grid-cols-2 gap-4">
                            <select value={newMovPlanta.tipo} onChange={e => setNewMovPlanta({...newMovPlanta, tipo: e.target.value as any})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <option value="entrada">Entrada (+)</option>
                                <option value="salida">Salida (-)</option>
                                <option value="ajuste">Ajuste (=)</option>
                            </select>
                            <input type="number" value={newMovPlanta.cantidad} onChange={e => setNewMovPlanta({...newMovPlanta, cantidad: parseInt(e.target.value) || 0})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg" />
                        </div>
                        <input type="text" placeholder="Concepto..." value={newMovPlanta.concepto} onChange={e => setNewMovPlanta({...newMovPlanta, concepto: e.target.value})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg" />
                        <div className="flex justify-end gap-2 pt-4">
                            <AppButton variant="secondary" onClick={() => setIsMovPlantaOpen(false)}>Cancelar</AppButton>
                            <AppButton onClick={handleSaveMovPlanta}>Guardar</AppButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default GestionStockView;
