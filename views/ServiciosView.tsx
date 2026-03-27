import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Servicio, Producto, TipoServicio, TipoProducto, EstadoServicio, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import AppButton from '../components/ui/AppButton';

interface ServiciosViewProps {
  servicios: Servicio[];
  productos: Producto[];
  addServicio: (servicio: Omit<Servicio, 'id' | 'estado'>) => void;
  updateServicio: (servicio: Servicio) => void;
  deleteServicio: (servicioId: string) => void;
  reactivarServicio: (servicioId: string) => void;
}

const ServicioForm: React.FC<{
  servicio: Partial<Servicio>;
  productos: Producto[];
  onSave: (servicio: Omit<Servicio, 'id'> | Servicio) => void;
  onClose: () => void;
}> = ({ servicio, productos, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Servicio>>(servicio);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = ['montoMensual', 'consumoIncluido'].includes(name);
    setFormData(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData as Servicio);
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
  const equiposOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.EQUIPO).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);
  const consumoOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);

  const showEquipo = formData.tipo !== TipoServicio.SOLO_CONSUMO;
  const showMonto = formData.tipo === TipoServicio.ABONO_FIJO || formData.tipo === TipoServicio.ALQUILER_PURO;
  const showConsumo = formData.tipo === TipoServicio.ABONO_FIJO;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">{servicio.id ? 'Editar' : 'Nuevo'} Servicio</h2>
      
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Servicio</label>
        <input id="nombre" type="text" name="nombre" placeholder="Ej: Abono 4 Bidones" value={formData.nombre || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
      </div>

      <div>
        <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Servicio</label>
        <select id="tipo" name="tipo" value={formData.tipo || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
          <option value="">Seleccionar tipo</option>
          {Object.values(TipoServicio).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      
      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción (Opcional)</label>
        <textarea id="descripcion" name="descripcion" placeholder="Detalles del servicio..." value={formData.descripcion || ''} onChange={handleChange} rows={2} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
      </div>

      <fieldset className="border-t dark:border-gray-600 pt-4 space-y-4">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2 -mb-2">Valores por Defecto</legend>
        
        {showEquipo && (
          <div>
            <label htmlFor="productoId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipo por Defecto</label>
            <SearchableSelect options={equiposOptions} value={formData.productoId || ''} onChange={(value) => handleSelectChange('productoId', value)} placeholder="Seleccionar Equipo" />
          </div>
        )}
        
        {showMonto && (
          <div>
            <label htmlFor="montoMensual" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto Mensual por Defecto ($)</label>
            <input id="montoMensual" type="number" name="montoMensual" placeholder="5000" value={formData.montoMensual ?? ''} onChange={handleChange} min="0" step="0.01" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </div>
        )}

        {showConsumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="productoConsumoId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producto de Consumo</label>
              <SearchableSelect options={consumoOptions} value={formData.productoConsumoId || ''} onChange={(value) => handleSelectChange('productoConsumoId', value)} placeholder="Seleccionar Producto" />
            </div>
            <div>
              <label htmlFor="consumoIncluido" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad Incluida</label>
              <input id="consumoIncluido" type="number" name="consumoIncluido" placeholder="4" value={formData.consumoIncluido ?? ''} onChange={handleChange} min="0" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 pt-4">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit">Guardar Servicio <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>
  )
}

const ServiciosView: React.FC<ServiciosViewProps> = ({ servicios, productos, addServicio, updateServicio, deleteServicio, reactivarServicio }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServicio, setEditingServicio] = useState<Partial<Servicio> | null>(null);
  const [servicioParaBaja, setServicioParaBaja] = useState<Servicio | null>(null);
  const [statusFilter, setStatusFilter] = useState<EstadoServicio | 'todos'>(EstadoServicio.ACTIVO);
  const { showNotification } = useNotification();

  const handleSave = (servicio: Omit<Servicio, 'id'> | Servicio) => {
    try {
      if ('id' in servicio && servicio.id) {
        updateServicio(servicio as Servicio);
        showNotification('Servicio actualizado con éxito.', 'success');
      } else {
        addServicio(servicio as Omit<Servicio, 'id' | 'estado'>);
        showNotification('Servicio creado con éxito.', 'success');
      }
      setIsModalOpen(false);
    } catch (e) {
      showNotification('Error al guardar el servicio.', 'error');
      console.error(e);
    }
  };
  
  const handleBajaConfirm = () => {
    if (!servicioParaBaja) return;
    try {
        deleteServicio(servicioParaBaja.id);
        showNotification('Servicio dado de baja con éxito.', 'success');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al dar de baja el servicio.';
        showNotification(message, 'error');
    }
    setServicioParaBaja(null);
  };

  const openNewModal = useCallback(() => {
    setEditingServicio({ tipo: TipoServicio.COMODATO, estado: EstadoServicio.ACTIVO });
    setIsModalOpen(true);
  }, []);

  // FIX: Add missing openEditModal function
  const openEditModal = (servicio: Servicio) => {
    setEditingServicio(servicio);
    setIsModalOpen(true);
  };

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

  const filteredServicios = useMemo(() => {
    let serviciosFiltrados = [...servicios].sort((a,b) => a.nombre.localeCompare(b.nombre));
    if (statusFilter !== 'todos') {
      serviciosFiltrados = serviciosFiltrados.filter(s => s.estado === statusFilter);
    }
    return serviciosFiltrados;
  }, [servicios, statusFilter]);

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Servicios</h1>
        <AppButton onClick={openNewModal}>
          + Nuevo Servicio <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
        </AppButton>
      </div>
      
      <div className="flex items-center space-x-4 bg-gray-200 dark:bg-gray-700 p-2 rounded-md w-fit">
        <span className="font-medium text-sm">Mostrar:</span>
        <label className="flex items-center cursor-pointer text-sm"><input type="radio" name="statusFilter" value="Activo" checked={statusFilter === 'Activo'} onChange={() => setStatusFilter(EstadoServicio.ACTIVO)} className="form-radio mr-1 text-primary-600" /> Activos</label>
        <label className="flex items-center cursor-pointer text-sm"><input type="radio" name="statusFilter" value="Inactivo" checked={statusFilter === 'Inactivo'} onChange={() => setStatusFilter(EstadoServicio.INACTIVO)} className="form-radio mr-1 text-primary-600" /> Inactivos</label>
        <label className="flex items-center cursor-pointer text-sm"><input type="radio" name="statusFilter" value="todos" checked={statusFilter === 'todos'} onChange={() => setStatusFilter('todos')} className="form-radio mr-1 text-primary-600" /> Todos</label>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Nombre del Servicio</th>
                <th scope="col" className="px-6 py-3">Tipo</th>
                <th scope="col" className="px-6 py-3">Monto por Defecto</th>
                <th scope="col" className="px-6 py-3">Estado</th>
                <th scope="col" className="px-6 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredServicios.map(servicio => {
                const isInactive = servicio.estado === EstadoServicio.INACTIVO;
                return(
                <tr key={servicio.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-opacity ${isInactive ? 'opacity-60' : 'bg-white dark:bg-gray-800'}`}>
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{servicio.nombre}</td>
                  <td className="px-6 py-4">{servicio.tipo}</td>
                  <td className="px-6 py-4">
                    {servicio.montoMensual ? `$${servicio.montoMensual.toLocaleString('es-AR')}` : 'N/A'}
                  </td>
                   <td className="px-6 py-4">
                     <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isInactive ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                        {servicio.estado}
                     </span>
                   </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <AppButton 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openEditModal(servicio)} 
                        className="!p-2 border-transparent bg-transparent text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-none"
                        title="Editar Servicio"
                    >
                        <PencilIcon />
                    </AppButton>
                    {isInactive ? (
                      <AppButton 
                        variant="success" 
                        size="sm" 
                        onClick={() => {
                          reactivarServicio(servicio.id);
                          showNotification('Servicio reactivado.', 'success');
                        }}
                        className="!p-2 border-transparent bg-transparent text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 shadow-none"
                        title="Reactivar Servicio"
                      >
                        <ReplyIcon />
                      </AppButton>
                    ) : (
                      <AppButton 
                        variant="danger" 
                        size="sm" 
                        onClick={() => setServicioParaBaja(servicio)} 
                        className="!p-2 border-transparent bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-none"
                        title="Dar de Baja"
                      >
                          <TrashIcon />
                      </AppButton>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {filteredServicios.length === 0 && <p className="text-center py-4 text-gray-500">No hay servicios que coincidan con el filtro.</p>}
        </div>
      </Card>
      
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ServicioForm
            servicio={editingServicio || {}}
            productos={productos}
            onSave={handleSave}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}

      {servicioParaBaja && (
        <Modal isOpen={!!servicioParaBaja} onClose={() => setServicioParaBaja(null)}>
            <div className="p-4 text-center">
                 <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4 pr-12">Confirmar Baja de Servicio</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea dar de baja el servicio <strong>"{servicioParaBaja.nombre}"</strong>?
                    <br />
                    El servicio pasará a estado 'Inactivo' y no podrá ser seleccionado para nuevos contratos.
                </p>
                <div className="flex justify-center space-x-4">
                    <AppButton
                        variant="secondary"
                        onClick={() => setServicioParaBaja(null)}
                        className="px-6"
                    >
                        Cancelar
                    </AppButton>
                    <AppButton
                        variant="danger"
                        onClick={handleBajaConfirm}
                        className="px-6"
                    >
                        Sí, Dar de Baja
                    </AppButton>
                </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

export default ServiciosView;