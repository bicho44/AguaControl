import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Contrato, Cliente, Producto, TipoServicio, EstadoContrato, TipoProducto, Sucursal, Servicio, EstadoServicio, EstadoProducto } from '../types';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { PencilIcon } from '../components/icons/PencilIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/SearchableSelect';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import AppButton from '../components/ui/AppButton';

interface ContratosViewProps {
  contratos: Contrato[];
  clientes: Cliente[];
  productos: Producto[];
  servicios: Servicio[];
  addContrato: (contrato: Omit<Contrato, 'id'>) => void;
  updateContrato: (contrato: Contrato) => void;
  deleteContrato: (contratoId: string) => void;
}

const ContratoForm: React.FC<{
  contrato: Partial<Contrato>;
  clientes: Cliente[];
  productos: Producto[];
  servicios: Servicio[];
  onSave: (contrato: Omit<Contrato, 'id'> | Contrato) => void;
  onClose: () => void;
}> = ({ contrato, clientes, productos, servicios, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Contrato>>(contrato);
  const [sucursalesCliente, setSucursalesCliente] = useState<Sucursal[]>([]);

  useEffect(() => {
    if (formData.clienteId) {
      const clienteSeleccionado = clientes.find(c => c.id === formData.clienteId);
      setSucursalesCliente(clienteSeleccionado?.sucursales || []);
    } else {
      setSucursalesCliente([]);
    }
  }, [formData.clienteId, clientes]);

  useEffect(() => {
    if (formData.servicioId) {
        const servicioSeleccionado = servicios.find(s => s.id === formData.servicioId);
        if (servicioSeleccionado) {
            setFormData(prev => ({
                ...prev,
                tipo: servicioSeleccionado.tipo,
                productoId: servicioSeleccionado.productoId || prev.productoId,
                montoMensual: servicioSeleccionado.montoMensual ?? prev.montoMensual,
                productoConsumoId: servicioSeleccionado.productoConsumoId || prev.productoConsumoId,
                consumoIncluido: servicioSeleccionado.consumoIncluido ?? prev.consumoIncluido,
            }));
        }
    }
  }, [formData.servicioId, servicios]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumber = ['montoMensual', 'consumoIncluido'].includes(name);
    setFormData(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
        const newState = { ...prev, [name]: value };
        if (name === 'clienteId') {
            newState.sucursalId = ''; // Reset sucursal when client changes
        }
        return newState;
    });
  };

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData as Contrato);
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

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nombre })), [clientes]);
  const servicioOptions = useMemo(() => {
    const serviciosActivos = servicios.filter(s => s.estado === EstadoServicio.ACTIVO || s.id === formData.servicioId);
    return serviciosActivos.map(s => ({ value: s.id, label: s.nombre }));
  }, [servicios, formData.servicioId]);
  
  const productosActivos = useMemo(() => productos.filter(p => p.estado === EstadoProducto.ACTIVO), [productos]);
  const equiposOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.EQUIPO).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);
  const consumoOptions = useMemo(() => productosActivos.filter(p => p.tipo === TipoProducto.RETORNABLE || p.tipo === TipoProducto.DESCARTABLE).map(p => ({ value: p.id, label: p.nombre })), [productosActivos]);

  const showEquipo = formData.tipo !== TipoServicio.SOLO_CONSUMO;
  const showMonto = formData.tipo === TipoServicio.ABONO_FIJO || formData.tipo === TipoServicio.ALQUILER_PURO;
  const showConsumo = formData.tipo === TipoServicio.ABONO_FIJO;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{contrato.id ? 'Editar' : 'Nuevo'} Contrato</h2>
      
       <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servicio</label>
          <SearchableSelect options={servicioOptions} value={formData.servicioId || ''} onChange={(value) => handleSelectChange('servicioId', value)} placeholder="Seleccionar un Servicio..." />
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
          <SearchableSelect options={clienteOptions} value={formData.clienteId || ''} onChange={(value) => handleSelectChange('clienteId', value)} placeholder="Seleccionar Cliente" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sucursal (Opcional)</label>
          <select name="sucursalId" value={formData.sucursalId || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" disabled={!formData.clienteId || sucursalesCliente.length === 0}>
            <option value="">Casa Central / Sin especificar</option>
            {sucursalesCliente.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de Inicio</label>
          <input type="date" name="fechaInicio" value={formData.fechaInicio || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </div>
         <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
          <select name="estado" value={formData.estado || ''} onChange={handleChange} required className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
            {Object.values(EstadoContrato).map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>
      
      {showEquipo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipo Asociado</label>
              <SearchableSelect options={equiposOptions} value={formData.productoId || ''} onChange={(value) => handleSelectChange('productoId', value)} placeholder="Seleccionar Equipo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de Serie (Opcional)</label>
              <input type="text" name="numeroSerie" placeholder="Ej: EQ-12345" value={formData.numeroSerie || ''} onChange={handleChange} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
            </div>
        </div>
      )}
      
      {showMonto && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto Mensual Fijo ($)</label>
          <input type="number" name="montoMensual" placeholder="5000" value={formData.montoMensual ?? ''} onChange={handleChange} required min="0" step="0.01" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </div>
      )}

      {showConsumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producto de Consumo</label>
              <SearchableSelect options={consumoOptions} value={formData.productoConsumoId || ''} onChange={(value) => handleSelectChange('productoConsumoId', value)} placeholder="Seleccionar Producto" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad Incluida</label>
              <input type="number" name="consumoIncluido" placeholder="4" value={formData.consumoIncluido ?? ''} onChange={handleChange} required min="0" className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
            </div>
        </div>
      )}

       <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condiciones Especiales (Opcional)</label>
          <textarea name="condicionesEspeciales" value={formData.condicionesEspeciales || ''} onChange={(e) => setFormData(prev => ({ ...prev, condicionesEspeciales: e.target.value }))} rows={3} className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </div>

      <div className="flex justify-end gap-2 pt-4">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit">Guardar Contrato <span className="opacity-60 text-[10px] ml-1 font-normal">(Ctrl+Enter)</span></AppButton>
      </div>
    </form>
  )
}

const ContratosView: React.FC<ContratosViewProps> = ({ contratos, clientes, productos, servicios, addContrato, updateContrato, deleteContrato }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Partial<Contrato> | null>(null);
  const [filter, setFilter] = useState('');
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
  const { showNotification } = useNotification();
  const [contratoParaBorrar, setContratoParaBorrar] = useState<Contrato | null>(null);

  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const serviciosMap = useMemo(() => new Map(servicios.map(s => [s.id, s])), [servicios]);

  const contratosAgrupados = useMemo(() => {
    const agrupados: { [clienteId: string]: Contrato[] } = {};
    contratos.forEach(contrato => {
      if (!agrupados[contrato.clienteId]) {
        agrupados[contrato.clienteId] = [];
      }
      agrupados[contrato.clienteId].push(contrato);
    });
    return Object.entries(agrupados)
      .map(([clienteId, contratosCliente]) => ({
        cliente: clientesMap.get(clienteId),
        contratos: contratosCliente.sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()),
      }))
      .filter(group => group.cliente);
  }, [contratos, clientesMap]);
  
  const filteredData = useMemo(() => {
    if (!filter) return contratosAgrupados;
    return contratosAgrupados.filter(group => 
      group.cliente?.nombre.toLowerCase().includes(filter.toLowerCase())
    );
  }, [contratosAgrupados, filter]);

  const handleSave = (contrato: Omit<Contrato, 'id'> | Contrato) => {
    try {
      if ('id' in contrato && contrato.id) {
        updateContrato(contrato as Contrato);
        showNotification('Contrato actualizado con éxito.', 'success');
      } else {
        addContrato(contrato as Omit<Contrato, 'id'>);
        showNotification('Contrato creado con éxito.', 'success');
      }
      setIsModalOpen(false);
    } catch (e) {
      showNotification('Error al guardar el contrato.', 'error');
      console.error(e);
    }
  };

  const openNewModal = useCallback(() => {
    setEditingContrato({
      fechaInicio: new Date().toISOString().split('T')[0],
      estado: EstadoContrato.ACTIVO,
    });
    setIsModalOpen(true);
  }, []);

  const openEditModal = (contrato: Contrato) => {
    setEditingContrato(contrato);
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
  
  const toggleClientExpansion = (clienteId: string) => {
    setExpandedClientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Contratos de Servicio</h1>
        <AppButton onClick={openNewModal}>
          + Nuevo Contrato <span className="opacity-60 text-[10px] ml-1 font-normal">(Alt+N)</span>
        </AppButton>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 bg-gray-200 dark:bg-gray-700 rounded-md"
          />
        </div>
        <div className="space-y-2 p-2">
          {filteredData.map(({ cliente, contratos: contratosCliente }) => {
              if (!cliente) return null;
              const isExpanded = expandedClientIds.has(cliente.id);
              return (
                 <div key={cliente.id} className="bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700">
                    <div className="flex items-center p-4 cursor-pointer" onClick={() => toggleClientExpansion(cliente.id)}>
                        <div className="flex-grow">
                            <h3 className="font-medium text-lg text-gray-900 dark:text-white">{cliente.nombre}</h3>
                            <p className="text-sm text-gray-500">{contratosCliente.length} contrato(s)</p>
                        </div>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                     {isExpanded && (
                        <div className="border-t dark:border-gray-700 p-4">
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Servicio</th>
                                            <th scope="col" className="px-4 py-3">Sucursal</th>
                                            <th scope="col" className="px-4 py-3">Equipo</th>
                                            <th scope="col" className="px-4 py-3">Inicio</th>
                                            <th scope="col" className="px-4 py-3">Estado</th>
                                            <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    {contratosCliente.map(contrato => {
                                        const sucursal = cliente.sucursales.find(s => s.id === contrato.sucursalId);
                                        const servicio = serviciosMap.get(contrato.servicioId);
                                        return (
                                        <tr key={contrato.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{servicio?.nombre || 'N/A'}</td>
                                            <td className="px-4 py-3">{sucursal?.nombre || 'Casa Central'}</td>
                                            <td className="px-4 py-3">{productosMap.get(contrato.productoId || '')?.nombre || '-'}</td>
                                            <td className="px-4 py-3">{new Date(contrato.fechaInicio + 'T00:00:00').toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${contrato.estado === EstadoContrato.ACTIVO ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                                                    {contrato.estado}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); openEditModal(contrato); }} className="text-blue-500 hover:text-blue-700 p-1"><PencilIcon /></button>
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContratoParaBorrar(contrato);
                                                }} className="text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>
                                            </td>
                                        </tr>
                                    )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                     )}
                 </div>
              )
          })}
          {filteredData.length === 0 && <p className="text-center py-4 text-gray-500">No se encontraron contratos con los filtros aplicados.</p>}
        </div>
      </Card>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ContratoForm
            contrato={editingContrato || {}}
            clientes={clientes}
            productos={productos}
            servicios={servicios}
            onSave={handleSave}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}

      {contratoParaBorrar && (
        <Modal isOpen={!!contratoParaBorrar} onClose={() => setContratoParaBorrar(null)}>
            <div className="p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-4">Confirmar Eliminación</h2>
                <p className="text-gray-600 dark:text-gray-300 my-4">
                    ¿Está seguro de que desea eliminar este contrato?
                    <br />
                    Esta acción no afectará a las facturas ya generadas, pero el servicio no se considerará para futuras facturaciones.
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={() => setContratoParaBorrar(null)}
                        className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (!contratoParaBorrar) return;
                            try {
                                deleteContrato(contratoParaBorrar.id);
                                showNotification('Contrato eliminado con éxito.', 'success');
                            } catch (e) {
                                showNotification('Error al eliminar the contrato.', 'error');
                                console.error(e);
                            }
                            setContratoParaBorrar(null);
                        }}
                        className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                        Sí, Eliminar
                    </button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ContratosView;