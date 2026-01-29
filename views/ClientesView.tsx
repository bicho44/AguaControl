import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Cliente, Sucursal, Remito, Producto, TipoProducto, TipoFacturacion, Telefono, TipoTelefono, Contrato, EstadoContrato, Servicio, TipoServicio, EstadoCliente, EstadoServicio, EstadoProducto, DiaSemana, RegistroPago, Rol } from '../types';
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
  updateCliente: (cliente: Cliente) => void;
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
  onSave: (cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente) & { stockInicial?: any[], contratosIniciales?: any[] }) => void;
  onClose: () => void;
}> = ({ cliente, productos, servicios, clientes, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Cliente>>(cliente);
  const [stockInicial, setStockInicial] = useState<{ productoId: string; cantidad: number; sucursalId?: string }[]>([]);
  const [contratosIniciales, setContratosIniciales] = useState<Omit<Contrato, 'id'|'clienteId'>[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [cuitExistente, setCuitExistente] = useState<string | null>(null);
  const [nombreExistente, setNombreExistente] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { showNotification } = useNotification();

  const [mapModalConfig, setMapModalConfig] = useState<{
    isOpen: boolean;
    sucursalIndex: number | null;
    initialLat?: number;
    initialLng?: number;
    initialAddress: string;
  }>({ isOpen: false, sucursalIndex: null, initialAddress: '' });

  const isNew = !cliente.id;
  
  useEffect(() => {
    if (!isNew) return;
    const cuitLimpio = unformatCuit(formData.cuit);
    if (cuitLimpio.length === 11) {
        const clienteExistente = clientes.find(c => unformatCuit(c.cuit) === cuitLimpio);
        setCuitExistente(clienteExistente ? clienteExistente.nombre : null);
    } else setCuitExistente(null);

    const nombreTrimmedLower = formData.nombre?.trim().toLowerCase();
    if (nombreTrimmedLower) {
        const clienteExistente = clientes.find(c => c.nombre.trim().toLowerCase() === nombreTrimmedLower);
        setNombreExistente(clienteExistente ? clienteExistente.nombre : null);
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
      const newSucursales = [...(formData.sucursales || [])];
      newSucursales[index] = { ...newSucursales[index], [field]: value };
      setFormData(prev => ({ ...prev, sucursales: newSucursales }));
  }

  const handleUpdateSucursalLocation = (index: number, lat: number, lng: number, address: string) => {
      setFormData(prev => {
          const newSucursales = [...(prev.sucursales || [])];
          newSucursales[index] = { ...newSucursales[index], lat, lng, direccion: address };
          return { ...prev, sucursales: newSucursales };
      });
  };

  const toggleDiaReparto = (sucursalIndex: number, day: DiaSemana) => {
      const newSucursales = [...(formData.sucursales || [])];
      const currentDays = newSucursales[sucursalIndex].diasReparto || [];
      const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
      newSucursales[sucursalIndex] = { ...newSucursales[sucursalIndex], diasReparto: newDays };
      setFormData(prev => ({ ...prev, sucursales: newSucursales }));
  }
  
  const handleSearchAddress = async (index: number) => {
      const direccion = formData.sucursales?.[index]?.direccion;
      if (!direccion) return showNotification('Ingrese una dirección', 'error');
      setIsSearching(true);
      try {
          const query = direccion.toLowerCase().includes('argentina') ? direccion : `${direccion}, Argentina`;
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
          const data = await response.json();
          if (data && data.length > 0) {
              handleUpdateSucursalLocation(index, parseFloat(data[0].lat), parseFloat(data[0].lon), direccion);
              showNotification('Dirección validada.', 'success');
          } else showNotification('Dirección no encontrada.', 'error');
      } catch (error) { showNotification('Error de búsqueda.', 'error'); } 
      finally { setIsSearching(false); }
  };

  const handleOpenMap = (index: number) => {
      const sucursal = formData.sucursales?.[index];
      setMapModalConfig({
          isOpen: true,
          sucursalIndex: index,
          initialLat: sucursal?.lat,
          initialLng: sucursal?.lng,
          initialAddress: sucursal?.direccion || ''
      });
  };

  const handleMapConfirm = (lat: number, lng: number, address: string) => {
      if (mapModalConfig.sucursalIndex !== null) {
          handleUpdateSucursalLocation(mapModalConfig.sucursalIndex, lat, lng, address);
      }
  };

  const addSucursal = () => setFormData(prev => ({...prev, sucursales: [...(prev.sucursales || []), { id: `new_${Date.now()}`, nombre: '', direccion: '', diasReparto: [] }]}));
  const removeSucursal = (index: number) => setFormData(prev => ({...prev, sucursales: prev.sucursales?.filter((_, i) => i !== index)}));

  const handleTelefonoChange = (index: number, field: keyof Telefono, value: string) => {
    const newTelefonos = [...(formData.telefonos || [])];
    newTelefonos[index] = { ...newTelefonos[index], [field]: value };
    setFormData(prev => ({ ...prev, telefonos: newTelefonos }));
  }
  const addTelefono = () => setFormData(prev => ({ ...prev, telefonos: [...(prev.telefonos || []), { tipo: TipoTelefono.CEL, numero: '' }] }));
  const removeTelefono = (index: number) => setFormData(prev => ({ ...prev, telefonos: prev.telefonos?.filter((_, i) => i !== index) }));

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...(formData.emails || [])];
    newEmails[index] = value;
    setFormData(prev => ({ ...prev, emails: newEmails }));
  }
  const addEmail = () => setFormData(prev => ({ ...prev, emails: [...(prev.emails || []), ''] }));
  const removeEmail = (index: number) => setFormData(prev => ({ ...prev, emails: prev.emails?.filter((_, i) => i !== index) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Cliente);
  };
  
  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);
  const sucursalOptions = useMemo(() => [{ value: '', label: 'Casa Central' }, ...(formData.sucursales || []).map(s => ({ value: s.id, label: s.nombre }))], [formData.sucursales]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Ficha de Cliente</h2>
      
      <div className="space-y-6">
          <Card title="Información Comercial">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppInput label="Nombre del Cliente" name="nombre" value={formData.nombre || ''} onChange={handleChange} required error={nombreExistente ? `Atención: Ya existe ${nombreExistente}` : undefined} />
                    <AppSelect 
                        label="Estado" 
                        name="estado" 
                        value={formData.estado || EstadoCliente.ACTIVO} 
                        onChange={handleChange} 
                        options={[
                            { value: EstadoCliente.ACTIVO, label: 'Activo' },
                            { value: EstadoCliente.INACTIVO, label: 'Inactivo' }
                        ]} 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AppInput label="CUIT" name="cuit" value={formatCuit(formData.cuit)} onChange={handleChange} error={cuitExistente ? `CUIT de ${cuitExistente}` : undefined} />
                    <AppSelect label="Condición Fiscal" name="tipoFacturacion" value={formData.tipoFacturacion || ''} onChange={handleChange} options={[{value: '', label: 'Seleccionar...'}, ...Object.values(TipoFacturacion).map(v => ({value: v, label: v}))]} />
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-600">
                    <input type="checkbox" id="tieneCuentaCorriente" name="tieneCuentaCorriente" checked={formData.tieneCuentaCorriente || false} onChange={handleCheckboxChange} className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500" />
                    <label htmlFor="tieneCuentaCorriente" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">Habilitar Cuenta Corriente (Venta a crédito)</label>
                </div>
            </div>
          </Card>

          <Card title="Contacto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Teléfonos</p>
                      {(formData.telefonos || []).map((tel, index) => (
                          <div key={index} className="flex gap-2">
                              <div className="w-1/3"><AppSelect value={tel.tipo} onChange={(e) => handleTelefonoChange(index, 'tipo', e.target.value)} options={Object.values(TipoTelefono).map(t => ({value: t, label: t}))} /></div>
                              <AppInput className="flex-1" value={tel.numero} onChange={(e) => handleTelefonoChange(index, 'numero', e.target.value)} placeholder="Nro..." />
                              <AppButton variant="danger" size="sm" onClick={() => removeTelefono(index)} className="!p-2"><TrashIcon className="w-5 h-5"/></AppButton>
                          </div>
                      ))}
                      <AppButton variant="secondary" size="sm" onClick={addTelefono} className="w-full border-dashed border-2">+ Teléfono</AppButton>
                  </div>
                  <div className="space-y-3">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Emails</p>
                      {(formData.emails || []).map((email, index) => (
                          <div key={index} className="flex gap-2">
                              <AppInput className="flex-1" value={email} onChange={(e) => handleEmailChange(index, e.target.value)} placeholder="correo@ejemplo.com" />
                              <AppButton variant="danger" size="sm" onClick={() => removeEmail(index)} className="!p-2"><TrashIcon className="w-5 h-5"/></AppButton>
                          </div>
                      ))}
                      <AppButton variant="secondary" size="sm" onClick={addEmail} className="w-full border-dashed border-2">+ Email</AppButton>
                  </div>
              </div>
          </Card>

          <Card title="Sucursales y Rutas">
              <div className="space-y-4">
                  {(formData.sucursales || []).map((suc, index) => (
                      <div key={index} className="p-4 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/40 space-y-4 relative">
                          <button type="button" onClick={() => removeSucursal(index)} className="absolute top-2 right-2 text-red-500 p-2"><TrashIcon className="w-5 h-5"/></button>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                              <AppInput label="Nombre Sucursal" value={suc.nombre} onChange={(e) => handleSucursalChange(index, 'nombre', e.target.value)} placeholder="Ej: Local Centro" />
                              <div className="relative">
                                  <AppInput label="Dirección" value={suc.direccion} onChange={(e) => handleSucursalChange(index, 'direccion', e.target.value)} />
                                  <button type="button" onClick={() => handleSearchAddress(index)} className="absolute right-2 top-8 p-1 text-primary-600 hover:bg-primary-50 rounded"><SearchIcon className="w-5 h-5"/></button>
                              </div>
                          </div>
                          <div className="space-y-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Días de Reparto</label>
                              <div className="flex flex-wrap gap-2">
                                  {Object.values(DiaSemana).map(day => (
                                      <button key={day} type="button" onClick={() => toggleDiaReparto(index, day)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${suc.diasReparto?.includes(day) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-gray-700 text-gray-500 dark:border-gray-600'}`}>
                                          {day.substring(0,3)}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700 mt-2">
                              <span className={`text-xs font-bold ${suc.lat ? 'text-green-500' : 'text-gray-400'}`}>{suc.lat ? '✓ Ubicación guardada' : '⚠ Sin ubicación'}</span>
                              <AppButton variant="secondary" size="sm" onClick={() => handleOpenMap(index)}>Configurar Mapa</AppButton>
                          </div>
                      </div>
                  ))}
                  <AppButton variant="secondary" onClick={addSucursal} className="w-full border-dashed border-2 py-4">+ Agregar Nueva Sucursal / Punto de Entrega</AppButton>
              </div>
          </Card>
      </div>

      {mapModalConfig.isOpen && (
          <MapPickerModal initialLat={mapModalConfig.initialLat} initialLng={mapModalConfig.initialLng} initialAddress={mapModalConfig.initialAddress} onConfirm={handleMapConfirm} onClose={() => setMapModalConfig({ isOpen: false, sucursalIndex: null, initialAddress: '' })} />
      )}

      <div className="flex justify-end gap-3 pt-6">
        <AppButton variant="secondary" onClick={onClose} size="lg">Cancelar</AppButton>
        <AppButton variant="primary" type="submit" size="lg" className="px-12">Guardar Cliente</AppButton>
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
        let deudaTotal = 0;
        const remitosCliente = remitos.filter(r => r.clienteId === cliente.id);
        const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));
        remitosCliente.forEach(r => {
            const totalRemito = r.movimientos.reduce((sum, mov) => {
                const prod = productosMap.get(mov.productoId);
                if (!prod) return sum;
                return sum + (mov.entregados * (preciosEspecialesMap.get(mov.productoId) ?? prod.precio));
            }, 0);
            const pagado = pagosMap.get(r.id) || 0;
            if (totalRemito > pagado) deudaTotal += (totalRemito - pagado);
        });
        if (deudaTotal > 0.01) deudas.set(cliente.id, deudaTotal);
    });
    return deudas;
  }, [clientes, remitos, registrosPago, productosMap]);

  const handleSave = (cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente)) => {
    try {
        if ('id' in cliente && cliente.id) {
            updateCliente(cliente as Cliente);
            showNotification('Cliente actualizado.', 'success');
        } else {
            addCliente(cliente as Omit<Cliente, 'id' | 'estado'>);
            showNotification('Cliente creado.', 'success');
        }
        setIsModalOpen(false);
    } catch (e) { showNotification('Error al guardar.', 'error'); }
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c => {
        const matchesName = c.nombre.toLowerCase().includes(filter.toLowerCase());
        const matchesStatus = statusFilter === 'todos' || c.estado === statusFilter;
        return matchesName && matchesStatus;
    }).sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, filter, statusFilter]);

  if (isModalOpen) {
      return (
          <div className="animate-fade-in">
              <div className="mb-6 flex items-center gap-4">
                  <button onClick={() => setIsModalOpen(false)} className="p-2 -ml-2 text-gray-500 hover:bg-white dark:hover:bg-gray-800 rounded-full transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Gestión de Cliente</h1>
              </div>
              <ClienteForm cliente={editingCliente || {}} productos={productos} servicios={servicios} clientes={clientes} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
          </div>
      );
  }

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        {currentUser?.rol === Rol.ADMINISTRADOR && <AppButton onClick={() => {setEditingCliente({estado: EstadoCliente.ACTIVO, sucursales: [{id: 'new_1', nombre: 'Casa Central', direccion: '', diasReparto: []}]}); setIsModalOpen(true);}}>+ Nuevo Cliente</AppButton>}
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
          <input type="text" placeholder="Buscar por nombre..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full md:w-1/3 p-3 bg-white dark:bg-gray-700 rounded-xl border dark:border-gray-600 focus:ring-2 focus:ring-primary-500" />
          <div className="flex items-center space-x-4 bg-white dark:bg-gray-700 p-1 rounded-xl border dark:border-gray-600">
            {['Activo', 'Inactivo', 'todos'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${statusFilter === s ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>{s === 'todos' ? 'TODOS' : s.toUpperCase()}</button>
            ))}
          </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredClientes.map(cliente => {
            const isExpanded = expandedClienteId === cliente.id;
            const deuda = deudasMap.get(cliente.id) || 0;
            return (
            <div key={cliente.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border dark:border-gray-700 transition-all ${cliente.estado === 'Inactivo' ? 'opacity-60' : ''}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedClienteId(isExpanded ? null : cliente.id)}>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cliente.nombre}</h3>
                             {deuda > 0.01 && <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">DEUDA: ${deuda.toLocaleString()}</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{cliente.sucursales.length} Punto(s) | {cliente.tieneCuentaCorriente ? 'A Crédito' : 'Contado'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        {currentUser?.rol === Rol.ADMINISTRADOR && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingCliente(cliente); setIsModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><PencilIcon /></button>
                        )}
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</p>
                                <ul className="text-sm space-y-1">
                                    {cliente.cuit && <li><span className="text-gray-400">CUIT:</span> {cliente.cuit}</li>}
                                    {(cliente.telefonos || []).map((tel, i) => <li key={i}><span className="text-gray-400">{tel.tipo}:</span> {tel.numero}</li>)}
                                    {(cliente.emails || []).map((email, i) => <li key={i}><span className="text-gray-400">Email:</span> {email}</li>)}
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursales</p>
                                <div className="space-y-2">
                                    {cliente.sucursales.map((suc, i) => (
                                        <div key={i} className="bg-white dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700 flex justify-between items-center shadow-sm">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-white text-sm">{suc.nombre}</p>
                                                <p className="text-[10px] text-gray-500">{suc.direccion}</p>
                                            </div>
                                            {suc.lat && <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${suc.lat},${suc.lng}`, '_blank'); }} className="p-2 bg-green-50 text-green-700 rounded-full"><MapIcon className="w-5 h-5" /></button>}
                                        </div>
                                    ))}
                                </div>
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
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600"><TrashIcon className="w-8 h-8"/></div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">¿Inactivar Cliente?</h2>
                <p className="text-gray-500">{clienteParaBaja.nombre} no podrá realizar nuevas compras pero su deuda permanecerá visible.</p>
                <div className="flex justify-center gap-3">
                    <AppButton variant="secondary" onClick={() => setClienteParaBaja(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={() => {deleteCliente(clienteParaBaja.id); setClienteParaBaja(null); showNotification('Cliente inactivado.', 'success');}}>Confirmar Baja</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

export default ClientesView;