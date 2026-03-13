
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Remito, Cliente, Usuario, PagoDetalle, RegistroPago, Rol, TipoVendedor, CausaRecambio, TipoProducto, DiaSemana, EmpresaSettings } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { getLocalDateString } from '../utils/dateUtils';

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
  causasRecambio: CausaRecambio[];
  empresaSettings: EmpresaSettings;
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
                <h2 className="text-xl font-black uppercase text-primary-600 pr-12">Herramienta de Corrección Masiva</h2>
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

const RemitosView: React.FC<RemitosViewProps> = ({ remitos, clientes, vendedores, productos, registrosPago, currentUser, addRemito, updateRemito, deleteRemito, addCliente, causasRecambio, empresaSettings }) => {
  const [activeTab, setActiveTab] = useState<'listado' | 'balance'>('listado');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRemito, setEditingRemito] = useState<any>(null);
  const [clienteFilter, setClienteFilter] = useState('');
  const [remitoNumberFilter, setRemitoNumberFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('todos');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [onlyLostFilter, setOnlyLostFilter] = useState(false);
  const [expandedRemitoId, setExpandedRemitoId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const [formInstanceId, setFormInstanceId] = useState(0);
  const [remitoParaBorrar, setRemitoParaBorrar] = useState<Remito | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [stickyVendedorId, setStickyVendedorId] = useState<string>(currentUser.id);

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
        const precio = mov.precioUnitario ?? peMap.get(mov.productoId) ?? prod.precio;
        return total + (mov.entregados * precio);
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
        
        const remitoDate = new Date(r.fecha + 'T00:00:00');
        const fromDate = dateFilter.from ? new Date(dateFilter.from + 'T00:00:00') : null;
        const toDate = dateFilter.to ? new Date(dateFilter.to + 'T00:00:00') : null;

        if (fromDate && remitoDate < fromDate) return false;
        if (toDate && remitoDate > toDate) return false;

        if (remitoNumberFilter) {
            const search = remitoNumberFilter.toLowerCase().replace(/-/g, '').trim();
            const pto = (r.puntoVenta || '').toString().toLowerCase();
            const num = (r.numero || '').toString().toLowerCase();
            const fullPadded = `${pto.padStart(4, '0')}${num.padStart(8, '0')}`;
            const rawCombined = `${pto}${num}`;
            
            if (!fullPadded.includes(search) && !rawCombined.includes(search) && !num.includes(search)) return false;
        }
        
        return true;
    }).sort((a, b) => {
        const dateA = new Date(a.fecha + 'T00:00:00').getTime();
        const dateB = new Date(b.fecha + 'T00:00:00').getTime();
        if (dateB !== dateA) return dateB - dateA;
        const ptoA = parseInt(a.puntoVenta) || 0;
        const ptoB = parseInt(b.puntoVenta) || 0;
        if (ptoB !== ptoA) return ptoB - ptoA;
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numB - numA;
    });
  }, [processedRemitos, clienteFilter, remitoNumberFilter, paymentStatusFilter, dateFilter, currentUser]);

  const returnableProducts = useMemo(() => productos.filter(p => p.tipo === TipoProducto.RETORNABLE), [productos]);
  const returnableProductIds = useMemo(() => new Set(returnableProducts.map(p => p.id)), [returnableProducts]);

  const balanceData = useMemo(() => {
    const stats: Record<string, { entregados: number; recibidos: number; remitosCount: number }> = {};
    
    filteredRemitos.forEach(r => {
        if (!stats[r.clienteId]) {
            stats[r.clienteId] = { entregados: 0, recibidos: 0, remitosCount: 0 };
        }
        
        let hasReturnable = false;
        r.movimientos.forEach(m => {
            if (returnableProductIds.has(m.productoId)) {
                stats[r.clienteId].entregados += m.entregados;
                stats[r.clienteId].recibidos += m.recibidos;
                hasReturnable = true;
            }
        });
        if (hasReturnable) {
            stats[r.clienteId].remitosCount++;
        }
    });

    return Object.entries(stats)
        .map(([clienteId, data]) => ({
            clienteId,
            cliente: clientesMap.get(clienteId),
            ...data,
            balance: data.entregados - data.recibidos
        }))
        .filter(item => {
            const hasActivity = item.entregados > 0 || item.recibidos > 0;
            if (!hasActivity) return false;
            if (onlyLostFilter) return item.balance > 0;
            return true;
        })
        .sort((a, b) => b.balance - a.balance);
}, [filteredRemitos, returnableProductIds, clientesMap, onlyLostFilter]);

  const getNextAvailableNumber = useCallback((pto: string, startNum: number) => {
    let current = startNum;
    const ptoRemitos = remitos.filter(r => r.puntoVenta === pto);
    const usedNumbers = new Set(ptoRemitos.map(r => parseInt(r.numero) || 0));
    
    while (usedNumbers.has(current)) {
        current++;
    }
    return current;
  }, [remitos]);

  const handleSave = async (r: any) => {
    try {
      // Guardamos el vendedor seleccionado para la próxima carga
      if (r.vendedorId) {
          setStickyVendedorId(r.vendedorId);
      }

      if (r.id) {
          await updateRemito(r);
          showNotification('Actualizado.', 'success');
          setIsFormOpen(false);
      } else {
          await addRemito(r);
          showNotification('Guardado.', 'success');
          
          if (currentUser.rol === Rol.ADMINISTRADOR) {
              const nextNum = getNextAvailableNumber(r.puntoVenta, (parseInt(r.numero) || 0) + 1);
              setEditingRemito({ 
                fecha: r.fecha,
                puntoVenta: r.puntoVenta, 
                numero: nextNum.toString(), 
                movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }], 
                pagos: [], 
                vendedorId: r.vendedorId || stickyVendedorId 
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
      fecha: getLocalDateString(), 
      puntoVenta: defaultPto, 
      numero: '', 
      movimientos: [{ productoId: '', entregados: 0, recibidos: 0 }], 
      pagos: [], 
      vendedorId: stickyVendedorId 
    });
    setFormInstanceId(prev => prev + 1);
    setIsFormOpen(true);
  }, [remitos, stickyVendedorId]);

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
                causasRecambio={causasRecambio}
            />
        </Card>
        <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );

  return (
    <div className="space-y-6 pt-12 md:pt-0 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Remitos</h1>
            <button onClick={() => setShowShortcuts(true)} className="text-gray-400 hover:text-primary-600 transition-colors p-1" title="Atajos de teclado">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
          
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl self-start">
              <button 
                onClick={() => setActiveTab('listado')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'listado' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  Listado
              </button>
              <button 
                onClick={() => setActiveTab('balance')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'balance' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  Balance de Envases
              </button>
          </div>

          <div className="flex gap-2 self-end md:self-auto">
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

      {activeTab === 'listado' ? (
        <>
          <Card>
            <div className="p-4 border-b dark:border-gray-700 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <SearchableSelect label="Cliente" value={clienteFilter} onChange={setClienteFilter} options={filterClienteOptions} />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <AppInput label="Nro Remito" placeholder="Ej: 0001-00001234" value={remitoNumberFilter} onChange={e => setRemitoNumberFilter(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[120px]">
                    <AppSelect label="Estado" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as any)} options={[{value:"todos", label:"Todos"}, {value:"pendiente", label:"Pendientes"}, {value:"pagado", label:"Pagados"}, {value:"facturado", label:"Facturados"}, {value:"ajuste", label:"Carga Inicial"}]} />
                </div>
                <div className="flex-1 min-w-[280px]">
                    <div className="flex gap-2 w-full">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
                            <input type="date" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
                            <input type="date" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-2 p-2">
              {filteredRemitos.map(remito => (
                <div key={remito.id} className="bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 overflow-hidden">
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedRemitoId(expandedRemitoId === remito.id ? null : remito.id)}>
                        <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold">Fecha</p><p className="font-medium text-sm">{new Date(remito.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p></div>
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
        </>
      ) : (
        <div className="space-y-4">
            <Card>
                <div className="p-4 border-b dark:border-gray-700 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <SearchableSelect label="Filtrar Cliente" value={clienteFilter} onChange={setClienteFilter} options={filterClienteOptions} />
                    </div>
                    <div className="flex-1 min-w-[280px]">
                        <div className="flex gap-2 w-full">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
                                <input type="date" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
                                <input type="date" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border dark:border-gray-700">
                        <input 
                            type="checkbox" 
                            id="onlyLost" 
                            checked={onlyLostFilter} 
                            onChange={e => setOnlyLostFilter(e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="onlyLost" className="text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                            Solo "Perdidos"
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <AppButton variant="secondary" onClick={() => {
                            const doc = new jsPDF();
                            const days = [DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO, DiaSemana.DOMINGO];
                            
                            const totalEntregados = balanceData.reduce((sum, d) => sum + d.entregados, 0);
                            const totalRecibidos = balanceData.reduce((sum, d) => sum + d.recibidos, 0);
                            const totalBalance = balanceData.reduce((sum, d) => sum + d.balance, 0);

                            doc.setFontSize(20);
                            doc.setTextColor(0, 102, 204);
                            doc.text('REPORTE DE ENVASES PENDIENTES', 14, 20);
                            
                            if (empresaSettings.logo) {
                                try {
                                    const imgProps = doc.getImageProperties(empresaSettings.logo);
                                    const maxWidth = 40;
                                    const maxHeight = 25;
                                    const ratio = imgProps.width / imgProps.height;
                                    
                                    let imgWidth = maxWidth;
                                    let imgHeight = maxWidth / ratio;
                                    
                                    if (imgHeight > maxHeight) {
                                        imgHeight = maxHeight;
                                        imgWidth = maxHeight * ratio;
                                    }
                                    
                                    doc.addImage(empresaSettings.logo, 'PNG', 196 - imgWidth, 10, imgWidth, imgHeight);
                                } catch (e) {
                                    console.error("Error adding logo to PDF", e);
                                }
                            }
                            
                            doc.setFontSize(10);
                            doc.setTextColor(100, 100, 100);
                            doc.text(`Generado el: ${new Date().toLocaleDateString('es-AR')}`, 14, 27);
                            doc.text(`Período: ${dateFilter.from || 'Inicio'} al ${dateFilter.to || 'Hoy'}`, 14, 32);
                            
                            // Resumen de Totales
                            doc.setDrawColor(200, 200, 200);
                            doc.line(14, 38, 196, 38);
                            
                            doc.setFontSize(11);
                            doc.setTextColor(0, 0, 0);
                            doc.setFont('helvetica', 'bold');
                            doc.text('RESUMEN GENERAL:', 14, 45);
                            
                            doc.setFont('helvetica', 'normal');
                            doc.text(`Total Entregados: ${totalEntregados}`, 14, 52);
                            doc.text(`Total Recibidos: ${totalRecibidos}`, 70, 52);
                            doc.setTextColor(totalBalance > 0 ? 200 : 0, totalBalance < 0 ? 150 : 0, 0);
                            doc.text(`Balance Neto (En Calle): ${totalBalance > 0 ? '+' : ''}${totalBalance}`, 130, 52);
                            
                            doc.setTextColor(0, 0, 0);
                            doc.line(14, 58, 196, 58);

                            let currentY = 68;

                            days.forEach(day => {
                                const clientsForDay = balanceData.filter(d => {
                                    return d.cliente?.sucursales.some(suc => suc.diasReparto?.includes(day));
                                });

                                if (clientsForDay.length > 0) {
                                    if (currentY > 230) {
                                        doc.addPage();
                                        currentY = 20;
                                    }
                                    
                                    doc.setFontSize(14);
                                    doc.setTextColor(0, 102, 204);
                                    doc.text(`REPARTO: ${day.toUpperCase()}`, 14, currentY);
                                    doc.setTextColor(0, 0, 0);
                                    
                                    autoTable(doc, {
                                        startY: currentY + 5,
                                        head: [['Cliente', 'Dirección', 'Entregados', 'Recibidos', 'Balance']],
                                        body: clientsForDay.map(d => [
                                            d.cliente?.nombre || 'N/A',
                                            d.cliente?.sucursales[0]?.direccion || '',
                                            d.entregados,
                                            d.recibidos,
                                            { content: d.balance > 0 ? `+${d.balance}` : d.balance, styles: { fontStyle: 'bold', textColor: d.balance > 0 ? [200, 0, 0] : [0, 150, 0] } }
                                        ]),
                                        theme: 'grid',
                                        headStyles: { fillColor: [0, 102, 204], fontSize: 9 },
                                        bodyStyles: { fontSize: 8 },
                                        columnStyles: {
                                            2: { halign: 'center' },
                                            3: { halign: 'center' },
                                            4: { halign: 'center' }
                                        },
                                        margin: { left: 14, right: 14 }
                                    });
                                    
                                    currentY = (doc as any).lastAutoTable.finalY + 15;
                                }
                            });

                            // Clientes sin día asignado
                            const clientsNoDay = balanceData.filter(d => {
                                return !d.cliente?.sucursales.some(suc => suc.diasReparto && suc.diasReparto.length > 0);
                            });

                            if (clientsNoDay.length > 0) {
                                if (currentY > 230) {
                                    doc.addPage();
                                    currentY = 20;
                                }
                                doc.setFontSize(14);
                                doc.setTextColor(100, 100, 100);
                                doc.text('CLIENTES SIN DÍA ASIGNADO', 14, currentY);
                                doc.setTextColor(0, 0, 0);

                                autoTable(doc, {
                                    startY: currentY + 5,
                                    head: [['Cliente', 'Dirección', 'Entregados', 'Recibidos', 'Balance']],
                                    body: clientsNoDay.map(d => [
                                        d.cliente?.nombre || 'N/A',
                                        d.cliente?.sucursales[0]?.direccion || '',
                                        d.entregados,
                                        d.recibidos,
                                        { content: d.balance > 0 ? `+${d.balance}` : d.balance, styles: { fontStyle: 'bold', textColor: d.balance > 0 ? [200, 0, 0] : [0, 150, 0] } }
                                    ]),
                                    theme: 'grid',
                                    headStyles: { fillColor: [100, 100, 100], fontSize: 9 },
                                    bodyStyles: { fontSize: 8 },
                                    columnStyles: {
                                        2: { halign: 'center' },
                                        3: { halign: 'center' },
                                        4: { halign: 'center' }
                                    },
                                    margin: { left: 14, right: 14 }
                                });
                            }

                            doc.save(`balance_envases_${new Date().toISOString().split('T')[0]}.pdf`);
                        }}>Generar PDF</AppButton>
                        <AppButton variant="secondary" onClick={() => {
                            const totalEntregados = balanceData.reduce((sum, d) => sum + d.entregados, 0);
                            const totalRecibidos = balanceData.reduce((sum, d) => sum + d.recibidos, 0);
                            const totalBalance = balanceData.reduce((sum, d) => sum + d.balance, 0);

                            const csv = [
                                ['RESUMEN GENERAL'].join(','),
                                ['Total Entregados', totalEntregados].join(','),
                                ['Total Recibidos', totalRecibidos].join(','),
                                ['Balance Neto (En Calle)', totalBalance].join(','),
                                [],
                                ['Cliente', 'Remitos', 'Entregados', 'Recibidos', 'Balance'].join(','),
                                ...balanceData.map(d => [
                                    `"${d.cliente?.nombre || 'N/A'}"`,
                                    d.remitosCount,
                                    d.entregados,
                                    d.recibidos,
                                    d.balance
                                ].join(','))
                            ].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `balance_envases_${dateFilter.from || 'inicio'}_${dateFilter.to || 'fin'}.csv`;
                            link.click();
                        }}>Exportar CSV</AppButton>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-400 uppercase font-black bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3 text-center">Remitos</th>
                                <th className="px-4 py-3 text-center">Entregados</th>
                                <th className="px-4 py-3 text-center">Recibidos</th>
                                <th className="px-4 py-3 text-center">Balance Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {balanceData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">No hay movimientos de envases retornables en este período.</td>
                                </tr>
                            ) : (
                                balanceData.map((item) => (
                                    <tr key={item.clienteId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-800 dark:text-white">{item.cliente?.nombre}</p>
                                            <p className="text-[10px] text-gray-500">{item.cliente?.sucursales[0]?.direccion}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono">{item.remitosCount}</td>
                                        <td className="px-4 py-3 text-center text-blue-600 font-bold">{item.entregados}</td>
                                        <td className="px-4 py-3 text-center text-gray-500">{item.recibidos}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-full font-black text-xs ${
                                                item.balance > 0 
                                                    ? 'bg-red-100 text-red-700' 
                                                    : item.balance < 0 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {item.balance > 0 ? `+${item.balance}` : item.balance}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-blue-50 border-blue-100">
                    <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Total Entregados</p>
                    <p className="text-2xl font-black text-blue-800">{balanceData.reduce((sum, d) => sum + d.entregados, 0)}</p>
                </Card>
                <Card className="p-4 bg-gray-50 border-gray-100">
                    <p className="text-[10px] font-black uppercase text-gray-600 mb-1">Total Recibidos</p>
                    <p className="text-2xl font-black text-gray-800">{balanceData.reduce((sum, d) => sum + d.recibidos, 0)}</p>
                </Card>
                <Card className="p-4 bg-red-50 border-red-100">
                    <p className="text-[10px] font-black uppercase text-red-600 mb-1">Balance Total (En Calle)</p>
                    <p className="text-2xl font-black text-red-800">{balanceData.reduce((sum, d) => sum + d.balance, 0)}</p>
                </Card>
            </div>
        </div>
      )}

      {remitoParaBorrar && (
        <Modal isOpen={!!remitoParaBorrar} onClose={() => setRemitoParaBorrar(null)}>
            <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white pr-12">¿Borrar Remito?</h2>
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
