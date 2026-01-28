
import React, { useState, useMemo } from 'react';
import { Servicio, Producto, TipoServicio, TipoProducto, EstadoServicio, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { ReplyIcon } from '../components/icons/ReplyIcon';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Servicio);
  };

  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);
  const equiposOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.EQUIPO).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);
  const consumoOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);


  const showEquipo = formData.tipo !== TipoServicio.SOLO_CONSUMO;
  const showMonto = formData.tipo === TipoServicio.ABONO_FIJO || formData.tipo === TipoServicio.ALQUILER_PURO;
  const showConsumo = formData.tipo === TipoServicio.ABONO_FIJO;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{servicio.id ? 'Editar' : 'Nuevo'} Servicio</h2>
      
      <AppInput label="Nombre del Servicio" name="nombre" placeholder="Ej: Abono 4 Bidones" value={formData.nombre || ''} onChange={handleChange} required />

      <AppSelect 
        label="Tipo de Servicio"
        name="tipo" 
        value={formData.tipo || ''} 
        onChange={handleChange} 
        options={[{value:"", label: "Seleccionar tipo"}, ...Object.values(TipoServicio).map(t => ({value: t, label: t}))]}
        required 
      />
      
      <AppTextarea label="Descripción (Opcional)" name="descripcion" placeholder="Detalles del servicio..." value={formData.descripcion || ''} onChange={handleChange} rows={2} />

      <fieldset className="border-t dark:border-gray-600 pt-4 space-y-4">
        <legend className="text-lg font-medium text-gray-800 dark:text-white px-2 -mb-2">Valores por Defecto</legend>
        
        {showEquipo && (
          <div>
            <SearchableSelect label="Equipo por Defecto" options={equiposOptions} value={formData.productoId || ''} onChange={(value) => handleSelectChange('productoId', value)} placeholder="Seleccionar Equipo" />
          </div>
        )}
        
        {showMonto && (
          <div>
            <AppInput label="Monto Mensual por Defecto ($)" type="number" name="montoMensual" placeholder="5000" value={formData.montoMensual ?? ''} onChange={handleChange} min="0" step="0.01" />
          </div>
        )}

        {showConsumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SearchableSelect label="Producto de Consumo" options={consumoOptions} value={formData.productoConsumoId || ''} onChange={(value) => handleSelectChange('productoConsumoId', value)} placeholder="Seleccionar Producto" />
            </div>
            <div>
              <AppInput label="Cantidad Incluida" type="number" name="consumoIncluido" placeholder="4" value={formData.consumoIncluido ?? ''} onChange={handleChange} min="0" />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex justify-end space-x-2 pt-4">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton type="submit">Guardar</AppButton>
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

  const openNewModal = () => {
    setEditingServicio({ tipo: TipoServicio.COMODATO, estado: EstadoServicio.ACTIVO });
    setIsModalOpen(true);
  };

  const openEditModal = (servicio: Servicio) => {
    setEditingServicio(servicio);
    setIsModalOpen(true);
  };
  
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
          + Nuevo Servicio
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
                    <button onClick={() => openEditModal(servicio)} className="text-blue-500 hover:text-blue-700 p-1"><PencilIcon /></button>
                    {isInactive ? (
                      <button 
                        onClick={() => {
                          reactivarServicio(servicio.id);
                          showNotification('Servicio reactivado.', 'success');
                        }}
                        className="text-green-500 hover:text-green-700 p-1"
                        title="Reactivar Servicio"
                      >
                        <ReplyIcon />
                      </button>
                    ) : (
                      <button onClick={() => setServicioParaBaja(servicio)} className="text-red-500 hover:text-red-700 p-1" title="Dar de Baja">
                          <TrashIcon />
                      </button>
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
                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4">Confirmar Baja de Servicio</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea dar de baja el servicio <strong>"{servicioParaBaja.nombre}"</strong>?
                    <br />
                    El servicio pasará a estado 'Inactivo' y no podrá ser seleccionado para nuevos contratos.
                </p>
                <div className="flex justify-center space-x-4">
                    <AppButton variant="secondary" onClick={() => setServicioParaBaja(null)}>
                        Cancelar
                    </AppButton>
                    <AppButton variant="danger" onClick={handleBajaConfirm}>
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
