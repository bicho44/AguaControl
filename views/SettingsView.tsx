




import React, { useState } from 'react';
import { EmpresaSettings, Telefono, TipoTelefono, CondicionIVA } from '../types';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/Card';
import { TrashIcon } from '../components/icons/TrashIcon';
import { UploadIcon } from '../components/icons/UploadIcon';
import { MapIcon } from '../components/icons/MapIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import MapPickerModal from '../components/MapPickerModal';

interface SettingsViewProps {
  settings: EmpresaSettings;
  updateSettings: (settings: EmpresaSettings) => void;
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

const SettingsView: React.FC<SettingsViewProps> = ({ settings, updateSettings }) => {
  const [formData, setFormData] = useState<EmpresaSettings>(settings);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { showNotification } = useNotification();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'cuit') {
        const unformatted = unformatCuit(value);
        setFormData(prev => ({ ...prev, [name]: unformatted }));
        return;
    }
     if (name === 'iibb') {
        const numericValue = value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, [name]: numericValue }));
        return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, logo: event.target?.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleMapConfirm = (lat: number, lng: number, address: string) => {
      setFormData(prev => ({ ...prev, lat, lng, direccion: address }));
      setIsMapOpen(false);
  };

  // Telefonos
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

  // Emails
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

  // Email Template Handlers
  const handleTemplateChange = (field: 'asunto' | 'cuerpo', value: string) => {
      setFormData(prev => ({
          ...prev,
          emailTemplate: {
              asunto: prev.emailTemplate?.asunto || '',
              cuerpo: prev.emailTemplate?.cuerpo || '',
              [field]: value
          }
      }));
  };

  const restoreDefaultTemplate = () => {
      const defaultTemplate = {
          asunto: "Factura {{numero}} - {{empresa}}",
          cuerpo: "Hola {{cliente}},\n\nAdjuntamos la factura correspondiente a sus últimos pedidos.\n\nTotal a pagar: ${{monto}}\n\nDetalle:\n{{remitos}}\n\nGracias por su compra.\n{{empresa}}"
      };
      setFormData(prev => ({ ...prev, emailTemplate: defaultTemplate }));
      showNotification('Plantilla restaurada a valores por defecto.', 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    showNotification('Configuración guardada con éxito.', 'success');
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Configuración de la Empresa</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-2">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">Logo de la Empresa</h3>
                    <div className="flex flex-col items-center">
                        <div className="w-40 h-40 mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                        {formData.logo ? (
                            <img src={formData.logo} alt="Logo Preview" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-gray-500">Sin Logo</span>
                        )}
                        </div>
                        <label className="cursor-pointer px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">
                            <UploadIcon />
                            <span className="ml-2">Cambiar Logo</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                        </label>
                    </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                     <h3 className="text-lg font-medium text-gray-800 dark:text-white">Datos Principales</h3>
                    <input type="text" name="nombre" placeholder="Nombre / Razón Social" value={formData.nombre || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    <input type="text" name="nombreFantasia" placeholder="Nombre de Fantasía" value={formData.nombreFantasia || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección y Ubicación (Depósito/Fábrica)</label>
                        <div className="flex gap-2">
                            <input type="text" name="direccion" placeholder="Dirección" value={formData.direccion || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                            <button
                                type="button"
                                onClick={() => setIsMapOpen(true)}
                                className={`p-2 rounded-md border ${formData.lat ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-600'}`}
                                title="Ubicar Depósito en Mapa"
                            >
                                <MapIcon />
                            </button>
                        </div>
                        {formData.lat && <p className="text-xs text-green-600 mt-1">Ubicación guardada: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}</p>}
                    </div>
                </div>
            </div>
        </Card>

        <Card title="Datos de Contacto">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <fieldset>
                    <legend className="text-lg font-medium text-gray-800 dark:text-white mb-2">Teléfonos</legend>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {(formData.telefonos || []).map((tel, index) => (
                            <div key={index} className="grid grid-cols-[1fr,2fr,auto] gap-2 items-center">
                                <select value={tel.tipo} onChange={(e) => handleTelefonoChange(index, 'tipo', e.target.value)} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm">
                                    {Object.values(TipoTelefono).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input type="text" placeholder="Número" value={tel.numero} onChange={(e) => handleTelefonoChange(index, 'numero', e.target.value)} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                                <button type="button" onClick={() => removeTelefono(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addTelefono} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Teléfono</button>
                </fieldset>

                <fieldset>
                    <legend className="text-lg font-medium text-gray-800 dark:text-white mb-2">Emails</legend>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {(formData.emails || []).map((email, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => handleEmailChange(index, e.target.value)} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                                <button type="button" onClick={() => removeEmail(index)} className="text-red-500 hover:text-red-700 p-2"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addEmail} className="mt-2 px-4 py-2 text-sm font-medium rounded-md border border-primary-500 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-500/10">+ Agregar Email</button>
                </fieldset>
            </div>
        </Card>

        <Card title="Datos Fiscales">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <input type="text" name="cuit" placeholder="XX-XXXXXXXX-X" value={formatCuit(formData.cuit)} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                 <select name="condicionIVA" value={formData.condicionIVA || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                    <option value="">Condición frente al IVA</option>
                    {Object.values(CondicionIVA).map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
                <input type="text" name="iibb" placeholder="Nro. Ingresos Brutos" value={formData.iibb || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de Inicio de Actividades</label>
                    <input type="date" name="fechaInicioActividad" value={formData.fechaInicioActividad || ''} onChange={handleChange} className="w-full md:w-1/3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md"/>
                </div>
            </div>
        </Card>

        <Card title="Configuración de Facturación y Pagos">
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco</label>
                        <input type="text" name="banco" placeholder="Ej: Banco Nación" value={formData.banco || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CBU / CVU</label>
                        <input type="text" name="cbu" placeholder="0000000000000000000000" value={formData.cbu || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alias</label>
                        <input type="text" name="alias" placeholder="ALIAS.EJEMPLO.MP" value={formData.alias || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones / Pie de Factura</label>
                    <textarea 
                        name="observacionesFactura" 
                        placeholder="Ej: Horario de atención Lun a Vie 9 a 18hs. Los precios están sujetos a cambio..." 
                        value={formData.observacionesFactura || ''} 
                        onChange={handleChange} 
                        rows={3}
                        className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" 
                    />
                </div>
            </div>
        </Card>

        {/* Nueva Tarjeta para Plantilla de Email */}
        <Card title="Plantilla de Correo Electrónico">
            <div className="p-4 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md border border-blue-200 dark:border-blue-800 mb-4">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Variables Disponibles:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700 dark:text-blue-300 font-mono">
                        <span>{`{{cliente}}`}</span>
                        <span>{`{{numero}}`}</span>
                        <span>{`{{monto}}`}</span>
                        <span>{`{{fecha}}`}</span>
                        <span>{`{{empresa}}`}</span>
                        <span className="col-span-2 font-bold">{`{{remitos}}`} (Lista de remitos)</span>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="button" 
                        onClick={restoreDefaultTemplate}
                        className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
                    >
                        <ReplyIcon className="h-4 w-4"/> Restaurar plantilla original
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asunto del Correo</label>
                    <input 
                        type="text" 
                        value={formData.emailTemplate?.asunto || ''} 
                        onChange={(e) => handleTemplateChange('asunto', e.target.value)}
                        className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" 
                        placeholder="Factura {{numero}} - {{empresa}}"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuerpo del Mensaje</label>
                    <textarea 
                        value={formData.emailTemplate?.cuerpo || ''} 
                        onChange={(e) => handleTemplateChange('cuerpo', e.target.value)}
                        rows={8}
                        className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md font-mono text-sm" 
                        placeholder="Escriba aquí el cuerpo del mensaje..."
                    />
                </div>
            </div>
        </Card>

        <div className="flex justify-end">
          <button type="submit" className="px-6 py-3 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700 text-lg shadow-lg">
            Guardar Configuración
          </button>
        </div>
      </form>

      {isMapOpen && (
          <MapPickerModal
            title="Ubicación del Depósito / Fábrica"
            initialLat={formData.lat}
            initialLng={formData.lng}
            initialAddress={formData.direccion || ''}
            onConfirm={handleMapConfirm}
            onClose={() => setIsMapOpen(false)}
          />
      )}
    </div>
  );
};

export default SettingsView;
