
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
  registrosPago: RegistroPago[]; // Añadimos esto para calcular deuda rápida
  addCliente: (cliente: Omit<Cliente, 'id' | 'estado'> & { stockInicial?: any[], contratosIniciales?: any[] }) => void;
  updateCliente: (cliente: Cliente) => void;
  deleteCliente: (clienteId: string) => void;
  reactivarCliente: (clienteId: string) => void;
}

const formatCuit = (value: string = '') => {
  const digits = value.replace(/\D/g, '').substring(0, 11);
  let formatted = '';
  if (digits.length > 0) {
    formatted += digits.substring(0, 2);
  }
  if (digits.length > 2) {
    formatted += '-' + digits.substring(2, 10);
  }
  if (digits.length > 10) {
    formatted += '-' + digits.substring(10, 11);
  }
  return formatted;
};

const unformatCuit = (value: string = '') => {
  return value.replace(/\D/g, '');
};

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
    
    const unformattedCuit = unformatCuit(formData.cuit);
    if (unformattedCuit.length === 11) {
        const clienteExistente = clientes.find(c => unformatCuit(c.cuit) === unformattedCuit);
        setCuitExistente(clienteExistente ? clienteExistente.nombre : null);
    } else {
        setCuitExistente(null);
    }

    const nombreTrimmedLower = formData.nombre?.trim().toLowerCase();
    if (nombreTrimmedLower) {
        const clienteExistente = clientes.find(c => c.nombre.trim().toLowerCase() === nombreTrimmedLower);
        setNombreExistente(clienteExistente ? clienteExistente.nombre : null);
    } else {
        setNombreExistente(null);
    }
  }, [formData.cuit, formData.nombre, clientes, isNew]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cuit') {
        setFormData(prev => ({ ...prev, [name]: value }));
        return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
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
          newSucursales[index] = {
              ...newSucursales[index],
              lat: lat,
              lng: lng,
              direccion: address
          };
          return { ...prev, sucursales: newSucursales };
      });
  };

  const toggleDiaReparto = (sucursalIndex: number, day: DiaSemana) => {
      const newSucursales = [...(formData.sucursales || [])];
      const sucursal = newSucursales[sucursalIndex];
      const currentDays = sucursal.diasReparto || [];
      
      let newDays;
      if (currentDays.includes(day)) {
          newDays = currentDays.filter(d => d !== day);
      } else {
          newDays = [...currentDays, day];
      }
      
      newSucursales[sucursalIndex] = { ...sucursal, diasReparto: newDays };
      setFormData(prev => ({ ...prev, sucursales: newSucursales }));
  }
  
  const handleSearchAddress = async (index: number) => {
      const direccion = formData.sucursales?.[index]?.direccion;
      if (!direccion) {
          showNotification('Ingrese una dirección para buscar', 'error');
          return;
      }

      setIsSearching(true);
      try {
          const query = direccion.toLowerCase().includes('argentina') ? direccion : `${direccion}, Argentina`;
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
          const data = await response.json();

          if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lng = parseFloat(data[0].lon);
              
              handleUpdateSucursalLocation(index, lat, lng, direccion);
              showNotification('Coordenadas encontradas. Puede verlas en el mapa.', 'success');
          } else {
              showNotification('No se encontró la dirección exacta. Ubíquela manualmente en el mapa.', 'error');
          }
      } catch (error) {
          console.error("Geocoding error:", error);
          showNotification('Error al buscar la dirección.', 'error');
      } finally {
          setIsSearching(false);
      }
  };

  const handleOpenMap = async (index: number) => {
      const sucursal = formData.sucursales?.[index];
      
      let lat = sucursal?.lat;
      let lng = sucursal?.lng;
      const address = sucursal?.direccion || '';

      if (address && (!lat || !lng)) {
           setIsSearching(true);
           try {
               const query = address.toLowerCase().includes('argentina') ? address : `${address}, Argentina`;
               const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
               const data = await response.json();
               if (data && data.length > 0) {
                   lat = parseFloat(data[0].lat);
                   lng = parseFloat(data[0].lon);
               }
           } catch(e) { console.error(e); }
           setIsSearching(false);
      }

      setMapModalConfig({
          isOpen: true,
          sucursalIndex: index,
          initialLat: lat,
          initialLng: lng,
          initialAddress: address
      });
  };

  const handleMapConfirm = (lat: number, lng: number, address: string) => {
      if (mapModalConfig.sucursalIndex !== null) {
          handleUpdateSucursalLocation(mapModalConfig.sucursalIndex, lat, lng, address);
      }
      setMapModalConfig({ isOpen: false, sucursalIndex: null, initialAddress: '' });
  };

  const addSucursal = () => {
      const newSucursal: Sucursal = { id: `new_${Date.now()}`, nombre: '', direccion: '', diasReparto: [] };
      setFormData(prev => ({...prev, sucursales: [...(prev.sucursales || []), newSucursal]}));
  }
  const removeSucursal = (index: number) => {
      setFormData(prev => ({...prev, sucursales: prev.sucursales?.filter((_, i) => i !== index)}));
  }

  const handleTelefonoChange = (index: number, field: keyof Telefono, value: string) => {
    const newTelefonos = [...(formData.telefonos || [])];
    newTelefonos[index] = { ...newTelefonos[index], [field]: value };
    setFormData(prev => ({ ...prev, telefonos: newTelefonos }));
  }
  const addTelefono = () => {
    const newTelefono: Telefono = { tipo: TipoTelefono.CEL, numero: '' };
    setFormData(prev => ({ ...prev, telefonos: [...(prev.telefonos || []), newTelefono] }));
  }
  const removeTelefono = (index: number) => {
    setFormData(prev => ({ ...prev, telefonos: prev.telefonos?.filter((_, i) => i !== index) }));
  }

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...(formData.emails || [])];
    newEmails[index] = value;
    setFormData(prev => ({ ...prev, emails: newEmails }));
  }
  const addEmail = () => {
    setFormData(prev => ({ ...prev, emails: [...(prev.emails || []), ''] }));
  }
  const removeEmail = (index: number) => {
    setFormData(prev => ({ ...prev, emails: prev.emails?.filter((_, i) => i !== index) }));
  }

  const handlePrecioEspecialChange = (index: number, field: 'productoId' | 'precio', value: string) => {
    const newPrecios = [...(formData.preciosEspeciales || [])];
    const updatedValue = field === 'precio' ? (value === '' ? 0 : Number(value)) : value;
    newPrecios[index] = { ...newPrecios[index], [field]: updatedValue };
    setFormData(prev => ({ ...prev, preciosEspeciales: newPrecios }));
  }
  const addPrecioEspecial = () => {
    const newPrecio = { productoId: '', precio: 0 };
    setFormData(prev => ({ ...prev, preciosEspeciales: [...(prev.preciosEspeciales || []), newPrecio] }));
  }
  const removePrecioEspecial = (index: number) => {
    setFormData(prev => ({ ...prev, preciosEspeciales: prev.preciosEspeciales?.filter((_, i) => i !== index) }));
  }

    const handleStockChange = (index: number, field: 'productoId' | 'cantidad' | 'sucursalId', value: string) => {
        const newStock = [...stockInicial];
        const updatedValue = field === 'cantidad' ? (value === '' ? 0 : Number(value)) : value;
        newStock[index] = { ...newStock[index], [field]: updatedValue };
        setStockInicial(newStock);
    };
    const addStockRow = () => setStockInicial([...stockInicial, { productoId: '', cantidad: 0, sucursalId: '' }]);
    const removeStockRow = (index: number) => setStockInicial(stockInicial.filter((_, i) => i !== index));

    const handleContratoChange = (index: number, field: keyof Omit<Contrato, 'id'|'clienteId'>, value: any) => {
        const newContratos = [...contratosIniciales];
        let newContrato = { ...newContratos[index], [field]: value };

        if (field === 'servicioId') {
            const servicio = servicios.find(s => s.id === value);
            if (servicio) {
                newContrato = {
                    ...newContrato,
                    tipo: servicio.tipo,
                    productoId: servicio.productoId || undefined,
                    montoMensual: servicio.montoMensual ?? undefined,
                    productoConsumoId: servicio.productoConsumoId || undefined,
                    consumoIncluido: servicio.consumoIncluido ?? undefined,
                };
            }
        }
        newContratos[index] = newContrato;
        setContratosIniciales(newContratos);
    };
    const addContratoRow = () => setContratosIniciales([...contratosIniciales, { servicioId: '', tipo: TipoServicio.COMODATO, fechaInicio: new Date().toISOString().split('T')[0], estado: EstadoContrato.ACTIVO }]);
    const removeContratoRow = (index: number) => setContratosIniciales(contratosIniciales.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const sucursalIdMap: Record<string, string> = {};

    if (formData.sucursales) {
      formData.sucursales.forEach(s => {
        if (s.id.startsWith('new_')) {
          const oldId = s.id;
          const newId = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          s.id = newId;
          sucursalIdMap[oldId] = newId;
        }
      });
    }

    const cleanPrecios = (formData.preciosEspeciales || []).filter(p => p.productoId && p.precio > 0);
    
    const updatedStockInicial = stockInicial.map(s => ({
        ...s,
        sucursalId: s.sucursalId && sucursalIdMap[s.sucursalId] ? sucursalIdMap[s.sucursalId] : s.sucursalId
    }));

    const updatedContratosIniciales = contratosIniciales.map(c => ({
        ...c,
        sucursalId: c.sucursalId && sucursalIdMap[c.sucursalId] ? sucursalIdMap[c.sucursalId] : c.sucursalId
    }));

    const finalData = { 
        ...formData, 
        cuit: unformatCuit(formData.cuit),
        preciosEspeciales: cleanPrecios,
        stockInicial: isNew ? updatedStockInicial.filter(s => s.productoId && s.cantidad > 0) : undefined,
        contratosIniciales: isNew ? updatedContratosIniciales.filter(c => c.servicioId && c.fechaInicio) : undefined,
    };

    onSave(finalData as Cliente);
  };
  
  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);
  const productosRetornables = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.RETORNABLE), [productosActivos]);
  const serviciosActivosOptions = useMemo(() => servicios.filter(s => s.estado === EstadoServicio.ACTIVO).map(s => ({ value: s.id, label: s.nombre })), [servicios]);

  const sucursalOptions = useMemo(() => [
    { value: '', label: 'Casa Central' },
    ...(formData.sucursales || []).map(s => ({ value: s.id, label: s.nombre }))
  ], [formData.sucursales]);


  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{cliente.id ? 'Editar' : 'Nuevo'} Cliente</h2>
      
      <fieldset className="border dark:border-gray-600 p-4 rounded-md">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Datos Generales</legend>
        <div className="space-y-4">
            <div>
                <AppInput label="Nombre del Cliente" name="nombre" value={formData.nombre || ''} onChange={handleChange} required error={nombreExistente ? `Ya existe un cliente llamado ${nombreExistente}` : ''} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AppInput label="CUIT" name="cuit" value={formatCuit(formData.cuit)} onChange={handleChange} placeholder="XX-XXXXXXXX-X" error={cuitExistente ? `CUIT en uso por ${cuitExistente}` : ''} />
                <AppSelect label="Tipo de Facturación" name="tipoFacturacion" value={formData.tipoFacturacion || ''} onChange={handleChange} options={[{value: "", label: "Seleccionar..."}, ...Object.values(TipoFacturacion).map(t => ({value: t, label: t}))]} />
            </div>
             <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="tieneCuentaCorriente" checked={formData.tieneCuentaCorriente || false} onChange={handleCheckboxChange} className="form-checkbox h-5 w-5 text-primary-600 rounded focus:ring-primary-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Habilitar Cuenta Corriente</span>
                </label>
            </div>
        </div>
      </fieldset>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="border dark:border-gray-600 p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Teléfonos</legend>
            <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                {(formData.telefonos || []).map((tel, index) => (
                    <div key={index} className="grid grid-cols-[1fr,2fr,auto] gap-2 items-center">
                        <AppSelect value={tel.tipo} onChange={(e) => handleTelefonoChange(index, 'tipo', e.target.value)} options={Object.values(TipoTelefono).map(t => ({value: t, label: t}))} className="!py-2" />
                        <AppInput placeholder="Número" value={tel.numero} onChange={(e) => handleTelefonoChange(index, 'numero', e.target.value)} required className="!py-2"/>
                        <AppButton variant="danger" size="sm" onClick={() => removeTelefono(index)} className="!p-2"><TrashIcon className="h-4 w-4" /></AppButton>
                    </div>
                ))}
            </div>
            <AppButton variant="secondary" size="sm" onClick={addTelefono} className="mt-2 w-full border-dashed border-2">+ Agregar Teléfono</AppButton>
        </fieldset>

        <fieldset className="border dark:border-gray-600 p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Emails</legend>
            <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                {(formData.emails || []).map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <AppInput type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => handleEmailChange(index, e.target.value)} required className="!py-2"/>
                        <AppButton variant="danger" size="sm" onClick={() => removeEmail(index)} className="!p-2"><TrashIcon className="h-4 w-4" /></AppButton>
                    </div>
                ))}
            </div>
            <AppButton variant="secondary" size="sm" onClick={addEmail} className="mt-2 w-full border-dashed border-2">+ Agregar Email</AppButton>
        </fieldset>
      </div>

      <fieldset className="border dark:border-gray-600 p-4 rounded-md">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Sucursales y Logística</legend>
        
        <div className="space-y-4 mt-2">
            {(formData.sucursales || []).map((sucursal, index) => (
                <div key={sucursal.id || index} className={`p-3 border dark:border-gray-700 rounded-md space-y-3 relative`}>
                    <button type="button" onClick={() => removeSucursal(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-4 w-4" /></button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                        <AppInput placeholder="Nombre Sucursal (Ej: Casa, Local)" value={sucursal.nombre} onChange={(e) => handleSucursalChange(index, 'nombre', e.target.value)} required />
                        <div className="flex gap-2">
                            <AppInput 
                                placeholder="Dirección física" 
                                value={sucursal.direccion} 
                                onChange={(e) => handleSucursalChange(index, 'direccion', e.target.value)} 
                                required 
                            />
                             <button 
                                type="button" 
                                onClick={() => handleSearchAddress(index)}
                                disabled={isSearching}
                                className="p-2.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 border border-blue-200 dark:border-blue-800"
                                title="Buscar coordenadas"
                            >
                                <SearchIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wide font-bold">Días de Reparto</label>
                        <div className="flex flex-wrap gap-2">
                            {Object.values(DiaSemana).map((day) => {
                                const isSelected = sucursal.diasReparto?.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDiaReparto(index, day)}
                                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                            isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {day.substring(0, 3)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                             {sucursal.lat && sucursal.lng ? (
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                                    <MapIcon className="w-4 h-4" />
                                    Ubicación guardada
                                </span>
                             ) : (
                                <span className="text-gray-400 flex items-center gap-1">
                                    <MapIcon className="w-4 h-4" />
                                    Sin ubicación en mapa
                                </span>
                             )}
                        </div>
                        <AppButton 
                            type="button" 
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenMap(index)} 
                        >
                            {sucursal.lat ? 'Ver/Corregir Mapa' : 'Ubicar en Mapa'}
                        </AppButton>
                    </div>
                </div>
            ))}
        </div>
        <AppButton variant="secondary" size="sm" onClick={addSucursal} className="mt-2 w-full border-dashed border-2">+ Agregar Sucursal</AppButton>
      </fieldset>

      <fieldset className="border dark:border-gray-600 p-4 rounded-md">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2">Precios Especiales</legend>
        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
          {(formData.preciosEspeciales || []).map((precio, index) => (
            <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
              <AppSelect value={precio.productoId} onChange={(e) => handlePrecioEspecialChange(index, 'productoId', e.target.value)} options={[{value: "", label: "Producto..."}, ...productosActivos.map(p => ({value: p.id, label: p.nombre}))]} className="!py-2" />
              <AppInput type="number" placeholder="$" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} step="0.01" min="0" className="!py-2" />
              <AppButton variant="danger" size="sm" onClick={() => removePrecioEspecial(index)} className="!p-2"><TrashIcon className="h-4 w-4" /></AppButton>
            </div>
          ))}
        </div>
        <AppButton variant="secondary" size="sm" onClick={addPrecioEspecial} className="mt-2 w-full border-dashed border-2">+ Agregar Precio</AppButton>
      </fieldset>
      
      {isNew && (
        <div className="space-y-4">
            <div className="border dark:border-gray-600 rounded-md">
                <button type="button" onClick={() => setOpenSection(openSection === 'stock' ? null : 'stock')} className="w-full flex justify-between items-center p-4 text-left">
                    <span className="text-lg font-medium text-gray-800 dark:text-white">Stock Inicial de Envases (Opcional)</span>
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${openSection === 'stock' ? 'rotate-180' : ''}`} />
                </button>
                {openSection === 'stock' && (
                    <div className="p-4 border-t dark:border-gray-600 space-y-2">
                        {stockInicial.map((stock, index) => (
                            <div key={index} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2 items-center">
                                <AppSelect value={stock.productoId} onChange={(e) => handleStockChange(index, 'productoId', e.target.value)} options={[{value: "", label: "Envase..."}, ...productosActivos.filter(p => p.tipo === TipoProducto.RETORNABLE).map(p => ({value: p.id, label: p.nombre}))]} className="!py-2" />
                                <AppInput type="number" placeholder="Cant." value={stock.cantidad} onChange={(e) => handleStockChange(index, 'cantidad', e.target.value)} className="!py-2" />
                                <AppSelect value={stock.sucursalId} onChange={(e) => handleStockChange(index, 'sucursalId', e.target.value)} options={sucursalOptions} className="!py-2" />
                                <AppButton variant="danger" size="sm" onClick={() => removeStockRow(index)} className="!p-2"><TrashIcon className="h-4 w-4" /></AppButton>
                            </div>
                        ))}
                         <AppButton variant="ghost" size="sm" onClick={addStockRow}>+ Agregar Stock Inicial</AppButton>
                    </div>
                )}
            </div>

             <div className="border dark:border-gray-600 rounded-md">
                <button type="button" onClick={() => setOpenSection(openSection === 'contratos' ? null : 'contratos')} className="w-full flex justify-between items-center p-4 text-left">
                    <span className="text-lg font-medium text-gray-800 dark:text-white">Contratos Iniciales (Opcional)</span>
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${openSection === 'contratos' ? 'rotate-180' : ''}`} />
                </button>
                 {openSection === 'contratos' && (
                    <div className="p-4 border-t dark:border-gray-600 space-y-2">
                        {contratosIniciales.map((contrato, index) => (
                            <div key={index} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2 items-center">
                                <AppSelect value={contrato.servicioId} onChange={(e) => handleContratoChange(index, 'servicioId', e.target.value)} options={[{value: "", label: "Servicio..."}, ...servicios.filter(s => s.estado === EstadoServicio.ACTIVO).map(s => ({value: s.id, label: s.nombre}))]} className="!py-2" />
                                <AppSelect value={contrato.sucursalId} onChange={(e) => handleContratoChange(index, 'sucursalId', e.target.value)} options={sucursalOptions} className="!py-2" />
                                 <AppInput type="date" value={contrato.fechaInicio} onChange={(e) => handleContratoChange(index, 'fechaInicio', e.target.value)} className="!py-2" />
                                <AppButton variant="danger" size="sm" onClick={() => removeContratoRow(index)} className="!p-2"><TrashIcon className="h-4 w-4" /></AppButton>
                            </div>
                        ))}
                         <AppButton variant="ghost" size="sm" onClick={addContratoRow}>+ Agregar Contrato Inicial</AppButton>
                    </div>
                )}
            </div>
        </div>
      )}

      {mapModalConfig.isOpen && (
          <MapPickerModal
              initialLat={mapModalConfig.initialLat}
              initialLng={mapModalConfig.initialLng}
              initialAddress={mapModalConfig.initialAddress}
              onConfirm={handleMapConfirm}
              onClose={() => setMapModalConfig({ isOpen: false, sucursalIndex: null, initialAddress: '' })}
              title="Ubicación de Sucursal"
          />
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton type="submit" variant="primary">Guardar</AppButton>
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

  // Cálculo de deuda por cliente (Optimizado)
  const deudasMap = useMemo(() => {
    const deudas = new Map<string, number>();
    
    // Agrupar pagos por origen
    const pagosMap = new Map<string, number>();
    registrosPago.forEach(p => {
        const key = p.origen.id;
        pagosMap.set(key, (pagosMap.get(key) || 0) + p.monto);
    });

    clientes.forEach(cliente => {
        const remitosCliente = remitos.filter(r => r.clienteId === cliente.id);
        const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

        let deudaTotal = 0;
        remitosCliente.forEach(r => {
            const totalRemito = r.movimientos.reduce((sum, mov) => {
                const prod = productosMap.get(mov.productoId);
                if (!prod) return sum;
                const precio = preciosEspecialesMap.get(mov.productoId) ?? prod.precio;
                return sum + (mov.entregados * precio);
            }, 0);
            
            const totalPagado = pagosMap.get(r.id) || 0;
            if (totalRemito > totalPagado) {
                deudaTotal += (totalRemito - totalPagado);
            }
        });
        
        if (deudaTotal > 0.01) deudas.set(cliente.id, deudaTotal);
    });
    
    return deudas;
  }, [clientes, remitos, registrosPago, productosMap]);

  const handleSave = (cliente: (Omit<Cliente, 'id' | 'estado'> | Cliente) & { stockInicial?: any[], contratosIniciales?: any[] }) => {
    try {
        if ('id' in cliente && cliente.id) {
            updateCliente(cliente as Cliente);
            showNotification('Cliente actualizado con éxito.', 'success');
        } else {
            addCliente(cliente as Omit<Cliente, 'id' | 'estado'>);
            showNotification('Cliente creado con éxito.', 'success');
        }
        setIsModalOpen(false);
    } catch (e) {
        showNotification('Error al guardar el cliente.', 'error');
        console.error(e);
    }
  };

  const handleBajaConfirm = () => {
    if (!clienteParaBaja) return;
    try {
        deleteCliente(clienteParaBaja.id);
        showNotification('Cliente dado de baja con éxito.', 'success');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al dar de baja el cliente.';
        showNotification(message, 'error');
    }
    setClienteParaBaja(null);
  };

  const openNewModal = () => {
    setEditingCliente({ 
        telefonos: [], 
        emails: [], 
        sucursales: [{ id: `new_${Date.now()}`, nombre: 'Casa Central', direccion: '', diasReparto: [] }], 
        preciosEspeciales: [],
        tieneCuentaCorriente: false,
        estado: EstadoCliente.ACTIVO
    });
    setIsModalOpen(true);
  }

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setIsModalOpen(true);
  }

  const handleOpenGoogleMaps = (sucursal: Sucursal) => {
      if (!sucursal.lat || !sucursal.lng) {
          showNotification('La sucursal no tiene coordenadas guardadas.', 'error');
          return;
      }
      const url = `https://www.google.com/maps/dir/?api=1&destination=${sucursal.lat},${sucursal.lng}`;
      window.open(url, '_blank');
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c => {
        const matchesName = c.nombre.toLowerCase().includes(filter.toLowerCase());
        const matchesStatus = statusFilter === 'todos' || c.estado === statusFilter;
        return matchesName && matchesStatus;
    }).sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, filter, statusFilter]);

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Clientes</h1>
        {currentUser?.rol === Rol.ADMINISTRADOR && (
            <AppButton onClick={openNewModal}>+ Nuevo Cliente</AppButton>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <AppInput
            placeholder="Buscar por nombre..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full md:w-1/3"
          />
          
          <div className="flex items-center space-x-4">
            <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Filtrar:</span>
            <label className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="radio" name="statusFilter" value="Activo" checked={statusFilter === EstadoCliente.ACTIVO} onChange={() => setStatusFilter(EstadoCliente.ACTIVO)} className="form-radio mr-1 text-primary-600" /> Activos</label>
            <label className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="radio" name="statusFilter" value="Inactivo" checked={statusFilter === EstadoCliente.INACTIVO} onChange={() => setStatusFilter(EstadoCliente.INACTIVO)} className="form-radio mr-1 text-primary-600" /> Inactivos</label>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredClientes.map(cliente => {
            const isInactive = cliente.estado === EstadoCliente.INACTIVO;
            const isExpanded = expandedClienteId === cliente.id;
            const deuda = deudasMap.get(cliente.id) || 0;
            
            return (
            <div key={cliente.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700 transition-opacity ${isInactive ? 'opacity-70' : ''}`}>
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => setExpandedClienteId(isExpanded ? null : cliente.id)}
                >
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cliente.nombre}</h3>
                             {isInactive && <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200">Inactivo</span>}
                             {deuda > 0.01 && (
                                <span className="px-2 py-0.5 text-xs font-black rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                    DEUDA: ${deuda.toLocaleString()}
                                </span>
                             )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {cliente.sucursales.length} Sucursal{cliente.sucursales.length !== 1 ? 'es' : ''} | {cliente.tieneCuentaCorriente ? 'Cta. Corriente' : 'Pago Efectivo'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentUser?.rol === Rol.ADMINISTRADOR && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); openEditModal(cliente); }} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full" title="Editar"><PencilIcon /></button>
                                {isInactive ? (
                                    <button onClick={(e) => { e.stopPropagation(); reactivarCliente(cliente.id); showNotification('Cliente reactivado.', 'success'); }} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full" title="Reactivar"><ReplyIcon /></button>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setClienteParaBaja(cliente); }} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full" title="Dar de Baja"><TrashIcon /></button>
                                )}
                            </>
                        )}
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                
                {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase text-xs tracking-wider">Contacto</h4>
                                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                                    {cliente.cuit && <li><strong>CUIT:</strong> {cliente.cuit}</li>}
                                    {(cliente.telefonos || []).map((tel, i) => (
                                        <li key={i}><strong>{tel.tipo}:</strong> {tel.numero}</li>
                                    ))}
                                    {(cliente.emails || []).map((email, i) => (
                                        <li key={i}><strong>Email:</strong> {email}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase text-xs tracking-wider">Sucursales / Rutas</h4>
                                <ul className="space-y-2">
                                    {cliente.sucursales.map((suc, i) => (
                                        <li key={i} className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700 shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-200">{suc.nombre}</p>
                                                <p className="text-xs text-gray-500">{suc.direccion}</p>
                                                {suc.diasReparto && suc.diasReparto.length > 0 && (
                                                    <p className="text-[10px] text-primary-600 font-bold mt-1">Días: {suc.diasReparto.join(', ')}</p>
                                                )}
                                            </div>
                                            {suc.lat && suc.lng && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenGoogleMaps(suc); }}
                                                    className="flex flex-col items-center p-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded hover:bg-green-100 transition-colors"
                                                    title="Navegar con GPS"
                                                >
                                                    <MapIcon className="w-5 h-5" />
                                                    <span className="text-[10px] font-black mt-1">GPS</span>
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )
        })}
        {filteredClientes.length === 0 && <p className="text-center py-8 text-gray-500">No se encontraron clientes.</p>}
      </div>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <ClienteForm 
                cliente={editingCliente || {}}
                productos={productos}
                servicios={servicios}
                clientes={clientes}
                onSave={handleSave}
                onClose={() => setIsModalOpen(false)}
            />
        </Modal>
      )}

      {clienteParaBaja && (
        <Modal isOpen={!!clienteParaBaja} onClose={() => setClienteParaBaja(null)}>
            <div className="p-4 text-center">
                 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4">Confirmar Baja de Cliente</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea dar de baja al cliente <strong>"{clienteParaBaja.nombre}"</strong>?
                    <br />
                    El cliente pasará a estado 'Inactivo' y no podrá generar nuevos remitos.
                </p>
                <div className="flex justify-center space-x-4">
                    <AppButton variant="secondary" onClick={() => setClienteParaBaja(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={handleBajaConfirm}>Sí, Dar de Baja</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

export default ClientesView;
