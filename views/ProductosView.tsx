import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Producto, TipoProducto, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';

interface ProductosViewProps {
  productos: Producto[];
  addProducto: (producto: Omit<Producto, 'id' | 'estado'>) => void;
  updateProducto: (producto: Producto) => void;
  deleteProducto: (productoId: string) => void;
  reactivarProducto: (productoId: string) => void;
}

const ProductoForm: React.FC<{
  producto: Partial<Producto>;
  onSave: (producto: Omit<Producto, 'id'> | Producto) => void;
  onClose: () => void;
}> = ({ producto, onSave, onClose }) => {
  const [formData, setFormData] = useState(producto);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNum = name === 'litros' || name === 'precio' || name === 'precioReventa' || name === 'stockPlanta' || name === 'stockEnvases';
    setFormData(prev => ({ ...prev, [name]: isNum ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData as Producto);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter pr-12">Ficha de Producto</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
                <AppInput label="Nombre del Producto" name="nombre" value={formData.nombre || ''} onChange={handleChange} required />
            </div>
            <AppInput label="Abreviatura (Gráficos)" name="abreviatura" value={formData.abreviatura || ''} onChange={handleChange} placeholder="Ej: B20L" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <AppSelect label="Tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} options={Object.values(TipoProducto).map(t=>({value:t, label:t}))} required />
            <AppInput label="Capacidad (Litros)" type="number" name="litros" value={formData.litros ?? ''} onChange={handleChange} required />
        </div>
        <Card title="Precios Sugeridos">
            <div className="grid grid-cols-2 gap-4">
                <AppInput label="Precio Lista" type="number" name="precio" value={formData.precio ?? ''} onChange={handleChange} step="0.01" required />
                <AppInput label="Precio Reventa" type="number" name="precioReventa" value={formData.precioReventa ?? ''} onChange={handleChange} step="0.01" />
            </div>
        </Card>
        <Card title="Stock Inicial en Planta">
            <div className="grid grid-cols-2 gap-4">
                <AppInput label="Stock Llenos" type="number" name="stockPlanta" value={formData.stockPlanta ?? ''} onChange={handleChange} />
                {formData.tipo === TipoProducto.RETORNABLE && (
                    <AppInput label="Stock Envases Vacíos" type="number" name="stockEnvases" value={formData.stockEnvases ?? ''} onChange={handleChange} />
                )}
            </div>
        </Card>
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border dark:border-gray-600">
            <label className="text-xs font-black text-gray-500 uppercase px-1">Color en Gráficos</label>
            <input type="color" name="color" value={formData.color || '#3b82f6'} onChange={handleChange} className="h-10 w-20 rounded-xl cursor-pointer border-0 p-1 bg-white shadow-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit" className="px-12">Guardar Producto <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>
  )
}

const ProductosView: React.FC<ProductosViewProps> = ({ productos, addProducto, updateProducto, deleteProducto, reactivarProducto }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Partial<Producto> | null>(null);
  const [statusFilter, setStatusFilter] = useState<EstadoProducto | 'todos'>(EstadoProducto.ACTIVO);
  const { showNotification } = useNotification();

  const handleSave = (p: Omit<Producto, 'id'> | Producto) => {
    try {
        if ('id' in p) updateProducto(p as Producto);
        else addProducto(p as Omit<Producto, 'id'>);
        showNotification('Guardado.', 'success');
        setIsModalOpen(false);
    } catch (e) { showNotification('Error.', 'error'); }
  };

  const openNewModal = useCallback(() => {
    setEditingProducto({estado: EstadoProducto.ACTIVO, color: '#3b82f6'});
    setIsModalOpen(true);
  }, []);

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

  const filteredProductos = useMemo(() => {
    let list = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre));
    return statusFilter === 'todos' ? list : list.filter(p => p.estado === statusFilter);
  }, [productos, statusFilter]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Productos</h1>
        <AppButton onClick={openNewModal}>
            + Nuevo Producto <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
        </AppButton>
      </div>
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit border dark:border-gray-700 shadow-sm">
        {['Activo', 'Inactivo', 'todos'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>{s.toUpperCase()}</button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50">
              <tr><th className="px-6 py-3 w-10">Icon</th><th className="px-6 py-3">Nombre</th><th className="px-6 py-3 text-right">Lista</th><th className="px-6 py-3 text-right">Reventa</th><th className="px-6 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {filteredProductos.map(p => (
                <tr key={p.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/50 ${p.estado === 'Inactivo' ? 'opacity-40' : ''}`}>
                  <td className="px-6 py-4"><div className="w-5 h-5 rounded-full border" style={{ backgroundColor: p.color || '#ccc' }}></div></td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{p.nombre}</td>
                  <td className="px-6 py-4 text-right font-mono">${p.precio.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-green-600">${(p.precioReventa || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => {setEditingProducto(p); setIsModalOpen(true);}} className="text-primary-600 p-2 hover:bg-primary-50 rounded-full"><PencilIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}><ProductoForm producto={editingProducto || {}} onSave={handleSave} onClose={() => setIsModalOpen(false)} /></Modal>}
    </div>
  )
}

export default ProductosView;