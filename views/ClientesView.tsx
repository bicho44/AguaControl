
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Cliente, Sucursal, Remito, Producto, TipoProducto, TipoFacturacion, Telefono, TipoTelefono, Contrato, EstadoContrato, Servicio, TipoServicio, EstadoCliente, EstadoServicio, EstadoProducto, DiaSemana, RegistroPago, Rol, PrecioEspecial } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import { MapIcon } from '../components/icons/MapIcon';
import { SearchIcon } from '../components/icons/SearchIcon';
import { CubeIcon } from '../components/icons/CubeIcon';
import MapPickerModal from '../components/MapPickerModal';
import { useAuth } from '../context/AuthContext';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

interface ClientesViewProps {
  clientes: Cliente[];
  remitos: Remito[];
  productos: Producto[];
  contratos: Contrato[];
  servicios: Servicio[];
  registrosPago: RegistroPago[];
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'> & { stockInicial?: any[], contratosIniciales?: any[] }) => void;
  updateCliente: (cliente: Cliente & { stockInicial?: any[], contratosIniciales?: any[] }) => void;
  deleteCliente: (clienteId: string) => void;
  reactivarCliente: (clienteId: string) => void;
}

const formatCuit = (value: string = '') => {
  const digits = value.replace(/\D/g, '').substring(0, 11);
  let formatted = '';
  if (digits.length > 0) formatted += digits.substring(0, 2);
  if (digits.length > 2) formatted += '-' + digits.substring(2, 10);
  if (digits.length > 10) formatted += '-' + digits.substring(10, 11);
  return formatted;
};

const unformatCuit = (value: string = '') => value.replace(/\D/g, '');

const ClienteForm: React.FC<{
  cliente: Partial<Cliente>;
  productos: Producto[];
  servicios: Servicio[];
  clientes: Cliente[]; 
  remitos: Remito[];
  onSave: (cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente) & { stockInicial?: any[], contratosIniciales?: any[] }) => void;
  onClose: () => void;
}> = ({ cliente, productos, servicios, clientes, remitos, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Cliente>>(cliente);
  const [contratosIniciales, setContratosIniciales] = useState<Omit<Contrato, 'id'|'clienteId'>[]>([]);
  const { showNotification } = useNotification();
  
  const currentBalances = useMemo(() => {
    if (!cliente.id) return new Map<string, Map<string, number>>();
    const map = new Map<string, Map<string, number>>();
    remitos.filter(r => r.clienteId === cliente.id).forEach(r => {
        const sucId = r.sucursalId || 'main';
        if (!map.has(sucId)) map.set(sucId, new Map());
        const prodMap = map.get(sucId)!;
        r.movimientos.forEach(m => {
            const current = prodMap.get(m.productoId) || 0;
            prodMap.set(m.productoId, current + (m.entregados - m.recibidos));
        });
    });
    return map;
  }, [cliente.id, remitos]);

  const [auditStocks, setAuditStocks] = useState<{ sucursalId: string; productoId: string; cantidad: number }[]>([]);

  useEffect(() => {
    const initialAudit: { sucursalId: string; productoId: string; cantidad: number }[] = [];
    currentBalances.forEach((prodMap, sucId) => {
        prodMap.forEach((qty, prodId) => {
            if (qty !== 0) initialAudit.push({ sucursalId: sucId, productoId: prodId, cantidad: qty });
        });
    });
    setAuditStocks(initialAudit);
  }, [currentBalances]);

  const [cuitExistente, setCuitExistente] = useState<string | null>(null);
  const [nombreExistente, setNombreExistente] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [mapModalConfig, setMapModalConfig] = useState<{
    isOpen: boolean;
    sucursalIndex: number | null;
    initialLat?: number;
    initialLng?: number;
    initialAddress: string;
  }>({ isOpen: false, sucursalIndex: null, initialAddress: '' });

  const isNew = !cliente.id;
  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);
  const serviciosActivos = useMemo(() => servicios.filter(s => s.estado === EstadoServicio.ACTIVO), [servicios]);
  
  useEffect(() => {
    if (!isNew) return;
    const cuitLimpio = unformatCuit(formData.cuit);
    if (cuitLimpio.length === 11) {
        const ce = clientes.find(c => unformatCuit(c.cuit) === cuitLimpio);
        setCuitExistente(ce ? ce.nombre : null);
    } else setCuitExistente(null);

    const nt = formData.nombre?.trim().toLowerCase();
    if (nt) {
        const ce = clientes.find(c => c.nombre.trim().toLowerCase() === nt);
        setNombreExistente(ce ? ce.nombre : null);
    } else setNombreExistente(null);
  }, [formData.cuit, formData.nombre, clientes, isNew]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'cuit' ? unformatCuit(value) : value }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSucursalChange = (index: number, field: keyof Sucursal, value: any) => {
      const newSucs = [...(formData.sucursales || [])];
      newSucs[index] = { ...newSucs[index], [field]: value };
      setFormData(prev => ({ ...prev, sucursales: newSucs }));
  }

  const toggleDiaReparto = (sucursalIndex: number, day: DiaSemana) => {
      const newSucs = [...(formData.sucursales || [])];
      const currentDays = newSucs[sucursalIndex].diasReparto || [];
      const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
      newSucs[sucursalIndex] = { ...newSucs[sucursalIndex], diasReparto: newDays };
      setFormData(prev => ({ ...prev, sucursales: newSucs }));
  }
  
  const handleSearchAddress = async (index: number) => {
      const direccion = formData.sucursales?.[index]?.direccion;
      if (!direccion) return showNotification('Ingrese una dirección', 'error');
      setIsSearching(true);
      try {
          const q = direccion.toLowerCase().includes('argentina') ? direccion : `${direccion}, Argentina`;
          const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
          const data = await resp.json();
          if (data && data.length > 0) {
              const newSucs = [...(formData.sucursales || [])];
              newSucs[index] = { ...newSucs[index], lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
              setFormData(prev => ({ ...prev, sucursales: newSucs }));
              showNotification('Dirección validada.', 'success');
          } else showNotification('Dirección no encontrada.', 'error');
      } catch (e) { showNotification('Error de búsqueda.', 'error'); } 
      finally { setIsSearching(false); }
  };

  const addSucursal = useCallback(() => setFormData(prev => ({...prev, sucursales: [...(prev.sucursales || []), { id: `suc_${Date.now()}`, nombre: '', direccion: '', diasReparto: [] }]})), []);
  const removeSucursal = (index: number) => setFormData(prev => ({...prev, sucursales: prev.sucursales?.filter((_, i) => i !== index)}));

  const handleAuditChange = (sucursalId: string, productoId: string, newTotal: number) => {
      setAuditStocks(prev => {
          const existingIdx = prev.findIndex(s => s.sucursalId === sucursalId && s.productoId === productoId);
          if (existingIdx >= 0) {
              const next = [...prev];
              next[existingIdx] = { ...next[existingIdx], cantidad: newTotal };
              return next;
          }
          return [...prev, { sucursalId, productoId, cantidad: newTotal }];
      });
  };

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stockDeltas: any[] = [];
    auditStocks.forEach(audit => {
        if (!audit.productoId) return;
        const currentQty = currentBalances.get(audit.sucursalId)?.get(audit.productoId) || 0;
        const delta = audit.cantidad - currentQty;
        if (delta !== 0) stockDeltas.push({ sucursalId: audit.sucursalId, productoId: audit.productoId, cantidad: delta });
    });
    onSave({ ...formData as Cliente, stockInicial: stockDeltas, contratosIniciales: contratosIniciales.filter(c => c.servicioId) });
  }, [formData, auditStocks, currentBalances, contratosIniciales, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        addSucursal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, addSucursal]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Ficha de Cliente</h2>
      
      <div className="space-y-6">
          <Card title="Información Comercial">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppInput label="Nombre de Fantasía (Local)" name="nombre" value={formData.nombre || ''} onChange={handleChange} required error={nombreExistente ? `Atención: Ya existe ${nombreExistente}` : undefined} />
                    <AppSelect label="Estado" name="estado" value={formData.estado || EstadoCliente.ACTIVO} onChange={handleChange} options={[{ value: EstadoCliente.ACTIVO, label: 'Activo' }, { value: EstadoCliente.INACTIVO, label: 'Inactivo' }]} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppInput label="Nombre Fiscal (Razón Social)" name="nombreFiscal" value={formData.nombreFiscal || ''} onChange={handleChange} placeholder="Ej: Perez Juan SRL" />
                    <AppInput label="CUIT" name="cuit" value={formatCuit(formData.cuit)} onChange={handleChange} error={cuitExistente ? `CUIT de ${cuitExistente}` : undefined} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppSelect label="Condición Fiscal" name="tipoFacturacion" value={formData.tipoFacturacion || ''} onChange={handleChange} options={[{value: '', label: 'Seleccionar...'}, ...Object.values(TipoFacturacion).map(v => ({value: v, label: v}))]} />
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-600">
                        <input type="checkbox" id="tieneCuentaCorriente" name="tieneCuentaCorriente" checked={formData.tieneCuentaCorriente || false} onChange={handleCheckboxChange} className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500" />
                        <label htmlFor="tieneCuentaCorriente" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">Habilitar Cuenta Corriente</label>
                    </div>
                </div>
            </div>
          </Card>

          <Card title="Sucursales, Rutas y Envases">
              <div className="space-y-6">
                  {(formData.sucursales || []).map((suc, index) => (
                      <div key={suc.id} className="p-5 border dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm space-y-5 relative overflow-hidden">
                          <button type="button" onClick={() => removeSucursal(index)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors p-2"><TrashIcon className="w-5 h-5"/></button>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-8">
                              <AppInput label="Nombre Sucursal" value={suc.nombre} onChange={(e) => handleSucursalChange(index, 'nombre', e.target.value)} placeholder="Ej: Principal / Depósito" />
                              <div className="relative">
                                  <AppInput label="Dirección" value={suc.direccion} onChange={(e) => handleSucursalChange(index, 'direccion', e.target.value)} />
                                  <button type="button" onClick={() => handleSearchAddress(index)} className="absolute right-2 top-8 p-1 text-primary-600 hover:bg-primary-50 rounded"><SearchIcon className="w-5 h-5"/></button>
                              </div>
                          </div>
                          <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Días de Reparto</label>
                              <div className="flex flex-wrap gap-2">
                                  {Object.values(DiaSemana).map(day => (
                                      <button key={day} type="button" onClick={() => toggleDiaReparto(index, day)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${suc.diasReparto?.includes(day) ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:border-gray-600 hover:bg-gray-100'}`}>{day.substring(0,3).toUpperCase()}</button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addSucursal} className="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-primary-600 hover:border-primary-500 transition-all font-bold text-sm">
                      + Agregar Sucursal <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+I)</span>
                  </button>
              </div>
          </Card>
      </div>

      <div className="flex justify-end gap-3 pt-6">
        <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
        <AppButton variant="primary" type="submit" size="lg" className="px-12 shadow-xl">Guardar Cambios <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>
  )
}

const ClientesView: React.FC<ClientesViewProps> = ({ clientes, remitos, productos, contratos, servicios, registrosPago, addCliente, updateCliente, deleteCliente, reactivarCliente }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente> | null>(null);
  const [clienteParaBaja, setClienteParaBaja] = useState<Cliente | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoCliente | 'todos'>(EstadoCliente.ACTIVO);
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const { user: currentUser } = useAuth();
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const deudasMap = useMemo(() => {
    const deudas = new Map<string, number>();
    const pagosMap = new Map<string, number>();
    registrosPago.forEach(p => pagosMap.set(p.origen.id, (pagosMap.get(p.origen.id) || 0) + p.monto));
    clientes.forEach(cliente => {
        let dt = 0;
        const rems = remitos.filter(r => r.clienteId === cliente.id && !r.esAjuste);
        const peMap = new Map<string, number>(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio] as [string, number]) || []);
        rems.forEach(r => {
            const tr = r.movimientos.reduce((s, m) => {
                const prod = productosMap.get(m.productoId);
                if (!prod) return s;
                return s + (m.entregados * (peMap.get(m.productoId) ?? prod.precio));
            }, 0);
            const pagado = pagosMap.get(r.id) || 0;
            if (tr > pagado) dt += (tr - pagado);
        });
        if (dt > 0.01) deudas.set(cliente.id, dt);
    });
    return deudas;
  }, [clientes, remitos, registrosPago, productosMap]);

  const stocksPorSucursal = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, number>>>();
    remitos.forEach(r => {
        const sucursId = r.sucursalId || 'main';
        if (!map.has(r.clienteId)) map.set(r.clienteId, new Map());
        const cm = map.get(r.clienteId)!;
        if (!cm.has(sucursId)) cm.set(sucursId, new Map());
        const sm = cm.get(sucursId)!;
        r.movimientos.forEach(m => {
            const current = sm.get(m.productoId) || 0;
            sm.set(m.productoId, current + (m.entregados - m.recibidos));
        });
    });
    return map;
  }, [remitos]);

  const handleSave = (c: (Omit<Cliente, 'id' | 'estado'> | Cliente)) => {
    try {
        if ('id' in c && c.id) updateCliente(c as Cliente);
        else addCliente(c as Omit<Cliente, 'id' | 'estado'>);
        showNotification('Guardado.', 'success');
        setIsModalOpen(false);
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c => {
        const matchesName = c.nombre.toLowerCase().includes(filter.toLowerCase());
        const matchesStatus = statusFilter === 'todos' || c.estado === statusFilter;
        return matchesName && matchesStatus;
    }).sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, filter, statusFilter]);

  if (isModalOpen) return (
    <div className="animate-fade-in">
        <div className="mb-6 flex items-center gap-4">
            <button onClick={() => setIsModalOpen(false)} className="p-2 -ml-2 text-gray-500 hover:bg-white dark:hover:bg-gray-800 rounded-full"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
            <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Gestión de Cliente</h1>
        </div>
        <ClienteForm cliente={editingCliente || {}} productos={productos} servicios={servicios} clientes={clientes} remitos={remitos} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
    </div>
  );

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        {currentUser?.rol === Rol.ADMINISTRADOR && <AppButton onClick={() => {setEditingCliente({estado: EstadoCliente.ACTIVO, sucursales: [{id: 'main', nombre: 'Casa Central', direccion: '', diasReparto: []}]}); setIsModalOpen(true);}}>+ Nuevo Cliente</AppButton>}
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <input type="text" placeholder="Buscar por nombre..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full md:w-1/3 p-3 bg-white dark:bg-gray-700 rounded-xl border dark:border-gray-600" />
          <div className="flex items-center space-x-4 bg-white dark:bg-gray-700 p-1 rounded-xl border dark:border-gray-600">
            {['Activo', 'Inactivo', 'todos'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>{s === 'todos' ? 'TODOS' : s.toUpperCase()}</button>
            ))}
          </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {filteredClientes.map(cliente => {
            const isExpanded = expandedClienteId === cliente.id;
            const deuda = deudasMap.get(cliente.id) || 0;
            const clienteStocks = stocksPorSucursal.get(cliente.id);
            return (
            <div key={cliente.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 transition-all ${cliente.estado === 'Inactivo' ? 'opacity-60' : ''}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedClienteId(isExpanded ? null : cliente.id)}>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cliente.nombre}</h3>
                             {deuda > 0.01 && <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-700">DEUDA: ${deuda.toLocaleString()}</span>}
                        </div>
                        <p className="text-xs text-gray-500">{cliente.sucursales.length} Punto(s) | {cliente.tieneCuentaCorriente ? 'A Crédito' : 'Contado'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        {currentUser?.rol === Rol.ADMINISTRADOR && <button onClick={(e) => { e.stopPropagation(); setEditingCliente(cliente); setIsModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"><PencilIcon /></button>}
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                {isExpanded && (
                    <div className="px-4 pb-4 pt-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ul className="text-sm space-y-1 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                                {cliente.nombreFiscal && <li><span className="text-gray-400">Raz. Soc:</span> {cliente.nombreFiscal}</li>}
                                {cliente.cuit && <li><span className="text-gray-400">CUIT:</span> {cliente.cuit}</li>}
                                {(cliente.telefonos || []).map((tel, i) => <li key={i}><span className="text-gray-400">{tel.tipo}:</span> {tel.numero}</li>)}
                            </ul>
                            <div className="space-y-3">
                                {cliente.sucursales.map((suc, i) => {
                                    const sucStockMap = clienteStocks?.get(suc.id);
                                    return (
                                        <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                                            <p className="font-black text-sm uppercase">{suc.nombre}</p>
                                            <p className="text-[10px] text-gray-500 mb-2">{suc.direccion}</p>
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t dark:border-gray-700">
                                                {sucStockMap ? Array.from(sucStockMap.entries()).map(([prodId, qty]) => qty > 0 && <div key={prodId} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-lg border dark:border-gray-700"><span className="text-[11px] font-black text-primary-600">{qty}</span><span className="text-[9px] text-gray-500 font-bold uppercase">{productosMap.get(prodId)?.nombre}</span></div>) : <p className="text-[9px] text-gray-400 italic">Sin envases.</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {currentUser?.rol === Rol.ADMINISTRADOR && (
                            <div className="mt-6 pt-4 border-t dark:border-gray-700 flex justify-end">
                                {cliente.estado === 'Activo' ? (
                                    <AppButton variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setClienteParaBaja(cliente); }}>Dar de Baja</AppButton>
                                ) : (
                                    <AppButton variant="success" size="sm" onClick={(e) => { e.stopPropagation(); reactivarCliente(cliente.id); }}>Reactivar</AppButton>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            )
        })}
      </div>
      {clienteParaBaja && (
        <Modal isOpen={!!clienteParaBaja} onClose={() => setClienteParaBaja(null)}>
            <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">¿Inactivar Cliente?</h2>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setClienteParaBaja(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={() => {deleteCliente(clienteParaBaja.id); setClienteParaBaja(null); showNotification('Inactivado.', 'success');}}>Confirmar Baja</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

export default ClientesView;
