
import React, { useState, useEffect } from 'react';
import { EmpresaSettings, Telefono, TipoTelefono, CondicionIVA } from '../types';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/Card';
import { TrashIcon } from '../components/icons/TrashIcon';
import { UploadIcon } from '../components/icons/UploadIcon';
import { MapIcon } from '../components/icons/MapIcon';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import MapPickerModal from '../components/MapPickerModal';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

interface SettingsViewProps {
  settings: EmpresaSettings;
  updateSettings: (settings: EmpresaSettings) => void;
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

const SettingsView: React.FC<SettingsViewProps> = ({ settings, updateSettings }) => {
  const [formData, setFormData] = useState<EmpresaSettings>(settings);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    showNotification('Configuración guardada.', 'success');
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0 pb-12">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Configuración del Sistema</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        
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
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 ml-1">Pie de Página de Factura (Términos, horarios, etc.)</label>
                    <textarea name="observacionesFactura" value={formData.observacionesFactura || ''} onChange={handleChange} rows={3} className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
            </div>
        </Card>

        <div className="flex justify-end sticky bottom-4 z-10">
          <AppButton type="submit" size="lg" className="shadow-2xl px-12">Guardar Todo</AppButton>
        </div>
      </form>

      {isMapOpen && (
          <MapPickerModal title="Configurar Ubicación Central" initialLat={formData.lat} initialLng={formData.lng} initialAddress={formData.direccion || ''} onConfirm={(lat, lng, address) => {setFormData({...formData, lat, lng, direccion: address}); setIsMapOpen(false);}} onClose={() => setIsMapOpen(false)} />
      )}
    </div>
  );
};

export default SettingsView;
