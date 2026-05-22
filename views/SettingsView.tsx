
import React, { useState, useEffect } from 'react';
import { EmpresaSettings, Telefono, TipoTelefono, CondicionIVA, CausaRecambio } from '../types';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/Card';
import { TrashIcon } from '../components/icons/TrashIcon';
import { UploadIcon } from '../components/icons/UploadIcon';
import { MapIcon } from '../components/icons/MapIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import { CogIcon } from '../components/icons/CogIcon';
import { ReceiptIcon } from '../components/icons/ReceiptIcon';
import { CubeIcon } from '../components/icons/CubeIcon';
import MapPickerModal from '../components/MapPickerModal';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import plugins from '../plugins';

// Force sync

interface SettingsViewProps {
  settings: EmpresaSettings;
  updateSettings: (settings: EmpresaSettings) => void;
  causasRecambio: CausaRecambio[];
  addCausaRecambio: (causa: Omit<CausaRecambio, 'id'>) => Promise<void>;
  deleteCausaRecambio: (id: string) => Promise<void>;
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

const SettingsView: React.FC<SettingsViewProps> = ({ settings, updateSettings, causasRecambio, addCausaRecambio, deleteCausaRecambio }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'afip' | 'recambios' | 'plugins'>('general');
  const [formData, setFormData] = useState<EmpresaSettings>(settings);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [newCausa, setNewCausa] = useState({ nombre: '', esPerdidaStock: false });
  const { showNotification } = useNotification();

  useEffect(() => {
      const config = localStorage.getItem('firebase_config');
      if (config) setShareLink(`${window.location.origin}/?config=${btoa(config)}`);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'cuit' ? unformatCuit(value) : (name === 'iibb' ? value.replace(/\D/g, '') : value) }));
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setFormData(prev => ({ ...prev, logo: ev.target?.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleTelefonoChange = (i: number, f: keyof Telefono, v: string) => {
    const newTels = [...(formData.telefonos || [])];
    newTels[i] = { ...newTels[i], [f]: v };
    setFormData(prev => ({ ...prev, telefonos: newTels }));
  }

  const handleEmailChange = (i: number, v: string) => {
    const newEmails = [...(formData.emails || [])];
    newEmails[i] = v;
    setFormData(prev => ({ ...prev, emails: newEmails }));
  }

  // --- Lógica AFIP ---
  const handleAfipChange = (field: string, value: any) => {
      setFormData(prev => ({
          ...prev,
          afipConfig: {
              ...prev.afipConfig,
              enabled: prev.afipConfig?.enabled ?? false, // asegurar booleano
              [field]: value
          }
      }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'cert' | 'key') => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const content = ev.target?.result as string;
              handleAfipChange(field, content);
              showNotification(`Archivo ${field === 'cert' ? 'Certificado' : 'Llave'} cargado.`, 'success');
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateSettings(formData);
    showNotification('Configuración guardada.', 'success');
  };

  const handleAddCausa = async () => {
    if (!newCausa.nombre) return;
    await addCausaRecambio(newCausa);
    setNewCausa({ nombre: '', esPerdidaStock: false });
    showNotification('Causa de recambio agregada.', 'success');
  };

  const tabs = [
    { id: 'general', label: 'General', icon: <CogIcon className="w-4 h-4" /> },
    { id: 'afip', label: 'AFIP', icon: <ReceiptIcon className="w-4 h-4" /> },
    { id: 'recambios', label: 'Recambios', icon: <ReplyIcon className="w-4 h-4" /> },
    { id: 'plugins', label: 'Plugins', icon: <CubeIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Configuración</h1>
        
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tighter transition-all ${
                activeTab === tab.id 
                ? 'bg-primary-600 text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            <Card title="Identidad Visual y Ubicación">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700">
                        <div className="w-32 h-32 mb-4 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-600 shadow-md">
                            {formData.logo ? <img src={formData.logo} className="w-full h-full object-contain" alt="Logo" /> : <span className="text-xs text-gray-400">SIN LOGO</span>}
                        </div>
                        <label className="cursor-pointer">
                            <AppButton variant="secondary" size="sm" className="pointer-events-none">Subir Logo</AppButton>
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                        </label>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <AppInput label="Razón Social / Nombre Legal" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
                        <AppInput label="Nombre de Fantasía" name="nombreFantasia" value={formData.nombreFantasia || ''} onChange={handleChange} />
                        <div className="relative">
                            <AppInput label="Dirección Fábrica / Depósito" name="direccion" value={formData.direccion || ''} onChange={handleChange} />
                            <button type="button" onClick={() => setIsMapOpen(true)} className={`absolute right-2 top-8 p-1 rounded ${formData.lat ? 'text-green-500' : 'text-gray-400'}`}><MapIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Datos Fiscales">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <AppInput label="CUIT" name="cuit" value={formatCuit(formData.cuit)} onChange={handleChange} />
                     <AppSelect label="Condición IVA" name="condicionIVA" value={formData.condicionIVA || ''} onChange={handleChange} options={[{value: '', label: 'Seleccionar...'}, ...Object.values(CondicionIVA).map(v => ({value: v, label: v}))]} />
                     <AppInput label="Ingresos Brutos" name="iibb" value={formData.iibb || ''} onChange={handleChange} />
                </div>
            </Card>

            <Card title="Contacto y Canales">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Teléfonos de la Empresa</p>
                        {(formData.telefonos || []).map((tel, i) => (
                            <div key={i} className="flex gap-2">
                                <div className="w-1/3"><AppSelect value={tel.tipo} onChange={(e) => handleTelefonoChange(i, 'tipo', e.target.value)} options={Object.values(TipoTelefono).map(t => ({value: t, label: t}))} /></div>
                                <AppInput value={tel.numero} onChange={(e) => handleTelefonoChange(i, 'numero', e.target.value)} className="flex-1" />
                                <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, telefonos: formData.telefonos?.filter((_, idx)=>idx!==i)})} className="!p-2"><TrashIcon/></AppButton>
                            </div>
                        ))}
                        <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, telefonos: [...(formData.telefonos || []), {tipo: TipoTelefono.CEL, numero: ''}]})} className="w-full border-dashed border-2">+ Agregar Teléfono</AppButton>
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Correos Electrónicos</p>
                        {(formData.emails || []).map((email, i) => (
                            <div key={i} className="flex gap-2">
                                <AppInput value={email} onChange={(e) => handleEmailChange(i, e.target.value)} className="flex-1" />
                                <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, emails: formData.emails?.filter((_, idx)=>idx!==i)})} className="!p-2"><TrashIcon/></AppButton>
                            </div>
                        ))}
                        <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, emails: [...(formData.emails || []), '']})} className="w-full border-dashed border-2">+ Agregar Email</AppButton>
                    </div>
                </div>
            </Card>

            <Card title="Datos para Factura y Pagos">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AppInput label="Banco" name="banco" value={formData.banco || ''} onChange={handleChange} />
                    <AppInput label="CBU / CVU" name="cbu" value={formData.cbu || ''} onChange={handleChange} />
                    <AppInput label="Alias" name="alias" value={formData.alias || ''} onChange={handleChange} />
                    <div className="md:col-span-3">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Pie de Página de Factura (Términos, horarios, etc.)</label>
                        <textarea name="observacionesFactura" value={formData.observacionesFactura || ''} onChange={handleChange} rows={3} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
                    </div>
                </div>
            </Card>
          </div>
        )}

        {activeTab === 'afip' && (
          <div className="animate-fade-in">
            <Card title="Integración AFIP (Facturación y Padrón)">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <input 
                            type="checkbox" 
                            id="afipEnabled"
                            checked={formData.afipConfig?.enabled || false}
                            onChange={(e) => handleAfipChange('enabled', e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                            <label htmlFor="afipEnabled" className="font-bold text-gray-800 dark:text-gray-200 cursor-pointer">Habilitar conexión con AFIP</label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Permite consultar padrón A13 y preparar facturación electrónica.</p>
                        </div>
                    </div>

                    {formData.afipConfig?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="md:col-span-2">
                                <AppInput 
                                    label="URL del Backend / API (Middleware)" 
                                    value={formData.afipConfig?.apiUrl || ''} 
                                    onChange={(e) => handleAfipChange('apiUrl', e.target.value)} 
                                    placeholder="Ej: https://tu-app.vercel.app/api/afip o https://api.proveedor.com"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Si usas Vercel Functions, suele ser <code>/api/afip</code>.</p>
                            </div>

                            <div className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase text-gray-500">Certificado (.crt)</span>
                                    {formData.afipConfig?.cert && <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">CARGADO</span>}
                                </div>
                                <label className="cursor-pointer block">
                                    <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-700 rounded-lg border hover:border-primary-500 transition-colors">
                                        <UploadIcon /> <span className="text-xs font-bold">Subir archivo .CRT</span>
                                    </div>
                                    <input type="file" accept=".crt,.pem" className="hidden" onChange={(e) => handleFileUpload(e, 'cert')} />
                                </label>
                                <textarea 
                                    value={formData.afipConfig?.cert || ''}
                                    onChange={(e) => handleAfipChange('cert', e.target.value)}
                                    className="w-full mt-2 h-20 p-2 text-[10px] font-mono bg-gray-100 dark:bg-gray-900 border-none rounded resize-none focus:ring-0"
                                    placeholder="-----BEGIN CERTIFICATE-----..."
                                />
                            </div>

                            <div className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase text-gray-500">Llave Privada (.key)</span>
                                    {formData.afipConfig?.key && <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">CARGADO</span>}
                                </div>
                                <label className="cursor-pointer block">
                                    <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-700 rounded-lg border hover:border-primary-500 transition-colors">
                                        <UploadIcon /> <span className="text-xs font-bold">Subir archivo .KEY</span>
                                    </div>
                                    <input type="file" accept=".key" className="hidden" onChange={(e) => handleFileUpload(e, 'key')} />
                                </label>
                                <textarea 
                                    value={formData.afipConfig?.key || ''}
                                    onChange={(e) => handleAfipChange('key', e.target.value)}
                                    className="w-full mt-2 h-20 p-2 text-[10px] font-mono bg-gray-100 dark:bg-gray-900 border-none rounded resize-none focus:ring-0 password-mask"
                                    placeholder="-----BEGIN PRIVATE KEY-----..."
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Card>
          </div>
        )}

        {activeTab === 'recambios' && (
          <div className="animate-fade-in">
            <Card title="Gestión de Recambios">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-4 items-end bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <AppInput 
                            label="Nueva Causa (ej: Envase Roto)" 
                            value={newCausa.nombre} 
                            onChange={(e) => setNewCausa({...newCausa, nombre: e.target.value})} 
                        />
                        <div className="flex items-center gap-2 pb-3">
                            <input 
                                type="checkbox" 
                                id="esPerdida"
                                checked={newCausa.esPerdidaStock} 
                                onChange={(e) => setNewCausa({...newCausa, esPerdidaStock: e.target.checked})}
                                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="esPerdida" className="text-sm font-medium text-gray-700 dark:text-gray-300">¿Es Pérdida de Stock?</label>
                        </div>
                        <AppButton type="button" onClick={handleAddCausa} variant="primary">Agregar Causa</AppButton>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Causas Configuradas</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {causasRecambio.map((causa) => (
                                <div key={causa.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-sm">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-white">{causa.nombre}</p>
                                        <p className="text-xs text-gray-500">
                                            {causa.esPerdidaStock ? '⚠️ Descuenta stock (Pérdida)' : '✅ Recuperable (Solo líquido)'}
                                        </p>
                                    </div>
                                    <AppButton 
                                        variant="danger" 
                                        size="sm" 
                                        onClick={() => deleteCausaRecambio(causa.id)} 
                                        className="!p-2"
                                        type="button"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </AppButton>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
          </div>
        )}

        {activeTab === 'plugins' && (
          <div className="space-y-6 animate-fade-in">
            {plugins.filter(p => p.settingsComponent).map(plugin => {
              const SettingsComp = plugin.settingsComponent!;
              return (
                <div key={plugin.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
                      {plugin.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tighter">{plugin.name}</h3>
                      <p className="text-xs text-gray-500">Configuración del módulo adicional</p>
                    </div>
                  </div>
                  <SettingsComp 
                    settings={formData} 
                    updateSettings={(newSettings) => {
                      setFormData(newSettings);
                      updateSettings(newSettings);
                      showNotification('Configuración de plugin actualizada.', 'success');
                    }} 
                  />
                </div>
              );
            })}
            {plugins.filter(p => p.settingsComponent).length === 0 && (
              <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-tighter">No hay plugins con configuración disponible</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end sticky bottom-4 z-10">
          <AppButton onClick={() => handleSubmit()} size="lg" className="shadow-2xl px-12">Guardar Todo</AppButton>
        </div>
      </div>

      {isMapOpen && (
          <MapPickerModal title="Configurar Ubicación Central" initialLat={formData.lat} initialLng={formData.lng} initialAddress={formData.direccion || ''} onConfirm={(lat, lng, address) => {setFormData({...formData, lat, lng, direccion: address}); setIsMapOpen(false);}} onClose={() => setIsMapOpen(false)} />
      )}
    </div>
  );
};

export default SettingsView;
