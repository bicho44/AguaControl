
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
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Atajos de Teclado"
            style={{ maxWidth: '400px' }}
            footer={<small style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)' }}>En Mac, 'Alt' corresponde a la tecla 'Option' (⌥).</small>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pico-muted-border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--pico-muted-color)' }}>Nuevo Remito</span>
                    <kbd style={{ fontSize: '0.75rem' }}>Alt + N</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pico-muted-border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--pico-muted-color)' }}>Guardar Remito</span>
                    <kbd style={{ fontSize: '0.75rem' }}>Ctrl + Enter</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pico-muted-border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--pico-muted-color)' }}>Agregar Producto</span>
                    <kbd style={{ fontSize: '0.75rem' }}>Alt + I</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--pico-muted-color)' }}>Agregar Pago</span>
                    <kbd style={{ fontSize: '0.75rem' }}>Alt + P</kbd>
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
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Herramienta de Corrección Masiva"
            style={{ maxWidth: '500px' }}
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
                    <AppButton 
                        variant="primary" 
                        onClick={handleConfirm} 
                        isLoading={isProcessing}
                        disabled={affectedRemitos.length === 0}
                    >
                        Reasignar {affectedRemitos.length} remitos
                    </AppButton>
                </div>
            }
        >
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: 'var(--pico-muted-color)' }}>Reasigna remitos de un vendedor a otro en un rango de fechas.</p>
            
            <div className="grid">
                <AppInput type="date" label="Desde" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <AppInput type="date" label="Hasta" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

                <div style={{ marginTop: '1rem' }}>
                    <small style={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--pico-muted-color)', display: 'block', marginBottom: '0.5rem' }}>Filtros de Vendedor</small>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--pico-card-sectioning-background-color)', borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-muted-border-color)', marginTop: '1rem' }}>
                    <input 
                        type="checkbox" 
                        id="excludeAdj" 
                        checked={excludeAdjustments} 
                        onChange={e => setExcludeAdjustments(e.target.checked)} 
                        style={{ margin: 0 }}
                    />
                    <label htmlFor="excludeAdj" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
                        Excluir Cargas Iniciales (Importaciones)
                        <br/><span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--pico-muted-color)' }}>Ignora remitos tipo "INI-XXXX" o ajustes de stock.</span>
                    </label>
                </div>

                <div style={{ background: 'rgba(255, 193, 7, 0.1)', padding: '0.75rem', borderRadius: 'var(--pico-border-radius)', border: '1px solid rgba(255, 193, 7, 0.3)', marginTop: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'center', color: '#856404' }}>
                        {affectedRemitos.length > 0 ? `Se actualizarán ${affectedRemitos.length} remitos.` : 'No hay remitos que coincidan.'}
                    </p>
                </div>

        </Modal>
    );
};

const PaymentStatusBadge: React.FC<{ remito: any }> = ({ remito }) => {
    if (remito.esAjuste) return <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: 'var(--pico-muted-background-color)', color: 'var(--pico-muted-color)' }}>Carga Inicial</span>;
    
    const badgeStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        fontWeight: 'bold',
        padding: '0.25rem 0.5rem',
        borderRadius: '1rem',
    };

    switch (remito.paymentStatus) {
        case 'facturado': 
            return <span style={{ ...badgeStyle, background: 'rgba(255, 193, 7, 0.2)', color: '#856404' }}>Facturado</span>;
        case 'pagado': 
            return <span style={{ ...badgeStyle, background: 'rgba(40, 167, 69, 0.2)', color: '#155724' }}>Pagado</span>;
        case 'pagado_parcial': 
            return <span style={{ ...badgeStyle, background: 'rgba(253, 126, 20, 0.2)', color: '#854226' }}>Parcial</span>;
        default: 
            return <span style={{ ...badgeStyle, background: 'rgba(220, 53, 69, 0.2)', color: '#721c24' }}>Pendiente</span>;
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
  const [balanceFilter, setBalanceFilter] = useState<'todos' | 'perdidos' | 'recuperados' | 'ambos'>('todos');
  const [showRemitosColumn, setShowRemitosColumn] = useState(true);
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
    const stats: Record<string, { 
        entregados: number; 
        recibidos: number; 
        remitosCount: number;
        detalles: Record<string, { entregados: number; recibidos: number }> 
    }> = {};
    
    filteredRemitos.forEach(r => {
        // Ignorar remitos que son de actualización de stock o carga inicial
        const isAdjustment = !!r.esAjuste || (r.numero && r.numero.toString().startsWith('INI'));
        if (isAdjustment) return;

        if (!stats[r.clienteId]) {
            stats[r.clienteId] = { entregados: 0, recibidos: 0, remitosCount: 0, detalles: {} };
        }
        
        let hasReturnable = false;
        r.movimientos.forEach(m => {
            if (returnableProductIds.has(m.productoId)) {
                stats[r.clienteId].entregados += m.entregados;
                stats[r.clienteId].recibidos += m.recibidos;
                
                if (!stats[r.clienteId].detalles[m.productoId]) {
                    stats[r.clienteId].detalles[m.productoId] = { entregados: 0, recibidos: 0 };
                }
                stats[r.clienteId].detalles[m.productoId].entregados += m.entregados;
                stats[r.clienteId].detalles[m.productoId].recibidos += m.recibidos;
                
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
            
            if (balanceFilter === 'perdidos') return item.balance > 0;
            if (balanceFilter === 'recuperados') return item.balance < 0;
            if (balanceFilter === 'ambos') return item.balance !== 0;
            return true;
        })
        .sort((a, b) => b.balance - a.balance);
}, [filteredRemitos, returnableProductIds, clientesMap, balanceFilter]);

  const periodTotalsByProduct = useMemo(() => {
    const totals: Record<string, { entregados: number; recibidos: number; balance: number }> = {};
    
    balanceData.forEach(d => {
        (Object.entries(d.detalles) as [string, { entregados: number; recibidos: number }][]).forEach(([prodId, det]) => {
            if (!totals[prodId]) totals[prodId] = { entregados: 0, recibidos: 0, balance: 0 };
            totals[prodId].entregados += det.entregados;
            totals[prodId].recibidos += det.recibidos;
            totals[prodId].balance += (det.entregados - det.recibidos);
        });
    });
    
    return totals;
  }, [balanceData]);

  const stockPlantaSummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const remitosToday = remitos.filter(r => r.fecha === today);
    const todayStats: Record<string, { entregados: number; recibidos: number }> = {};
    
    remitosToday.forEach(r => {
        r.movimientos.forEach(m => {
            if (returnableProductIds.has(m.productoId)) {
                if (!todayStats[m.productoId]) todayStats[m.productoId] = { entregados: 0, recibidos: 0 };
                todayStats[m.productoId].entregados += m.entregados;
                todayStats[m.productoId].recibidos += m.recibidos;
            }
        });
    });

    return returnableProducts.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stockPlanta || 0,
      envases: p.stockEnvases || 0,
      hoyEntregados: todayStats[p.id]?.entregados || 0,
      hoyRecibidos: todayStats[p.id]?.recibidos || 0
    }));
  }, [returnableProducts, remitos, returnableProductIds]);

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
    <div className="animate-fade-in" style={{ position: 'relative' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setIsFormOpen(false)} className="outline" style={{ padding: '0.5rem', margin: 0, width: 'auto', border: 'none', background: 'transparent' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Gestionar Remito</h1>
            <button onClick={() => setShowShortcuts(true)} className="outline" style={{ marginLeft: 'auto', padding: '0.5rem', margin: 0, width: 'auto', border: 'none', background: 'transparent', color: 'var(--pico-muted-color)' }} title="Atajos de Teclado">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 'bold' }}>Remitos</h1>
                <button onClick={() => setShowShortcuts(true)} className="outline" style={{ padding: '0.25rem', margin: 0, width: 'auto', border: 'none', background: 'transparent', color: 'var(--pico-muted-color)' }} title="Atajos de teclado">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {currentUser.rol === Rol.ADMINISTRADOR && (
                      <button 
                        onClick={() => setShowReassignModal(true)} 
                        className="outline secondary"
                        style={{ padding: '0.5rem', margin: 0, width: 'auto' }}
                        title="Corrección Masiva de Asignación"
                      >
                          <CogIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                      </button>
                  )}
                  <AppButton onClick={openNewModal}>
                      + Nuevo Remito <small style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '0.25rem', fontWeight: 'normal' }}>(Alt+N)</small>
                  </AppButton>
              </div>
          </div>
          
          <div style={{ display: 'flex', background: 'var(--pico-card-sectioning-background-color)', padding: '0.25rem', borderRadius: 'var(--pico-border-radius)', alignSelf: 'flex-start' }}>
              <button 
                onClick={() => setActiveTab('listado')}
                className="outline"
                style={{ 
                    padding: '0.5rem 1rem', 
                    margin: 0, 
                    fontSize: '0.875rem', 
                    fontWeight: 'bold',
                    border: 'none',
                    background: activeTab === 'listado' ? 'var(--pico-background-color)' : 'transparent',
                    color: activeTab === 'listado' ? 'var(--pico-primary-underline)' : 'var(--pico-muted-color)',
                    boxShadow: activeTab === 'listado' ? 'var(--pico-card-box-shadow)' : 'none'
                }}
              >
                  Listado
              </button>
              <button 
                onClick={() => setActiveTab('balance')}
                className="outline"
                style={{ 
                    padding: '0.5rem 1rem', 
                    margin: 0, 
                    fontSize: '0.875rem', 
                    fontWeight: 'bold',
                    border: 'none',
                    background: activeTab === 'balance' ? 'var(--pico-background-color)' : 'transparent',
                    color: activeTab === 'balance' ? 'var(--pico-primary-underline)' : 'var(--pico-muted-color)',
                    boxShadow: activeTab === 'balance' ? 'var(--pico-card-box-shadow)' : 'none'
                }}
              >
                  Balance de Envases
              </button>
          </div>
      </div>

      {activeTab === 'listado' ? (
        <>
          <Card>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--pico-muted-border-color)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <SearchableSelect label="Cliente" value={clienteFilter} onChange={setClienteFilter} options={filterClienteOptions} />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                    <AppInput label="Nro Remito" placeholder="Ej: 0001-00001234" value={remitoNumberFilter} onChange={e => setRemitoNumberFilter(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                    <AppSelect label="Estado" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as any)} options={[{value:"todos", label:"Todos"}, {value:"pendiente", label:"Pendientes"}, {value:"pagado", label:"Pagados"}, {value:"facturado", label:"Facturados"}, {value:"ajuste", label:"Carga Inicial"}]} />
                </div>
                <div style={{ flex: '1 1 280px' }}>
                    <div className="grid" style={{ margin: 0, gap: '0.5rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Desde</label>
                            <input type="date" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))} style={{ margin: 0 }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Hasta</label>
                            <input type="date" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))} style={{ margin: 0 }} />
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
              {filteredRemitos.map(remito => (
                <article key={remito.id} style={{ margin: 0, padding: 0, overflow: 'hidden', border: '1px solid var(--pico-muted-border-color)' }}>
                    <div 
                        style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} 
                        onClick={() => setExpandedRemitoId(expandedRemitoId === remito.id ? null : remito.id)}
                    >
                        <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                            <div>
                                <small style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Fecha</small>
                                <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>{new Date(remito.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                            </div>
                            <div>
                                <small style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Cliente</small>
                                <span style={{ fontWeight: 'bold', fontSize: '0.875rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {clientesMap.get(remito.clienteId)?.nombre || 'N/A'}
                                    {remito.sucursalId && (
                                        <small style={{ marginLeft: '0.25rem', fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--pico-muted-color)', background: 'var(--pico-card-sectioning-background-color)', padding: '0.125rem 0.375rem', borderRadius: '1rem' }}>
                                            {clientesMap.get(remito.clienteId)?.sucursales.find(s => s.id === remito.sucursalId)?.nombre}
                                        </small>
                                    )}
                                </span>
                            </div>
                            <div>
                                <small style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Número</small>
                                <span style={{ fontWeight: '500', fontSize: '0.875rem', fontFamily: 'var(--pico-font-family-monospace)' }}>{remito.puntoVenta.padStart(4,'0')}-{remito.numero.padStart(8,'0')}</span>
                            </div>
                            <div>
                                <small style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Estado</small>
                                <PaymentStatusBadge remito={remito} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingRemito(remito); setIsFormOpen(true); }} 
                                className="outline"
                                style={{ padding: '0.25rem', margin: 0, width: 'auto', border: 'none', background: 'transparent', color: '#3b82f6' }}
                                disabled={!remito.canBeEdited}
                            >
                                <PencilIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                            </button>
                            {currentUser.rol === Rol.ADMINISTRADOR && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setRemitoParaBorrar(remito); }}
                                    className="outline"
                                    style={{ padding: '0.25rem', margin: 0, width: 'auto', border: 'none', background: 'transparent', color: '#ef4444' }}
                                    disabled={!remito.canBeDeleted}
                                    title={!remito.canBeDeleted ? "No se puede borrar: tiene pagos o factura asociada" : "Borrar Remito"}
                                >
                                    <TrashIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                                </button>
                            )}
                            <ChevronDownIcon style={{ width: '1.25rem', height: '1.25rem', transition: 'transform 0.2s', transform: expandedRemitoId === remito.id ? 'rotate(180deg)' : 'none' }} />
                        </div>
                    </div>
                    {expandedRemitoId === remito.id && (
                        <div style={{ padding: '1rem', borderTop: '1px solid var(--pico-muted-border-color)', background: 'var(--pico-card-sectioning-background-color)' }}>
                            <table style={{ width: '100%', fontSize: '0.75rem', margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ textTransform: 'uppercase', fontWeight: 900 }}>Producto</th>
                                        <th style={{ textTransform: 'uppercase', fontWeight: 900, textAlign: 'center' }}>Entregados</th>
                                        <th style={{ textTransform: 'uppercase', fontWeight: 900, textAlign: 'center' }}>Retirados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {remito.movimientos.map((m, i) => (
                                        <tr key={i}>
                                            <td>{productosMap.get(m.productoId)?.nombre}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{m.entregados}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--pico-muted-color)' }}>{m.recibidos}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </article>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Card>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--pico-muted-border-color)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <SearchableSelect label="Filtrar Cliente" value={clienteFilter} onChange={setClienteFilter} options={filterClienteOptions} />
                    </div>
                    <div style={{ flex: '1 1 280px' }}>
                        <div className="grid" style={{ margin: 0, gap: '0.5rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Desde</label>
                                <input type="date" value={dateFilter.from} onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))} style={{ margin: 0 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', display: 'block' }}>Hasta</label>
                                <input type="date" value={dateFilter.to} onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))} style={{ margin: 0 }} />
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '12rem' }}>
                        <AppSelect 
                            label="Filtrar Balance"
                            value={balanceFilter}
                            onChange={(e) => setBalanceFilter(e.target.value as any)}
                            options={[
                                { value: 'todos', label: 'Todos' },
                                { value: 'perdidos', label: 'Solo Perdidos' },
                                { value: 'recuperados', label: 'Solo Recuperados' },
                                { value: 'ambos', label: 'Perdidos y Recuperados' }
                            ]}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <small style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--pico-muted-color)' }}>Columnas</small>
                        <AppButton 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setShowRemitosColumn(!showRemitosColumn)}
                            style={{ 
                                background: showRemitosColumn ? 'rgba(var(--pico-primary-rgb), 0.1)' : 'transparent',
                                borderColor: showRemitosColumn ? 'var(--pico-primary-border)' : 'var(--pico-muted-border-color)',
                                color: showRemitosColumn ? 'var(--pico-primary)' : 'var(--pico-muted-color)'
                            }}
                        >
                            {showRemitosColumn ? 'Ocultar Remitos' : 'Mostrar Remitos'}
                        </AppButton>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                            doc.text('RESUMEN DEL PERÍODO POR PRODUCTO:', 14, 45);
                            
                            doc.setFontSize(9);
                            doc.setFont('helvetica', 'normal');
                            let summaryY = 52;
                                (Object.entries(periodTotalsByProduct) as [string, { entregados: number; recibidos: number; balance: number }][]).forEach(([prodId, totals]) => {
                                    const prod = productosMap.get(prodId);
                                    if (summaryY > 260) {
                                        doc.addPage();
                                        summaryY = 20;
                                    }
                                    doc.setTextColor(0, 0, 0);
                                    doc.text(`${prod?.nombre || 'N/A'}:`, 14, summaryY);
                                    doc.setTextColor(0, 102, 204);
                                    doc.text(`Entregados: ${totals.entregados}`, 70, summaryY);
                                    doc.setTextColor(100, 100, 100);
                                    doc.text(`Recibidos: ${totals.recibidos}`, 110, summaryY);
                                    doc.setTextColor(totals.balance > 0 ? 200 : 0, totals.balance < 0 ? 150 : 0, 0);
                                    doc.text(`Balance: ${totals.balance > 0 ? '+' : ''}${totals.balance}`, 150, summaryY);
                                    summaryY += 6;
                                });
                            
                            doc.setTextColor(0, 0, 0);
                            doc.line(14, summaryY + 2, 196, summaryY + 2);

                            let currentY = summaryY + 12;

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
                                        body: clientsForDay.map(d => {
                                            const entregadosDetalle = (Object.entries(d.detalles) as [string, { entregados: number; recibidos: number }][])
                                                .filter(([_, det]) => det.entregados > 0)
                                                .map(([prodId, det]) => `${productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: ${det.entregados}`)
                                                .join('\n');
                                            
                                            const recibidosDetalle = (Object.entries(d.detalles) as [string, { entregados: number; recibidos: number }][])
                                                .filter(([_, det]) => det.recibidos > 0)
                                                .map(([prodId, det]) => `${productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: ${det.recibidos}`)
                                                .join('\n');

                                            return [
                                                d.cliente?.nombre || 'N/A',
                                                d.cliente?.sucursales[0]?.direccion || '',
                                                { content: entregadosDetalle || '0', styles: { fontSize: 7 } },
                                                { content: recibidosDetalle || '0', styles: { fontSize: 7 } },
                                                { content: d.balance > 0 ? `+${d.balance}` : d.balance, styles: { fontStyle: 'bold', textColor: d.balance > 0 ? [200, 0, 0] : [0, 150, 0] } }
                                            ];
                                        }),
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
                                        body: clientsNoDay.map(d => {
                                            const entregadosDetalle = (Object.entries(d.detalles) as [string, { entregados: number; recibidos: number }][])
                                                .filter(([_, det]) => det.entregados > 0)
                                                .map(([prodId, det]) => `${productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: ${det.entregados}`)
                                                .join('\n');
                                            
                                            const recibidosDetalle = (Object.entries(d.detalles) as [string, { entregados: number; recibidos: number }][])
                                                .filter(([_, det]) => det.recibidos > 0)
                                                .map(([prodId, det]) => `${productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: ${det.recibidos}`)
                                                .join('\n');

                                        return [
                                            d.cliente?.nombre || 'N/A',
                                            d.cliente?.sucursales[0]?.direccion || '',
                                            { content: entregadosDetalle || '0', styles: { fontSize: 7 } },
                                            { content: recibidosDetalle || '0', styles: { fontSize: 7 } },
                                            { content: d.balance > 0 ? `+${d.balance}` : d.balance, styles: { fontStyle: 'bold', textColor: d.balance > 0 ? [200, 0, 0] : [0, 150, 0] } }
                                        ];
                                    }),
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
                            const csvRows = [
                                ['RESUMEN DEL PERÍODO POR PRODUCTO'],
                                ['Producto', 'Entregados', 'Recibidos', 'Balance Neto']
                            ];

                            (Object.entries(periodTotalsByProduct) as [string, { entregados: number; recibidos: number; balance: number }][]).forEach(([prodId, totals]) => {
                                const prod = productosMap.get(prodId);
                                csvRows.push([
                                    `"${prod?.nombre || 'N/A'}"`,
                                    totals.entregados.toString(),
                                    totals.recibidos.toString(),
                                    totals.balance.toString()
                                ]);
                            });

                            csvRows.push([]);
                            csvRows.push(['DETALLE POR CLIENTE']);
                            
                            const headers = ['Cliente', 'Dirección'];
                            if (showRemitosColumn) headers.push('Remitos');
                            headers.push('Entregados', 'Recibidos', 'Balance');
                            csvRows.push(headers);

                            balanceData.forEach(d => {
                                const row = [
                                    `"${d.cliente?.nombre || 'N/A'}"`,
                                    `"${d.cliente?.sucursales[0]?.direccion || ''}"`
                                ];
                                if (showRemitosColumn) row.push(d.remitosCount.toString());
                                row.push(
                                    d.entregados.toString(),
                                    d.recibidos.toString(),
                                    d.balance.toString()
                                );
                                csvRows.push(row);
                            });

                            const csv = csvRows.map(row => row.join(',')).join('\n');
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `balance_envases_${dateFilter.from || 'inicio'}_${dateFilter.to || 'fin'}.csv`;
                            link.click();
                        }}>Exportar CSV</AppButton>
                    </div>
                </div>
                
                {/* Stock en Planta Legend */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--pico-muted-border-color)', background: 'var(--pico-card-sectioning-background-color)' }}>
                    {stockPlantaSummary.map(s => (
                        <div key={s.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem', borderRadius: 'var(--pico-border-radius)', border: '1px solid var(--pico-muted-border-color)', background: 'var(--pico-background-color)', boxShadow: 'var(--pico-box-shadow)' }}>
                            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>{s.stock}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '0.5rem', fontWeight: 'bold', color: 'var(--pico-muted-color)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Llenos</span>
                                        {s.hoyEntregados > 0 && <span style={{ fontSize: '0.5rem', fontWeight: 900, color: '#ef4444' }}>(-{s.hoyEntregados})</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--pico-muted-color)', lineHeight: 1 }}>{s.envases}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {s.hoyRecibidos > 0 && <span style={{ fontSize: '0.5rem', fontWeight: 900, color: '#16a34a' }}>(+{s.hoyRecibidos})</span>}
                                        <span style={{ fontSize: '0.5rem', fontWeight: 'bold', color: 'var(--pico-muted-color)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Vacíos</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.875rem', margin: 0 }}>
                        <thead style={{ fontSize: '0.65rem', color: 'var(--pico-muted-color)', textTransform: 'uppercase', fontWeight: 900, background: 'var(--pico-card-sectioning-background-color)' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                                {showRemitosColumn && <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Remitos</th>}
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Entregados</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Recibidos</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Balance Neto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {balanceData.length === 0 ? (
                                <tr>
                                    <td colSpan={showRemitosColumn ? 5 : 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--pico-muted-color)', fontStyle: 'italic' }}>No hay movimientos de envases retornables en este período.</td>
                                </tr>
                            ) : (
                                balanceData.map((item) => (
                                    <tr key={item.clienteId} style={{ borderBottom: '1px solid var(--pico-muted-border-color)' }}>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--pico-color)' }}>{item.cliente?.nombre}</p>
                                            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--pico-muted-color)' }}>{item.cliente?.sucursales[0]?.direccion}</p>
                                        </td>
                                        {showRemitosColumn && <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontFamily: 'var(--pico-font-family-monospace)' }}>{item.remitosCount}</td>}
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                                                {(Object.entries(item.detalles) as [string, { entregados: number; recibidos: number }][]).map(([prodId, d]) => d.entregados > 0 && (
                                                    <span key={prodId} style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                        {productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: {d.entregados}
                                                    </span>
                                                ))}
                                                {item.entregados === 0 && <span style={{ color: 'var(--pico-muted-border-color)' }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                                                {(Object.entries(item.detalles) as [string, { entregados: number; recibidos: number }][]).map(([prodId, d]) => d.recibidos > 0 && (
                                                    <span key={prodId} style={{ fontSize: '0.75rem', color: 'var(--pico-muted-color)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                                        {productosMap.get(prodId)?.abreviatura || productosMap.get(prodId)?.nombre}: {d.recibidos}
                                                    </span>
                                                ))}
                                                {item.recibidos === 0 && <span style={{ color: 'var(--pico-muted-border-color)' }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                padding: '0.25rem 0.75rem', 
                                                borderRadius: '1rem', 
                                                fontWeight: 900, 
                                                fontSize: '0.75rem',
                                                background: item.balance > 0 ? 'rgba(220, 38, 38, 0.1)' : item.balance < 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                                color: item.balance > 0 ? '#dc2626' : item.balance < 0 ? '#16a34a' : '#6b7280'
                                            }}>
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
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--pico-muted-color)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 0.25rem', margin: 0 }}>Resumen del Período por Producto</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {(Object.entries(periodTotalsByProduct) as [string, { entregados: number; recibidos: number; balance: number }][]).map(([prodId, totals]) => {
                        const prod = productosMap.get(prodId);
                        return (
                            <article key={prodId} style={{ margin: 0, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--pico-primary)' }}></div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--pico-muted-color)', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod?.nombre || 'N/A'}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.55rem', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase' }}>Entregados</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8' }}>{totals.entregados}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: '0.55rem', fontWeight: 'bold', color: 'var(--pico-muted-color)', textTransform: 'uppercase' }}>Recibidos</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--pico-color)' }}>{totals.recibidos}</span>
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--pico-muted-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.55rem', fontWeight: 'bold', color: 'var(--pico-muted-color)', textTransform: 'uppercase' }}>Balance Neto</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 900, color: totals.balance > 0 ? '#dc2626' : totals.balance < 0 ? '#16a34a' : 'var(--pico-muted-color)' }}>
                                        {totals.balance > 0 ? `+${totals.balance}` : totals.balance}
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                    {Object.keys(periodTotalsByProduct).length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: 'var(--pico-card-sectioning-background-color)', borderRadius: 'var(--pico-border-radius)', border: '2px dashed var(--pico-muted-border-color)' }}>
                            <p style={{ color: 'var(--pico-muted-color)', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>No hay datos para el período seleccionado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {remitoParaBorrar && (
        <Modal 
            isOpen={!!remitoParaBorrar} 
            onClose={() => setRemitoParaBorrar(null)}
            title="¿Borrar Remito?"
            style={{ maxWidth: '400px' }}
        >
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ 
                    margin: '0 auto 1.5rem', 
                    width: '4rem', 
                    height: '4rem', 
                    backgroundColor: 'rgba(211, 47, 47, 0.1)', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#d32f2f'
                }}>
                    <TrashIcon style={{ width: '2rem', height: '2rem' }}/>
                </div>
                <p style={{ color: 'var(--pico-muted-color)', marginBottom: '1.5rem' }}>
                    Se eliminará el remito <strong>{remitoParaBorrar.puntoVenta}-{remitoParaBorrar.numero}</strong>.
                    <br/><small>Esta acción revertirá el stock y saldo del cliente.</small>
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
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
