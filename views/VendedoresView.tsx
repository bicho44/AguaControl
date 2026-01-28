
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { useNotification } from '../context/NotificationContext';
import { TrashIcon } from '../components/icons/TrashIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import SearchableSelect from '../components/SearchableSelect';

interface UsuariosViewProps {
  usuarios: Usuario[];
  registrosPago: RegistroPago[];
  remitos: Remito[];
  clientes: Cliente[];
  productos: Producto[];
  ventasVendedor: VentaVendedor[];
  addUsuario: (usuario: Omit<Usuario, 'id'>) => void;
  updateUsuario: (usuario: Usuario) => void;
  addVentaVendedor: (venta: Omit<VentaVendedor, 'id' | 'pagoIds'> & { pagos?: PagoDetalle[] }) => void;
}

const UsuarioForm: React.FC<{
  usuario: Partial<Usuario>;
  productos: Producto[];
  onSave: (usuario: Omit<Usuario, 'id'> | Usuario) => void;
  onClose: () => void;
}> = ({ usuario, productos, onSave, onClose }) => {
  const [formData, setFormData] = useState(usuario);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrecioEspecialChange = (index: number, field: 'productoId' | 'precio', value: string) => {
    const newPrecios = [...(formData.preciosEspeciales || [])];
    newPrecios[index] = { ...newPrecios[index], [field]: field === 'precio' ? (value === '' ? 0 : Number(value)) : value };
    setFormData(prev => ({ ...prev, preciosEspeciales: newPrecios }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Usuario);
  };

  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
      <div className="space-y-4">
          <AppInput label="Nombre Completo" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
          <AppInput label="Correo Electrónico" type="email" name="email" value={formData.email || ''} onChange={handleChange} required />
          <AppInput label="Contraseña" type="password" name="password" placeholder="Solo para cambiar..." onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4">
              <AppSelect label="Rol" name="rol" value={formData.rol || ''} onChange={handleChange} options={Object.values(Rol).map(r => ({value: r, label: r}))} required />
              <AppSelect label="Tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} options={[{value: TipoVendedor.INTERNO, label: 'Interno'}, {value: TipoVendedor.EXTERNO, label: 'Externo'}]} required />
          </div>
      </div>

      {formData.tipo === TipoVendedor.EXTERNO && (
        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">Precios de Reventa Especiales</legend>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {(formData.preciosEspeciales || []).map((precio, index) => (
                <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={precio.productoId} onChange={(v) => handlePrecioEspecialChange(index, 'productoId', v)} /></div>
                    <div className="w-32"><AppInput type="number" value={precio.precio} onChange={(e) => handlePrecioEspecialChange(index, 'precio', e.target.value)} step="0.01" /></div>
                    <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: formData.preciosEspeciales?.filter((_,i)=>i!==index)})} className="!p-2"><TrashIcon/></AppButton>
                </div>
            ))}
            <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, preciosEspeciales: [...(formData.preciosEspeciales || []), {productoId: '', precio: 0}]})} className="w-full border-dashed border-2">+ Agregar Precio</AppButton>
            </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit" className="px-8">Guardar Usuario</AppButton>
      </div>
    </form>
  )
}

const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, registrosPago, remitos, clientes, productos, ventasVendedor, addUsuario, updateUsuario, addVentaVendedor }) => {
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);
  const { showNotification } = useNotification();
  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const handleSaveUsuario = (usuario: Omit<Usuario, 'id'> | Usuario) => {
    try {
        if ('id' in usuario) updateUsuario(usuario);
        else addUsuario(usuario);
        showNotification('Guardado con éxito.', 'success');
        setEditingUsuario(null);
    } catch (e) { showNotification('Error al guardar.', 'error'); }
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Usuarios del Sistema</h1>
        <AppButton onClick={() => setEditingUsuario({ rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO })}>+ Nuevo Usuario</AppButton>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarios.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{u.nombre}</h3>
                  <p className="text-xs text-gray-400 font-black uppercase tracking-tighter">{u.rol} | {u.tipo}</p>
              </div>
               <button onClick={() => setEditingUsuario(u)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-full"><PencilIcon /></button>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                <p className="text-sm font-mono truncate">{u.email}</p>
            </div>
          </Card>
        ))}
      </div>

      {editingUsuario && (
        <Modal isOpen={!!editingUsuario} onClose={() => setEditingUsuario(null)}>
            <UsuarioForm usuario={editingUsuario} productos={productos} onSave={handleSaveUsuario} onClose={() => setEditingUsuario(null)} />
        </Modal>
      )}
    </div>
  );
};

export default UsuariosView;
