
import React, { useState, useMemo } from 'react';
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
    const isNumber = name === 'litros' || name === 'precio' || name === 'precioReventa';
    setFormData(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Producto);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{producto.id ? 'Editar' : 'Nuevo'} Producto</h2>
      
      <AppInput label="Nombre del Producto" name="nombre" value={formData.nombre || ''} onChange={handleChange} required placeholder="Ej: Bidón 20L Retornable" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AppSelect 
            label="Tipo" 
            name="tipo" 
            value={formData.tipo || ''} 
            onChange={handleChange} 
            options={[{value: "", label: "Seleccionar Tipo"}, ...Object.values(TipoProducto).map(t => ({value: t, label: t}))]} 
            required 
        />
        <AppInput label="Litros (Capacidad)" type="number" name="litros" value={formData.litros ?? ''} onChange={handleChange} required min="0" placeholder="0" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary-50/50 dark:bg-primary-900/10 p-4 rounded-lg border border-primary-100 dark:border-primary-800">
        <AppInput label="Precio de Lista (Público)" type="number" name="precio" value={formData.precio ?? ''} onChange={handleChange} required min="0" step="0.01" placeholder="0.00" className="!bg-white dark:!bg-gray-700"/>
        <AppInput label="Precio Reventa (Distribuidores)" type="number" name="precioReventa" value={formData.precioReventa ?? ''} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className="!bg-white dark:!bg-gray-700"/>
      </div>

      <div>
        <label htmlFor="color" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Color (para gráficos)</label>
        <div className="flex items-center gap-2">
          <input id="color" type="color" name="color" value={formData.color || '#3b82f6'} onChange={handleChange} className="h-10 w-20 rounded-md cursor-pointer border-0 p-0" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{formData.color || '#3b82f6'}</span>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton type="submit" variant="primary">Guardar Producto</AppButton>
      </div>
    </form>
  )
}

const ProductosView: React.FC<ProductosViewProps> = ({ productos, addProducto, updateProducto, deleteProducto, reactivarProducto }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Partial<Producto> | null>(null);
  const [productoParaBaja, setProductoParaBaja] = useState<Producto | null>(null);
  const [statusFilter, setStatusFilter] = useState<EstadoProducto | 'todos'>(EstadoProducto.ACTIVO);
  const { showNotification } = useNotification();

  const handleSave = (producto: Omit<Producto, 'id'> | Producto) => {
    try {
        if ('id' in producto && producto.id) {
          updateProducto(producto as Producto);
          showNotification('Producto actualizado con éxito.', 'success');
        } else {
          addProducto(producto as Omit<Producto, 'id'>);
          showNotification('Producto creado con éxito.', 'success');
        }
        setIsModalOpen(false);
    } catch (e) {
        showNotification('Error al guardar el producto.', 'error');
        console.error(e);
    }
  };

  const handleBajaConfirm = () => {
    if (!productoParaBaja) return;
    try {
        deleteProducto(productoParaBaja.id);
        showNotification('Producto dado de baja con éxito.', 'success');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al dar de baja el producto.';
        showNotification(message, 'error');
    }
    setProductoParaBaja(null);
  };

  const openNewModal = () => {
    setEditingProducto({
      nombre: '',
      tipo: TipoProducto.RETORNABLE,
      litros: 0,
      precio: 0,
      estado: EstadoProducto.ACTIVO,
      color: '#3b82f6'
    });
    setIsModalOpen(true);
  }

  const openEditModal = (producto: Producto) => {
    setEditingProducto(producto);
    setIsModalOpen(true);
  }

  const filteredProductos = useMemo(() => {
    let productosFiltrados = [...productos].sort((a,b) => a.nombre.localeCompare(b.nombre));
    if (statusFilter !== 'todos') {
      productosFiltrados = productosFiltrados.filter(p => p.estado === statusFilter);
    }
    return productosFiltrados;
  }, [productos, statusFilter]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Productos</h1>
        <AppButton onClick={openNewModal}>+ Nuevo Producto</AppButton>
      </div>

      <div className="flex items-center space-x-4 bg-gray-200 dark:bg-gray-700 p-2 rounded-lg w-fit shadow-inner">
        <span className="font-bold text-sm text-gray-600 dark:text-gray-300 ml-2">Mostrar:</span>
        <label className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors"><input type="radio" name="statusFilter" value="Activo" checked={statusFilter === 'Activo'} onChange={() => setStatusFilter(EstadoProducto.ACTIVO)} className="form-radio mr-1 text-primary-600" /> Activos</label>
        <label className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors"><input type="radio" name="statusFilter" value="Inactivo" checked={statusFilter === 'Inactivo'} onChange={() => setStatusFilter(EstadoProducto.INACTIVO)} className="form-radio mr-1 text-primary-600" /> Inactivos</label>
        <label className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors mr-2"><input type="radio" name="statusFilter" value="todos" checked={statusFilter === 'todos'} onChange={() => setStatusFilter('todos')} className="form-radio mr-1 text-primary-600" /> Todos</label>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3 w-10">Color</th>
                <th scope="col" className="px-6 py-3">Nombre</th>
                <th scope="col" className="px-6 py-3">Tipo</th>
                <th scope="col" className="px-6 py-3 text-right">P. Lista</th>
                <th scope="col" className="px-6 py-3 text-right">P. Reventa</th>
                <th scope="col" className="px-6 py-3">Estado</th>
                <th scope="col" className="px-6 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.map(producto => {
                const isInactive = producto.estado === EstadoProducto.INACTIVO;
                return (
                <tr key={producto.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-opacity ${isInactive ? 'opacity-60' : 'bg-white dark:bg-gray-800'}`}>
                  <td className="px-6 py-4">
                    <div className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm" style={{ backgroundColor: producto.color || '#ccc' }} title={producto.color}></div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap dark:text-white">{producto.nombre}</td>
                  <td className="px-6 py-4">{producto.tipo}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-800 dark:text-gray-200">${producto.precio.toLocaleString('es-AR')}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">
                      {producto.precioReventa ? `$${producto.precioReventa.toLocaleString('es-AR')}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${isInactive ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                        {producto.estado}
                     </span>
                   </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => openEditModal(producto)} className="text-blue-500 hover:text-blue-700 p-1"><PencilIcon /></button>
                    {isInactive ? (
                      <button 
                        onClick={() => {
                          reactivarProducto(producto.id);
                          showNotification('Producto reactivado.', 'success');
                        }}
                        className="text-green-500 hover:text-green-700 p-1"
                        title="Reactivar Producto"
                      >
                        <ReplyIcon />
                      </button>
                    ) : (
                      <button onClick={() => setProductoParaBaja(producto)} className="text-red-500 hover:text-red-700 p-1" title="Dar de Baja">
                          <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {filteredProductos.length === 0 && <p className="text-center py-4 text-gray-500">No hay productos que coincidan con el filtro.</p>}
        </div>
      </Card>
      
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <ProductoForm 
                producto={editingProducto || {}}
                onSave={handleSave}
                onClose={() => setIsModalOpen(false)}
            />
        </Modal>
      )}

      {productoParaBaja && (
        <Modal isOpen={!!productoParaBaja} onClose={() => setProductoParaBaja(null)}>
            <div className="p-4 text-center">
                 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <TrashIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Confirmar Baja</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    ¿Está seguro de que desea dar de baja <strong>"{productoParaBaja.nombre}"</strong>?
                    <br />
                    No podrá seleccionarlo en nuevos remitos.
                </p>
                <div className="flex justify-center space-x-4">
                    <AppButton variant="secondary" onClick={() => setProductoParaBaja(null)}>Cancelar</AppButton>
                    <AppButton variant="danger" onClick={handleBajaConfirm}>Sí, Dar de Baja</AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

export default ProductosView;
