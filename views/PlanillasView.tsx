
import React, { useMemo, useState, useEffect } from 'react';
import { PlanillaDiaria, Usuario, Producto, EstadoPlanilla, Rol, ItemStock, TipoVendedor, Remito, ItemDevolucion, TipoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { TrashIcon } from '../components/icons/TrashIcon';
import { CubeIcon } from '../components/icons/CubeIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';

interface PlanillasViewProps {
  planillas: PlanillaDiaria[];
  usuarios: Usuario[];
  productos: Producto[];
  remitos: Remito[];
  addPlanilla: (planilla: Omit<PlanillaDiaria, 'id'>) => void;
  updatePlanilla: (planilla: PlanillaDiaria) => void;
}

// Formulario para crear nueva planilla (Carga Inicial)
const PlanillaForm: React.FC<{
    usuarios: Usuario[];
    productos: Producto[];
    onSave: (data: Omit<PlanillaDiaria, 'id'>) => void;
    onClose: () => void;
}> = ({ usuarios, productos, onSave, onClose }) => {
    const [repartidorId, setRepartidorId] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [cargaInicial, setCargaInicial] = useState<ItemStock[]>([]);

    const repartidores = useMemo(() => usuarios.filter(u => u.rol === Rol.REPARTIDOR && u.tipo === TipoVendedor.INTERNO), [usuarios]);
    const productosOptions = useMemo(() => productos.map(p => ({ value: p.id, label: p.nombre })), [productos]);

    const handleAddItem = () => {
        setCargaInicial([...cargaInicial, { productoId: '', cantidad: 0 }]);
    };

    const handleItemChange = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...cargaInicial];
        newItems[index] = { ...newItems[index], [field]: value };
        setCargaInicial(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setCargaInicial(cargaInicial.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const itemsValidos = cargaInicial.filter(item => item.productoId && item.cantidad > 0);
        
        const nuevaPlanilla: Omit<PlanillaDiaria, 'id'> = {
            fecha,
            repartidorId,
            estado: EstadoPlanilla.ABIERTA,
            cargaInicial: itemsValidos,
        };
        onSave(nuevaPlanilla);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Abrir Nueva Planilla de Carga</h2>
            
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
                        <option value="">Seleccionar Repartidor</option>
                        {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                </div>
            </div>

            <fieldset className="border-t dark:border-gray-600 pt-4">
                <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Carga Inicial (Salida de Fábrica)</legend>
                <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center text-sm font-medium text-gray-500 mb-1">
                        <span>Producto</span>
                        <span className="text-center">Cantidad</span>
                        <span></span>
                    </div>
                    {cargaInicial.map((item, index) => (
                        <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                            <SearchableSelect 
                                options={productosOptions}
                                value={item.productoId}
                                onChange={(val) => handleItemChange(index, 'productoId', val)}
                                placeholder="Producto..."
                            />
                            <input 
                                type="number" 
                                value={item.cantidad} 
                                onChange={(e) => handleItemChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-center"
                                min="1"
                            />
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 p-2 hover:bg-red-100 rounded-full">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddItem} className="mt-3 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">
                    + Agregar Producto
                </button>
            </fieldset>

            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200">Cancelar</button>
                <button type="submit" disabled={!repartidorId || cargaInicial.length === 0} className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Confirmar Apertura
                </button>
            </div>
        </form>
    );
};

// Formulario para Registrar Recarga / Paso por Fábrica
const RecargaForm: React.FC<{
    productos: Producto[];
    onSave: (recarga: ItemStock[], descarga: ItemStock[]) => void;
    onClose: () => void;
}> = ({ productos, onSave, onClose }) => {
    const [itemsCarga, setItemsCarga] = useState<ItemStock[]>([]);
    const [itemsDescarga, setItemsDescarga] = useState<ItemStock[]>([]);

    const productosOptions = useMemo(() => productos.map(p => ({ value: p.id, label: p.nombre })), [productos]);
    const productosRetornables = useMemo(() => productos.filter(p => p.tipo === TipoProducto.RETORNABLE).map(p => ({ value: p.id, label: p.nombre })), [productos]);

    // Helpers para Carga (Llenos)
    const handleAddCarga = () => setItemsCarga([...itemsCarga, { productoId: '', cantidad: 0 }]);
    const handleCargaChange = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...itemsCarga];
        newItems[index] = { ...newItems[index], [field]: value };
        setItemsCarga(newItems);
    };
    const handleRemoveCarga = (index: number) => setItemsCarga(itemsCarga.filter((_, i) => i !== index));

    // Helpers para Descarga (Vacíos)
    const handleAddDescarga = () => setItemsDescarga([...itemsDescarga, { productoId: '', cantidad: 0 }]);
    const handleDescargaChange = (index: number, field: keyof ItemStock, value: any) => {
        const newItems = [...itemsDescarga];
        newItems[index] = { ...newItems[index], [field]: value };
        setItemsDescarga(newItems);
    };
    const handleRemoveDescarga = (index: number) => setItemsDescarga(itemsDescarga.filter((_, i) => i !== index));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cargaValida = itemsCarga.filter(i => i.productoId && i.cantidad > 0);
        const descargaValida = itemsDescarga.filter(i => i.productoId && i.cantidad > 0);
        onSave(cargaValida, descargaValida);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Paso por Fábrica (Recarga)</h2>
            <p className="text-sm text-gray-500">Registre los productos que se cargan al camión y los envases vacíos que se bajan.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección Recarga (Llenos) */}
                <fieldset className="border dark:border-gray-600 p-4 rounded-md bg-green-50 dark:bg-green-900/10">
                    <legend className="text-base font-semibold text-green-700 dark:text-green-300 px-2 flex items-center gap-2">
                        <CubeIcon className="w-5 h-5"/> Carga de Productos (Entrada)
                    </legend>
                    <div className="space-y-2 mt-2">
                        {itemsCarga.map((item, index) => (
                            <div key={index} className="grid grid-cols-[1fr,80px,auto] gap-2 items-center">
                                <SearchableSelect options={productosOptions} value={item.productoId} onChange={(val) => handleCargaChange(index, 'productoId', val)} placeholder="Prod..." />
                                <input 
                                    type="number" 
                                    value={item.cantidad} 
                                    onChange={(e) => handleCargaChange(index, 'cantidad', parseInt(e.target.value))} 
                                    className="w-full p-2 rounded-md border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    min="1"
                                />
                                <button type="button" onClick={() => handleRemoveCarga(index)} className="text-red-500"><TrashIcon/></button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddCarga} className="mt-2 text-sm text-green-700 font-medium hover:underline">+ Agregar Producto</button>
                    </div>
                </fieldset>

                {/* Sección Descarga (Vacíos) */}
                <fieldset className="border dark:border-gray-600 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/10">
                    <legend className="text-base font-semibold text-yellow-700 dark:text-yellow-300 px-2 flex items-center gap-2">
                        <ReplyIcon className="w-5 h-5"/> Descarga de Vacíos (Salida)
                    </legend>
                    <div className="space-y-2 mt-2">
                        {itemsDescarga.map((item, index) => (
                            <div key={index} className="grid grid-cols-[1fr,80px,auto] gap-2 items-center">
                                <SearchableSelect options={productosRetornables} value={item.productoId} onChange={(val) => handleDescargaChange(index, 'productoId', val)} placeholder="Envase..." />
                                <input 
                                    type="number" 
                                    value={item.cantidad} 
                                    onChange={(e) => handleDescargaChange(index, 'cantidad', parseInt(e.target.value))} 
                                    className="w-full p-2 rounded-md border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" 
                                    min="1"
                                />
                                <button type="button" onClick={() => handleRemoveDescarga(index)} className="text-red-500"><TrashIcon/></button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddDescarga} className="mt-2 text-sm text-yellow-700 font-medium hover:underline">+ Agregar Vacíos</button>
                    </div>
                </fieldset>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">Guardar Recarga</button>
            </div>
        </form>
    );
};

interface StockSummary {
    productoId: string;
    nombre: string;
    cargaTotal: number; // Inicial + Recargas
    ventas: number;
    devolucionesRemito: number; // Envases vacíos recuperados según remitos
    vaciosDescargados: number; // Envases vacíos bajados en fábrica
    stockTeorico: number; // Para productos llenos: CargaTotal - Ventas
    envasesTeoricos: number; // Envases en camión: Recuperados - Descargados
}

const PlanillaDetailModal: React.FC<{
    planilla: PlanillaDiaria;
    usuariosMap: Map<string, Usuario>;
    productosMap: Map<string, Producto>;
    remitos: Remito[];
    onClose: () => void;
    onUpdatePlanilla: (planilla: PlanillaDiaria) => void;
}> = ({ planilla, usuariosMap, productosMap, remitos, onClose, onUpdatePlanilla }) => {
    
    const isClosed = planilla.estado === EstadoPlanilla.CERRADA;
    const [observaciones, setObservaciones] = useState(planilla.observaciones || '');
    const [isRecargaOpen, setIsRecargaOpen] = useState(false);
    const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
    
    // Estado para guardar los inputs físicos (Auditoría)
    const [auditoria, setAuditoria] = useState<Record<string, { llenos: number, vacios: number }>>({});

    // 1. Calcular estadísticas teóricas
    const stats = useMemo(() => {
        const summary = new Map<string, StockSummary>();

        // Función helper para inicializar producto en resumen
        const initProd = (prodId: string) => {
            if (!summary.has(prodId)) {
                const prod = productosMap.get(prodId);
                summary.set(prodId, {
                    productoId: prodId,
                    nombre: prod?.nombre || 'Desconocido',
                    cargaTotal: 0,
                    ventas: 0,
                    devolucionesRemito: 0,
                    vaciosDescargados: 0,
                    stockTeorico: 0,
                    envasesTeoricos: 0
                });
            }
        };

        // A. Carga Inicial
        planilla.cargaInicial.forEach(item => {
            initProd(item.productoId);
            summary.get(item.productoId)!.cargaTotal += item.cantidad;
        });

        // B. Recargas (Entradas Llenos y Salidas Vacíos)
        if (planilla.recargas) {
            planilla.recargas.forEach(recarga => {
                // Sumar Productos Llenos
                recarga.items.forEach(item => {
                    initProd(item.productoId);
                    summary.get(item.productoId)!.cargaTotal += item.cantidad;
                });
                // Sumar Vacíos Descargados
                if (recarga.vaciosDescargados) {
                    recarga.vaciosDescargados.forEach(item => {
                        initProd(item.productoId);
                        summary.get(item.productoId)!.vaciosDescargados += item.cantidad;
                    });
                }
            });
        }

        // C. Procesar Ventas del Día (Remitos)
        const remitosDelDia = remitos.filter(r => 
            r.vendedorId === planilla.repartidorId && 
            r.fecha === planilla.fecha
        );

        remitosDelDia.forEach(remito => {
            remito.movimientos.forEach(mov => {
                initProd(mov.productoId);
                const current = summary.get(mov.productoId)!;
                current.ventas += mov.entregados;
                current.devolucionesRemito += mov.recibidos;
            });
        });

        // D. Calcular Teóricos Finales
        summary.forEach(item => {
            item.stockTeorico = item.cargaTotal - item.ventas;
            // Envases en camión = (Lo que recuperé de clientes) - (Lo que ya bajé en recargas)
            // Asumimos que el camión sale con 0 envases vacíos al inicio del día.
            item.envasesTeoricos = Math.max(0, item.devolucionesRemito - item.vaciosDescargados);
        });

        return Array.from(summary.values());
    }, [planilla, remitos, productosMap]);

    // 2. Inicializar estado de auditoría
    useEffect(() => {
        const initialAudit: Record<string, { llenos: number, vacios: number }> = {};
        
        stats.forEach(item => {
            if (isClosed && planilla.devolucion) {
                const saved = planilla.devolucion.find(d => d.productoId === item.productoId);
                initialAudit[item.productoId] = {
                    llenos: saved ? saved.cantidadLlenos : 0,
                    vacios: saved ? saved.cantidadVacios : 0
                };
            } else if (!auditoria[item.productoId]) {
                initialAudit[item.productoId] = {
                    llenos: item.stockTeorico > 0 ? item.stockTeorico : 0,
                    vacios: item.envasesTeoricos // Sugerir lo que debería haber
                };
            }
        });
        
        if (Object.keys(auditoria).length === 0 || isClosed) {
             setAuditoria(initialAudit);
        }
    }, [stats, isClosed, planilla.devolucion]);

    const handleAuditChange = (productoId: string, field: 'llenos' | 'vacios', value: string) => {
        if (isClosed) return;
        const numValue = parseInt(value) || 0;
        setAuditoria(prev => ({
            ...prev,
            [productoId]: { ...prev[productoId], [field]: numValue }
        }));
    };

    const confirmClosePlanilla = () => {
        const devolucionItems: ItemDevolucion[] = Object.entries(auditoria).map(([productoId, data]) => {
            const values = data as { llenos: number, vacios: number };
            return {
                productoId,
                cantidadLlenos: values.llenos,
                cantidadVacios: values.vacios
            };
        });

        const planillaCerrada: PlanillaDiaria = {
            ...planilla,
            estado: EstadoPlanilla.CERRADA,
            devolucion: devolucionItems,
            observaciones: observaciones
        };

        onUpdatePlanilla(planillaCerrada);
        setIsCloseConfirmOpen(false);
        onClose();
    };

    const handleRecargaSave = (itemsCarga: ItemStock[], itemsDescarga: ItemStock[]) => {
        const nuevaRecarga = {
            hora: new Date().toLocaleTimeString(),
            items: itemsCarga,
            vaciosDescargados: itemsDescarga
        };
        
        const updatedPlanilla = {
            ...planilla,
            recargas: [...(planilla.recargas || []), nuevaRecarga]
        };
        
        onUpdatePlanilla(updatedPlanilla);
        setIsRecargaOpen(false);
    };

    const totalVentas = stats.reduce((acc, curr) => acc + curr.ventas, 0);

    // Filter out products from list
    const productosList = Array.from(productosMap.values());

    return (
        <Modal isOpen={true} onClose={onClose} className="max-w-6xl">
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
                <div className="flex justify-between items-start border-b dark:border-gray-700 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                            {isClosed ? 'Auditoría de Cierre' : 'Cierre y Rendición de Stock'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Repartidor: <span className="font-semibold text-gray-800 dark:text-gray-200">{usuariosMap.get(planilla.repartidorId)?.nombre}</span>
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Fecha: {new Date(planilla.fecha + 'T00:00:00').toLocaleDateString()}
                        </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-1 ${
                            planilla.estado === EstadoPlanilla.ABIERTA 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                            {planilla.estado.toUpperCase()}
                        </span>
                        {!isClosed && (
                            <button 
                                onClick={() => setIsRecargaOpen(true)}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1 shadow-sm"
                            >
                                <CubeIcon className="h-3 w-3"/> Registrar Recarga
                            </button>
                        )}
                    </div>
                </div>

                {!isClosed && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                            <span className="text-lg">ℹ️</span> ¿Cómo realizar la rendición?
                        </h4>
                        <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400 space-y-2">
                            <li>
                                <strong>Columna 'Recuento (Real)':</strong> Cuente y anote la cantidad de productos <u>llenos</u> que quedaron en el camión.
                            </li>
                            <li>
                                <strong>Columna 'Env. Fís. (Vacíos)':</strong> Cuente y anote la cantidad total de envases <u>vacíos</u> que se bajan del camión.
                            </li>
                            <li>
                                El sistema calculará automáticamente las diferencias. Si todo coincide, los valores de "Balance" deben ser cero o estar en verde.
                            </li>
                        </ul>
                    </div>
                )}

                {isRecargaOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20 p-4">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl max-w-4xl w-full border dark:border-gray-700">
                            <RecargaForm productos={productosList} onSave={handleRecargaSave} onClose={() => setIsRecargaOpen(false)} />
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-2 py-3 rounded-tl-lg bg-gray-200 dark:bg-gray-800 sticky left-0 z-10">Producto</th>
                                <th className="px-2 py-3 text-center border-l dark:border-gray-600" title="Carga Inicial + Recargas">Carga Total</th>
                                <th className="px-2 py-3 text-center text-red-600 dark:text-red-400 border-l dark:border-gray-600" title="Ventas registradas">Ventas</th>
                                
                                {/* Sección Control Stock Lleno */}
                                <th className="px-2 py-3 text-center border-l-2 border-gray-400 dark:border-gray-500 bg-blue-50 dark:bg-blue-900/20" title="Stock Teórico = Carga - Ventas">Calculado (Sistema)</th>
                                <th className="px-2 py-3 text-center bg-blue-50 dark:bg-blue-900/20 text-blue-800 font-bold" title="Stock físico contado en camión">Recuento (Real)</th>
                                <th className="px-2 py-3 text-center bg-blue-50 dark:bg-blue-900/20">Balance</th>

                                {/* Sección Control Envases Vacíos */}
                                <th className="px-2 py-3 text-center border-l-2 border-gray-400 dark:border-gray-500 bg-yellow-50 dark:bg-yellow-900/20" title="Recuperados - Descargados">Env. Teor.</th>
                                <th className="px-2 py-3 text-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 font-bold" title="Envases físicos bajados del camión">Env. Fís. (Vacíos)</th>
                                <th className="px-2 py-3 text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-tr-lg">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((item) => {
                                const currentAudit = auditoria[item.productoId] || { llenos: 0, vacios: 0 };
                                const difLlenos = currentAudit.llenos - item.stockTeorico;
                                const difVacios = currentAudit.vacios - item.envasesTeoricos; 

                                return (
                                <tr key={item.productoId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50">
                                    <td className="px-2 py-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 min-w-[150px]">
                                        {item.nombre}
                                        {item.cargaTotal > item.cargaTotal - (planilla.recargas?.reduce((acc, r) => acc + (r.items.find(i=>i.productoId === item.productoId)?.cantidad || 0), 0) || 0) && (
                                            <span className="block text-[10px] text-green-600 font-normal">+ Recarga</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-center text-gray-500 border-l dark:border-gray-600">
                                        {item.cargaTotal}
                                    </td>
                                    <td className="px-2 py-3 text-center text-red-600 dark:text-red-400 border-l dark:border-gray-600 font-bold">
                                        {item.ventas}
                                    </td>

                                    {/* Control Llenos */}
                                    <td className="px-2 py-3 text-center border-l-2 border-gray-300 dark:border-gray-600 bg-blue-50/50 dark:bg-blue-900/10 font-bold text-blue-700 dark:text-blue-300">
                                        {item.stockTeorico}
                                    </td>
                                    <td className="px-2 py-3 text-center bg-blue-50/50 dark:bg-blue-900/10">
                                        <input 
                                            type="number" 
                                            value={currentAudit.llenos}
                                            onChange={(e) => handleAuditChange(item.productoId, 'llenos', e.target.value)}
                                            className={`w-20 p-1 text-center font-bold border rounded focus:ring-2 focus:ring-blue-500 ${isClosed ? 'bg-transparent border-none' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-800 dark:text-blue-200'}`}
                                            disabled={isClosed}
                                        />
                                    </td>
                                    <td className={`px-2 py-3 text-center font-bold bg-blue-50/50 dark:bg-blue-900/10 ${difLlenos < 0 ? 'text-red-600' : (difLlenos > 0 ? 'text-green-600' : 'text-gray-400')}`}>
                                        {difLlenos === 0 ? 'OK' : (difLlenos > 0 ? `+${difLlenos}` : difLlenos)}
                                    </td>

                                    {/* Control Vacíos */}
                                    <td className="px-2 py-3 text-center border-l-2 border-gray-300 dark:border-gray-600 bg-yellow-50/50 dark:bg-yellow-900/10 font-bold text-yellow-700 dark:text-yellow-300">
                                        {item.envasesTeoricos}
                                        {item.vaciosDescargados > 0 && <span className="block text-[10px] text-gray-400 font-normal">(-{item.vaciosDescargados} desc)</span>}
                                    </td>
                                    <td className="px-2 py-3 text-center bg-yellow-50/50 dark:bg-yellow-900/10">
                                        <input 
                                            type="number" 
                                            value={currentAudit.vacios}
                                            onChange={(e) => handleAuditChange(item.productoId, 'vacios', e.target.value)}
                                            className={`w-20 p-1 text-center font-bold border rounded focus:ring-2 focus:ring-yellow-500 ${isClosed ? 'bg-transparent border-none' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-yellow-800 dark:text-yellow-200'}`}
                                            disabled={isClosed}
                                        />
                                    </td>
                                    <td className={`px-2 py-3 text-center font-bold bg-yellow-50/50 dark:bg-yellow-900/10 ${difVacios < 0 ? 'text-red-600' : (difVacios > 0 ? 'text-green-600' : 'text-gray-400')}`}>
                                        {difVacios === 0 ? 'OK' : (difVacios > 0 ? `+${difVacios}` : difVacios)}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones del Cierre</label>
                    <textarea 
                        className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-md border dark:border-gray-600" 
                        rows={3}
                        placeholder="Anotar roturas, faltantes o incidencias..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        disabled={isClosed}
                    />
                </div>

                <div className="flex justify-end pt-4 gap-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400">
                        {isClosed ? 'Cerrar Vista' : 'Cancelar'}
                    </button>
                    {!isClosed && (
                        <button 
                            onClick={() => setIsCloseConfirmOpen(true)} 
                            className="px-6 py-2 rounded-md bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg"
                        >
                            Cerrar Planilla y Auditar
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de Confirmación de Cierre */}
            {isCloseConfirmOpen && (
                <Modal isOpen={true} onClose={() => setIsCloseConfirmOpen(false)} className="max-w-md">
                    <div className="text-center p-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
                            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cerrar Planilla Definitivamente?</h3>
                        <p className="text-gray-500 dark:text-gray-300 text-sm mb-6">
                            Esta acción guardará los stocks físicos y calculará las diferencias finales. 
                            <br/><br/>
                            <strong>No podrá modificar estos datos una vez cerrada.</strong>
                        </p>
                        <div className="flex justify-center gap-3">
                            <button 
                                onClick={() => setIsCloseConfirmOpen(false)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300"
                            >
                                Volver a revisar
                            </button>
                            <button 
                                onClick={confirmClosePlanilla}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-bold"
                            >
                                Sí, Cerrar Planilla
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

const PlanillasView: React.FC<PlanillasViewProps> = ({ planillas, usuarios, productos, remitos, addPlanilla, updatePlanilla }) => {
  const { showNotification } = useNotification();
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingPlanilla, setViewingPlanilla] = useState<PlanillaDiaria | null>(null);

  const usuariosMap = useMemo(() => new Map(usuarios.map(u => [u.id, u])), [usuarios]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const filteredPlanillas = useMemo(() => {
      return planillas.filter(p => p.fecha === filterDate);
  }, [planillas, filterDate]);

  const handleCreatePlanilla = (newPlanilla: Omit<PlanillaDiaria, 'id'>) => {
      const exists = planillas.some(p => p.fecha === newPlanilla.fecha && p.repartidorId === newPlanilla.repartidorId);
      if (exists) {
          showNotification('Ya existe una planilla para este repartidor en la fecha seleccionada.', 'error');
          return;
      }
      
      addPlanilla(newPlanilla);
      setIsFormOpen(false);
      showNotification('Planilla abierta correctamente.', 'success');
  };

  const handleUpdatePlanilla = (planilla: PlanillaDiaria) => {
      updatePlanilla(planilla);
      showNotification('Planilla actualizada correctamente.', 'success');
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Control de Stock y Reparto</h1>
        <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">
          + Nueva Planilla
        </button>
      </div>

      <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <label className="font-medium text-gray-700 dark:text-gray-300">Fecha:</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)} 
            className="p-2 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600"
          />
      </div>

      <Card>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                          <th className="px-6 py-3">Repartidor</th>
                          <th className="px-6 py-3 text-center">Estado</th>
                          <th className="px-6 py-3">Resumen Carga Inicial</th>
                          <th className="px-6 py-3 text-right">Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredPlanillas.map(planilla => (
                          <tr key={planilla.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  {usuariosMap.get(planilla.repartidorId)?.nombre || 'Desconocido'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      planilla.estado === EstadoPlanilla.ABIERTA 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}>
                                      {planilla.estado}
                                  </span>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-1">
                                      {planilla.cargaInicial.map((item, idx) => {
                                          const prod = productosMap.get(item.productoId);
                                          if (!prod) return null;
                                          return (
                                              <span key={idx} className="bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-100 dark:border-blue-800">
                                                  {item.cantidad} x {prod.nombre}
                                              </span>
                                          );
                                      })}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => setViewingPlanilla(planilla)}
                                    className={`font-medium ${
                                        planilla.estado === EstadoPlanilla.ABIERTA 
                                        ? 'text-blue-600 hover:underline' 
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                  >
                                      {planilla.estado === EstadoPlanilla.ABIERTA ? 'Auditar / Cerrar' : 'Ver Detalle'}
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredPlanillas.length === 0 && (
                          <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                  No hay planillas registradas para esta fecha.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </Card>

      {isFormOpen && (
          <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
              <PlanillaForm 
                  usuarios={usuarios} 
                  productos={productos} 
                  onSave={handleCreatePlanilla} 
                  onClose={() => setIsFormOpen(false)} 
              />
          </Modal>
      )}

      {viewingPlanilla && (
          <PlanillaDetailModal 
              planilla={viewingPlanilla} 
              usuariosMap={usuariosMap} 
              productosMap={productosMap}
              remitos={remitos}
              onClose={() => setViewingPlanilla(null)} 
              onUpdatePlanilla={handleUpdatePlanilla}
          />
      )}
    </div>
  );
};

export default PlanillasView;
