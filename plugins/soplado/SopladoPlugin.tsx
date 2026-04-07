
import React, { useState } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import AppSelect from '../../components/ui/AppSelect';
import Modal from '../../components/Modal';
import { Preforma, Molde, ProduccionSoplado, EntregaSoplado, InsumoSoplado } from './types';
import { Rol } from '../../types';

const SopladoPlugin: React.FC = () => {
    const { 
        preformas, moldes, produccionSoplado, entregasSoplado, productos, clientes, insumosSoplado,
        addPreforma, updatePreforma, deletePreforma,
        addMolde, updateMolde, deleteMolde,
        addInsumoSoplado, updateInsumoSoplado, deleteInsumoSoplado,
        addProduccionSoplado, deleteProduccionSoplado,
        addEntregaSoplado, deleteEntregaSoplado,
        empresaSettings
    } = useDataStore();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'inventario' | 'produccion' | 'logistica'>('produccion');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'preforma' | 'molde' | 'produccion' | 'entrega' | 'insumo' | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    const isAdmin = user?.rol === Rol.ADMINISTRADOR;

    // --- FORM STATES ---
    const [preformaForm, setPreformaForm] = useState<Partial<Preforma>>({ color: '', peso: 0, material: 'PET', stockActual: 0, puntoReposicion: 0 });
    const [moldeForm, setMoldeForm] = useState<Partial<Molde>>({ nombre: '', litros: 0, preformaId: '' });
    const [insumoForm, setInsumoForm] = useState<Partial<InsumoSoplado>>({ nombre: '', stockActual: 0, puntoReposicion: 0 });
    const [produccionForm, setProduccionForm] = useState<Partial<ProduccionSoplado>>({ fecha: new Date().toISOString().split('T')[0], moldeId: '', cantidadProducida: 0, merma: 0 });
    const [entregaForm, setEntregaForm] = useState<Partial<EntregaSoplado>>({ fecha: new Date().toISOString().split('T')[0], moldeId: '', destino: 'PLANTA', cantidad: 0, insumos: [] });

    const openModal = (type: 'preforma' | 'molde' | 'produccion' | 'entrega' | 'insumo', item?: any) => {
        setModalType(type);
        setEditingItem(item || null);
        if (item) {
            if (type === 'preforma') setPreformaForm(item);
            if (type === 'molde') setMoldeForm(item);
            if (type === 'insumo') setInsumoForm(item);
            if (type === 'produccion') setProduccionForm(item);
            if (type === 'entrega') setEntregaForm(item);
        } else {
            if (type === 'preforma') setPreformaForm({ color: '', peso: 0, material: 'PET', stockActual: 0, puntoReposicion: 0 });
            if (type === 'molde') setMoldeForm({ nombre: '', litros: 0, preformaId: '' });
            if (type === 'insumo') setInsumoForm({ nombre: '', stockActual: 0, puntoReposicion: 0 });
            if (type === 'produccion') setProduccionForm({ fecha: new Date().toISOString().split('T')[0], moldeId: '', cantidadProducida: 0, merma: 0 });
            if (type === 'entrega') setEntregaForm({ fecha: new Date().toISOString().split('T')[0], moldeId: '', destino: 'PLANTA', cantidad: 0, insumos: [] });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (modalType === 'preforma') {
            if (editingItem) await updatePreforma({ ...editingItem, ...preformaForm } as Preforma);
            else await addPreforma(preformaForm as Preforma);
        } else if (modalType === 'molde') {
            if (editingItem) await updateMolde({ ...editingItem, ...moldeForm } as Molde);
            else await addMolde(moldeForm as Molde);
        } else if (modalType === 'insumo') {
            if (editingItem) await updateInsumoSoplado({ ...editingItem, ...insumoForm } as InsumoSoplado);
            else await addInsumoSoplado(insumoForm as InsumoSoplado);
        } else if (modalType === 'produccion') {
            await addProduccionSoplado({ ...produccionForm, operadorId: user?.id || '' } as ProduccionSoplado);
        } else if (modalType === 'entrega') {
            await addEntregaSoplado(entregaForm as EntregaSoplado);
        }
        setIsModalOpen(false);
    };

    const renderInventario = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">Preformas</h3>
                <AppButton size="sm" onClick={() => openModal('preforma')}>+ Nueva</AppButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {preformas.map(p => (
                    <Card key={p.id}>
                        <div className="flex justify-between">
                            <div>
                                <p className="font-bold text-primary-600">{p.color} - {p.peso}g</p>
                                <p className="text-sm text-gray-500">{p.material}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-xl font-black ${p.stockActual <= p.puntoReposicion ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                                    {p.stockActual}
                                </p>
                                <p className="text-[10px] uppercase text-gray-400">Stock Actual</p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <AppButton variant="secondary" size="sm" className="flex-1" onClick={() => openModal('preforma', p)}>Editar</AppButton>
                            {isAdmin && <AppButton variant="danger" size="sm" onClick={() => deletePreforma(p.id)}>Eliminar</AppButton>}
                        </div>
                    </Card>
                ))}
            </div>

            <div className="flex justify-between items-center mt-8">
                <h3 className="text-lg font-bold dark:text-white">Moldes</h3>
                <AppButton size="sm" onClick={() => openModal('molde')}>+ Nuevo</AppButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {moldes.map(m => (
                    <Card key={m.id}>
                        <p className="font-bold text-gray-800 dark:text-white">{m.nombre}</p>
                        <p className="text-sm text-gray-500">{m.litros} Litros</p>
                        <p className="text-xs text-gray-400 mt-1">Preforma: {preformas.find(p => p.id === m.preformaId)?.color || 'N/A'}</p>
                        <div className="mt-4 flex gap-2">
                            <AppButton variant="secondary" size="sm" className="flex-1" onClick={() => openModal('molde', m)}>Editar</AppButton>
                            {isAdmin && <AppButton variant="danger" size="sm" onClick={() => deleteMolde(m.id)}>Eliminar</AppButton>}
                        </div>
                    </Card>
                ))}
            </div>

            <div className="flex justify-between items-center mt-8">
                <h3 className="text-lg font-bold dark:text-white">Insumos Asociados (Tapas, Manijas)</h3>
                <AppButton size="sm" onClick={() => openModal('insumo')}>+ Nuevo</AppButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insumosSoplado.map(i => (
                    <Card key={i.id}>
                        <div className="flex justify-between">
                            <div>
                                <p className="font-bold text-primary-600">{i.nombre}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-xl font-black ${i.stockActual <= i.puntoReposicion ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                                    {i.stockActual}
                                </p>
                                <p className="text-[10px] uppercase text-gray-400">Stock Actual</p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <AppButton variant="secondary" size="sm" className="flex-1" onClick={() => openModal('insumo', i)}>Editar</AppButton>
                            {isAdmin && <AppButton variant="danger" size="sm" onClick={() => deleteInsumoSoplado(i.id)}>Eliminar</AppButton>}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );

    const renderProduccion = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">Producción Diaria</h3>
                <AppButton onClick={() => openModal('produccion')}>+ Cargar Soplado</AppButton>
            </div>
            <div className="space-y-2">
                {produccionSoplado.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(p => (
                    <div key={p.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <p className="font-bold dark:text-white">{moldes.find(m => m.id === p.moldeId)?.nombre || 'Molde Desconocido'}</p>
                            <p className="text-xs text-gray-500">{p.fecha}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black text-green-600">+{p.cantidadProducida}</p>
                            {p.merma > 0 && <p className="text-xs text-red-400">Merma: {p.merma}</p>}
                        </div>
                        {isAdmin && (
                            <button onClick={() => deleteProduccionSoplado(p.id)} className="ml-4 text-red-500 hover:text-red-700">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderLogistica = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">Entregas y Salidas</h3>
                <AppButton onClick={() => openModal('entrega')}>+ Registrar Entrega</AppButton>
            </div>
            <div className="space-y-2">
                {entregasSoplado.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(e => (
                    <div key={e.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <p className="font-bold dark:text-white">{moldes.find(m => m.id === e.moldeId)?.nombre || 'Molde Desconocido'}</p>
                            <p className="text-xs text-gray-500">Destino: <span className="font-bold text-primary-600">{e.destino === 'PLANTA' ? 'PLANTA INTERNA' : (clientes.find(c => c.id === e.destino)?.nombre || e.destino)}</span></p>
                            <p className="text-[10px] text-gray-400">{e.fecha}</p>
                            {e.insumos && e.insumos.length > 0 && (
                                <div className="mt-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Insumos:</p>
                                    {e.insumos.map((ins, idx) => (
                                        <p key={idx} className="text-xs text-gray-500">
                                            {insumosSoplado.find(i => i.id === ins.insumoId)?.nombre || 'Insumo'} x {ins.cantidad}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black text-blue-600">-{e.cantidad}</p>
                        </div>
                        {isAdmin && (
                            <button onClick={() => deleteEntregaSoplado(e.id)} className="ml-4 text-red-500 hover:text-red-700">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-4 w-full pb-24">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary-600 rounded-2xl shadow-lg shadow-primary-500/30">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white">Soplado de Bidones</h1>
                    <p className="text-sm text-gray-500">Gestión de producción y stock de descartables</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setActiveTab('produccion')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'produccion' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
                >
                    Producción
                </button>
                <button 
                    onClick={() => setActiveTab('logistica')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'logistica' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
                >
                    Logística
                </button>
                <button 
                    onClick={() => setActiveTab('inventario')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'inventario' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
                >
                    Inventario
                </button>
            </div>

            {activeTab === 'inventario' && renderInventario()}
            {activeTab === 'produccion' && renderProduccion()}
            {activeTab === 'logistica' && renderLogistica()}

            {/* Modal de Carga (Mobile First) */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingItem ? 'Editar Registro' : `Nuevo Registro de ${modalType}`}
            >
                <div className="space-y-4">
                    {modalType === 'preforma' && (
                        <>
                            <AppInput label="Color" value={preformaForm.color} onChange={e => setPreformaForm({...preformaForm, color: e.target.value})} placeholder="Ej: Azul, Cristal" />
                            <div className="grid grid-cols-2 gap-4">
                                <AppInput label="Peso (gr)" type="number" value={preformaForm.peso} onChange={e => setPreformaForm({...preformaForm, peso: Number(e.target.value)})} />
                                <AppInput label="Material" value={preformaForm.material} onChange={e => setPreformaForm({...preformaForm, material: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <AppInput label="Stock Inicial" type="number" value={preformaForm.stockActual} onChange={e => setPreformaForm({...preformaForm, stockActual: Number(e.target.value)})} />
                                <AppInput label="Punto Reposición" type="number" value={preformaForm.puntoReposicion} onChange={e => setPreformaForm({...preformaForm, puntoReposicion: Number(e.target.value)})} />
                            </div>
                        </>
                    )}

                    {modalType === 'molde' && (
                        <>
                            <AppInput label="Nombre del Molde" value={moldeForm.nombre} onChange={e => setMoldeForm({...moldeForm, nombre: e.target.value})} placeholder="Ej: Bidón 5L Reforzado" />
                            <AppInput label="Capacidad (Litros)" type="number" value={moldeForm.litros} onChange={e => setMoldeForm({...moldeForm, litros: Number(e.target.value)})} />
                            <AppSelect 
                                label="Preforma que utiliza" 
                                value={moldeForm.preformaId} 
                                onChange={e => setMoldeForm({...moldeForm, preformaId: e.target.value})}
                                options={[
                                    { value: '', label: 'Seleccionar preforma' },
                                    ...preformas.map(p => ({ value: p.id, label: `${p.color} - ${p.peso}g` }))
                                ]}
                            />
                        </>
                    )}

                    {modalType === 'insumo' && (
                        <>
                            <AppInput label="Nombre del Insumo" value={insumoForm.nombre} onChange={e => setInsumoForm({...insumoForm, nombre: e.target.value})} placeholder="Ej: Tapas, Manijas" />
                            <div className="grid grid-cols-2 gap-4">
                                <AppInput label="Stock Inicial" type="number" value={insumoForm.stockActual} onChange={e => setInsumoForm({...insumoForm, stockActual: Number(e.target.value)})} />
                                <AppInput label="Punto Reposición" type="number" value={insumoForm.puntoReposicion} onChange={e => setInsumoForm({...insumoForm, puntoReposicion: Number(e.target.value)})} />
                            </div>
                        </>
                    )}

                    {modalType === 'produccion' && (
                        <>
                            <AppInput label="Fecha" type="date" value={produccionForm.fecha} onChange={e => setProduccionForm({...produccionForm, fecha: e.target.value})} />
                            <AppSelect 
                                label="Molde / Producto" 
                                value={produccionForm.moldeId} 
                                onChange={e => setProduccionForm({...produccionForm, moldeId: e.target.value})}
                                options={[
                                    { value: '', label: 'Seleccionar molde' },
                                    ...moldes.map(m => ({ value: m.id, label: m.nombre }))
                                ]}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Cantidad Producida</label>
                                    <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <button onClick={() => setProduccionForm(f => ({...f, cantidadProducida: Math.max(0, (f.cantidadProducida || 0) - 10)}))} className="p-3 text-primary-600 font-bold">-10</button>
                                        <input type="number" className="w-full bg-transparent text-center font-bold dark:text-white" value={produccionForm.cantidadProducida} onChange={e => setProduccionForm({...produccionForm, cantidadProducida: Number(e.target.value)})} />
                                        <button onClick={() => setProduccionForm(f => ({...f, cantidadProducida: (f.cantidadProducida || 0) + 10}))} className="p-3 text-primary-600 font-bold">+10</button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Merma (Descarte)</label>
                                    <AppInput type="number" value={produccionForm.merma} onChange={e => setProduccionForm({...produccionForm, merma: Number(e.target.value)})} />
                                </div>
                            </div>
                        </>
                    )}

                    {modalType === 'entrega' && (
                        <>
                            <AppInput label="Fecha" type="date" value={entregaForm.fecha} onChange={e => setEntregaForm({...entregaForm, fecha: e.target.value})} />
                            <AppSelect 
                                label="Producto a entregar" 
                                value={entregaForm.moldeId} 
                                onChange={e => setEntregaForm({...entregaForm, moldeId: e.target.value})}
                                options={[
                                    { value: '', label: 'Seleccionar producto' },
                                    ...moldes.map(m => ({ value: m.id, label: m.nombre }))
                                ]}
                            />
                            <AppSelect 
                                label="Destino" 
                                value={entregaForm.destino} 
                                onChange={e => setEntregaForm({...entregaForm, destino: e.target.value})}
                                options={[
                                    { value: 'PLANTA', label: 'PLANTA INTERNA (Llenado)' },
                                    ...clientes.map(c => ({ value: c.id, label: c.nombre }))
                                ]}
                            />
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 ml-1">Cantidad</label>
                                <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                                    <button onClick={() => setEntregaForm(f => ({...f, cantidad: Math.max(0, (f.cantidad || 0) - 50)}))} className="p-3 text-primary-600 font-bold">-50</button>
                                    <input type="number" className="w-full bg-transparent text-center font-bold dark:text-white" value={entregaForm.cantidad} onChange={e => setEntregaForm({...entregaForm, cantidad: Number(e.target.value)})} />
                                    <button onClick={() => setEntregaForm(f => ({...f, cantidad: (f.cantidad || 0) + 50}))} className="p-3 text-primary-600 font-bold">+50</button>
                                </div>
                            </div>
                            
                            {/* Insumos Asociados */}
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <label className="text-sm font-bold text-gray-800 dark:text-white mb-2 block">Insumos Asociados (Opcional)</label>
                                {entregaForm.insumos?.map((ins, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2 items-center">
                                        <div className="flex-1">
                                            <AppSelect 
                                                value={ins.insumoId} 
                                                onChange={e => {
                                                    const newInsumos = [...(entregaForm.insumos || [])];
                                                    newInsumos[idx].insumoId = e.target.value;
                                                    setEntregaForm({...entregaForm, insumos: newInsumos});
                                                }}
                                                options={[
                                                    { value: '', label: 'Seleccionar insumo' },
                                                    ...insumosSoplado.map(i => ({ value: i.id, label: i.nombre }))
                                                ]}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <AppInput 
                                                type="number" 
                                                value={ins.cantidad} 
                                                onChange={e => {
                                                    const newInsumos = [...(entregaForm.insumos || [])];
                                                    newInsumos[idx].cantidad = Number(e.target.value);
                                                    setEntregaForm({...entregaForm, insumos: newInsumos});
                                                }} 
                                            />
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newInsumos = [...(entregaForm.insumos || [])];
                                                newInsumos.splice(idx, 1);
                                                setEntregaForm({...entregaForm, insumos: newInsumos});
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                                <AppButton 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => setEntregaForm({...entregaForm, insumos: [...(entregaForm.insumos || []), { insumoId: '', cantidad: 0 }]})}
                                >
                                    + Agregar Insumo
                                </AppButton>
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex gap-3">
                        <AppButton variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</AppButton>
                        <AppButton className="flex-1" onClick={handleSave}>Guardar</AppButton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SopladoPlugin;
