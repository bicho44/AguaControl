
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
import { ClipboardListIcon } from '../components/icons/ClipboardListIcon';
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
  deleteContrato?: (contratoId: string) => void; // Nuevo prop opcional para manejar borrado desde la vista padre
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
  contratos: Contrato[]; 
  clientes: Cliente[]; 
  remitos: Remito[];
  onSave: (data: { cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente) & { stockInicial?: any[], contratosIniciales?: any[] }, contratosAEliminar: string[] }) => void;
  onClose: () => void;
}> = ({ cliente, productos, servicios, contratos, clientes, remitos, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Cliente>>(cliente);
  const [contratosIniciales, setContratosIniciales] = useState<Omit<Contrato, 'id'|'clienteId'>[]>([]);
  const [mapIndex, setMapIndex] = useState<number | null>(null);
  const [contratosAEliminar, setContratosAEliminar] = useState<Set<string>>(new Set());
  const { showNotification } = useNotification();
  
  const contratosVigentes = useMemo(() => {
      if (!cliente.id) return [];
      return contratos.filter(c => c.clienteId === cliente.id && c.estado === EstadoContrato.ACTIVO);
  }, [cliente.id, contratos]);

  const serviciosMap = useMemo(() => new Map(servicios.map(s => [s.id, s])), [servicios]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

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

  const isNew = !cliente.id;

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

  const handleAuditChange = (sucursalId: string, productoId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setAuditStocks(prev => {
        // Filtramos el item anterior de este producto en esta sucursal
        const others = prev.filter(a => !(a.sucursalId === sucursalId && a.productoId === productoId));
        // Agregamos el nuevo valor
        return [...others, { sucursalId, productoId, cantidad: qty }];
    });
  };

  const handleAddStockItem = (sucursalId: string) => {
      // Buscar un producto que no esté ya en la lista de auditoría para esa sucursal
      const existingIds = new Set(auditStocks.filter(a => a.sucursalId === sucursalId).map(a => a.productoId));
      const candidate = productos.find(p => !existingIds.has(p.id) && p.estado === EstadoProducto.ACTIVO);
      
      if (candidate) {
          setAuditStocks(prev => [...prev, { sucursalId, productoId: candidate.id, cantidad: 0 }]);
      } else {
          showNotification('Todos los productos ya están listados.', 'error');
      }
  };

  const handleStockProductChange = (sucursalId: string, oldProductId: string, newProductId: string) => {
      setAuditStocks(prev => prev.map(a => {
          if (a.sucursalId === sucursalId && a.productoId === oldProductId) {
              return { ...a, productoId: newProductId };
          }
          return a;
      }));
  };

  const removeStockItem = (sucursalId: string, productoId: string) => {
      setAuditStocks(prev => prev.filter(a => !(a.sucursalId === sucursalId && a.productoId === productoId)));
  };

  const addContratoInicial = () => {
    setContratosIniciales(prev => [...prev, { 
        servicioId: '', 
        tipo: TipoServicio.ALQUILER_PURO, 
        fechaInicio: new Date().toISOString().split('T')[0], 
        estado: EstadoContrato.ACTIVO 
    }]);
  };

  const removeContratoInicial = (index: number) => {
    setContratosIniciales(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDeleteContrato = (id: string) => {
      setContratosAEliminar(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const updateContratoInicial = (index: number, field: keyof Contrato | 'servicioId', value: any) => {
    const newC = [...contratosIniciales];
    if (field === 'servicioId') {
        const s = servicios.find(s => s.id === value);
        if (s) {
            newC[index] = {
                ...newC[index],
                servicioId: value,
                tipo: s.tipo,
                montoMensual: s.montoMensual,
                productoId: s.productoId,
                productoConsumoId: s.productoConsumoId,
                consumoIncluido: s.consumoIncluido
            };
        }
    } else {
        newC[index] = { ...newC[index], [field]: value };
    }
    setContratosIniciales(newC);
  };

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stockDeltas: any[] = [];
    
    // Calcular diferencias de stock
    auditStocks.forEach(audit => {
        if (!audit.productoId) return;
        const currentQty = currentBalances.get(audit.sucursalId)?.get(audit.productoId) || 0;
        const delta = audit.cantidad - currentQty;
        if (delta !== 0) stockDeltas.push({ sucursalId: audit.sucursalId, productoId: audit.productoId, cantidad: delta });
    });

    onSave({ 
        cliente: { 
            ...formData as Cliente, 
            stockInicial: stockDeltas, 
            contratosIniciales: contratosIniciales.filter(c => c.servicioId) 
        },
        contratosAEliminar: Array.from(contratosAEliminar)
    });
  }, [formData, auditStocks, currentBalances, contratosIniciales, contratosAEliminar, onSave]);

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

  const activeProductOptions = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO).map(p => ({ value: p.id, label: p.nombre })), [productos]);

  return (
    <>
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

          <Card title="Sucursales y Stock">
              <div className="space-y-6">
                  {(formData.sucursales || []).map((suc, index) => (
                      <div key={suc.id} className="p-5 border dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm space-y-5 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500"></div>
                          <button type="button" onClick={() => removeSucursal(index)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors p-2"><TrashIcon className="w-5 h-5"/></button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-8">
                              <AppInput label="Nombre Sucursal" value={suc.nombre} onChange={(e) => handleSucursalChange(index, 'nombre', e.target.value)} placeholder="Ej: Principal / Depósito" />
                              <div className="relative">
                                  <div className="flex items-end gap-2">
                                      <div className="flex-1">
                                          <AppInput label="Dirección" value={suc.direccion} onChange={(e) => handleSucursalChange(index, 'direccion', e.target.value)} />
                                      </div>
                                      <div className="flex gap-1 mb-1">
                                          <button type="button" onClick={() => handleSearchAddress(index)} title="Buscar dirección (Texto)" className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg"><SearchIcon className="w-5 h-5"/></button>
                                          <button type="button" onClick={() => setMapIndex(index)} title="Ubicar en Mapa" className={`p-2 rounded-lg transition-colors ${suc.lat ? 'text-white bg-green-600 hover:bg-green-700' : 'text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}><MapIcon className="w-5 h-5"/></button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Días de Reparto</label>
                                  <div className="flex flex-wrap gap-2">
                                      {Object.values(DiaSemana).map(day => (
                                          <button key={day} type="button" onClick={() => toggleDiaReparto(index, day)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${suc.diasReparto?.includes(day) ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:border-gray-600 hover:bg-gray-100'}`}>{day.substring(0,3).toUpperCase()}</button>
                                      ))}
                                  </div>
                              </div>

                              {/* STOCK INTEGRADO EN LA SUCURSAL - MODIFICADO PARA SER DINÁMICO */}
                              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                      <CubeIcon className="w-3 h-3"/> Inventario de Envases
                                  </label>
                                  
                                  {/* Lista de productos con stock definido o agregados manualmente */}
                                  <div className="space-y-2 mb-3">
                                      {auditStocks.filter(a => a.sucursalId === suc.id).map((item) => (
                                          <div key={item.productoId} className="flex gap-2 items-center">
                                              <div className="flex-grow">
                                                  <SearchableSelect 
                                                      options={activeProductOptions}
                                                      value={item.productoId}
                                                      onChange={(newId) => handleStockProductChange(suc.id, item.productoId, newId)}
                                                  />
                                              </div>
                                              <input 
                                                  type="number" 
                                                  value={item.cantidad} 
                                                  onChange={(e) => handleAuditChange(suc.id, item.productoId, e.target.value)} 
                                                  className="w-20 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-bold text-gray-800 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                                              />
                                              <button 
                                                  type="button" 
                                                  onClick={() => removeStockItem(suc.id, item.productoId)}
                                                  className="p-2 text-red-400 hover:text-red-600"
                                                  title="Quitar de la lista"
                                              >
                                                  <TrashIcon className="w-4 h-4" />
                                              </button>
                                          </div>
                                      ))}
                                  </div>

                                  <AppButton 
                                      variant="secondary" 
                                      size="sm" 
                                      className="w-full text-xs py-2"
                                      onClick={() => handleAddStockItem(suc.id)}
                                  >
                                      + Agregar Producto al Stock
                                  </AppButton>
                              </div>
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addSucursal} className="w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-primary-600 hover:border-primary-500 transition-all font-bold text-sm">
                      + Agregar Sucursal <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+I)</span>
                  </button>
              </div>
          </Card>

          <Card title="Gestión de Servicios y Contratos">
              <div className="space-y-6">
                  {/* Contratos Vigentes (Con opción de borrado) */}
                  {contratosVigentes.length > 0 && (
                      <div className="space-y-3 mb-6 pb-6 border-b dark:border-gray-700">
                          <label className="text-[10px] font-black text-green-600 uppercase tracking-widest px-1">Contratos Activos</label>
                          <div className="grid grid-cols-1 gap-3">
                              {contratosVigentes.map(c => {
                                  const s = serviciosMap.get(c.servicioId);
                                  const isDeleted = contratosAEliminar.has(c.id);
                                  
                                  return (
                                      <div key={c.id} className={`flex justify-between items-center p-3 border rounded-xl shadow-sm transition-all ${isDeleted ? 'bg-red-50 border-red-200 opacity-60 grayscale' : 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-900/50 border-l-4 border-l-green-500'}`}>
                                          <div>
                                              <p className={`font-bold text-sm ${isDeleted ? 'text-red-800 line-through' : 'text-gray-800 dark:text-white'}`}>
                                                  {s?.nombre || 'Servicio Personalizado'}
                                              </p>
                                              <p className="text-xs text-gray-500">Inicio: {new Date(c.fechaInicio).toLocaleDateString()} • ${c.montoMensual?.toLocaleString() || 0}/mes</p>
                                              {isDeleted && <span className="text-[10px] font-black text-red-600 uppercase">SE ELIMINARÁ AL GUARDAR</span>}
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <div className="flex flex-col items-end gap-1">
                                                  <span className="text-[10px] font-black uppercase bg-green-50 text-green-700 px-2 py-0.5 rounded">{c.tipo}</span>
                                              </div>
                                              <button 
                                                  type="button" 
                                                  onClick={() => toggleDeleteContrato(c.id)}
                                                  className={`p-2 rounded-full transition-colors ${isDeleted ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' : 'bg-red-100 text-red-500 hover:bg-red-200'}`}
                                                  title={isDeleted ? "Deshacer eliminación" : "Dar de baja contrato"}
                                              >
                                                  {isDeleted ? <ReplyIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}

                  {/* Asignación de Nuevos Contratos (Formulario expandido) */}
                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Alta de Nuevos Servicios</label>
                          <AppButton variant="secondary" size="sm" onClick={addContratoInicial} className="text-xs">
                              + Agregar
                          </AppButton>
                      </div>
                      
                      {contratosIniciales.map((c, idx) => (
                          <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 space-y-3 relative">
                              <button type="button" onClick={() => removeContratoInicial(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                                  <div className="col-span-2">
                                      <label className="text-[9px] font-bold text-gray-400 uppercase">Servicio Base</label>
                                      <SearchableSelect 
                                          options={servicios.filter(s => s.estado === EstadoServicio.ACTIVO).map(s => ({value: s.id, label: s.nombre}))}
                                          value={c.servicioId}
                                          onChange={(v) => updateContratoInicial(idx, 'servicioId', v)}
                                          placeholder="Seleccionar..."
                                      />
                                  </div>
                                  <div>
                                      <label className="text-[9px] font-bold text-gray-400 uppercase">Inicio</label>
                                      <input type="date" value={c.fechaInicio} onChange={(e) => updateContratoInicial(idx, 'fechaInicio', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" />
                                  </div>
                                  <div>
                                      <label className="text-[9px] font-bold text-gray-400 uppercase">Monto Mensual</label>
                                      <input type="number" value={c.montoMensual || ''} onChange={(e) => updateContratoInicial(idx, 'montoMensual', parseFloat(e.target.value))} className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" placeholder="$" />
                                  </div>
                              </div>
                          </div>
                      ))}
                      
                      {contratosIniciales.length === 0 && contratosVigentes.length === 0 && (
                          <div className="text-center py-4 text-gray-400 text-xs italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                              Sin servicios asignados.
                          </div>
                      )}
                  </div>
              </div>
          </Card>
      </div>

      <div className="flex justify-end gap-3 pt-6">
        <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
        <AppButton variant="primary" type="submit" size="lg" className="px-12 shadow-xl">Guardar Cambios <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>

    {mapIndex !== null && (
        <MapPickerModal 
            initialLat={formData.sucursales?.[mapIndex]?.lat}
            initialLng={formData.sucursales?.[mapIndex]?.lng}
            initialAddress={formData.sucursales?.[mapIndex]?.direccion || ''}
            onConfirm={(lat, lng, address) => {
                const newSucs = [...(formData.sucursales || [])];
                newSucs[mapIndex] = { ...newSucs[mapIndex], lat, lng, direccion: address };
                setFormData(prev => ({ ...prev, sucursales: newSucs }));
                setMapIndex(null);
            }}
            onClose={() => setMapIndex(null)}
        />
    )}
    </>
  )
}

const ClientesView: React.FC<ClientesViewProps> = ({ clientes, remitos, productos, contratos, servicios, registrosPago, addCliente, updateCliente, deleteCliente, reactivarCliente, deleteContrato }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente> | null>(null);
  const [clienteParaBaja, setClienteParaBaja] = useState<Cliente | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoCliente | 'todos'>(EstadoCliente.ACTIVO);
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const { user: currentUser } = useAuth();
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const serviciosMap = useMemo(() => new Map(servicios.map(s => [s.id, s])), [servicios]);

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

  const handleSave = ({ cliente: c, contratosAEliminar }: { cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente), contratosAEliminar: string[] }) => {
    try {
        // 1. Procesar eliminación de contratos si los hay y si tenemos la función
        if (contratosAEliminar.length > 0 && deleteContrato) {
            contratosAEliminar.forEach(id => deleteContrato(id));
        }

        // 2. Guardar o Actualizar Cliente
        if ('id' in c && c.id) updateCliente(c as Cliente);
        else addCliente(c as Omit<Cliente, 'id' | 'estado'>);
        
        showNotification('Guardado.', 'success');
        setIsModalOpen(false);
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const openNewModal = useCallback(() => {
    if (currentUser?.rol !== Rol.ADMINISTRADOR) return;
    setEditingCliente({estado: EstadoCliente.ACTIVO, sucursales: [{id: 'main', nombre: 'Casa Central', direccion: '', diasReparto: []}]});
    setIsModalOpen(true);
  }, [currentUser]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'n' || e.key === 'N') && !isModalOpen) {
            e.preventDefault();
            openNewModal();
        }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isModalOpen, openNewModal]);

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
        <ClienteForm 
            cliente={editingCliente || {}} 
            productos={productos} 
            servicios={servicios} 
            contratos={contratos}
            clientes={clientes} 
            remitos={remitos} 
            onSave={handleSave} 
            onClose={() => setIsModalOpen(false)} 
        />
    </div>
  );

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        {currentUser?.rol === Rol.ADMINISTRADOR && (
            <AppButton onClick={openNewModal}>
                + Nuevo Cliente <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
            </AppButton>
        )}
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
            const activeContracts = contratos.filter(c => c.clienteId === cliente.id && c.estado === EstadoContrato.ACTIVO);

            // LOGICA DE AGRUPACIÓN POR SUCURSAL
            const contractsBySucursal = activeContracts.reduce((acc, contrato) => {
                const key = contrato.sucursalId || 'general';
                if (!acc[key]) acc[key] = [];
                
                // Agrupar por Servicio dentro de la sucursal (para que no salgan líneas repetidas)
                const existingGroup = acc[key].find(g => g.servicioId === contrato.servicioId);
                if (existingGroup) {
                    existingGroup.cantidad++;
                } else {
                    acc[key].push({
                        servicioId: contrato.servicioId,
                        nombre: serviciosMap.get(contrato.servicioId)?.nombre || 'Servicio',
                        cantidad: 1
                    });
                }
                return acc;
            }, {} as Record<string, { servicioId: string, nombre: string, cantidad: number }[]>);

            const hasGeneralContracts = contractsBySucursal['general'] && contractsBySucursal['general'].length > 0;

            return (
            <div key={cliente.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 transition-all ${cliente.estado === 'Inactivo' ? 'opacity-60' : ''}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedClienteId(isExpanded ? null : cliente.id)}>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cliente.nombre}</h3>
                             {deuda > 0.01 && <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-700">DEUDA: ${deuda.toLocaleString()}</span>}
                             {activeContracts.length > 0 && <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-green-100 text-green-700">{activeContracts.length} Servicios</span>}
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
                            <div className="space-y-4">
                                <ul className="text-sm space-y-1 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                                    {cliente.nombreFiscal && <li><span className="text-gray-400">Raz. Soc:</span> {cliente.nombreFiscal}</li>}
                                    {cliente.cuit && <li><span className="text-gray-400">CUIT:</span> {cliente.cuit}</li>}
                                    {(cliente.telefonos || []).map((tel, i) => <li key={i}><span className="text-gray-400">{tel.tipo}:</span> {tel.numero}</li>)}
                                </ul>
                                
                                {hasGeneralContracts && (
                                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-200 dark:border-green-800">
                                        <p className="text-[10px] font-black uppercase text-green-800 dark:text-green-300 mb-2 flex items-center gap-2"><ClipboardListIcon className="w-3 h-3"/> Contratos Generales</p>
                                        <div className="space-y-2">
                                            {contractsBySucursal['general'].map((group, idx) => (
                                                <div key={idx} className="flex justify-between items-center border-b border-green-200 dark:border-green-800/50 pb-1 last:border-0 last:pb-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-black px-1.5 rounded">{group.cantidad}x</span>
                                                        <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">{group.nombre}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {cliente.sucursales.map((suc, i) => {
                                    const sucStockMap = clienteStocks?.get(suc.id);
                                    const branchContracts = contractsBySucursal[suc.id] || [];
                                    
                                    return (
                                        <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-black text-sm uppercase">{suc.nombre}</p>
                                                    <p className="text-[10px] text-gray-500">{suc.direccion}</p>
                                                </div>
                                                {suc.lat && <a href={`https://www.google.com/maps/search/?api=1&query=${suc.lat},${suc.lng}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-700"><MapIcon className="w-4 h-4"/></a>}
                                            </div>

                                            {/* CONTRATOS ESPECIFICOS DE LA SUCURSAL */}
                                            {branchContracts.length > 0 && (
                                                <div className="mb-3 py-2 border-y border-dashed border-gray-200 dark:border-gray-700">
                                                    <p className="text-[9px] font-black text-green-600 mb-1 uppercase">Equipos en Comodato/Alquiler</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {branchContracts.map((c, idx) => (
                                                            <div key={idx} className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-100 dark:border-green-800">
                                                                <span className="text-[10px] font-black text-green-700 dark:text-green-300">{c.cantidad}x</span>
                                                                <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate max-w-[150px]">{c.nombre}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-1.5 pt-1">
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
