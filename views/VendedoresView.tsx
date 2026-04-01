
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Usuario, Remito, Cliente, TipoVendedor, MetodoPago, Producto, PagoDetalle, VentaVendedor, MovimientoVenta, RegistroPago, Rol, EstadoProducto, ComisionProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
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

  const handleComisionChange = (index: number, field: 'productoId' | 'monto', value: string) => {
    const newComisiones = [...(formData.comisiones || [])];
    newComisiones[index] = { ...newComisiones[index], [field]: field === 'monto' ? (value === '' ? 0 : Number(value)) : value };
    setFormData(prev => ({ ...prev, comisiones: newComisiones }));
  }

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData as Usuario);
  }, [formData, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);

  const isInternal = formData.tipo === TipoVendedor.INTERNO;
  const isExternal = formData.tipo === TipoVendedor.EXTERNO;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter pr-12">{usuario.id ? 'Editar' : 'Nuevo'} Usuario</h2>
      <div className="space-y-4">
          <AppInput label="Nombre Completo" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
          <AppInput label="Correo Electrónico" type="email" name="email" value={formData.email || ''} onChange={handleChange} required />
          <AppInput label="Contraseña" type="password" name="password" placeholder="Solo para cambiar..." onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4">
              <AppSelect label="Rol" name="rol" value={formData.rol || ''} onChange={handleChange} options={Object.values(Rol).map(r => ({value: r, label: r}))} required />
              <AppSelect label="Tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} options={[{value: TipoVendedor.INTERNO, label: 'Interno (Empleado)'}, {value: TipoVendedor.EXTERNO, label: 'Externo (Revendedor)'}]} required />
          </div>
          
          {isInternal && (
              <fieldset className="border-t dark:border-gray-600 pt-4">
                  <legend className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest px-2 mb-2">Comisiones por Producto</legend>
                  <div className="space-y-2">
                    {(formData.comisiones || []).map((comision, index) => (
                        <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1"><SearchableSelect options={productosActivos.map(p=>({value:p.id, label:p.nombre}))} value={comision.productoId} onChange={(v) => handleComisionChange(index, 'productoId', v)} /></div>
                            <div className="w-32"><AppInput type="number" value={comision.monto} onChange={(e) => handleComisionChange(index, 'monto', e.target.value)} step="0.01" placeholder="$ Comision" /></div>
                            <AppButton variant="danger" size="sm" onClick={() => setFormData({...formData, comisiones: formData.comisiones?.filter((_,i)=>i!==index)})} className="!p-2"><TrashIcon/></AppButton>
                        </div>
                    ))}
                    <AppButton variant="secondary" size="sm" onClick={() => setFormData({...formData, comisiones: [...(formData.comisiones || []), {productoId: '', monto: 0}]})} className="w-full border-dashed border-2 text-blue-600 border-blue-200">+ Agregar Comisión Específica</AppButton>
                  </div>
              </fieldset>
          )}
      </div>

      {isExternal && (
        <fieldset className="border-t dark:border-gray-600 pt-4">
            <legend className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">Precios de Reventa Especiales</legend>
            <div className="space-y-2">
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

  // Ordenar usuarios alfabéticamente
  const sortedUsuarios = useMemo(() => {
      return [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [usuarios]);

  const handleSaveUsuario = (u: Omit<Usuario, 'id'> | Usuario) => {
    try {
        if ('id' in u) updateUsuario(u as Usuario);
        else addUsuario(u as Omit<Usuario, 'id'>);
        showNotification('Guardado con éxito.', 'success');
        setEditingUsuario(null);
    } catch (e) { showNotification('Error al guardar.', 'error'); }
  };

  const openNewModal = useCallback(() => {
    setEditingUsuario({ rol: Rol.REPARTIDOR, tipo: TipoVendedor.INTERNO });
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'n' || e.key === 'N') && !editingUsuario) {
            e.preventDefault();
            openNewModal();
        }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [editingUsuario, openNewModal]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Usuarios del Sistema</h1>
        <AppButton onClick={openNewModal}>
            + Nuevo Usuario <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
        </AppButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedUsuarios.map(u => (
          <Card key={u.id}>
            <div className="flex justify-between items-start">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{u.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-black uppercase tracking-tighter text-gray-500">{u.rol}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tighter ${u.tipo === TipoVendedor.EXTERNO ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{u.tipo}</span>
                  </div>
              </div>
               <button onClick={() => setEditingUsuario(u)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-full transition-colors"><PencilIcon /></button>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700 space-y-2">
                <p className="text-sm font-mono truncate">{u.email}</p>
                {u.tipo === TipoVendedor.INTERNO && u.comisiones && u.comisiones.length > 0 && (
                    <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/10 p-2 rounded">
                        <p className="font-bold">Comisiones Configuradas:</p>
                        <ul className="list-disc list-inside">
                            {u.comisiones.slice(0, 3).map((c, i) => {
                                const prodName = productos.find(p => p.id === c.productoId)?.nombre || 'Producto';
                                return <li key={i}>{prodName}: ${c.monto}</li>;
                            })}
                            {u.comisiones.length > 3 && <li>... y {u.comisiones.length - 3} más</li>}
                        </ul>
                    </div>
                )}
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
