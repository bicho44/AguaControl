
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Remito, Cliente, Usuario, PagoDetalle, RegistroPago, Rol, TipoVendedor } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import AppInput from '../components/ui/AppInput'; // Requerido para ReassignModal
import { CogIcon } from '../components/icons/CogIcon';
import RemitoForm from '../components/RemitoForm';

type PaymentStatus = 'facturado' | 'pagado' | 'pagado_parcial' | 'pendiente' | 'gratis' | 'ajuste';
type PaymentStatusFilter = 'todos' | 'pendiente' | 'pagado' | 'facturado' | 'ajuste';

interface RemitosViewProps {
  remitos: Remito[];
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: any[];
  registrosPago: RegistroPago[];
  currentUser: Usuario;
  addRemito: (remito: Omit<Remito, 'id' | 'pagoIds' | 'facturaId'> & { pagos?: PagoDetalle[] }) => Promise<void>;
  updateRemito: (remito: Remito & { pagos?: PagoDetalle[] }) => Promise<void>;
  deleteRemito: (remitoId: string) => Promise<void>;
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'>) => Promise<string>; 
}

const ShortcutsHelp: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
            <div className="p-4">
                <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                    <span className="bg-gray-200 dark:bg-gray-700 rounded px-2 py-1 text-sm">⌘</span> Atajos de Teclado
                </h3>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-300">Nuevo Remito</span>
                        <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono font-bold border dark:border-gray-600 text-xs">Alt + N</kbd>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-300">Guardar Remito</span>
                        <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono font-bold border dark:border-gray-600 text-xs">Ctrl + Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-300">Agregar Producto</span>
                        <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono font-bold border dark:border-gray-600 text-xs">Alt + I</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-300">Agregar Pago</span>
                        <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono font-bold border dark:border-gray-600 text-xs">Alt + P</kbd>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <p className="text-[10px] text-gray-400">En Mac, 'Alt' corresponde a la tecla 'Option' (⌥).</p>
                </div>
            </div>
        </Modal>
    );
};

const ReassignModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    vendedores: Usuario[];
    remitos: Remito[];
    onReassign: (remitoIds: string[], newVendedorId: string) => Promise<void>;
}> = ({ isOpen, onClose, vendedores, remitos, onReassign }) => {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [oldVendedorId, setOldVendedorId] = useState('');
    const [newVendedorId, setNewVendedorId] = useState('');
    const [excludeAdjustments, setExcludeAdjustments] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const affectedRemitos = useMemo(() => {
        if (!fromDate || !toDate || !newVendedorId) return [];
        const start = new Date(fromDate + 'T00:00:00').getTime();
        const end = new Date(toDate + 'T23:59:59').getTime();
        
        return remitos.filter(r => {
            const d = new Date(r.fecha + 'T00:00:00').getTime();
            const dateMatch = d >= start && d <= end;
            const vendorMatch = !oldVendedorId || r.vendedorId === oldVendedorId;
            
            const isAdjustment = !!r.esAjuste || (r.numero && r.numero.toString().startsWith('INI'));
            if (excludeAdjustments && isAdjustment) return false;

            return dateMatch && vendorMatch && r.vendedorId !== newVendedorId;
        });
    }, [remitos, fromDate, toDate, oldVendedorId, newVendedorId, excludeAdjustments]);

    const handleConfirm = async () => {
        setIsProcessing(true);
        await onReassign(affectedRemitos.map(r => r.id), newVendedorId);
        setIsProcessing(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
            <div className="space-y-4">
                <h2 className="text-xl font-black uppercase text-primary-600">Herramienta de Corrección Masiva</h2>
                <p className="text-xs text-gray-500">Reasigna remitos de un vendedor a otro en un rango de fechas.</p>
                
                <div className="grid grid-cols-2 gap-4">
                    <AppInput type="date" label="Desde" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    <AppInput type="date" label="Hasta" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>

                <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Filtros de Vendedor</p>
                    <AppSelect 
                        label="Vendedor Original (Opcional)" 
                        value={oldVendedorId} 
                        onChange={e => setOldVendedorId(e.target.value)} 
                        options={[{value: '', label: 'Cualquiera'}, ...vendedores.map(v => ({value: v.id, label: v.nombre}))]} 
                    />
                    <AppSelect 
                        label="NUEVO Vendedor Asignado" 
                        value={newVendedorId} 
                        onChange={e => setNewVendedorId(e.target.value)} 
                        options={[{value: '', label: 'Seleccionar...'}, ...vendedores.map(v => ({value: v.id, label: v.nombre}))]} 
                    />
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input 
                        type="checkbox" 
                        id="excludeAdj" 
                        checked={excludeAdjustments} 
                        onChange={e => setExcludeAdjustments(e.target.checked)} 
                        className="w-4 h-4 text-primary-600 rounded"
                    />
                    <label htmlFor="excludeAdj" className="text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                        Excluir Cargas Iniciales (Importaciones)
                        <br/><span className="text-[10px] font-normal text-gray-400">Ignora remitos tipo "INI-XXXX" o ajustes de stock.</span>
                    </label>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-sm font-bold text-yellow-800 text-center">
                        {affectedRemitos.length > 0 ? `Se actualizarán ${affectedRemitos.length} remitos.` : 'No hay remitos que coincidan.'}
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton onClick={handleConfirm} disabled={affectedRemitos.length === 0 || isProcessing} isLoading={isProcessing}>Aplicar Cambios</AppButton>
                </div>
            </div>
        </Modal>
    );
};

const PaymentStatusBadge: React.FC<{ remito: any }> = ({ remito }) => {
    if (remito.esAjuste) return <span className="font-bold text-[10px] uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Carga Inicial</span>;
    switch (remito.paymentStatus) {
        case 'facturado': return <span className="font-bold text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">Facturado</span>;
        case 'pagado': return <span className="font-bold text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">Pagado</span>;
        case 'pagado_parcial': return <span className="font-bold text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">Parcial</span>;
        default: return <span className="font-bold text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full">Pendiente</span>;
    }
}

const RemitosView: React.FC<RemitosViewProps> = ({ remitos, clientes, vendedores, productos, registrosPago, currentUser, addRemito, updateRemito, deleteRemito, addCliente }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRemito, setEditingRemito] = useState<any>(null);
  const [clienteFilter, setClienteFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('todos');
  const [expandedRemitoId, setExpandedRemitoId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [formInstanceId, setFormInstanceId] = useState(0);
  const [remitoParaBorrar, setRemitoParaBorrar] = useState<Remito | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  
  // Filtrar clientes si es vendedor externo
  const visibleClientes = useMemo(() => {
      if (currentUser.tipo === TipoVendedor.EXTERNO) {
          // AHORA FILTRAMOS POR CREADOR (lógica nueva)
          return clientes.filter(c => c.creadoPor === currentUser.id);
      }
      return clientes;
  }, [clientes, currentUser]);

  const filterClienteOptions = useMemo(() => {
    return [{value: "", label: "Todos"}, ...visibleClientes.map(c=>({value:c.id, label:c.nombre}))];
  }, [visibleClientes]);
  
  const pagosMap = useMemo(() => {
      const map = new Map<string, RegistroPago[]>();
      registrosPago.forEach(pago => {
          if (pago.origen.tipo === 'remito') {
              const remitoId = pago.origen.id;
              if (!map.has(remitoId)) map.set(remitoId, []);
              map.get(remitoId)!.push(pago);
          }
      });
      return map;
  }, [registrosPago]);

  const getRemitoTotal = useCallback((r: Remito) => {
    if (r.esAjuste) return 0;
    const c = clientesMap.get(r.clienteId);
    if (!c) return 0;
    const peMap = new Map(c.preciosEspeciales?.map(p => [p.productoId, p.precio]));
    return r.movimientos.reduce((total, mov) => {
        const prod = productosMap.get(mov.productoId);
        if (!prod) return total;
        return total + (mov.entregados * (peMap.get(mov.productoId) ?? prod.precio));
    }, 0);
  }, [clientesMap, productosMap]);

  const processedRemitos = useMemo(() => {
    return remitos.map(r => {
      const pagos = pagosMap.get(r.id) || [];
      const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
      const totalRemito = getRemitoTotal(r);
      const cliente = clientesMap.get(r.clienteId);
      let status: PaymentStatus = 'pendiente';
      if (r.esAjuste) status = 'ajuste';
      else if (cliente?.tieneCuentaCorriente) status = r.facturaId ? 'facturado' : 'pendiente';
      else { const deuda = totalRemito - totalPagado; if (totalRemito <= 0.01) status = 'gratis'; else if (deuda <= 0.01) status = 'pagado'; else if (totalPagado > 0) status = 'pagado_parcial'; }
      return { ...r, totalPagado, totalRemito, paymentStatus: status, canBeDeleted: !r.pagoIds?.length && !r.facturaId, canBeEdited: !r.facturaId };
    });
  }, [remitos, pagosMap, getRemitoTotal, clientesMap]);

  const filteredRemitos = useMemo(() => {
    return processedRemitos.filter(r => {
        if (currentUser.rol === Rol.REPARTIDOR && r.vendedorId !== currentUser.id) return false;
        if (clienteFilter && r.clienteId !== clienteFilter) return false;
        if (paymentStatusFilter !== 'todos' && r.paymentStatus !== paymentStatusFilter) return false;
        return true;
    }).sort((a, b) => {
        const dateA = new Date(a.fecha).getTime();
        const dateB = new Date(b.fecha).getTime();
        if (dateB !== dateA) return dateB - dateA;
        const ptoA = parseInt(a.puntoVenta) || 0;
        const ptoB = parseInt(b.puntoVenta) || 0;
        if (ptoB !== ptoA) return ptoB - ptoA;
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numB - numA;
    });
  }, [processedRemitos, clienteFilter, paymentStatusFilter, currentUser]);

  const handleSave = async (r: any) => {
    try {
      if (r.id) {
          await updateRemito(r);
          showNotification('Actualizado.', 'success');
          setIsFormOpen(false);
      } else {
          await addRemito(r);
          showNotification('Guardado.', 'success');
          
          if (currentUser.rol === Rol.ADMINISTRADOR) {
              const nextNum = (parseInt(r.numero) || 0) + 1;
              setEditingRemito({ 
                fecha: r.fecha,
                puntoVenta: r.puntoVenta, 
                numero: nextNum.toString(), 
                movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }], 
                pagos: [], 
                vendedorId: currentUser.id 
              });
              setFormInstanceId(prev => prev + 1);
          } else {
              setIsFormOpen(false);
          }
      }
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const handleReassign = async (remitoIds: string[], newVendorId: string) => {
      try {
          const promises = remitoIds.map(id => {
              const remito = remitos.find(r => r.id === id);
              if (remito) return updateRemito({ ...remito, vendedorId: newVendorId });
              return Promise.resolve();
          });
          await Promise.all(promises);
          showNotification('Remitos reasignados con éxito.', 'success');
      } catch (e) {
          showNotification('Error al reasignar.', 'error');
      }
  };

  const openNewModal = useCallback(() => {
    const lastRemito = [...remitos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
    const defaultPto = lastRemito?.puntoVenta || '1';

    setEditingRemito({ 
      fecha: new Date().toISOString().split('T')[0], 
      puntoVenta: defaultPto, 
      numero: '', 
      movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }], 
      pagos: [], 
      vendedorId: currentUser.id 
    });
    setFormInstanceId(prev => prev + 1);
    setIsFormOpen(true);
  }, [remitos, currentUser]);

  const handleAddClienteWrapper = async (c: any) => {
      if(!addCliente) return "";
      return await addCliente({ ...c, creadoPor: currentUser.id }); // IMPORTANTE: Pasamos el creador
  }

  useEffect(() => {
      const handleGlobalKeys = (e: KeyboardEvent) => {
          if (e.altKey && (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') && !isFormOpen) {
              e.preventDefault();
              openNewModal();
          }
      };
      window.addEventListener('keydown', handleGlobalKeys);
      return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isFormOpen, openNewModal]);

  const handleDeleteConfirm = async () => {
      if (!remitoParaBorrar) return;
      try {
          await deleteRemito(remitoParaBorrar.id);
          showNotification('Remito eliminado.', 'success');
          setRemitoParaBorrar(null);
      } catch (e) {
          showNotification('Error al eliminar.', 'error');
      }
  };

  if (isFormOpen) return (
    <div className="animate-fade-in relative">
        <div className="mb-6 flex items-center gap-4">
            <button onClick={() => setIsFormOpen(false)} className="p-2 -ml-2 text-gray-500 hover:bg-white rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
            <h1 className="text-2xl font-black uppercase">Gestionar Remito</h1>
            <button onClick={() => setShowShortcuts(true)} className="ml-auto text-gray-400 hover:text-primary-600 transition-colors" title="Atajos de Teclado">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
        </div>
        <Card>
            <RemitoForm 
                key={formInstanceId} 
                remito={editingRemito} 
                clientes={visibleClientes} 
                vendedores={vendedores} 
                productos={productos} 
                currentUser={currentUser} 
                onSave={handleSave} 
                onAddCliente={handleAddClienteWrapper} 
                onClose={() => setIsFormOpen(false)} 
                remitos={remitos} 
                registrosPago={registrosPago} 
                isReadOnly={!!editingRemito?.facturaId}
            />
        </Card>
        <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );

  return (
    <div className="space-y-6 pt-12 md:pt-0 relative">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Remitos</h1>
            <button onClick={() => setShowShortcuts(true)} className="text-gray-400 hover:text-primary-600 transition-colors p-1" title="Atajos de teclado">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
              {currentUser.rol === Rol.ADMINISTRADOR && (
                  <button 
                    onClick={() => setShowReassignModal(true)} 
                    className="p-2 bg-yellow-100 text-yellow-800 rounded-xl hover:bg-yellow-200 transition-colors flex items-center gap-2"
                    title="Corrección Masiva de Asignación"
                  >
                      <CogIcon className="w-5 h-5" />
                  </button>
              )}
              <AppButton onClick={openNewModal}>+ Nuevo Remito <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span></AppButton>
          </div>
      </div>
      <Card>
        <div className="p-4 border-b dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect label="Cliente" value={clienteFilter} onChange={setClienteFilter} options={filterClienteOptions} />
            <AppSelect label="Estado" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as any)} options={[{value:"todos", label:"Todos"}, {value:"pendiente", label:"Pendientes"}, {value:"pagado", label:"Pagados"}, {value:"facturado", label:"Facturados"}, {value:"ajuste", label:"Carga Inicial"}]} />
        </div>
        <div className="space-y-2 p-2">
          {filteredRemitos.map(remito => (
            <div key={remito.id} className="bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedRemitoId(expandedRemitoId === remito.id ? null : remito.id)}>
                    <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Fecha</p><p className="font-medium text-sm">{new Date(remito.fecha + 'T00:00:00').toLocaleDateString()}</p></div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Cliente</p>
                            <p className="font-bold text-sm truncate">
                                {clientesMap.get(remito.clienteId)?.nombre || 'N/A'}
                                {remito.sucursalId && (
                                    <span className="ml-1 text-[10px] font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                        {clientesMap.get(remito.clienteId)?.sucursales.find(s => s.id === remito.sucursalId)?.nombre}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Número</p><p className="font-medium text-sm font-mono">{remito.puntoVenta.padStart(4,'0')}-{remito.numero.padStart(8,'0')}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold">Estado</p><PaymentStatusBadge remito={remito} /></div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditingRemito(remito); setIsFormOpen(true); }} className="text-blue-500 p-2 hover:bg-blue-50 rounded-full disabled:opacity-30 disabled:cursor-not-allowed" disabled={!remito.canBeEdited}><PencilIcon/></button>
                        {currentUser.rol === Rol.ADMINISTRADOR && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setRemitoParaBorrar(remito); }}
                                className="text-red-500 p-2 hover:bg-red-50 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={!remito.canBeDeleted}
                                title={!remito.canBeDeleted ? "No se puede borrar: tiene pagos o factura asociada" : "Borrar Remito"}
                            >
                                <TrashIcon />
                            </button>
                        )}
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${expandedRemitoId === remito.id ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                {expandedRemitoId === remito.id && (
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                        <table className="w-full text-xs text-left">
                            <thead className="text-gray-400 uppercase font-black"><tr><th className="py-2">Producto</th><th className="py-2 text-center">Entregados</th><th className="py-2 text-center">Retirados</th></tr></thead>
                            <tbody>{remito.movimientos.map((m, i)=>(<tr key={i} className="border-t dark:border-gray-700"><td className="py-2">{productosMap.get(m.productoId)?.nombre}</td><td className="py-2 text-center font-bold text-blue-600">{m.entregados}</td><td className="py-2 text-center text-gray-400">{m.recibidos}</td></tr>))}</tbody>
                        </table>
                    </div>
                )}
            </div>
          ))}
        </div>
      </Card>

      {remitoParaBorrar && (
        <Modal isOpen={!!remitoParaBorrar} onClose={() => setRemitoParaBorrar(null)}>
            <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">¿Borrar Remito?</h2>
                <p className="text-gray-500">
                    Se eliminará el remito <strong>{remitoParaBorrar.puntoVenta}-{remitoParaBorrar.numero}</strong>.
                    <br/>Esta acción revertirá el stock y saldo del cliente.
                </p>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setRemitoParaBorrar(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={handleDeleteConfirm}>Sí, Eliminar</AppButton>
                </div>
            </div>
        </Modal>
      )}
      
      <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      
      <ReassignModal 
        isOpen={showReassignModal} 
        onClose={() => setShowReassignModal(false)}
        vendedores={vendedores}
        remitos={remitos}
        onReassign={handleReassign}
      />
    </div>
  )
}

export default RemitosView;
