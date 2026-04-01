import React, { useState, useEffect, useMemo } from 'react';
import { Contrato, Cliente, Producto, Servicio, Sucursal, TipoServicio, TipoProducto, EstadoContrato, EstadoServicio, EstadoProducto } from '../types';
import SearchableSelect from './SearchableSelect';
import AppButton from './ui/AppButton';
import AppInput from './ui/AppInput';
import AppSelect from './ui/AppSelect';
import { getLocalDateString } from '../utils/dateUtils';

interface ContratoFormProps {
  contrato?: Partial<Contrato>;
  clientes: Cliente[];
  productos: Producto[];
  servicios: Servicio[];
  onSave: (contrato: Omit<Contrato, 'id'> | Contrato) => void;
  onClose: () => void;
  fixedClienteId?: string;
  overrideSucursales?: Sucursal[];
}

const ContratoForm: React.FC<ContratoFormProps> = ({
  contrato = {},
  clientes,
  productos,
  servicios,
  onSave,
  onClose,
  fixedClienteId,
  overrideSucursales
}) => {
  const [formData, setFormData] = useState<Partial<Contrato>>({
      fechaInicio: getLocalDateString(),
      estado: EstadoContrato.ACTIVO,
      ...contrato
  });
  
  const [sucursalesCliente, setSucursalesCliente] = useState<Sucursal[]>([]);

  useEffect(() => {
    if (overrideSucursales) {
        setSucursalesCliente([...overrideSucursales].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else if (formData.clienteId) {
        const c = clientes.find(cli => cli.id === formData.clienteId);
        setSucursalesCliente([...(c?.sucursales || [])].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else {
        setSucursalesCliente([]);
    }
  }, [formData.clienteId, clientes, overrideSucursales]);

  useEffect(() => {
      if (fixedClienteId && formData.clienteId !== fixedClienteId) {
          setFormData(prev => ({ ...prev, clienteId: fixedClienteId }));
      }
  }, [fixedClienteId, formData.clienteId]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = ['montoMensual', 'consumoIncluido'].includes(name);
    setFormData(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
        const newState = { ...prev, [name]: value };
        if (name === 'clienteId' && !fixedClienteId) {
            newState.sucursalId = ''; 
        }
        return newState;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Contrato);
  };

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
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white pr-12">{formData.id ? 'Editar' : 'Nuevo'} Contrato</h2>
      
       <div>
          <SearchableSelect label="Servicio" options={servicioOptions} value={formData.servicioId || ''} onChange={(value) => handleSelectChange('servicioId', value)} placeholder="Seleccionar un Servicio..." />
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {fixedClienteId ? (
              <AppInput label="Cliente" type="text" disabled value={clientes.find(c => c.id === fixedClienteId)?.nombre || 'Cliente Actual'} />
          ) : (
              <SearchableSelect label="Cliente" options={clienteOptions} value={formData.clienteId || ''} onChange={(value) => handleSelectChange('clienteId', value)} placeholder="Seleccionar Cliente" />
          )}
        </div>
        <div>
          <AppSelect 
            label="Sucursal (Opcional)" 
            name="sucursalId" 
            value={formData.sucursalId || ''} 
            onChange={handleChange} 
            disabled={(!formData.clienteId && !fixedClienteId) || sucursalesCliente.length === 0}
            options={[
              { value: '', label: 'Casa Central / Sin especificar' },
              ...sucursalesCliente.map(s => ({ value: s.id, label: s.nombre }))
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <AppInput label="Fecha de Inicio" type="date" name="fechaInicio" value={formData.fechaInicio || ''} onChange={handleChange} required />
        </div>
         <div>
          <AppSelect 
            label="Estado" 
            name="estado" 
            value={formData.estado || ''} 
            onChange={handleChange} 
            required 
            options={Object.values(EstadoContrato).map(e => ({ value: e, label: e }))}
          />
        </div>
      </div>
      
      {showEquipo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SearchableSelect label="Equipo Asociado" options={equiposOptions} value={formData.productoId || ''} onChange={(value) => handleSelectChange('productoId', value)} placeholder="Seleccionar Equipo" />
            </div>
            <div>
              <AppInput label="Número de Serie (Opcional)" type="text" name="numeroSerie" placeholder="Ej: EQ-12345" value={formData.numeroSerie || ''} onChange={handleChange} />
            </div>
        </div>
      )}
      
      {showMonto && (
        <div>
          <AppInput label="Monto Mensual Fijo ($)" type="number" name="montoMensual" placeholder="5000" value={formData.montoMensual ?? ''} onChange={handleChange} required min="0" step="0.01" />
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

       <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Condiciones Especiales (Opcional)</label>
          <textarea name="condicionesEspeciales" value={formData.condicionesEspeciales || ''} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 outline-none" />
        </div>

      <div className="flex justify-end gap-2 pt-4">
        <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
        <AppButton variant="primary" type="submit">Guardar Contrato</AppButton>
      </div>
    </form>
  )
}

export default ContratoForm;