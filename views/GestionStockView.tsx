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
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import { getLocalDateString, formatDate } from '../utils/dateUtils';
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
    const [items, setItems] = useState<ItemStock[]>([{ productoId: '', cantidad: 0 }]);

    const repartidores = useMemo(() => usuarios.filter(u => u.rol === Rol.REPARTIDOR && u.tipo === TipoVendedor.INTERNO), [usuarios]);
    const productosOptions = useMemo(() => 
        productos
            .filter(p => p.estado !== EstadoProducto.INACTIVO)
            .map(p => ({ value: p.id, label: p.nombre })), 
    [productos]);

    const handleLoadLast = useCallback(() => {
        if (!repartidorId) return;
        const lastPlanilla = [...planillas]
            .sort((a, b) => new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime())
            .find(p => p.repartidorId === repartidorId);
        
        if (lastPlanilla) {
            setItems(lastPlanilla.cargaInicial.map(i => ({ ...i })));
        }
    }, [repartidorId, planillas]);

    const addItem = () => setItems([...items, { productoId: '', cantidad: 0 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
    const updateItem = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const itemsValidos = items.filter(i => i.productoId && i.cantidad > 0);

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
                <AppSelect
                    label="Repartidor"
                    value={repartidorId}
                    onChange={(e) => setRepartidorId(e.target.value)}
                    options={[
                        { value: '', label: 'Seleccione...' },
                        ...repartidores.map(r => ({ value: r.id, label: r.nombre }))
                    ]}
                    required
                />
                <AppInput
                    label="Fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos a Cargar</h3>
                    {repartidorId && (
                        <AppButton 
                            type="button" 
                            onClick={handleLoadLast}
                            variant="secondary"
                            size="sm"
                            className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full transition-colors border-transparent shadow-none"
                        >
                            ⚡ Cargar Último Reparto
                        </AppButton>
                    )}
                </div>
                
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="flex flex-wrap sm:flex-nowrap gap-3 items-end bg-white dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700 shadow-sm">
                            <div className="flex-1 min-w-[150px]">
                                <SearchableSelect 
                                    options={productosOptions} 
                                    value={item.productoId} 
                                    onChange={(v) => updateItem(index, 'productoId', v)} 
                                    placeholder="Seleccionar Producto"
                                />
                            </div>
                            <div className="w-full sm:w-32">
                                <AppInput 
                                    type="number" 
                                    value={item.cantidad || ''} 
                                    onChange={(e) => updateItem(index, 'cantidad', parseInt(e.target.value) || 0)}
                                    placeholder="Cant."
                                    className="text-right font-black"
                                />
                            </div>
                            <AppButton 
                                variant="danger" 
                                size="sm" 
                                onClick={() => removeItem(index)}
                                className="!p-2 h-[42px] w-[42px]"
                                type="button"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </AppButton>
                        </div>
                    ))}
                    <AppButton 
                        variant="secondary" 
                        size="sm" 
                        onClick={addItem} 
                        className="w-full border-dashed border-2 !py-3 font-black uppercase tracking-widest text-[10px]"
                        type="button"
                    >
                        + Agregar Producto
                    </AppButton>
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
    const [itemsCarga, setItemsCarga] = useState<ItemStock[]>([{ productoId: '', cantidad: 0 }]);
    const [itemsDescarga, setItemsDescarga] = useState<ItemStock[]>([{ productoId: '', cantidad: 0 }]);

    const productosOptions = useMemo(() => 
        productos
            .filter(p => p.estado !== EstadoProducto.INACTIVO)
            .map(p => ({ value: p.id, label: p.nombre })), 
    [productos]);

    const addItemCarga = () => setItemsCarga([...itemsCarga, { productoId: '', cantidad: 0 }]);
    const removeItemCarga = (index: number) => setItemsCarga(itemsCarga.filter((_, i) => i !== index));
    const updateItemCarga = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...itemsCarga];
        newItems[index] = { ...newItems[index], [field]: value };
        setItemsCarga(newItems);
    };

    const addItemDescarga = () => setItemsDescarga([...itemsDescarga, { productoId: '', cantidad: 0 }]);
    const removeItemDescarga = (index: number) => setItemsDescarga(itemsDescarga.filter((_, i) => i !== index));
    const updateItemDescarga = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...itemsDescarga];
        newItems[index] = { ...newItems[index], [field]: value };
        setItemsDescarga(newItems);
    };

    const handleSave = () => {
        const cargaValida = itemsCarga.filter(i => i.productoId && i.cantidad > 0);
        const descargaValida = itemsDescarga.filter(i => i.productoId && i.cantidad > 0);

        if (cargaValida.length === 0 && descargaValida.length === 0) return;
        onSave(cargaValida, descargaValida);
    };

    return (
        <div className="space-y-8">
            <div className="pr-10">
                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Registrar Recarga</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Movimiento intermedio de stock</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CARGA (SALE DE PLANTA) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carga (Sale de Planta)</h3>
                    </div>
                    <div className="space-y-3">
                        {itemsCarga.map((item, index) => (
                            <div key={index} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl border dark:border-gray-700">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={productosOptions} 
                                        value={item.productoId} 
                                        onChange={(v) => updateItemCarga(index, 'productoId', v)} 
                                        placeholder="Producto"
                                    />
                                </div>
                                <div className="w-20">
                                    <AppInput 
                                        type="number" 
                                        value={item.cantidad || ''} 
                                        onChange={(e) => updateItemCarga(index, 'cantidad', parseInt(e.target.value) || 0)}
                                        className="text-right font-black text-blue-600"
                                    />
                                </div>
                                <AppButton variant="danger" size="sm" onClick={() => removeItemCarga(index)} className="!p-2 h-[38px] w-[38px]"><TrashIcon className="w-4 h-4"/></AppButton>
                            </div>
                        ))}
                        <AppButton variant="secondary" size="sm" onClick={addItemCarga} className="w-full border-dashed border-2 !py-2 text-[9px] font-black uppercase">+ Agregar Carga</AppButton>
                    </div>
                </div>

                {/* DESCARGA (ENTRA A PLANTA) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descarga (Entra a Planta)</h3>
                    </div>
                    <div className="space-y-3">
                        {itemsDescarga.map((item, index) => (
                            <div key={index} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl border dark:border-gray-700">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={productosOptions} 
                                        value={item.productoId} 
                                        onChange={(v) => updateItemDescarga(index, 'productoId', v)} 
                                        placeholder="Producto"
                                    />
                                </div>
                                <div className="w-20">
                                    <AppInput 
                                        type="number" 
                                        value={item.cantidad || ''} 
                                        onChange={(e) => updateItemDescarga(index, 'cantidad', parseInt(e.target.value) || 0)}
                                        className="text-right font-black text-orange-600"
                                    />
                                </div>
                                <AppButton variant="danger" size="sm" onClick={() => removeItemDescarga(index)} className="!p-2 h-[38px] w-[38px]"><TrashIcon className="w-4 h-4"/></AppButton>
                            </div>
                        ))}
                        <AppButton variant="secondary" size="sm" onClick={addItemDescarga} className="w-full border-dashed border-2 !py-2 text-[9px] font-black uppercase">+ Agregar Descarga</AppButton>
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

            <div className="overflow-hidden border dark:border-gray-700 rounded-2xl">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-4 py-3 text-left">Producto</th>
                            <th className="px-4 py-3 text-right">Salió (Total)</th>
                            <th className="px-4 py-3 text-right text-orange-600">Volvió (Lleno)</th>
                            <th className="px-4 py-3 text-right text-blue-600">Entregado</th>
                            <th className="px-4 py-3 text-right text-green-600">Vacíos (Recup.)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {devolucion.map((item, idx) => {
                            const pId = item.productoId;
                            let salio = planilla.cargaInicial.find(i => i.productoId === pId)?.cantidad || 0;
                            planilla.recargas?.forEach(r => {
                                salio += r.items.find(i => i.productoId === pId)?.cantidad || 0;
                            });
                            const entregado = salio - item.cantidadLlenos;

                            return (
                                <tr key={item.productoId} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-4">
                                        <p className="font-bold text-gray-800 dark:text-white uppercase tracking-tighter">{productos.find(p => p.id === item.productoId)?.nombre}</p>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-gray-400 font-bold">{salio}</td>
                                    <td className="px-4 py-4">
                                        <AppInput 
                                            type="number" 
                                            value={item.cantidadLlenos || ''} 
                                            onChange={e => handleItemChange(idx, 'cantidadLlenos', parseInt(e.target.value) || 0)}
                                            className="text-right font-black text-orange-600"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="font-black text-blue-600 text-lg">{entregado}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <AppInput 
                                            type="number" 
                                            value={item.cantidadVacios || ''} 
                                            onChange={e => handleItemChange(idx, 'cantidadVacios', parseInt(e.target.value) || 0)}
                                            className="text-right font-black text-green-600"
                                            placeholder="0"
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
            // --- LLENOS ---
            const stockInicialLlenos = lastCierre?.saldos.find(s => s.productoId === p.id)?.cantidadFisica ?? (p.stockPlanta || 0);
            
            const produccionHistorica = movsDia
                .filter(m => m.productoId === p.id && m.tipo === 'entrada' && !m.esEnvase && m.concepto.toLowerCase().includes('producción'))
                .reduce((sum, m) => sum + m.cantidad, 0);

            let salidasInternasLlenos = 0;
            planillasDia.forEach(pl => {
                salidasInternasLlenos += pl.cargaInicial.find(i => i.productoId === p.id)?.cantidad || 0;
                pl.recargas?.forEach(rec => {
                    salidasInternasLlenos += rec.items.find(i => i.productoId === p.id)?.cantidad || 0;
                });
                if (pl.estado === EstadoPlanilla.CERRADA) {
                    salidasInternasLlenos -= pl.devolucion?.find(d => d.productoId === p.id)?.cantidadLlenos || 0;
                }
            });

            const salidasExternasLlenos = ventasDia.reduce((sum, v) => {
                return sum + (v.movimientos.find(m => m.productoId === p.id)?.cantidad || 0);
            }, 0);

            const prodNueva = productionInput[p.id] || 0;
            const teoricoLlenos = stockInicialLlenos + produccionHistorica + prodNueva - salidasInternasLlenos - salidasExternasLlenos;

            // --- VACÍOS ---
            // El stock inicial de vacíos no se guarda en el cierre físico actual (TODO: agregarlo), así que usamos el del producto
            const stockInicialVacios = p.stockEnvases || 0; 
            
            // Los vacíos se CONSUMEN en la producción
            const consumoProduccion = (produccionHistorica + prodNueva);

            let recuperosInternosVacios = 0;
            planillasDia.forEach(pl => {
                pl.recargas?.forEach(rec => {
                    recuperosInternosVacios += rec.vaciosDescargados?.find(i => i.productoId === p.id)?.cantidad || 0;
                });
                if (pl.estado === EstadoPlanilla.CERRADA) {
                    recuperosInternosVacios += pl.devolucion?.find(d => d.productoId === p.id)?.cantidadVacios || 0;
                }
            });

            const recuperosExternosVacios = ventasDia.reduce((sum, v) => {
                return sum + (v.movimientos.find(m => m.productoId === p.id)?.recibidos || 0);
            }, 0);

            const teoricoVacios = stockInicialVacios - consumoProduccion + recuperosInternosVacios + recuperosExternosVacios;

            return {
                producto: p,
                llenos: {
                    inicial: stockInicialLlenos,
                    produccionHistorica,
                    produccionNueva: prodNueva,
                    salidasInternas: salidasInternasLlenos,
                    salidasExternas: salidasExternasLlenos,
                    teorico: teoricoLlenos
                },
                vacios: {
                    inicial: stockInicialVacios,
                    consumo: consumoProduccion,
                    recuperosInternos: recuperosInternosVacios,
                    recuperosExternos: recuperosExternosVacios,
                    teorico: teoricoVacios
                }
            };
        });
    }, [selectedDate, cierresPlanta, planillas, ventasVendedor, movimientosPlanta, productos, productionInput]);

    const handleSaveBalance = async () => {
        if (isSavingCierre) return;
        setIsSavingCierre(true);
        try {
            // 1. Guardar movimientos de producción nuevos
            for (const d of balanceData) {
                if (d.llenos.produccionNueva > 0) {
                    // Entrada de Llenos
                    await addMovimientoPlanta({
                        fecha: selectedDate,
                        productoId: d.producto.id,
                        cantidad: d.llenos.produccionNueva,
                        tipo: 'entrada',
                        concepto: 'Producción Diaria',
                        esEnvase: false
                    });
                    // Salida de Vacíos (Consumo)
                    await addMovimientoPlanta({
                        fecha: selectedDate,
                        productoId: d.producto.id,
                        cantidad: d.llenos.produccionNueva,
                        tipo: 'salida',
                        concepto: 'Consumo por Producción',
                        esEnvase: true
                    });
                }
            }

            // 2. Guardar Cierre
            const saldos = balanceData.map(d => ({
                productoId: d.producto.id,
                cantidadFisica: physicalStock[d.producto.id] ?? d.llenos.teorico,
                cantidadTeorica: d.llenos.teorico,
                produccionDia: d.llenos.produccionHistorica + d.llenos.produccionNueva
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
                    <div className="flex items-center gap-4 mt-4">
                        <div className="w-48">
                            <AppInput 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)} 
                                className="font-black text-primary-600"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-gray-800 dark:text-white">{formatDate(selectedDate)}</span>
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Sesión Diaria</span>
                        </div>
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
                                                <span className="text-[10px] font-bold text-gray-400 mt-1">{formatDate(p.fecha)}</span>
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-3">
                        <ChartBarIcon className="h-5 w-5 text-gray-400" />
                        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Balance de Planta / Auditoría</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Stock Inicial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-100"></div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Producción (Llenado)</span>
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
                </div>

                <Card className="overflow-hidden border-none shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-5">Producto / Envase</th>
                                    <th className="px-6 py-5 text-right">Stock Inicial</th>
                                    <th className="px-6 py-5 text-center bg-blue-50/30 dark:bg-blue-900/5">Producción</th>
                                    <th className="px-6 py-5 text-right text-red-500">Entregados (Salidas)</th>
                                    <th className="px-6 py-5 text-right text-green-500">Recuperados (Entradas)</th>
                                    <th className="px-6 py-5 text-right">Teórico</th>
                                    <th className="px-6 py-5 text-center bg-yellow-50/30 dark:bg-yellow-900/5">Físico</th>
                                    <th className="px-6 py-5 text-right">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {balanceData.map(d => {
                                    const fisico = physicalStock[d.producto.id] ?? d.llenos.teorico;
                                    const diferencia = fisico - d.llenos.teorico;
                                    const entregados = d.llenos.salidasInternas + d.llenos.salidasExternas;
                                    const recuperados = d.vacios.recuperadosInternos + d.vacios.descargasExternas;
                                    
                                    if (d.llenos.inicial === 0 && d.llenos.produccionHistorica === 0 && d.llenos.produccionNueva === 0 && entregados === 0 && fisico === 0 && recuperados === 0) {
                                        return null;
                                    }

                                    return (
                                        <tr key={d.producto.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="font-black text-gray-800 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tighter">{d.producto.nombre}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{d.producto.tipo}</span>
                                                    {d.producto.tipo === TipoProducto.RETORNABLE && (
                                                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                            Vacíos en Planta: {d.vacios.teorico}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-gray-400 font-bold">{d.llenos.inicial}</td>
                                            <td className="px-6 py-5 bg-blue-50/10 dark:bg-blue-900/5">
                                                <div className="flex flex-col items-center gap-1">
                                                    <AppInput 
                                                        type="number" 
                                                        placeholder="0"
                                                        value={productionInput[d.producto.id] || ''}
                                                        onChange={e => setProductionInput(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                        className="w-24 text-center font-black text-blue-700 dark:text-blue-400"
                                                    />
                                                    {d.llenos.produccionHistorica > 0 && (
                                                        <span className="text-[9px] font-bold text-gray-400">Ya cargado: {d.llenos.produccionHistorica}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="font-black text-red-500 text-base">-{entregados}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="font-black text-green-500 text-base">+{recuperados}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-gray-800 dark:text-white text-xl tracking-tighter">{d.llenos.teorico}</td>
                                            <td className="px-6 py-5 bg-yellow-50/10 dark:bg-yellow-900/5">
                                                <AppInput 
                                                    type="number" 
                                                    value={fisico}
                                                    onChange={e => setPhysicalStock(prev => ({ ...prev, [d.producto.id]: parseInt(e.target.value) || 0 }))}
                                                    className="w-24 mx-auto text-center font-black"
                                                    placeholder={d.llenos.teorico.toString()}
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
                                    <div className="flex gap-2">
                                        <AppButton size="sm" variant="secondary" fullWidth onClick={() => setSelectedPlanilla(p)} className="text-[9px] font-black uppercase tracking-widest py-1">Ver</AppButton>
                                        <AppButton 
                                            size="sm" 
                                            variant="secondary" 
                                            fullWidth 
                                            onClick={() => {
                                                if(window.confirm('¿Reabrir este reparto?')) {
                                                    updatePlanilla({ ...p, estado: EstadoPlanilla.ABIERTA, devolucion: [] });
                                                    showNotification('Reparto reabierto', 'success');
                                                }
                                            }} 
                                            className="text-[9px] font-black uppercase tracking-widest py-1 border-dashed"
                                        >
                                            Reabrir
                                        </AppButton>
                                    </div>
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
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatDate(selectedPlanilla.fecha)}</span>
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
                                {selectedPlanilla.estado === EstadoPlanilla.CERRADA && (
                                    <AppButton 
                                        size="sm" 
                                        variant="secondary" 
                                        onClick={() => {
                                            if(window.confirm('¿Reabrir este reparto? Se revertirá el ingreso de stock a planta.')) {
                                                updatePlanilla({
                                                    ...selectedPlanilla,
                                                    estado: EstadoPlanilla.ABIERTA,
                                                    devolucion: []
                                                });
                                                setSelectedPlanilla(null);
                                                showNotification('Reparto reabierto', 'success');
                                            }
                                        }}
                                    >
                                        Reabrir
                                    </AppButton>
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
